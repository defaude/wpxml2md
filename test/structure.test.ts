import { expect } from '@std/expect';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { htmlToMarkdown } from '../src/htmlToMarkdown.ts';
import { coreHtmlFixtures } from './htmlFixtures.ts';

const markdownParser = unified().use(remarkParse).use(remarkGfm);

type AstNode = {
    type: string;
    children?: AstNode[];
    depth?: number;
    ordered?: boolean | null;
    start?: number | null;
    value?: string;
    url?: string;
};

function descendants(node: AstNode): AstNode[] {
    return (node.children ?? []).flatMap((child) => {
        return [child, ...descendants(child)];
    });
}

function children(node: AstNode): AstNode[] {
    if (!node.children) throw new Error(`Expected children on ${node.type}`);
    return node.children;
}

function childAt(node: AstNode, index: number): AstNode {
    const child = children(node)[index];
    if (!child) throw new Error(`Expected child ${index} on ${node.type}`);
    return child;
}

Deno.test('existing HTML fixtures preserve Markdown structure after parsing', () => {
    const fixtureByName = new Map(coreHtmlFixtures.map((fixture) => [fixture.name, fixture]));
    for (
        const name of [
            'adjacent paragraphs form separate Markdown paragraphs',
            'heading levels one through six',
            'nested unordered and ordered lists retain nesting and start',
            'loose list items retain multiple paragraphs',
            'blockquote retains multiple paragraphs',
            'inline code and fenced code preserve source whitespace',
        ]
    ) {
        const fixture = fixtureByName.get(name)!;
        const tree = markdownParser.parse(htmlToMarkdown(fixture.html));
        const nodes = descendants(tree);

        if (name.startsWith('adjacent paragraphs')) {
            expect(tree.children.length).toBe(2);
            expect(tree.children.map((node) => node.type)).toEqual([
                'paragraph',
                'paragraph',
            ]);
        } else if (name.startsWith('heading levels')) {
            expect(nodes.filter((node) => node.type === 'heading').map((node) => node.depth)).toEqual([
                1,
                2,
                3,
                4,
                5,
                6,
            ]);
        } else if (name.startsWith('nested unordered')) {
            const outer = tree.children[0];
            if (outer?.type !== 'list') throw new Error(`Expected root list, got ${outer?.type}`);
            expect(outer.ordered).toBe(false);
            const outerItems = children(outer);
            expect(outerItems.map((item) => children(item).map((child) => child.type))).toEqual([
                ['paragraph', 'list'],
                ['paragraph'],
            ]);
            expect(outerItems.map((item) => childAt(item, 0).children?.[0]?.value)).toEqual(['Alpha', 'Beta']);
            const nested = childAt(outerItems[0], 1);
            if (nested.type !== 'list') throw new Error(`Expected nested ordered list, got ${nested.type}`);
            expect([nested.ordered, nested.start]).toEqual([true, 3]);
            const nestedItems = children(nested);
            expect(nestedItems.map((item) => children(item).map((child) => child.type))).toEqual([
                ['paragraph', 'list'],
                ['paragraph'],
            ]);
            expect(nestedItems.map((item) => childAt(item, 0).children?.[0]?.value)).toEqual(['Three', 'Four']);
            const deepest = childAt(nestedItems[0], 1);
            if (deepest.type !== 'list') throw new Error(`Expected deepest unordered list, got ${deepest.type}`);
            expect(deepest.ordered).toBe(false);
            expect(childAt(childAt(childAt(deepest, 0), 0), 0).value).toBe('Nested');
        } else if (name.startsWith('loose list')) {
            const items = nodes.filter((node) => node.type === 'listItem');
            expect(
                items.map((item) => item.children?.filter((child) => child.type === 'paragraph').length),
            )
                .toEqual([2, 1]);
        } else if (name.startsWith('blockquote')) {
            const quote = nodes.find((node) => node.type === 'blockquote')!;
            expect(quote.children?.map((child) => child.type)).toEqual([
                'paragraph',
                'paragraph',
            ]);
        } else {
            const code = nodes.find((node) => node.type === 'code')!;
            expect(code.value).toBe('  first line\n\n\n    indented line');
            const inlineCode = nodes.find((node) => node.type === 'inlineCode');
            expect(inlineCode?.value).toBe('a * b');
        }
    }
});

Deno.test('formatted link labels retain strong and emphasis nodes with the original destination', () => {
    const tree = markdownParser.parse(
        htmlToMarkdown('<p><a href="https://example.org/target"><strong>Bold</strong> and <em>soft</em></a></p>'),
    );
    const link = descendants(tree).find((node) => node.type === 'link');
    if (!link) throw new Error('Expected linked label in parsed Markdown');
    expect(link.url).toBe('https://example.org/target');
    expect(link.children?.map((node) => [node.type, node.value ?? node.children?.[0]?.value])).toEqual([
        ['strong', 'Bold'],
        ['text', ' and '],
        ['emphasis', 'soft'],
    ]);
});

Deno.test('empty and comment-only HTML fragments produce no Markdown blocks', () => {
    expect(htmlToMarkdown('')).toBe('');
    expect(htmlToMarkdown('<!-- exporter note -->')).toBe('');
});

Deno.test('fenced code roundtrip preserves leading and trailing blank lines and language', () => {
    const tree = markdownParser.parse(htmlToMarkdown(
        '<pre><code class="language-ts">\n  const x = 1;\n\n\n</code></pre>',
    ));
    expect(tree.children.length).toBe(1);
    const code = tree.children[0];
    if (code.type !== 'code') throw new Error(`Expected code, got ${code.type}`);
    expect([code.lang, code.value]).toEqual(['ts', '\n  const x = 1;\n\n']);
});
