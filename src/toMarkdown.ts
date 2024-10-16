import { UTCDate } from '@date-fns/utc';
import type { Post } from './model.ts';

export function toMarkdown(post: Post) {
    return `---
slug: ${post.slug}
title: ${post.title}
createdAt: ${new UTCDate(post.createdAt)}
modifiedAt: ${new UTCDate(post.modifiedAt)}
thumbnail: ${post.thumbnailUrl ?? ''}
categories: 
${post.categories.map(({ name, text }) => `- ${name}: ${text}`).join('\n')}
---
${post.content}`; // todo: remove comment nodes, remove superfluous html, maybe?
}
