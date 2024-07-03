import { type RawItem, rawItems } from './importJson';

export type Post = {
    // wp:post_id[0]
    id: string;
    // wp:post_name[0]
    slug: string;
    // wp:post_date_gmt[0]
    createdAt: string; // 2024-03-17 16:31:00 (UTC)
    // wp:post_modified_gmt[0]
    modifiedAt: string;
    // title[0]
    title: string;
    // wp:content:encoded[0]
    content: string;
    // category[].$.nicename
    categoryNiceNames: string[];
    // wp:postmeta.find(x => x['wp:meta_key'][0] === '_thumbnail_id')?['wp:meta_value'][0]
    thumbnailId: string | undefined;
};

function toPost(raw: RawItem): Post {
    return {
        id: raw['wp:post_id'][0],
        slug: raw['wp:post_name'][0],
        createdAt: `${raw['wp:post_date_gmt'][0]} +0000`,
        modifiedAt: `${raw['wp:post_modified_gmt'][0]} +0000`,
        title: raw.title[0],
        content: raw['content:encoded'][0],
        categoryNiceNames: raw.category.map(rawCategory => rawCategory.$.nicename),
        thumbnailId: raw['wp:postmeta'].find(pm => pm['wp:meta_key'][0] === '_thumbnail_id')?.['wp:meta_value'][0],
    };
}

export const posts = new Map<string, Post>();

export type Attachment = {
    // wp:post_id[0]
    id: string;
    // guid[0]._
    url: string;
};

function toAttachment(raw: RawItem): Attachment {
    return {
        id: raw['wp:post_id'][0],
        url: raw['wp:attachment_url'][0],
    };
}

export const attachments = new Map<string, Attachment>();

for (const raw of rawItems) {
    const type = raw['wp:post_type'][0];
    if (type === 'post') {
        const postItem = toPost(raw);
        posts.set(postItem.id, postItem);
    }

    if (type === 'attachment') {
        const attachmentItem = toAttachment(raw);
        attachments.set(attachmentItem.id, attachmentItem);
    }
}
