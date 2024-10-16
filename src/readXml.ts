import { parse } from '@libs/xml';
import { slugify } from '@std/text/unstable-slugify';
import { groupBy } from './util.ts';

import type { Attachment, Category, Post } from './model.ts';

type PostType = 'attachment' | 'custom_css' | 'nav_menu_item' | 'post' | 'page' | 'wp_global_styles';

type PostMeta = {
    'wp:meta_key': string;
    'wp:meta_value': string;
};

type WpCategory = {
    '#text': string;
    '@nicename': string;
};

type WpChannelItem = {
    title: string;
    link: string;
    pubDate: string;
    category?: WpCategory | WpCategory[];
    'content:encoded': string | null;
    'wp:post_id': string;
    'wp:post_date': string;
    'wp:post_date_gmt': string;
    'wp:post_modified': string;
    'wp:post_modified_gmt': string;
    'wp:post_name': string | null;
    'wp:post_type': PostType;
    'wp:attachment_url': string;
    'wp:postmeta'?: PostMeta | PostMeta[];
};

type WpXml = {
    rss: {
        channel: {
            title: string;
            link: string;
            language: string;
            item: WpChannelItem[];
        };
    };
};

function toAttachment(item: WpChannelItem): Attachment {
    return {
        id: item['wp:post_id'],
        url: item['wp:attachment_url'],
    };
}

function toCategory(wpCategory: WpCategory): Category {
    return {
        text: wpCategory['#text'],
        name: wpCategory['@nicename'],
    };
}

function toPost(item: WpChannelItem): Post {
    const postMeta = item['wp:postmeta'];
    return {
        id: item['wp:post_id'],
        slug: item['wp:post_name'] ?? slugify(item.title),
        createdAt: `${item['wp:post_date_gmt']} +0000`,
        modifiedAt: `${item['wp:post_modified_gmt']} +0000`,
        title: item.title,
        content: item['content:encoded']!,
        categories: Array.isArray(item.category) ? item.category.map(toCategory) : [toCategory(item.category!)],
        thumbnailId: Array.isArray(postMeta)
            ? postMeta.find((pm) => pm['wp:meta_key'] === '_thumbnail_id')?.['wp:meta_value']
            : !!postMeta && postMeta['wp:meta_key'] === '_thumbnail_id'
            ? postMeta['wp:meta_value']
            : undefined,
    };
}

export async function readXml(inputFile: string) {
    using file = await Deno.open(inputFile);
    const xml = parse(file) as unknown as WpXml;
    const { title, link, item: items } = xml.rss.channel;
    const { post: wpPosts, attachment: wpAttachments } = groupBy(items, (item) => item['wp:post_type']);

    const posts = wpPosts.map(toPost);

    const attachments = wpAttachments
        .map(toAttachment)
        .reduce((record, attachment) => {
            record[attachment.id] = attachment.url;
            return record;
        }, {} as Record<string, string>);

    return { title, link, posts, attachments };
}
