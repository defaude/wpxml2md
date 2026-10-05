import { basename } from '@std/path';
import type { Element, Root } from 'hast';
import { downloadImage, downloadVideo } from './downloadMedia.ts';
import { unThumbnail } from './unThumbnail.ts';

const imageExtension = /\.(?:avif|gif|jpe?g|png|svg|webp|bmp|tiff?)$/i;

/** Localize media attributes in place, retaining element structure and article-link destinations. */
export async function prepareMedia(
    root: Root,
    site: string,
    mediaFolder: string,
    postFolder: string,
    thumbnailUrl: string | undefined,
    dryRun = false,
): Promise<string | undefined> {
    const images = new Map<string, Promise<string>>();
    const videos = new Map<string, Promise<string>>();
    const links = new WeakSet<Element>();
    function remoteUrl(value: unknown): string | undefined {
        if (typeof value !== 'string' || !value) return undefined;
        const url = new URL(value, site);
        return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined;
    }
    function image(url: string): Promise<string> {
        if (!images.has(url)) images.set(url, downloadImage(url, mediaFolder, postFolder, dryRun));
        return images.get(url)!;
    }
    function video(url: string): Promise<string> {
        if (!videos.has(url)) videos.set(url, downloadVideo(url, mediaFolder, postFolder, dryRun));
        return videos.get(url)!;
    }

    const thumbnail = remoteUrl(thumbnailUrl);
    const localizedThumbnail = thumbnail ? await image(thumbnail) : thumbnailUrl;

    async function visit(node: Element | Root, link?: Element, inVideo = false) {
        if (node.type === 'element') {
            if (node.tagName === 'a') link = node;
            if (node.tagName === 'video') {
                inVideo = true;
                const poster = remoteUrl(node.properties.poster);
                if (poster) node.properties.poster = await image(poster);
            }
            if (node.tagName === 'img') {
                const src = remoteUrl(node.properties.src);
                if (src) {
                    const path = await image(src);
                    node.properties.src = path;
                    // The chosen full-sized/fallback file replaces remote responsive variants.
                    delete node.properties.srcSet;
                    delete node.properties.sizes;
                    node.properties.alt ??= basename(new URL(src).pathname);
                    const href = remoteUrl(link?.properties.href);
                    if (link && href && !links.has(link)) {
                        links.add(link);
                        if (href === src || href === unThumbnail(src)) {
                            link.properties.href = path;
                        } else if (imageExtension.test(new URL(href).pathname)) {
                            link.properties.href = await image(href);
                        }
                    }
                }
            }
            if (inVideo && ['video', 'source'].includes(node.tagName)) {
                const src = remoteUrl(node.properties.src);
                if (src) node.properties.src = await video(src);
            }
        }
        for (const child of node.children) {
            if (child.type === 'element') await visit(child, link, inVideo);
        }
    }
    await visit(root);
    return localizedThumbnail;
}
