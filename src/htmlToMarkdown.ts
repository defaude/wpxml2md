import { unified } from 'unified';
import rehypeParse from 'rehype-parse';
import rehypeRemark from 'rehype-remark';
import remarkGfm from 'remark-gfm';
import remarkStringify from 'remark-stringify';
import type { Nodes } from 'hast';
import type { Code } from 'mdast';

function codeText(node: Nodes): string {
    if (node.type === 'text') return node.value;
    if (node.type === 'element' && node.tagName === 'br') return '\n';
    return 'children' in node ? node.children.map(codeText).join('') : '';
}

const converter = unified()
    .use(rehypeParse, { fragment: true })
    .use(rehypeRemark, {
        handlers: {
            pre(_state, node) {
                const code = node.children.find((child) => child.type === 'element' && child.tagName === 'code');
                const classes = code?.type === 'element' ? code.properties.className : undefined;
                const language = Array.isArray(classes)
                    ? classes.map(String).find((name) => name.startsWith('language-'))?.slice(9)
                    : undefined;
                // A fenced block supplies the last line terminator itself. Keep all other whitespace,
                // including trailing empty lines (the default handler trims every trailing line).
                const result: Code = { type: 'code', lang: language, value: codeText(node).replace(/\n$/, '') };
                return result;
            },
        },
    })
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

/** Convert a prepared HTML fragment without network or filesystem access. */
export function htmlToMarkdown(html: string): string {
    return String(converter.processSync(html));
}
