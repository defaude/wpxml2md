import { parseArgs } from '@std/cli/parse-args';
import { basename, join, resolve } from '@std/path';
import { parse as parseYaml } from '@std/yaml';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import type { Element, Nodes as HtmlNode } from 'hast';
import type { Nodes as MarkdownNode } from 'mdast';
import { parseHtml } from '../src/htmlToMarkdown.ts';
import { processPost } from '../src/processPost.ts';
import { readXml } from '../src/readXml.ts';
import { unThumbnail } from '../src/unThumbnail.ts';

const slug = 'spezielle-schleusen-und-grosse-pferde';
const relativeMarkdown = `output/2025/10/16_${slug}/index.md`;
const markdownParser = unified().use(remarkParse).use(remarkGfm);

function check(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

function htmlElements(node: HtmlNode): Element[] {
    return 'children' in node
        ? node.children.flatMap((child) => [
            ...(child.type === 'element' ? [child] : []),
            ...htmlElements(child),
        ])
        : [];
}

function markdownNodes(node: MarkdownNode): MarkdownNode[] {
    return [node, ...('children' in node ? node.children.flatMap(markdownNodes) : [])];
}

function text(node: HtmlNode | MarkdownNode): string {
    if (node.type === 'text' || node.type === 'inlineCode') return node.value;
    return 'children' in node ? node.children.map(text).join('') : '';
}

function normalizedText(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

async function hashFile(path: string): Promise<string> {
    const hash = await crypto.subtle.digest('SHA-256', await Deno.readFile(path));
    return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function mediaType(path: string): Promise<string> {
    using file = await Deno.open(path);
    const bytes = new Uint8Array(16);
    await file.read(bytes);
    const ascii = (start: number, end: number) => new TextDecoder().decode(bytes.slice(start, end));
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'JPEG';
    if (bytes[0] === 0x89 && ascii(1, 4) === 'PNG') return 'PNG';
    if (ascii(0, 3) === 'GIF') return 'GIF';
    if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'WebP';
    if (ascii(4, 8) === 'ftyp') return 'MP4';
    if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return 'WebM';
    throw new Error(`Unrecognized media signature (possibly an HTML error response): ${path}`);
}

function splitMarkdown(markdown: string) {
    const boundary = markdown.indexOf('\n---\n', 4);
    check(markdown.startsWith('---\n') && boundary >= 0, 'Missing frontmatter');
    return {
        metadata: parseYaml(markdown.slice(4, boundary)) as Record<string, unknown>,
        body: markdown.slice(boundary + 5),
    };
}

function canonical(value: unknown, paths: Map<string, string>): unknown {
    const normalize = (string: string) => {
        for (const [from, to] of paths) string = string.replaceAll(from, to);
        return string;
    };
    if (Array.isArray(value)) return value.map((child) => canonical(child, paths));
    if (value && typeof value === 'object') {
        const object = value as Record<string, unknown>;
        return Object.fromEntries(
            Object.entries(object).filter(([key]) => key !== 'position').map(([key, child]) => [
                key,
                (key === 'url' || (object.type === 'html' && key === 'value')) && typeof child === 'string'
                    ? normalize(child)
                    : canonical(child, paths),
            ]),
        );
    }
    return value;
}

function equal(actual: unknown, expected: unknown, message: string) {
    check(JSON.stringify(actual) === JSON.stringify(expected), message);
}

export async function verifyExample(args = Deno.args) {
    const flags = parseArgs(args, {
        boolean: ['dry-run', 'download', 'help'],
        string: ['compare'],
        unknown: (arg) => {
            if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`);
            return true;
        },
    });
    if (flags.help) {
        console.log('Usage: verifyExample.ts [--dry-run | --download] [--compare DRY_RUN_DIRECTORY] [export.xml]');
        return;
    }
    check(flags._.length <= 1 && !(flags['dry-run'] && flags.download), 'Invalid arguments');
    check(!flags.compare || flags.download, '--compare requires --download');
    const dryRun = !flags.download;
    const input = resolve(String(flags._[0] ?? 'export.xml'));
    const compare = flags.compare ? resolve(flags.compare) : undefined;
    const inputHash = await hashFile(input);
    const { posts, link, attachments } = await readXml(input);
    const selected = posts.filter((post) => post.slug === slug);
    check(selected.length === 1, 'Expected exactly one selected article');
    const post = selected[0];
    check(post.createdAt.startsWith('2025-10-16T'), 'Unexpected article date');
    const source = parseHtml(post.content);
    const sourceElements = htmlElements(source);
    const images = sourceElements.filter((node) => node.tagName === 'img');
    const videos = sourceElements.filter((node) => node.tagName === 'video');
    const paragraphs = sourceElements.filter((node) => node.tagName === 'p' || node.tagName === 'figcaption');
    const thumbnailUrl = post.thumbnailId ? attachments[post.thumbnailId] : undefined;
    check(thumbnailUrl, 'Selected article thumbnail missing from attachment metadata');
    const imageUrls = [
        ...new Set([
            thumbnailUrl,
            ...images.map((node) => new URL(String(node.properties.src), link).href),
        ]),
    ];
    const counts = {
        paragraphs: sourceElements.filter((node) => node.tagName === 'p').length,
        images: images.length,
        galleries:
            sourceElements.filter((node) =>
                node.tagName === 'figure' && Array.isArray(node.properties.className) &&
                node.properties.className.includes('wp-block-gallery')
            ).length,
        directVideos: videos.filter((node) => node.properties.src).length,
        thumbnailId: post.thumbnailId,
    };
    console.log(`Fresh source controls: ${JSON.stringify(counts)}`);
    const root = await Deno.makeTempDir({ prefix: `wpxml2md-example-${dryRun ? 'dry' : 'live'}-` });
    console.log(`Verification directory: ${root}`);
    const cwd = Deno.cwd();
    const originalFetch = globalThis.fetch;
    const requests: { url: string; status?: number; contentType?: string | null; error?: string }[] = [];
    globalThis.fetch = async (input, init) => {
        const url = String(input);
        check(!dryRun, `Dry-run attempted network access: ${url}`);
        try {
            const response = await originalFetch(input, init);
            requests.push({ url, status: response.status, contentType: response.headers.get('content-type') });
            return response;
        } catch (error) {
            requests.push({ url, error: String(error) });
            throw error;
        }
    };
    try {
        Deno.chdir(root);
        const markdown = await processPost(post, link, { [post.thumbnailId!]: thumbnailUrl }, dryRun);
        const file = join(root, relativeMarkdown);
        equal(await Deno.readTextFile(file), markdown, 'Written Markdown differs from return value');
        const { metadata, body } = splitMarkdown(markdown);
        equal(metadata.slug, `2025/10/16_${slug}`, 'Wrong frontmatter slug');
        equal(metadata.createdAt, post.createdAt, 'Wrong frontmatter date');
        const result = markdownParser.parse(body);
        const nodes = markdownNodes(result);
        const resultImages = nodes.filter((node) => node.type === 'image');
        const resultParagraphs = nodes.filter((node) => node.type === 'paragraph' && normalizedText(text(node)));
        equal(
            resultParagraphs.map((node) => normalizedText(text(node))),
            paragraphs.map((node) => normalizedText(text(node))),
            'Paragraph text or order differs',
        );
        equal(
            nodes.filter((node) => node.type === 'strong').map(text),
            sourceElements.filter((node) => node.tagName === 'strong').map(text),
            'Bold text differs',
        );
        const successful = new Set(
            requests.filter((request) => request.status && request.status >= 200 && request.status < 300)
                .map((request) => request.url),
        );
        const pathFor = (url: string) => {
            const absolute = new URL(url, link).href;
            const full = unThumbnail(absolute);
            return `media/${basename(new URL(dryRun || successful.has(full) ? full : absolute).pathname)}`;
        };
        equal(
            resultImages.map((node) => node.url),
            images.map((node) => pathFor(String(node.properties.src))),
            'Image paths or order differ',
        );
        equal(
            resultImages.map((node) => node.alt),
            images.map((node) => node.properties.alt ?? basename(new URL(String(node.properties.src), link).pathname)),
            'Image alt text differs',
        );
        equal(metadata.thumbnail, pathFor(thumbnailUrl), 'Wrong thumbnail path');
        const resultVideos = nodes.filter((node) => node.type === 'html').flatMap((node) =>
            htmlElements(parseHtml(node.value)).filter((element) => element.tagName === 'video')
        );
        equal(
            resultVideos.map((node) => node.properties),
            videos.map((node) => ({
                ...node.properties,
                ...(node.properties.src ? { src: pathFor(String(node.properties.src)) } : {}),
                ...(node.properties.poster ? { poster: pathFor(String(node.properties.poster)) } : {}),
            })),
            'Video order or attributes differ',
        );
        // Check the complete paragraph/image/video sequence, rather than only independent counts.
        const sourceOrder = sourceElements.filter((node) => ['p', 'img', 'video', 'figcaption'].includes(node.tagName))
            .map((node) => node.tagName === 'img' ? 'image' : node.tagName === 'video' ? 'video' : 'paragraph');
        const resultOrder = result.children.flatMap((node) => {
            if (node.type === 'paragraph' && normalizedText(text(node))) return ['paragraph'];
            return markdownNodes(node).flatMap((child) => {
                if (child.type === 'image') return ['image'];
                if (child.type === 'html') {
                    return htmlElements(parseHtml(child.value)).filter((element) => element.tagName === 'video')
                        .map(() => 'video');
                }
                return [];
            });
        });
        equal(resultOrder, sourceOrder, 'Block/media sequence differs');
        const media = join(root, relativeMarkdown, '..', 'media');
        const localReferences = [
            ...new Set([
                String(metadata.thumbnail),
                ...nodes.flatMap((node) =>
                    (node.type === 'image' || node.type === 'link') && node.url.startsWith('media/') ? [node.url] : []
                ),
                ...resultVideos.flatMap((node) =>
                    [node, ...htmlElements(node)].flatMap((element) =>
                        ['src', 'poster'].flatMap((key) => {
                            const value = element.properties[key];
                            return typeof value === 'string' && value.startsWith('media/') ? [value] : [];
                        })
                    )
                ),
            ]),
        ];
        let files = 0;
        let bytes = 0;
        const mediaTypes: Record<string, number> = {};
        if (dryRun) {
            check(requests.length === 0, 'Dry-run fetched media');
            const mediaExists = await Deno.stat(media).then(() => true).catch((error) => {
                if (error instanceof Deno.errors.NotFound) return false;
                throw error;
            });
            check(!mediaExists, 'Dry-run created media directory');
            await Deno.writeTextFile(file, 'stale Markdown');
            equal(
                await processPost(post, link, { [post.thumbnailId!]: thumbnailUrl }, true),
                markdown,
                'Repeated dry-run changed output',
            );
            equal(await Deno.readTextFile(file), markdown, 'Repeated dry-run did not update Markdown');
        } else {
            for (const reference of localReferences) {
                const stat = await Deno.stat(join(file, '..', decodeURIComponent(reference)));
                check(stat.isFile && stat.size > 0, `Missing/empty referenced file: ${reference}`);
            }
            for await (const entry of Deno.readDir(media)) {
                const stat = await Deno.stat(join(media, entry.name));
                check(entry.isFile && stat.size > 0, `Invalid media file: ${entry.name}`);
                files++;
                bytes += stat.size;
                const type = await mediaType(join(media, entry.name));
                mediaTypes[type] = (mediaTypes[type] ?? 0) + 1;
            }
            equal(files, localReferences.length, 'Unexpected unreferenced media files');
        }
        const fallbacks = imageUrls.filter((url) =>
            unThumbnail(url) !== url && successful.has(url) && !successful.has(unThumbnail(url))
        )
            .map((url) => ({ attempted: unThumbnail(url), original: url, path: pathFor(url) }));
        const paths = new Map(
            fallbacks.map(({ original, path }) => [path, `media/${basename(new URL(unThumbnail(original)).pathname)}`]),
        );
        if (compare) {
            const earlier = JSON.parse(await Deno.readTextFile(join(compare, 'result.json')));
            check(earlier.mode === 'dry-run' && earlier.inputHash === inputHash, 'Comparison input/mode differs');
            const dry = splitMarkdown(await Deno.readTextFile(join(compare, relativeMarkdown)));
            equal(
                canonical(result, paths),
                canonical(markdownParser.parse(dry.body), new Map()),
                'Dry/live Markdown differs beyond recorded fallback paths',
            );
            equal(
                { ...metadata, thumbnail: paths.get(String(metadata.thumbnail)) ?? metadata.thumbnail },
                dry.metadata,
                'Dry/live frontmatter differs beyond recorded fallback paths',
            );
        }
        equal(await hashFile(input), inputHash, 'Export changed during verification');
        const report = {
            mode: dryRun ? 'dry-run' : 'download',
            inputHash,
            relativeMarkdown,
            counts,
            markdown: {
                paragraphs: resultParagraphs.length,
                images: resultImages.length,
                videos: resultVideos.length,
                blocks: result.children.length,
            },
            localReferences: localReferences.length,
            files,
            bytes,
            mediaTypes,
            fallbacks,
            requests,
            comparisonPassed: !!compare,
        };
        await Deno.writeTextFile(join(root, 'result.json'), JSON.stringify(report, null, 2) + '\n');
        console.log(
            `Verification passed: ${
                JSON.stringify({
                    mode: report.mode,
                    markdown: report.markdown,
                    files,
                    bytes,
                    fallbacks: fallbacks.length,
                    comparisonPassed: !!compare,
                })
            }`,
        );
        return { root, file, report };
    } catch (error) {
        await Deno.writeTextFile(
            join(root, 'failure.json'),
            JSON.stringify({ inputHash, counts, requests, error: String(error) }, null, 2) + '\n',
        );
        throw error;
    } finally {
        globalThis.fetch = originalFetch;
        Deno.chdir(cwd);
    }
}

if (import.meta.main) {
    try {
        await verifyExample();
    } catch (error) {
        console.error(error);
        Deno.exitCode = 1;
    }
}
