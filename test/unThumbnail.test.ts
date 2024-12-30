import { unThumbnail } from '../src/unThumbnail.ts';
import { expect } from '@std/expect';

Deno.test('should return the unchanged url', () => {
    const urls = [
        'https://foo.bar/some-picture.jpeg',
        'https://foo.bar/123-987.jpg',
    ];
    for (const url of urls) {
        const output = unThumbnail(url);
        expect(output).toBe(url);
    }
});

Deno.test('should strip common thumbnail suffixes', () => {
    const urls = [
        { original: 'https://foo.bar/some-picture-scaled.png', expected: 'https://foo.bar/some-picture.png' },
        { original: 'https://foo.bar/some-picture-1024x768.png', expected: 'https://foo.bar/some-picture.png' },
    ];

    for (const { original, expected } of urls) {
        const output = unThumbnail(original);
        expect(output).toBe(expected);
    }
});
