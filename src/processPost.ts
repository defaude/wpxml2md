import { basename, join } from '@std/path';
import { load } from 'cheerio';
import { toMarkdown } from './toMarkdown.ts';
import { Post } from './model.ts';
import { downloadImage, downloadVideo } from './downloadMedia.ts';

export async function processPost(post: Post, site: string, attachments: Record<string, string>, dryRun = false) {
    const publishedDate = Temporal.Instant.from(post.createdAt).toZonedDateTimeISO('UTC');
    const year = publishedDate.year;
    const month = `${publishedDate.month}`.padStart(2, '0');

    const postFolder = join('output', `${year}`, month, post.slug);
    const mediaFolder = join(postFolder, 'media');
    if (!dryRun) {
        await Deno.mkdir(join('output', `${year}`, month), { recursive: true });
        // Exclusive creation protects existing posts even when this function is called directly.
        await Deno.mkdir(postFolder);
        await Deno.mkdir(mediaFolder);
    }
    console.log(`${dryRun ? '[dry-run] ' : ''}Processing post "${post.slug}"`);

    // download thumbnail
    const thumbnailUrl = post.thumbnailId ? attachments[post.thumbnailId] : undefined;
    if (thumbnailUrl) {
        try {
            post.thumbnailUrl = await downloadImage(thumbnailUrl, mediaFolder, postFolder, dryRun);
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
        const imagePath = await downloadImage(src, mediaFolder, postFolder, dryRun);
        const imageString = `[![${alt}](${imagePath})](${imagePath})`;
        $link.replaceWith(imageString);
    }

    // replace img tags with markdown images
    for (const img of $('img')) {
        const $img = $(img);
        const src = $img.attr('src') as string;
        const alt = $img.attr('alt') || basename(src);
        if (src.startsWith(site)) {
            const imagePath = await downloadImage(src, mediaFolder, postFolder, dryRun);
            const imageString = `![${alt}](${imagePath})`;
            $img.replaceWith(imageString);
        }
    }

    // clean up video tags
    for (const figure of $('figure.wp-block-video')) {
        const $figure = $(figure);
        const src = $figure.find('video').attr('src') as string;
        const videoPath = await downloadVideo(src, mediaFolder, postFolder, dryRun);
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

    // strip remaining <figure> tags
    for (const figure of $('figure')) {
        const $figure = $(figure);
        $figure.replaceWith($figure.contents());
    }

    // replace <ul> with markdown lists
    for (const ul of $('ul')) {
        const $ul = $(ul);
        const items = $ul.find('li').map((_, li) => `- ${$(li).contents()}`).get().join('\n');
        $ul.replaceWith(items);
    }

    // replace <strong> and <b> tags with markdown bold
    for (const strong of $('strong, b')) {
        const $strong = $(strong);
        $strong.replaceWith(`**${$strong.contents()}**`);
    }

    // replace <em> tags with markdown italic
    for (const em of $('em')) {
        const $em = $(em);
        $em.replaceWith(`*${$em.contents()}*`);
    }

    // replace <s> tags with markdown strikethrough
    for (const s of $('s')) {
        const $s = $(s);
        $s.replaceWith(`~~${$s.contents()}~~`);
    }

    // replace html headings with markdown headings
    for (const h of $('h1, h2, h3, h4, h5, h6')) {
        const $h = $(h);
        $h.replaceWith(`# ${$h.contents()}`);
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

    const markdown = toMarkdown(post);
    if (!dryRun) await Deno.writeTextFile(join(postFolder, 'index.md'), markdown);
    return markdown;
}
