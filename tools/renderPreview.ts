import { join, resolve } from '@std/path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { toHast } from 'mdast-util-to-hast';
import { toHtml } from 'hast-util-to-html';
import { htmlToMarkdown } from '../src/htmlToMarkdown.ts';
import { coreHtmlFixtures } from '../test/htmlFixtures.ts';

const parser = unified().use(remarkParse).use(remarkGfm);
function render(markdown: string): string {
    return toHtml(toHast(parser.parse(markdown), { allowDangerousHtml: true }), { allowDangerousHtml: true });
}

export async function renderPreview(directory: string) {
    const root = resolve(directory);
    const report = JSON.parse(await Deno.readTextFile(join(root, 'result.json')));
    if (report.mode !== 'download') throw new Error('Use a completed download verification directory for preview.');
    const markdown = await Deno.readTextFile(join(root, report.relativeMarkdown));
    const boundary = markdown.indexOf('\n---\n', 4);
    if (boundary < 0) throw new Error('Missing frontmatter');
    const body = markdown.slice(boundary + 5);
    const fixtures = coreHtmlFixtures.filter((fixture) =>
        /heading levels|nested unordered|loose list|blockquote|inline code|mixed inline/.test(fixture.name)
    );
    const html = `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; media-src 'self'">
<base href="/${report.relativeMarkdown.slice(0, report.relativeMarkdown.lastIndexOf('/') + 1)}">
<title>WordPress Markdown verification</title>
<style>
body { max-width: 760px; margin: 32px auto; padding: 0 24px; font: 18px/1.6 system-ui, sans-serif; color: #202428; background: #fff; }
h1, h2, h3, h4, h5, h6 { line-height: 1.25; margin: 1.5em 0 .65em; }
p { margin: 1em 0; } img { display: block; max-width: 100%; height: auto; margin: 1em auto; }
video { display: block; max-width: 100%; width: 100%; max-height: 500px; margin: 1em 0; }
li > p { margin: .5em 0; } li > ul, li > ol { margin: .5em 0; }
blockquote { border-left: 4px solid #b8c0c8; margin: 1em 0; padding-left: 20px; }
pre { white-space: pre; overflow: auto; background: #f0f2f4; padding: 16px; } code { font-family: monospace; }
a { color: #075ea3; } section { border-top: 1px solid #b8c0c8; margin-top: 48px; padding-top: 16px; }
</style></head><body>
<header><h1>WordPress Markdown verification</h1><p>CommonMark/GFM with retained HTML and local media. No scripts or automatic playback.</p></header>
<article id="article">${render(body)}</article>
<section id="structures"><h2>Synthetic structure checks</h2>${
        fixtures.map((fixture, index) =>
            `<section id="fixture-${index}"><h3>${fixture.name}</h3>${render(htmlToMarkdown(fixture.html))}</section>`
        ).join('\n')
    }</section>
</body></html>`;
    const preview = join(root, 'preview.html');
    await Deno.writeTextFile(preview, html);
    console.log(`Preview written: ${preview}`);
    return preview;
}

if (import.meta.main) {
    if (Deno.args.length !== 1) throw new Error('Usage: renderPreview.ts DOWNLOAD_VERIFICATION_DIRECTORY');
    await renderPreview(Deno.args[0]);
}
