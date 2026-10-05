# WPxml2md

Convert a WordPress XML export into Markdown for static site generators such as Astro. Requires Deno 2.9 or newer.

This is a small, purpose-built converter, not a complete WordPress migration tool. It processes posts and attachment
metadata; pages and other post types are ignored. HTML conversion covers common images, WordPress video blocks, links,
emphasis, lists and headings. Complex blocks and nested structures may need manual cleanup.

## Usage

Save your WordPress export as `export.xml`, then run:

```sh
deno task start
# Or specify another export:
deno task start path/to/export.xml
```

The converter creates `output/<year>/<month>/<slug>/index.md`, with downloaded media in each post's `media/` directory.
Dates use UTC and ISO 8601; frontmatter is serialized as YAML. Images with common WordPress thumbnail suffixes try the
full-sized URL first, then fall back to the original URL if that fails.

A normal run fails if `output` already exists, whether it is a file, directory or symlink. Move or remove it explicitly
before another normal run. Nothing is automatically deleted or overwritten. A failed conversion may leave partial
output; inspect that output before moving or removing it and retrying.

## Preview without downloads

```sh
deno task start --dry-run path/to/export.xml
# Equivalent preview task, with network access denied and writes limited to output:
deno task preview path/to/export.xml
# Watch source changes and repeat the preview:
deno task dev path/to/export.xml
```

Dry-run writes the converted Markdown to the usual `output/<year>/<month>/<slug>/index.md` files, including local links
to files under `media/`. It creates the required directories and replaces existing Markdown files so you can repeat the
conversion without deleting the output folder. Media downloads are skipped; existing media and unrelated files are
preserved. The console shows progress and planned media URLs, without printing the Markdown content. The default input
is `export.xml` for all tasks.

The preview assumes the full-sized image exists. It cannot predict download errors or the resulting fallback filenames
without accessing the network. The first invocation may still fetch missing project dependencies into Deno's cache.

Use `deno task start --help` for the command summary.

## Development

```sh
deno task verify
```

This runs formatting, lint, type checking and offline tests. Tests cover XML parsing, YAML round trips, text conversion,
downloads with simulated HTTP responses, existing-target protection and dry-run with denied network permissions. They
use temporary directories and never process your real export.

The official Deno agent skill is included under `.agents/skills/deno/`.

## Library choices

- `@libs/xml` maps XML into objects and is backed by `@std/xml`. Keeping that adapter avoids reimplementing WordPress
  namespace, CDATA and attribute handling on top of the lower-level parser.
- `@std/yaml` serializes frontmatter, replacing hand-written quoting and escaping.
- `@std/cli` parses options; `@std/path` handles filesystem paths; `@std/text` supplies slug fallback.
- Native `Temporal` UTC methods replace the two date-fns dependencies. Native `Object.fromEntries`, `Deno.readTextFile`
  and `Deno.writeTextFile` replace manual accumulation and file handling.
- Tests use the `expect` syntax from `@std/expect`.
- Cheerio remains responsible for HTML parsing and traversal. Deno's standard libraries do not provide an equivalent
  HTML-to-Markdown converter. The WordPress-specific transformations and thumbnail suffix handling remain local.

## Known limitations

Paragraph boundaries without intervening whitespace, nested lists, heading levels and unsupported WordPress blocks still
need more conversion work. These pre-existing limitations are not resolved by updating the toolchain or using dry-run.
