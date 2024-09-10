import { mkdir, rm, writeFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { UTCDate } from '@date-fns/utc';
import { load } from 'cheerio';
import { getMonth } from 'date-fns/getMonth';
import { getYear } from 'date-fns/getYear';
import { downloadImage } from './downloadImage';
import { site } from './importJson';
import { type Post, attachments, posts } from './items';
import { toMarkdown } from './toMarkdown';

const outputBase = '../output/';
const outputFolder = new URL(outputBase, import.meta.url);

console.info('purging output folder');
await rm(outputFolder, { recursive: true, force: true });

for (const post of posts.values()) {
    await processPost(post, site);
}

async function processPost(post: Post, site: string) {
    console.info(`processing post "${post.slug}"`);

    const publishedDate = new UTCDate(post.createdAt);
    const year = getYear(publishedDate);
    const month = `${getMonth(publishedDate) + 1}`.padStart(2, '0');

    const postFolder = new URL(`./${year}/${month}/${post.slug}/`, outputFolder);
    const imageFolder = new URL('img/', postFolder);
    await mkdir(imageFolder, { recursive: true });

    // download thumbnail
    const thumbnailUrl = attachments.get(post.thumbnailId)?.url;
    if (thumbnailUrl) {
        try {
            await downloadImage(thumbnailUrl, imageFolder);
            post.thumbnailUrl = `./img/${basename(thumbnailUrl)}`;
        } catch (e) {
            console.error('Could not download thumbnail', e);
        }
    }

    // go through all images & links with images, download & replace in post.content
    const $ = load(post.content, {}, false);

    const imagesToLoad: string[] = [];

    $('a:has(img)').replaceWith((_, element) => {
        const $this = load(element);
        const href = $this('a').attr('href');
        const hrefWithoutExtension = removeFileExtension(href);
        const $img = $this('img');
        const src = $img.attr('src');
        const alt = $img.attr('alt') || basename(href);

        if (src.startsWith(hrefWithoutExtension)) {
            imagesToLoad.push(href);
            const filename = basename(href);
            return `[![${alt}](./img/${filename})](./img/${filename})`;
        }

        return element;
    });

    $('img').replaceWith((_, element) => {
        const $this = load(element);
        const $img = $this('img');
        const src = $img.attr('src');
        const filename = basename(src);
        const alt = $img.attr('alt') || filename;

        if (src.startsWith(site)) {
            imagesToLoad.push(src);
            return `![${alt}](./img/${filename})`;
        }

        return element;
    });

    await Promise.all(imagesToLoad.map(img => downloadImage(img, imageFolder)));

    post.content = $.html();

    await writeFile(new URL('index.mdx', postFolder), toMarkdown(post));
}

function removeFileExtension(url: string): string {
    const extension = extname(url);
    return url.slice(0, -extension.length);
}
