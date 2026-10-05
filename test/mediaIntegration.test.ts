import { expect } from '@std/expect';
import { processPost } from '../src/processPost.ts';
import { examplePost, xmlDocument, xmlItem } from './fixtures.ts';
import { main } from '../main.ts';

const postFolder = 'output/2025/01/01_example';
const mediaFolder = `${postFolder}/media`;

async function inTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
    const dir = await Deno.makeTempDir();
    const cwd = Deno.cwd();
    try {
        Deno.chdir(dir);
        return await fn(dir);
    } finally {
        Deno.chdir(cwd);
        await Deno.remove(dir, { recursive: true });
    }
}

function mockFetch(handler: (url: string) => Response | Promise<Response>) {
    const original = globalThis.fetch;
    const calls: string[] = [];
    globalThis.fetch = (input) => {
        const url = String(input);
        calls.push(url);
        return Promise.resolve(handler(url));
    };
    return { calls, restore: () => globalThis.fetch = original };
}

Deno.test('full-size image success and original fallback produce resolvable local references', async () => {
    for (const fallback of [false, true]) {
        await inTempDir(async () => {
            const mock = mockFetch((url) => {
                if (fallback && url.endsWith('/photo.jpg')) return new Response('missing', { status: 404 });
                return new Response(new Uint8Array([11, 12, 13]));
            });
            try {
                const post = {
                    ...examplePost,
                    content:
                        '<p><a href="https://site.test/photo-1200x800.jpg"><img src="https://site.test/photo-1200x800.jpg" srcset="a 1x, b 2x" sizes="50vw"></a></p>',
                };
                const dryMarkdown = await processPost(post, 'https://site.test', {}, true);
                expect(dryMarkdown.slice(dryMarkdown.indexOf('\n---\n') + 5)).toBe(
                    '[![photo-1200x800.jpg](media/photo.jpg)](media/photo.jpg)\n',
                );
                expect(mock.calls).toEqual([]);
                await expect(Deno.stat(mediaFolder)).rejects.toThrow(Deno.errors.NotFound);

                const markdown = await processPost(post, 'https://site.test', {});
                const body = markdown.slice(markdown.indexOf('\n---\n') + 5);
                const expected = fallback
                    ? '[![photo-1200x800.jpg](media/photo-1200x800.jpg)](media/photo-1200x800.jpg)\n'
                    : '[![photo-1200x800.jpg](media/photo.jpg)](media/photo.jpg)\n';
                expect(body).toBe(expected);
                const path = fallback ? `${mediaFolder}/photo-1200x800.jpg` : `${mediaFolder}/photo.jpg`;
                expect(await Deno.readFile(path)).toEqual(new Uint8Array([11, 12, 13]));
                expect(mock.calls).toEqual(
                    fallback
                        ? ['https://site.test/photo.jpg', 'https://site.test/photo-1200x800.jpg']
                        : ['https://site.test/photo.jpg'],
                );
            } finally {
                mock.restore();
            }
        });
    }
});

Deno.test('media links localize independently while article links and video attributes are retained', async () => {
    await inTempDir(async () => {
        const mock = mockFetch(() => new Response(new Uint8Array([21, 22])));
        try {
            const markdown = await processPost(
                {
                    ...examplePost,
                    content:
                        '<p><a href="https://site.test/story"><img src="https://site.test/story-thumb.jpg" alt="Story"></a></p>' +
                        '<p><a href="https://site.test/photo-full.jpg"><img src="https://site.test/photo-thumb.jpg" alt="Photo"></a></p>' +
                        '<video controls muted poster="//site.test/poster.jpg" src="/clip.mp4"><source src="https://site.test/clip.webm" type="video/webm"></video>',
                },
                'https://site.test',
                {},
            );
            const body = markdown.slice(markdown.indexOf('\n---\n') + 5);
            expect(body).toBe(
                '[![Story](media/story-thumb.jpg)](https://site.test/story)\n\n' +
                    '[![Photo](media/photo-thumb.jpg)](media/photo-full.jpg)\n\n' +
                    '<video controls muted poster="media/poster.jpg" src="media/clip.mp4"><source src="media/clip.webm" type="video/webm"></video>\n',
            );
            expect(mock.calls).toEqual([
                'https://site.test/story-thumb.jpg',
                'https://site.test/photo-thumb.jpg',
                'https://site.test/photo-full.jpg',
                'https://site.test/poster.jpg',
                'https://site.test/clip.mp4',
                'https://site.test/clip.webm',
            ]);
            for (
                const file of [
                    'story-thumb.jpg',
                    'photo-thumb.jpg',
                    'photo-full.jpg',
                    'poster.jpg',
                    'clip.mp4',
                    'clip.webm',
                ]
            ) {
                expect(await Deno.readFile(`${mediaFolder}/${file}`)).toEqual(new Uint8Array([21, 22]));
            }
        } finally {
            mock.restore();
        }
    });
});

Deno.test('thumbnail, repeated images, and shared linked-image anchors are downloaded once per remote URL', async () => {
    await inTempDir(async () => {
        const mock = mockFetch(() => new Response(new Uint8Array([31])));
        try {
            const markdown = await processPost(
                {
                    ...examplePost,
                    thumbnailId: 'cover',
                    content:
                        '<a href="https://site.test/picture.jpg"><img src="https://site.test/picture.jpg" alt="One">' +
                        '<img src="https://site.test/picture.jpg" alt="Two"></a>' +
                        '<img src="https://site.test/cover.jpg" alt="Cover">',
                },
                'https://site.test',
                { cover: 'https://site.test/cover.jpg' },
            );
            const body = markdown.slice(markdown.indexOf('\n---\n') + 5);
            const expected =
                '[![One](media/picture.jpg)![Two](media/picture.jpg)](media/picture.jpg)![Cover](media/cover.jpg)\n';
            expect(body).toBe(expected);
            expect(mock.calls).toEqual(['https://site.test/cover.jpg', 'https://site.test/picture.jpg']);
            expect(await Deno.readFile(`${mediaFolder}/cover.jpg`)).toEqual(new Uint8Array([31]));
            expect(await Deno.readFile(`${mediaFolder}/picture.jpg`)).toEqual(new Uint8Array([31]));
        } finally {
            mock.restore();
        }
    });
});

Deno.test('dry-run resolves URL forms, skips data and missing sources, and remains repeatable without touching media', async () => {
    await inTempDir(async () => {
        await Deno.mkdir('output');
        await Deno.writeTextFile('output/keep.txt', 'untouched');
        const originalPost = {
            ...examplePost,
            content:
                '<p><img src="/root.jpg"><img src="//cdn.test/protocol.jpg"><img src="data:image/png;base64,AA=="><img alt="No source"></p>' +
                '<video><source type="video/mp4"></video>',
        };
        const savedPost = structuredClone(originalPost);
        const fetch = mockFetch(() => {
            throw new Error('dry-run must not fetch');
        });
        const log = console.log;
        const logs: string[] = [];
        console.log = (...args) => logs.push(args.join(' '));
        try {
            const first = await processPost(originalPost, 'https://site.test/base/', {}, true);
            const second = await processPost(originalPost, 'https://site.test/base/', {}, true);
            expect(first).toBe(second);
            expect(first.slice(first.indexOf('\n---\n') + 5)).toBe(
                '![root.jpg](media/root.jpg)![protocol.jpg](media/protocol.jpg)![](data:image/png;base64,AA==)![No source]()\n\n' +
                    '<video><source type="video/mp4"></video>\n',
            );
            expect(originalPost).toEqual(savedPost);
            expect(fetch.calls).toEqual([]);
            expect(await Deno.readTextFile(`${postFolder}/index.md`)).toBe(first);
            await expect(Deno.stat(mediaFolder)).rejects.toThrow(Deno.errors.NotFound);
            expect(await Deno.readTextFile('output/keep.txt')).toBe('untouched');

            await Deno.mkdir(mediaFolder);
            await Deno.writeFile(`${mediaFolder}/existing.jpg`, new Uint8Array([41, 42]));
            await Deno.writeTextFile(`${postFolder}/index.md`, 'stale markdown');
            await processPost(originalPost, 'https://site.test/base/', {}, true);
            expect(await Deno.readTextFile(`${postFolder}/index.md`)).toBe(first);
            expect(await Deno.readFile(`${mediaFolder}/existing.jpg`)).toEqual(new Uint8Array([41, 42]));
            const names: string[] = [];
            for await (const entry of Deno.readDir(mediaFolder)) names.push(entry.name);
            expect(names.sort()).toEqual(['existing.jpg']);
            expect(logs.join('\n')).not.toContain(first);
        } finally {
            console.log = log;
            fetch.restore();
        }
    });
});

Deno.test('existing output directory, file, and symlinks are rejected before XML parsing', async () => {
    for (const kind of ['directory', 'file', 'symlink', 'dangling symlink']) {
        await inTempDir(async () => {
            await Deno.writeTextFile('export.xml', 'not valid XML');
            if (kind === 'directory') await Deno.mkdir('output');
            if (kind === 'file') await Deno.writeTextFile('output', 'keep');
            if (kind === 'symlink') {
                await Deno.writeTextFile('existing-target', 'keep');
                await Deno.symlink('existing-target', 'output');
            }
            if (kind === 'dangling symlink') await Deno.symlink('missing-target', 'output');
            await expect(main([])).rejects.toThrow('already exists');
            if (kind === 'file') expect(await Deno.readTextFile('output')).toBe('keep');
            if (kind === 'symlink') expect(await Deno.readTextFile('output')).toBe('keep');
        });
    }
});

Deno.test('failed thumbnail, image, or video download leaves no final Markdown file', async () => {
    const cases = [
        { name: 'thumbnail', thumbnailId: 'cover', content: '<p>Body</p>' },
        { name: 'image', content: '<img src="https://site.test/image.jpg">' },
        { name: 'video', content: '<video src="https://site.test/movie.mp4"></video>' },
    ];
    for (const { name, thumbnailId, content } of cases) {
        await inTempDir(async () => {
            const mock = mockFetch(() => new Response('unavailable', { status: 503 }));
            try {
                await expect(processPost({ ...examplePost, content, thumbnailId }, 'https://site.test', {
                    cover: 'https://site.test/cover.jpg',
                })).rejects.toThrow(
                    name === 'thumbnail' || name === 'image' ? 'Failed to download image' : 'Failed to download video',
                );
                await expect(Deno.stat(`${postFolder}/index.md`)).rejects.toThrow(Deno.errors.NotFound);
                expect(mock.calls.length).toBeGreaterThan(0);
            } finally {
                mock.restore();
            }
        });
    }
});

Deno.test('main dry-run overwrites Markdown repeatedly while preserving pre-existing media and unrelated output', async () => {
    await inTempDir(async () => {
        await Deno.mkdir(`${mediaFolder}`, { recursive: true });
        await Deno.writeFile(`${mediaFolder}/photo.jpg`, new Uint8Array([51, 52]));
        await Deno.writeTextFile('output/keep.txt', 'keep');
        await Deno.writeTextFile(`${postFolder}/index.md`, 'stale');
        await Deno.writeTextFile('export.xml', xmlDocument(xmlItem()));
        const fetch = mockFetch(() => {
            throw new Error('dry-run must not fetch');
        });
        try {
            await main(['--dry-run']);
            const first = await Deno.readTextFile(`${postFolder}/index.md`);
            await main(['--dry-run']);
            expect(await Deno.readTextFile(`${postFolder}/index.md`)).toBe(first);
            expect(first.slice(first.indexOf('\n---\n') + 5)).toBe('Hello & world\n');
            expect(await Deno.readTextFile('output/keep.txt')).toBe('keep');
            expect(await Deno.readFile(`${mediaFolder}/photo.jpg`)).toEqual(new Uint8Array([51, 52]));
            expect(fetch.calls).toEqual([]);
        } finally {
            fetch.restore();
        }
    });
});
