# WPxml2md

Convert a WordPress XML export into Markdown for static site generators such as Astro. Requires Deno 2.9 or newer.

This converter processes posts and attachment metadata; pages and other post types are ignored. It uses a structured
HTML/Markdown pipeline and downloads images, thumbnails and videos. Publication status, authors, comments and complete
WordPress theme/layout migration are outside its scope.

## Usage

Save your WordPress export as `export.xml`, then run:

```sh
deno task start
# Or specify another export:
deno task start path/to/export.xml
```

The converter creates `output/<year>/<month>/<day>_<slug>/index.md`, with downloaded media in each post's `media/`
directory. The day is the zero-padded UTC day of the month (`01` through `31`). Dates use native Temporal and ISO 8601;
frontmatter is serialized as YAML, including the same date-prefixed slug. Images with common WordPress thumbnail
suffixes try the full-sized URL first, then fall back to the original URL if that fails.

A normal run fails if `output` already exists, whether it is a file, directory or symlink. Move or remove it explicitly
before another normal run. Nothing is automatically deleted or overwritten by the CLI. Download failures, including
thumbnail failures, abort the post instead of claiming successful local references. A failed conversion may leave
partial output; inspect that output before moving or removing it and retrying.

## Preview without downloads

```sh
deno task start --dry-run path/to/export.xml
# Equivalent preview task, with network access denied and writes limited to output:
deno task preview path/to/export.xml
# Watch source changes and repeat the preview:
deno task dev path/to/export.xml
```

Dry-run writes the converted Markdown to the usual `output/<year>/<month>/<day>_<slug>/index.md` files, including local
links to files under `media/`. It creates post directories and replaces existing Markdown so conversion can be repeated
without deleting the output folder. It creates no new `media/` directories and preserves existing media and unrelated
files. The console shows progress and planned media URLs without printing Markdown content.

Dry-run and normal runs use the same text conversion. Preview assumes the full-sized image exists. It cannot predict
network failures or fallback filenames; a real download may therefore produce different image/link/thumbnail paths. The
first invocation may still fetch missing project dependencies into Deno's cache.

Use `deno task start --help` for the command summary.

## HTML conversion

The processing stages are:

1. `rehype-parse` parses the WordPress content as an HTML fragment into a HAST tree.
2. Media preparation changes HTML attributes to the resulting local paths. WordPress wrapper normalization removes
   comments and preserves captions, without inserting Markdown strings into HTML.
3. `rehype-remark` translates the prepared HTML tree into MDAST.
4. `remark-stringify`, with `remark-gfm`, serializes Markdown once. No global blank-line cleanup follows serialization.
5. `@std/yaml` adds frontmatter and the Markdown file is written.

`htmlToMarkdown(html)` is independently usable without filesystem or network access. `parseHtml` and
`htmlTreeToMarkdown` allow the post processor to prepare media on the same tree without reparsing HTML. Conversion
clones its tree; processing also leaves the input Post object unchanged, making repeated dry-runs deterministic.

Supported structures include separate paragraphs even without source whitespace, ATX heading levels 1–6, formatted
links, bold/emphasis, GFM strikethrough, explicit `<br>` hard breaks, nested unordered/ordered lists with numbering
starts, multiple paragraphs in list items and blockquotes, inline code, fenced code and simple rectangular tables with a
header row. Literal Markdown punctuation is escaped where needed. Adjacent inline elements introduce no spaces. Code
indentation and blank lines, including trailing blank lines, are retained; the closing fence supplies the final line
terminator. The HTML parser applies normal HTML entity and line-ending rules.

Gutenberg image/gallery/video figures and classic gallery-item/icon/caption wrappers retain their content order. Image
and gallery captions become following paragraphs. Gallery images are emitted in order as ordinary Markdown images;
WordPress grid layouts and column styling are not reproduced. Media links matching an image or its full-size variant use
its actual downloaded path, including fallbacks. Independently linked image files are localized separately; links to
articles retain their destinations. HTTP(S), site-relative and protocol-relative image sources are localized. Video
`src`, nested video `<source src>` and poster images are localized while the remaining attributes are retained. Repeated
source URLs within a post are downloaded once. A localized `<img>` loses remote `srcset`/`sizes` variants. Data URLs
remain inline and missing media sources do not trigger downloads.

## Deliberate HTML fallbacks and limits

Videos and their child source elements remain HTML, rather than being reduced to links. Complex tables (spans, captions,
unequal row lengths, nested tables, block content or explicit line breaks in cells), tables without a header row, embeds
such as iframes, SVG and elements without an intentional Markdown mapping retain their HTML and descendant content. HTML
fallback snapshots are taken before whitespace normalization; comments are removed even inside fallback trees. Ordinary
wrappers are transparent. HTML is normalized serialization of the parsed tree, rather than byte-for-byte source text.

The target renderer must enable raw HTML for these fallbacks and support GFM for tables/strikethrough. This project does
not configure an Astro site, apply target-specific CSS, sanitize HTML, expand WordPress shortcodes, execute embeds or
mirror iframe resources. Responsive `<picture>` sources, audio and subtitle-track resources are retained as HTML and are
not independently downloaded. Source filenames are used for downloads; different URLs with identical filenames can
collide within a post. The converter does not deduplicate media across posts, rewrite ordinary internal article links or
copy WordPress/theme-specific layouts and styles.

## Development

```sh
deno task verify
```

This runs formatting, lint, type checking (including verification tools) and tests with network explicitly denied. Tests
use temporary directories and synthetic content; they never process your real export or write to project output. The
fixture corpus is documented in `test/HTML_FIXTURES.md`. Small cases assert complete Markdown outputs; roundtrip checks
assert paragraph/heading structure, list hierarchy and starts, rich link labels and unchanged code contents. Media
integration tests simulate HTTP success, 404 full-image fallback and failed image/thumbnail/video responses, check saved
bytes, repeat dry-runs, preserve existing files and reject existing CLI output targets before XML parsing.

The official Deno agent skill is included under `.agents/skills/deno/`.

## Reproduce the real-article verification

The optional tool below reads the ignored local export, selects only `spezielle-schleusen-und-grosse-pferde` dated 16
October 2025 and processes only that article and its needed media. Each invocation creates a new temporary directory; it
never uses the project's existing `output`. Its relative Markdown path is
`output/2025/10/16_spezielle-schleusen-und-grosse-pferde/index.md`.

With dependencies already cached:

```sh
# Offline: filesystem output, no network access, then overwrite stale Markdown and repeat.
deno run --frozen --cached-only --allow-read --allow-write --deny-net tools/verifyExample.ts --dry-run export.xml

# Copy the reported offline verification directory into this comparison argument:
deno run --frozen --cached-only --allow-read --allow-write --allow-net=fernheimweh.de \
    tools/verifyExample.ts --download --compare /path/to/offline-verification-directory export.xml

# Generate a local CommonMark/GFM HTML preview of the successful live result and synthetic structures:
deno run --frozen --cached-only --allow-read --allow-write --deny-net \
    tools/renderPreview.ts /path/to/live-verification-directory

# Serve the temporary directory on loopback with MP4 byte-range support (Ctrl-C stops it):
deno run --frozen --cached-only --allow-read=/path/to/live-verification-directory --allow-net=127.0.0.1:38765 \
    tools/servePreview.ts /path/to/live-verification-directory
```

The verification directories contain the Markdown, a `result.json` with source counts, HTTP results, media paths, byte
totals and any real fallback attempts, and downloaded media only in the live run. A failed run writes `failure.json`,
exits unsuccessfully and leaves its acceptance open. File signatures reject empty/non-media error responses. The
comparison checks complete Markdown ASTs and frontmatter, allowing only paths backed by recorded full-size/original
fallback results. Preview is `preview.html` at the live directory root. Serve that temporary directory with a static
HTTP server supporting MP4 byte ranges, then open `/preview.html`; its base path resolves local media. The preview
contains no JavaScript and blocks external resources through CSP. Inspect the article and the synthetic nested-list,
multi-paragraph blockquote and code examples appended below it.

Verification on 5 October 2026 with Deno 2.9.7:

| Check                           | Result                                                                                                                                                          |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fresh HTML controls             | 14 paragraphs, 22 images, 6 galleries, 3 direct-source videos, thumbnail ID 6112                                                                                |
| Offline run with denied network | Markdown written and repeatably updated; no media directory, no downloads                                                                                       |
| Output structure                | 14 text paragraphs, 22 ordered image references and 3 HTML videos; 39 top-level Markdown blocks                                                                 |
| Live HTTP results               | 26 requests, all HTTP 200: 23 JPEG images (including thumbnail) and 3 MP4 videos                                                                                |
| Downloaded files                | 26 nonempty files, valid JPEG/MP4 signatures, 288,291,212 bytes; all local references resolve                                                                   |
| Full-size/original behavior     | All full-size image attempts succeeded; no real original fallback was required                                                                                  |
| Dry/live comparison             | Identical frontmatter and complete parsed Markdown structure; no path differences                                                                               |
| Visual inspection               | Local CommonMark/GFM view: 22 loaded article images; all 3 videos have controls, loaded metadata and no media error; spacing and synthetic nesting/code checked |
| Project protection              | Export SHA-256 unchanged; all 155 pre-existing project-output files unchanged                                                                                   |
| Final offline validation        | 54 tests passed; format, lint, types and `git diff --check` passed                                                                                              |

The live verification is evidence for that export/server snapshot. Missing-server and original-fallback behavior is
separately exercised by offline simulated HTTP tests. Visual acceptance covers the supplied local renderer; deployment
into a particular static-site theme, embed execution and actual video playback are separate target checks. Export
content, generated Markdown, media, reports and screenshots are not committed.

## Library choices

- `@libs/xml` maps WordPress namespaces, CDATA and attributes into objects and is backed by `@std/xml`.
- `@std/yaml` serializes frontmatter; `@std/cli` parses options; `@std/path` handles paths; `@std/text` supplies slug
  fallback.
- Native Temporal provides UTC dates; native object/array operations and Deno APIs handle mapping and files.
- `unified`, [`rehype-parse`](https://github.com/rehypejs/rehype/tree/main/packages/rehype-parse),
  [`rehype-remark`](https://github.com/rehypejs/rehype-remark),
  [`remark-stringify`](https://github.com/remarkjs/remark/tree/main/packages/remark-stringify) and
  [`remark-gfm`](https://github.com/remarkjs/remark-gfm) provide the HTML/Markdown pipeline through Deno npm imports.
- `hast-util-to-mdast` exposes default handlers for selective overrides; `hast-util-to-html` preserves explicit HTML
  fallbacks. HAST/MDAST type packages describe the trees. Cheerio is no longer needed.
- `remark-parse` supports structural tests and example verification; `mdast-util-to-hast` renders the local preview.
- Tests use `expect` from `@std/expect`. Dependencies and their resolved versions live in `deno.json` and `deno.lock`.
