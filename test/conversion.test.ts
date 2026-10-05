import { expect } from '@std/expect';
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
        expect(result.posts.length).toEqual(1);
        expect(result.posts[0].title).toEqual('A & B');
        expect(result.posts[0].content).toEqual('<p>Hello &amp; world</p>');
        expect(result.posts[0].thumbnailId).toEqual('2');
        expect(result.posts[0].categories).toEqual([{ text: 'News', name: 'news' }]);
        expect(result.attachments).toEqual({ '2': 'https://example.org/image.jpg' });
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
            expect(result.posts.length).toEqual(items ? 1 : 0);
            if (items) expect(result.posts[0].categories).toEqual([]);
        }
    } finally {
        await Deno.remove(dir, { recursive: true });
    }
});

Deno.test('frontmatter uses UTC year/month and ISO dates', () => {
    const markdown = toMarkdown(examplePost);
    expect(markdown).toContain('slug: 2025/01/01_example');
    const metadata = parse(markdown.split('---')[1]) as Record<string, unknown>;
    expect(metadata.createdAt).toEqual('2025-01-01T00:30:00.000Z');
    expect(metadata.title).toEqual(examplePost.title);
    const special = {
        ...examplePost,
        title: 'Path \\new "quoted"\nnext',
        categories: [{ text: 'Topic: #one', name: 'topic' }],
    };
    const roundtrip = parse(toMarkdown(special).split('---')[1]) as Record<string, unknown>;
    expect(roundtrip.title).toEqual(special.title);
    expect(roundtrip.categories).toEqual(['Topic: #one']);
});

Deno.test('HTML conversion retains text, emphasis and links', async () => {
    const dir = await Deno.makeTempDir();
    const cwd = Deno.cwd();
    try {
        Deno.chdir(dir);
        await processPost({ ...examplePost }, 'https://example.org', {});
        const markdown = await Deno.readTextFile('output/2025/01/01_example/index.md');
        expect(markdown).toContain('Hello **world**');
        expect(markdown).toContain('[Link](https://example.org)');
    } finally {
        Deno.chdir(cwd);
        await Deno.remove(dir, { recursive: true });
    }
});

Deno.test('Temporal uses UTC calendar boundaries consistently in folders and frontmatter', async () => {
    const dir = await Deno.makeTempDir();
    const cwd = Deno.cwd();
    try {
        Deno.chdir(dir);
        const post = {
            ...examplePost,
            createdAt: '2025-01-01T00:30:00+01:00',
            modifiedAt: '2024-12-31T23:30:00-02:00',
        };
        await processPost(post, 'https://example.org', {});
        const markdown = await Deno.readTextFile('output/2024/12/31_example/index.md');
        const metadata = parse(markdown.split('---')[1]) as Record<string, unknown>;
        expect(metadata.slug).toBe('2024/12/31_example');
        expect(metadata.createdAt).toBe('2024-12-31T23:30:00.000Z');
        expect(metadata.modifiedAt).toBe('2025-01-01T01:30:00.000Z');
    } finally {
        Deno.chdir(cwd);
        await Deno.remove(dir, { recursive: true });
    }
});

Deno.test('XML timestamps preserve UTC and reject invalid calendar dates', async () => {
    const dir = await Deno.makeTempDir();
    try {
        const file = `${dir}/export.xml`;
        await Deno.writeTextFile(file, xmlDocument(xmlItem()));
        const { posts } = await readXml(file);
        expect(posts[0].createdAt).toBe('2025-01-01T00:30:00.000Z');
        expect(posts[0].modifiedAt).toBe('2025-01-02T00:30:00.000Z');
        await Deno.writeTextFile(file, xmlDocument(xmlItem().replace('2025-01-01', '2025-02-30')));
        await expect(readXml(file)).rejects.toThrow(RangeError);
    } finally {
        await Deno.remove(dir, { recursive: true });
    }
});

Deno.test('integrated conversion writes separated blocks, localized media and unchanged article links', async () => {
    const dir = await Deno.makeTempDir();
    const cwd = Deno.cwd();
    const fetch = globalThis.fetch;
    const post = {
        ...examplePost,
        content: '<p>One</p><p>Two <a href="https://example.org/article"><strong>article</strong></a></p>' +
            '<figure><a href="https://example.org/photo.jpg"><img src="https://example.org/photo-1024x768.jpg" alt="Photo"></a><figcaption>Caption</figcaption></figure>' +
            '<p><a href="https://example.org/story"><img src="https://example.org/story.jpg" alt="Story"></a></p>' +
            '<video controls muted src="https://example.org/clip.mp4" poster="https://example.org/poster.jpg"><source src="https://example.org/clip.webm" type="video/webm"></video>',
    };
    const original = structuredClone(post);
    const calls: string[] = [];
    try {
        Deno.chdir(dir);
        globalThis.fetch = (input) => {
            calls.push(String(input));
            return Promise.resolve(new Response(new Uint8Array([7, 8, 9])));
        };
        const markdown = await processPost(post, 'https://example.org', {});
        const body = markdown.slice(markdown.indexOf('\n---\n') + 5);
        expect(body).toBe(
            'One\n\nTwo [**article**](https://example.org/article)\n\n' +
                '[![Photo](media/photo.jpg)](media/photo.jpg)\n\nCaption\n\n' +
                '[![Story](media/story.jpg)](https://example.org/story)\n\n' +
                '<video controls muted src="media/clip.mp4" poster="media/poster.jpg"><source src="media/clip.webm" type="video/webm"></video>\n',
        );
        expect(post).toEqual(original);
        expect(await Deno.readTextFile('output/2025/01/01_example/index.md')).toBe(markdown);
        expect(calls).toEqual([
            'https://example.org/photo.jpg',
            'https://example.org/story.jpg',
            'https://example.org/poster.jpg',
            'https://example.org/clip.mp4',
            'https://example.org/clip.webm',
        ]);
        for (const name of ['photo.jpg', 'story.jpg', 'poster.jpg', 'clip.mp4', 'clip.webm']) {
            expect(await Deno.readFile(`output/2025/01/01_example/media/${name}`)).toEqual(new Uint8Array([7, 8, 9]));
        }
    } finally {
        globalThis.fetch = fetch;
        Deno.chdir(cwd);
        await Deno.remove(dir, { recursive: true });
    }
});
