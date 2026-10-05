import { stringify } from '@std/yaml';
import type { Post } from './model.ts';

export function toMarkdown(post: Post) {
    const publishedDate = new Date(post.createdAt);
    const year = publishedDate.getUTCFullYear();
    const month = `${publishedDate.getUTCMonth() + 1}`.padStart(2, '0');
    const metadata = stringify({
        slug: `${year}/${month}/${post.slug}`,
        title: post.title,
        createdAt: publishedDate.toISOString(),
        modifiedAt: new Date(post.modifiedAt).toISOString(),
        thumbnail: post.thumbnailUrl ?? '',
        categories: post.categories.map(({ text }) => text),
    });
    return `---\n${metadata}---\n${post.content}`;
}
