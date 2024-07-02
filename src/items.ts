import { type RawItem, rawItems } from './importJson';

export type PostItem = {
    // wp:post_id[0]
    id: string;
    // wp:post_date[0]
    createdAt: 'string'; // 2024-03-17 16:31:00 (UTC)
    // wp:post_modified[0]
    modifiedAt: 'string';
    // title[0]
    title: string;
    // wp:content:encoded[0]
    content: string;
    // category[].$.nicename
    categoryNiceNames: string[];
    // wp:postmeta.find(x => x['wp:meta_key'][0] === '_thumbnail_id')?['wp:meta_value'][0]
    thumbnailId: string | undefined;
};

function toPostItem(raw: RawItem): PostItem {
    return {
        id: raw['wp:post_id'][0],
        createdAt: raw['wp:post_date'][0],
        modifiedAt: raw['wp:post_modified'][0],
        title: raw.title[0],
        content: raw['content:encoded'][0],
        categoryNiceNames: raw.category.map(rawCategory => rawCategory.$.nicename),
        thumbnailId: raw['wp:postmeta'].find(pm => pm['wp:meta_key'][0] === '_thumbnail_id')?.['wp:meta_value'][0],
    };
}

export const postItems = new Map<string, PostItem>();

export type AttachmentItem = {
    // wp:post_id[0]
    id: string;
    // guid[0]._
    url: string;
};

function toAttachmentItem(raw: RawItem): AttachmentItem {
    return {
        id: raw['wp:post_id'][0],
        url: raw['wp:attachment_url'][0],
    };
}

export const attachmentItems = new Map<string, AttachmentItem>();

for (const raw of rawItems) {
    const type = raw['wp:post_type'][0];
    if (type === 'post') {
        const postItem = toPostItem(raw);
        postItems.set(postItem.id, postItem);
    }

    if (type === 'attachment') {
        const attachmentItem = toAttachmentItem(raw);
        attachmentItems.set(attachmentItem.id, attachmentItem);
    }
}
