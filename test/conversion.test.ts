import { assertEquals, assertStringIncludes } from '@std/assert';
import { parse } from '@std/yaml';
import { readXml } from '../src/readXml.ts';
import { toMarkdown } from '../src/toMarkdown.ts';
import { processPost } from '../src/processPost.ts';
import type { Post } from '../src/model.ts';

export const examplePost: Post = {
    id: '1',
    slug: 'example',
    title: 'A "title"',
    createdAt: '2025-01-01 00:30:00 +0000',
    modifiedAt: '2025-01-02 00:30:00 +0000',
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

Deno.test('XML preserves CDATA, entities, metadata and attachments', async () => {
    const dir = await Deno.makeTempDir();
    try {
        const path = `${dir}/export.xml`;
        await Deno.writeTextFile(
            path,
            xmlDocument(
                xmlItem() + `<item><wp:post_id>2</wp:post_id>
<wp:post_type>attachment</wp:post_type><wp:attachment_url>https://example.org/image.jpg</wp:attachment_url></item>`,
            ),
        );
        const result = await readXml(path);
        assertEquals(result.posts.length, 1);
        assertEquals(result.posts[0].title, 'A & B');
        assertEquals(result.posts[0].content, '<p>Hello &amp; world</p>');
        assertEquals(result.posts[0].thumbnailId, '2');
        assertEquals(result.posts[0].categories, [{ text: 'News', name: 'news' }]);
        assertEquals(result.attachments, { '2': 'https://example.org/image.jpg' });
    } finally {
        await Deno.remove(dir, { recursive: true });
    }
});

Deno.test('XML supports zero or one item and missing categories', async () => {
    const dir = await Deno.makeTempDir();
    try {
        for (const items of ['', xmlItem('')]) {
            await Deno.writeTextFile(`${dir}/export.xml`, xmlDocument(items));
            const result = await readXml(`${dir}/export.xml`);
            assertEquals(result.posts.length, items ? 1 : 0);
            if (items) assertEquals(result.posts[0].categories, []);
        }
    } finally {
        await Deno.remove(dir, { recursive: true });
    }
});

Deno.test('frontmatter uses UTC year/month and ISO dates', () => {
    const markdown = toMarkdown(examplePost);
    assertStringIncludes(markdown, 'slug: 2025/01/example');
    const metadata = parse(markdown.split('---')[1]) as Record<string, unknown>;
    assertEquals(metadata.createdAt, '2025-01-01T00:30:00.000Z');
    assertEquals(metadata.title, examplePost.title);
    const special = {
        ...examplePost,
        title: 'Path \\new "quoted"\nnext',
        categories: [{ text: 'Topic: #one', name: 'topic' }],
    };
    const roundtrip = parse(toMarkdown(special).split('---')[1]) as Record<string, unknown>;
    assertEquals(roundtrip.title, special.title);
    assertEquals(roundtrip.categories, ['Topic: #one']);
});

Deno.test('HTML conversion retains text, emphasis and links', async () => {
    const dir = await Deno.makeTempDir();
    const cwd = Deno.cwd();
    try {
        Deno.chdir(dir);
        await processPost({ ...examplePost }, 'https://example.org', {});
        const markdown = await Deno.readTextFile('output/2025/01/example/index.md');
        assertStringIncludes(markdown, 'Hello **world**');
        assertStringIncludes(markdown, '[Link](https://example.org)');
    } finally {
        Deno.chdir(cwd);
        await Deno.remove(dir, { recursive: true });
    }
});
