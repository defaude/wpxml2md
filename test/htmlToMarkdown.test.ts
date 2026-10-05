import { expect } from '@std/expect';
import { htmlToMarkdown } from '../src/htmlToMarkdown.ts';
import { coreHtmlFixtures, wordpressHtmlFixtures } from './htmlFixtures.ts';

for (const { name, html, markdown } of [...coreHtmlFixtures, ...wordpressHtmlFixtures]) {
    Deno.test({
        name: `HTML fragment: ${name}`,
        permissions: { read: false, write: false, net: false },
        fn() {
            expect(htmlToMarkdown(html)).toBe(markdown);
        },
    });
}

Deno.test('code fences preserve leading and trailing empty lines, indentation and language', () => {
    expect(htmlToMarkdown('<pre><code class="language-ts">\n  const x = 1;\n\n\n</code></pre>')).toBe(
        '```ts\n\n  const x = 1;\n\n\n```\n',
    );
    expect(htmlToMarkdown('<pre><code>```\n  x\n</code></pre>')).toBe('````\n```\n  x\n````\n');
});

Deno.test('literal heading, quote and list markers stay text', () => {
    expect(htmlToMarkdown('<p># heading</p><p>&gt; quote</p><p>- item</p><p>3. item</p>')).toBe(
        '\\# heading\n\n\\> quote\n\n\\- item\n\n3\\. item\n',
    );
});

Deno.test('legacy gallery wrappers retain image and caption order', () => {
    expect(htmlToMarkdown(
        '<div class="gallery"><dl class="gallery-item"><dt class="gallery-icon"><img src="one.jpg" alt="One"></dt>' +
            '<dd class="wp-caption-text">First <em>caption</em></dd></dl>' +
            '<dl class="gallery-item"><dt class="gallery-icon"><img src="two.jpg" alt="Two"></dt></dl></div>',
    )).toBe('![One](one.jpg)\n\nFirst *caption*\n\n![Two](two.jpg)\n');
});

Deno.test('HTML fallbacks preserve inline spacing, attributes and internal whitespace', () => {
    expect(htmlToMarkdown('<p>Before<sup>2</sup><custom-mark data-x="a">x</custom-mark>after</p>')).toBe(
        'Before<sup>2</sup><custom-mark data-x="a">x</custom-mark>after\n',
    );
    expect(htmlToMarkdown('<iframe src="embed" title="one  two">\n\n fallback  text\n</iframe>')).toBe(
        '<iframe src="embed" title="one  two">\n\n fallback  text\n</iframe>\n',
    );
    expect(htmlToMarkdown('<p data-mdast="ignore">Keep<!-- comment -->text</p>')).toBe('Keeptext\n');
    expect(htmlToMarkdown('<svg viewBox="0 0 10 10"><!-- comment --><text>Kept</text></svg>')).toBe(
        '<svg viewBox="0 0 10 10"><text>Kept</text></svg>\n',
    );
});

Deno.test('complex tables keep captions, row spans, block contents and cell breaks as HTML', () => {
    for (
        const html of [
            '<table><caption>Caption</caption><tbody><tr><th>A</th></tr><tr><td>B</td></tr></tbody></table>',
            '<table><tbody><tr><th>A</th></tr><tr><td rowspan="2">B</td></tr><tr><td>C</td></tr></tbody></table>',
            '<table><tbody><tr><th>A</th></tr><tr><td><p>One</p><p>Two</p></td></tr></tbody></table>',
            '<table><tbody><tr><th>A</th></tr><tr><td>One<br>Two</td></tr></tbody></table>',
        ]
    ) expect(htmlToMarkdown(html)).toBe(`${html}\n`);
});
