import { assertEquals, assertStringIncludes } from '@std/assert';
import { parse } from '@std/yaml';
import { readXml } from '../src/readXml.ts';
import { toMarkdown } from '../src/toMarkdown.ts';
import { processPost } from '../src/processPost.ts';
import { examplePost, xmlDocument, xmlItem } from './fixtures.ts';

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
