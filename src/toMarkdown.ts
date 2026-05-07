import { UTCDate } from '@date-fns/utc';
import { getMonth } from 'date-fns/getMonth';
import { getYear } from 'date-fns/getYear';
import type { Post } from './model.ts';

export function toMarkdown(post: Post) {
    const publishedDate = new UTCDate(post.createdAt);
    const year = getYear(publishedDate);
    const month = `${getMonth(publishedDate) + 1}`.padStart(2, '0');

    return `---
slug: ${year}/${month}/${post.slug}
title: "${post.title.replaceAll('"', '\\"')}"
createdAt: ${new UTCDate(post.createdAt)}
modifiedAt: ${new UTCDate(post.modifiedAt)}
thumbnail: ${post.thumbnailUrl ?? ''}
categories: 
${post.categories.map(({ text }) => `- ${text}`).join('\n')}
---
${post.content}`;
}
