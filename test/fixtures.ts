import type { Post } from '../src/model.ts';
export const examplePost: Post = {
    id: '1',
    slug: 'example',
    title: 'A "title"',
    createdAt: '2025-01-01T00:30:00.000Z',
    modifiedAt: '2025-01-02T00:30:00.000Z',
    content: '<p>Hello <strong>world</strong></p>\n<p><a href="https://example.org">Link</a></p>',
    categories: [{ text: 'News', name: 'news' }],
    thumbnailId: undefined,
};

export function xmlItem(category = '<category nicename="news">News</category>') {
    return `<item><title>A &amp; B</title><wp:post_id>1</wp:post_id><wp:post_name>example</wp:post_name>
<wp:post_type>post</wp:post_type><wp:post_date_gmt>2025-01-01 00:30:00</wp:post_date_gmt>
<wp:post_modified_gmt>2025-01-02 00:30:00</wp:post_modified_gmt>
<content:encoded><![CDATA[<p>Hello &amp; world</p>]]></content:encoded>${category}
<wp:postmeta><wp:meta_key>_thumbnail_id</wp:meta_key><wp:meta_value>2</wp:meta_value></wp:postmeta></item>`;
}

export function xmlDocument(items: string) {
    return `<rss xmlns:wp="http://wordpress.org/export/1.2/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel><title>Site</title><link>https://example.org</link>${items}</channel></rss>`;
}
