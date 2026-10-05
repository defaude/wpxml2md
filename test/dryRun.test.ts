import { expect } from '@std/expect';
import { main, parseOptions } from '../main.ts';
import { downloadImage, downloadVideo } from '../src/downloadMedia.ts';
import { processPost } from '../src/processPost.ts';
import { examplePost, xmlDocument, xmlItem } from './fixtures.ts';

Deno.test('CLI parses dry-run before or after input and rejects invalid arguments', () => {
    expect(parseOptions([])).toEqual({ input: 'export.xml', dryRun: false, help: false });
    for (const args of [['--dry-run', 'sample.xml'], ['sample.xml', '--dry-run']]) {
        expect(parseOptions(args)).toEqual({ input: 'sample.xml', dryRun: true, help: false });
    }
    expect(() => parseOptions(['--typo'])).toThrow(
        'Unknown option',
    );
    expect(() => parseOptions(['a.xml', 'b.xml'])).toThrow(
        'at most one',
    );
});

Deno.test('dry-run converts media and text without changing an existing target', async () => {
    const dir = await Deno.makeTempDir();
    const cwd = Deno.cwd();
    const fetch = globalThis.fetch;
    try {
        Deno.chdir(dir);
        await Deno.mkdir('output');
        await Deno.writeTextFile('output/keep.txt', 'unchanged');
        globalThis.fetch = () => {
            throw new Error('Dry-run must never fetch');
        };
        const markdown = await processPost(
            {
                ...examplePost,
                thumbnailId: '2',
                content:
                    '<p>Hello <strong>world</strong></p><a href="x"><img src="https://example.org/photo-1024x768.jpg"></a>' +
                    '<img src="https://example.org/plain.jpg"><figure class="wp-block-video"><video src="https://example.org/movie.mp4"></video></figure>',
            },
            'https://example.org',
            { '2': 'https://example.org/cover.jpg' },
            true,
        );
        expect(markdown).toContain('Hello **world**');
        for (const path of ['media/photo.jpg', 'media/plain.jpg', 'media/cover.jpg', 'media/movie.mp4']) {
            expect(markdown).toContain(path);
        }
        expect(await Deno.readTextFile('output/keep.txt')).toEqual('unchanged');
        expect(Array.from(Deno.readDirSync('output')).map((entry) => entry.name)).toEqual(['keep.txt']);
        await Deno.writeTextFile('export.xml', xmlDocument(xmlItem()));
        await main(['--dry-run']);
        await expect(main([])).rejects.toThrow(
            'already exists',
        );
        await Deno.remove('output', { recursive: true });
        await main(['--dry-run']);
        await expect(Deno.stat('output')).rejects.toThrow(Deno.errors.NotFound);
    } finally {
        globalThis.fetch = fetch;
        Deno.chdir(cwd);
        await Deno.remove(dir, { recursive: true });
    }
});

Deno.test('normal downloads save bytes and fall back from missing full-sized image', async () => {
    const dir = await Deno.makeTempDir();
    const fetch = globalThis.fetch;
    const calls: string[] = [];
    try {
        await Deno.mkdir(`${dir}/media`);
        globalThis.fetch = (input) => {
            const url = String(input);
            calls.push(url);
            return Promise.resolve(
                url.endsWith('/photo.jpg')
                    ? new Response('missing', { status: 404 })
                    : new Response(new Uint8Array([1, 2, 3])),
            );
        };
        expect(await downloadImage('https://example.org/photo-1024x768.jpg', `${dir}/media`, dir)).toEqual(
            'media/photo-1024x768.jpg',
        );
        expect(calls).toEqual(['https://example.org/photo.jpg', 'https://example.org/photo-1024x768.jpg']);
        expect(await Deno.readFile(`${dir}/media/photo-1024x768.jpg`)).toEqual(new Uint8Array([1, 2, 3]));
        expect(await downloadVideo('https://example.org/movie.mp4', `${dir}/media`, dir)).toEqual('media/movie.mp4');
        expect(await Deno.readFile(`${dir}/media/movie.mp4`)).toEqual(new Uint8Array([1, 2, 3]));
        globalThis.fetch = () => Promise.resolve(new Response('failed', { status: 500 }));
        await expect(downloadImage('https://example.org/bad.jpg', `${dir}/media`, dir)).rejects.toThrow(
            'Failed to download',
        );
        await expect(downloadVideo('https://example.org/bad.mp4', `${dir}/media`, dir)).rejects.toThrow(
            'Failed to download',
        );
    } finally {
        globalThis.fetch = fetch;
        await Deno.remove(dir, { recursive: true });
    }
});

Deno.test('normal conversion writes output once and preserves existing posts', async () => {
    const dir = await Deno.makeTempDir();
    const cwd = Deno.cwd();
    try {
        Deno.chdir(dir);
        await Deno.writeTextFile('export.xml', xmlDocument(xmlItem()));
        await main([]);
        const path = 'output/2025/01/example/index.md';
        const original = await Deno.readTextFile(path);
        expect(original).toContain('Hello &amp; world');
        await expect(processPost({ ...examplePost }, 'https://example.org', {})).rejects.toThrow(
            Deno.errors.AlreadyExists,
        );
        expect(await Deno.readTextFile(path)).toEqual(original);
    } finally {
        Deno.chdir(cwd);
        await Deno.remove(dir, { recursive: true });
    }
});

Deno.test({
    name: 'dry-run works with filesystem writes and network explicitly denied',
    permissions: { write: false, net: false },
    async fn() {
        const markdown = await processPost(
            {
                ...examplePost,
                content:
                    '<img src="https://example.invalid/photo.jpg"><figure class="wp-block-video"><video src="https://example.invalid/video.mp4"></video></figure>',
                thumbnailId: '2',
            },
            'https://example.invalid',
            { '2': 'https://example.invalid/cover.jpg' },
            true,
        );
        expect(markdown).toContain('media/photo.jpg');
        expect(markdown).toContain('media/video.mp4');
        expect(markdown).toContain('media/cover.jpg');
    },
});
