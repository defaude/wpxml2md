import { basename, extname, join } from '@std/path';
import { UTCDate } from '@date-fns/utc';
import { getMonth } from 'date-fns/getMonth';
import { getYear } from 'date-fns/getYear';
import { load } from 'cheerio';
// import { downloadImage } from './downloadImage.ts';
import { toMarkdown } from './toMarkdown.ts';
import { Post } from './model.ts';

export async function processPost(post: Post, site: string, attachments: Record<string, string>) {
    console.log(`processing post "${post.slug}"`);

    const publishedDate = new UTCDate(post.createdAt);
    const year = getYear(publishedDate);
    const month = `${getMonth(publishedDate) + 1}`.padStart(2, '0');

    const postFolder = join('output', `${year}`, month, post.slug);
    const imageFolder = join(postFolder, 'img');
    await Deno.mkdir(imageFolder, { recursive: true });

    // download thumbnail
    const thumbnailUrl = post.thumbnailId ? attachments[post.thumbnailId] : undefined;
    if (thumbnailUrl) {
        try {
            // await downloadImage(thumbnailUrl, imageFolder);
            post.thumbnailUrl = `./img/${basename(thumbnailUrl)}`;
        } catch (e) {
            console.error('Could not download thumbnail', e);
        }
    }

    const $ = load(post.content, {}, false);

    const imagesToLoad: string[] = [];

    // replace links to images with thumbnails with links to full image
    $('a:has(img)').replaceWith((_, element) => {
        const $this = load(element);
        const href = $this('a').attr('href') as string;
        const hrefWithoutExtension = removeFileExtension(href);
        const $img = $this('img');
        const src = $img.attr('src') as string;
        const alt = $img.attr('alt') || basename(href);

        if (src.startsWith(hrefWithoutExtension)) {
            imagesToLoad.push(href);
            const filename = basename(href);
            return `[![${alt}](./img/${filename})](./img/${filename})`;
        }

        return element;
    });

    // replace img tags with markdown images
    $('img').replaceWith((_, element) => {
        const $this = load(element);
        const $img = $this('img');
        const src = $img.attr('src') as string;
        const filename = basename(src);
        const alt = $img.attr('alt') || filename;

        if (src.startsWith(site)) {
            imagesToLoad.push(src);
            return `![${alt}](./img/${filename})`;
        }

        return element;
    });

    // await Promise.all(imagesToLoad.map((img) => downloadImage(img, imageFolder)));

    // replace text-only links with simple markdown links
    $('a:not(:has(*))').replaceWith((_, element) => {
        const $this = load(element);
        const $a = $this('a');
        const href = $a.attr('href');
        const text = $a.text();
        return `[${text}](${href})`;
    });

    post.content = $.html();

    using file = await Deno.create(join(postFolder, 'index.md'));
    await file.write(new TextEncoder().encode(toMarkdown(post)));
}

function removeFileExtension(url: string): string {
    const extension = extname(url);
    return url.slice(0, -extension.length);
}
