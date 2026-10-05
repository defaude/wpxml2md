import { expect } from '@std/expect';
import { htmlToMarkdown } from '../src/htmlToMarkdown.ts';
import { coreHtmlFixtures } from './htmlFixtures.ts';

for (const { name, html, markdown } of coreHtmlFixtures) {
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
