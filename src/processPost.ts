import { join } from '@std/path';
import { toMarkdown } from './toMarkdown.ts';
import type { Post } from './model.ts';
import { htmlTreeToMarkdown, parseHtml } from './htmlToMarkdown.ts';
import { prepareMedia } from './prepareMedia.ts';

export async function processPost(post: Post, site: string, attachments: Record<string, string>, dryRun = false) {
    const publishedDate = Temporal.Instant.from(post.createdAt).toZonedDateTimeISO('UTC');
    const year = publishedDate.year;
    const month = `${publishedDate.month}`.padStart(2, '0');
    const day = `${publishedDate.day}`.padStart(2, '0');

    const postFolder = join('output', `${year}`, month, `${day}_${post.slug}`);
    const mediaFolder = join(postFolder, 'media');
    await Deno.mkdir(postFolder, { recursive: true });
    if (!dryRun) await Deno.mkdir(mediaFolder, { recursive: true });
    console.log(`${dryRun ? '[dry-run] ' : ''}Processing post "${post.slug}"`);

    const tree = parseHtml(post.content);
    const thumbnailUrl = await prepareMedia(
        tree,
        site,
        mediaFolder,
        postFolder,
        post.thumbnailId ? attachments[post.thumbnailId] : undefined,
        dryRun,
    );
    const markdown = toMarkdown({
        ...post,
        thumbnailUrl: thumbnailUrl ?? post.thumbnailUrl,
        content: htmlTreeToMarkdown(tree),
    });
    await Deno.writeTextFile(join(postFolder, 'index.md'), markdown);
    return markdown;
}
