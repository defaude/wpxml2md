import { basename, join } from '@std/path';
import { UTCDate } from '@date-fns/utc';
import { getMonth } from 'date-fns/getMonth';
import { getYear } from 'date-fns/getYear';
import { load } from 'cheerio';
import { toMarkdown } from './toMarkdown.ts';
import { Post } from './model.ts';
import { downloadImage, downloadVideo } from './downloadMedia.ts';

export async function processPost(post: Post, site: string, attachments: Record<string, string>) {
    const publishedDate = new UTCDate(post.createdAt);
    const year = getYear(publishedDate);
    const month = `${getMonth(publishedDate) + 1}`.padStart(2, '0');

    const postFolder = join('output', `${year}`, month, post.slug);
    const alreadyExists = await Deno.stat(postFolder).then(() => true).catch(() => false);
    if (alreadyExists) {
        console.warn(`Post "${post.slug}" already exists, skipping`);
        return;
    }

    console.log(`Processing post "${post.slug}"`);

    const mediaFolder = join(postFolder, 'media');
    await Deno.mkdir(mediaFolder, { recursive: true });

    // download thumbnail
    const thumbnailUrl = post.thumbnailId ? attachments[post.thumbnailId] : undefined;
    if (thumbnailUrl) {
        try {
            post.thumbnailUrl = await downloadImage(thumbnailUrl, mediaFolder, postFolder);
        } catch (e) {
            console.error('  ❌Could not download thumbnail', e);
        }
    }

    const $ = load(post.content, {}, false);

    // replace links to images with thumbnails with links to full image
    for (const link of $('a:has(img)')) {
        const $link = $(link);
        const $img = $link.find('img');
        const src = $img.attr('src') as string;
        const alt = $img.attr('alt') ?? '';
        const imagePath = await downloadImage(src, mediaFolder, postFolder);
        const imageString = `[![${alt}](${imagePath})](${imagePath})`;
        $link.replaceWith(imageString);
    }

    // replace img tags with markdown images
    for (const img of $('img')) {
        const $img = $(img);
        const src = $img.attr('src') as string;
        const alt = $img.attr('alt') || basename(src);
        if (src.startsWith(site)) {
            const imagePath = await downloadImage(src, mediaFolder, postFolder);
            const imageString = `![${alt}](${imagePath})`;
            $img.replaceWith(imageString);
        }
    }

    // clean up video tags
    for (const figure of $('figure.wp-block-video')) {
        const $figure = $(figure);
        const src = $figure.find('video').attr('src') as string;
        const videoPath = await downloadVideo(src, mediaFolder, postFolder);
        const videoString = `<video controls src="${videoPath}"></video>`;
        $figure.replaceWith(videoString);
    }

    // replace text-only links with simple markdown links
    for (const a of $('a:not(:has(*))')) {
        const $a = $(a);
        const href = $a.attr('href') as string;
        const text = $a.text();
        $a.replaceWith(`[${text}](${href})`);
    }

    // strip <p> and <figure class="wp-block-image"> tags
    for (const thing of $('p, figure.wp-block-image')) {
        const $thing = $(thing);
        $thing.replaceWith($thing.contents());
    }

    // strip <figure class="wp-block-gallery"> tags
    for (const figure of $('figure.wp-block-gallery')) {
        const $figure = $(figure);
        $figure.replaceWith($figure.contents());
    }

    // replace <strong> and <b> tags with markdown bold
    for (const strong of $('strong, b')) {
        const $strong = $(strong);
        $strong.replaceWith(`**${$strong.contents()}**`);
    }

    // replace <s> tags with markdown strikethrough
    for (const s of $('s')) {
        const $s = $(s);
        $s.replaceWith(`~~${$s.contents()}~~`);
    }

    // remove comments
    // based on https://github.com/cheeriojs/cheerio/issues/214
    const $wrapped = load(`<div>${$.html()}</div>`);

    $wrapped.root().find('*').contents().each(function () {
        if (this.type === 'comment') {
            $(this).remove();
        }
    });

    // output cleaned up content
    post.content = $wrapped.root().find('body > div').html()!.trim()
        .replaceAll('\n\n\n\n', '\n\n')
        .replaceAll('\n\n\n', '\n\n');

    using file = await Deno.create(join(postFolder, 'index.md'));
    await file.write(new TextEncoder().encode(toMarkdown(post)));
}
