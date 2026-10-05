import { unified } from 'unified';
import rehypeParse from 'rehype-parse';
import rehypeRemark from 'rehype-remark';
import remarkGfm from 'remark-gfm';
import remarkStringify from 'remark-stringify';
import { toHtml } from 'hast-util-to-html';
import { defaultHandlers, type Handle } from 'hast-util-to-mdast';
import type { Element, Nodes, Parents, Root } from 'hast';
import type { Code, Html } from 'mdast';

declare module 'hast' {
    interface ElementData {
        preservedHtml?: string;
    }
}

const standardHandlers: Record<string, Handle> = defaultHandlers;

const parser = unified().use(rehypeParse, { fragment: true });

// Only these elements have an intentional Markdown mapping or transparent wrapper behavior.
// Everything else retains its HTML, rather than inheriting the library's lossy/ignoring handlers.
const markdownElements = new Set([
    'a',
    'b',
    'blockquote',
    'br',
    'code',
    'del',
    'em',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'hr',
    'i',
    'img',
    'li',
    'ol',
    'p',
    'pre',
    's',
    'strike',
    'strong',
    'table',
    'tbody',
    'td',
    'th',
    'thead',
    'tr',
    'ul',
]);
const wrappers = new Set([
    'abbr',
    'address',
    'article',
    'aside',
    'bdi',
    'bdo',
    'cite',
    'div',
    'figcaption',
    'figure',
    'footer',
    'header',
    'main',
    'nav',
    'section',
    'small',
    'span',
    'time',
]);
const inlineContexts = new Set([
    'p',
    'a',
    'b',
    'strong',
    'em',
    'i',
    's',
    'del',
    'strike',
    'span',
    'figcaption',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'td',
    'th',
]);

function codeText(node: Nodes): string {
    if (node.type === 'text') return node.value;
    if (node.type === 'element' && node.tagName === 'br') return '\n';
    return 'children' in node ? node.children.map(codeText).join('') : '';
}

function elements(node: Parents): Element[] {
    return node.children.flatMap((child) => child.type === 'element' ? [child, ...elements(child)] : []);
}

function simpleTable(node: Element): boolean {
    const descendants = elements(node);
    const rows = descendants.filter((child) => child.tagName === 'tr');
    const cells = (row: Element) =>
        row.children.filter((child): child is Element =>
            child.type === 'element' && (child.tagName === 'td' || child.tagName === 'th')
        );
    const header = rows[0] && cells(rows[0]);
    return !!header?.length && header.every((cell) => cell.tagName === 'th') &&
        rows.every((row) => cells(row).length === header.length) &&
        !descendants.some((child) =>
            ['caption', 'colgroup', 'tfoot', 'table'].includes(child.tagName) ||
            Number(child.properties.colSpan ?? 1) !== 1 || Number(child.properties.rowSpan ?? 1) !== 1 ||
            (['td', 'th'].includes(child.tagName) && elements(child).some((nested) =>
                !['a', 'b', 'br', 'code', 'del', 'em', 'i', 'img', 's', 'span', 'strike', 'strong'].includes(
                    nested.tagName,
                )
            ))
        );
}

const preserveHtml: Handle = (_state, node, parent) => {
    const value = String(node.data?.preservedHtml ?? toHtml(node));
    const inline = parent?.type === 'element' && inlineContexts.has(parent.tagName);
    const result: Html = { type: 'html', value, data: { hName: inline ? 'span' : 'div' } };
    return result;
};

/** Normalize a clone: remove comments and snapshot HTML fallbacks before rehype's whitespace normalization. */
function prepareTree(tree: Root): { tree: Root; handlers: Record<string, Handle> } {
    const clone = structuredClone(tree);
    const handlers: Record<string, Handle> = {};
    function normalize(parent: Parents) {
        parent.children = parent.children.filter((child) => child.type !== 'comment');
        for (const child of parent.children) {
            if (child.type !== 'element') continue;
            // Input attributes must not invoke the library's content-discarding escape hatch.
            delete child.properties.dataMdast;
            const classes = Array.isArray(child.properties.className) ? child.properties.className : [];
            if (child.tagName === 'dl' && classes.includes('gallery-item')) child.tagName = 'figure';
            if (child.tagName === 'dt' && classes.includes('gallery-icon')) child.tagName = 'div';
            if (child.tagName === 'dd' && classes.includes('wp-caption-text')) child.tagName = 'figcaption';
            normalize(child);
            const fallback = (!markdownElements.has(child.tagName) && !wrappers.has(child.tagName)) ||
                (child.tagName === 'table' && !simpleTable(child));
            if (fallback) {
                child.data ??= { position: {} };
                child.data.preservedHtml = toHtml(child);
                handlers[child.tagName] = (state, node, container) =>
                    node.data?.preservedHtml !== undefined
                        ? preserveHtml(state, node, container)
                        : standardHandlers[node.tagName](state, node, container);
            }
        }
    }
    normalize(clone);
    return { tree: clone, handlers };
}

const pre: Handle = (_state, node) => {
    const code = node.children.find((child) => child.type === 'element' && child.tagName === 'code');
    const classes = code?.type === 'element' ? code.properties.className : undefined;
    const language = Array.isArray(classes)
        ? classes.map(String).find((name) => name.startsWith('language-'))?.slice(9)
        : undefined;
    // A fenced block supplies the last line terminator itself. Keep all other whitespace,
    // including trailing empty lines (the default handler trims every trailing line).
    const result: Code = { type: 'code', lang: language, value: codeText(node).replace(/\n$/, '') };
    return result;
};

/** Parse once, as a fragment, so media preparation can edit the same HTML tree. */
export function parseHtml(html: string): Root {
    return parser.parse(html);
}

/** Serialize a prepared HTML tree without I/O, reparsing, or post-serialization whitespace changes. */
export function htmlTreeToMarkdown(root: Root): string {
    const { tree, handlers } = prepareTree(root);
    const converter = unified()
        .use(rehypeRemark, { handlers: { ...handlers, pre } })
        .use(remarkGfm)
        .use(remarkStringify, {
            bullet: '-',
            emphasis: '*',
            strong: '*',
            fences: true,
            incrementListMarker: true,
            listItemIndent: 'one',
            setext: false,
        });
    return converter.stringify(converter.runSync(tree));
}

/** Convert a prepared HTML fragment without network or filesystem access. */
export function htmlToMarkdown(html: string): string {
    return htmlTreeToMarkdown(parseHtml(html));
}
