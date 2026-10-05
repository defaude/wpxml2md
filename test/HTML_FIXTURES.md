# HTML-to-Markdown fixture contracts

`htmlFixtures.ts` is a synthetic, private-data-free corpus for the structured converter. It exports two phases:
`coreHtmlFixtures` describes ordinary HTML structure and Markdown behavior; `wordpressHtmlFixtures` covers WordPress
wrappers, image and video blocks, captions, and comments. Each entry contains the input fragment and the complete
expected Markdown body, without frontmatter. The converter tests consume these values as complete output assertions.

## Output conventions

- Use ATX headings (`#` through `######`).
- Use `-` for unordered items and incremented numbers for ordered items, respecting the list's `start` attribute. Indent
  nested items consistently.
- Use `*` and `**` for emphasis and strong emphasis, and backticks/fenced code for code. Code content, indentation, and
  blank lines are significant.
- Separate block elements with exactly one blank line. Adjacent inline spans contribute no separator. A `<br>` is a
  backslash hard line break.
- Escape Markdown punctuation that would otherwise become syntax when it is literal text. Use GFM pipes for simple
  tables.
- Preserve links and their formatted labels. Images use their localized `src` as the Markdown image destination; an
  enclosing link retains its own destination, whether it points to an article or a full-size media file.
- Render image and gallery captions as following paragraphs, preserving image order. Retain videos and unsupported
  structures as HTML, including relevant attributes and descendant content. Remove comments and treat ordinary wrappers
  transparently.
- Do not globally collapse whitespace after serialization. HTML fallbacks are deliberate output contracts, not silently
  discarded content.

The exact strings are active conversion contracts. The structural test suite also reparses Markdown to verify the
resulting hierarchy and node contents.

## Known limitations of the previous conversion

`src/processPost.ts` first replaces selected elements with Markdown strings, then passes the mutated document through
later HTML-oriented Cheerio steps. That means Markdown markers can be reparsed as text and are not represented as
structured nodes. It also strips paragraph wrappers before serialization, losing paragraph boundaries; replaces every
heading level with `#`; flattens unordered lists using all descendant `<li>` elements, losing nesting and ordered lists;
and flattens emphasis by interpolating child collections. Linked images are always changed to links targeting the
downloaded image, so article links are lost. Figure wrappers are stripped without explicit caption handling, and videos
are reduced to a `<video>` with only `controls` and `src`. Only images whose source starts with the site URL are
localized. Finally, manual comment handling reparses the HTML and a pair of global newline replacements attempts to
repair whitespace, without modeling block structure.

The baseline probes confirmed concrete failures: `<p>One</p><p>Two</p>` became `OneTwo`; `<h2>Two</h2><h3>Three</h3>`
became `# Two# Three`; formatted link text remained HTML around its Markdown emphasis; and a nested unordered list
duplicated its child item in the flattened output.

This fixture corpus intentionally does not copy any real export content. The real export remains a separate integration
check and is not fixture data.
