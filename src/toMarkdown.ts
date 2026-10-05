import { stringify } from '@std/yaml';
import type { Post } from './model.ts';

export function toMarkdown(post: Post) {
    const publishedDate = Temporal.Instant.from(post.createdAt).toZonedDateTimeISO('UTC');
    const year = publishedDate.year;
    const month = `${publishedDate.month}`.padStart(2, '0');
    const metadata = stringify({
        slug: `${year}/${month}/${post.slug}`,
        title: post.title,
        createdAt: publishedDate.toInstant().toString({ fractionalSecondDigits: 3 }),
        modifiedAt: Temporal.Instant.from(post.modifiedAt).toString({ fractionalSecondDigits: 3 }),
        thumbnail: post.thumbnailUrl ?? '',
        categories: post.categories.map(({ text }) => text),
    });
    return `---\n${metadata}---\n${post.content}`;
}
