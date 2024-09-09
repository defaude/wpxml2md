import { UTCDate } from '@date-fns/utc';
import type { Post } from './items';

export function toMarkdown(post: Post) {
    return `---
slug: ${post.slug}
title: ${post.title}
createdAt: ${new UTCDate(post.createdAt)}
modifiedAt: ${new UTCDate(post.modifiedAt)}
thumbnail: ${post.thumbnailUrl ?? ''}
categories: 
${post.categoryNiceNames.map(nn => `- ${nn}`).join('\n')}
---
${post.content}`; // todo: remove comment nodes, remove superfluous html, maybe?
}
