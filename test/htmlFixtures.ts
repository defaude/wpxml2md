/** Synthetic HTML-to-Markdown contracts; no content is taken from a WordPress export. */
export interface HtmlConversionFixture {
    name: string;
    html: string;
    markdown: string;
}

export const coreHtmlFixtures: HtmlConversionFixture[] = [
    {
        name: 'adjacent paragraphs form separate Markdown paragraphs',
        html: '<p>One</p><p>Two</p>',
        markdown: 'One\n\nTwo' + '\n',
    },
    {
        name: 'adjacent inline spans add no separator',
        html: '<span>One</span><span>Two</span>',
        markdown: 'OneTwo' + '\n',
    },
    {
        name: 'mixed inline content and formatted link text',
        html:
            '<p>A <strong>bold</strong> and <em>soft</em> <a href="https://example.org"><strong>linked bold</strong> and <em>linked soft</em></a>.</p>',
        markdown: 'A **bold** and *soft* [**linked bold** and *linked soft*](https://example.org).' + '\n',
    },
    {
        name: 'heading levels one through six',
        html: '<h1>Level 1</h1><h2>Level 2</h2><h3>Level 3</h3><h4>Level 4</h4><h5>Level 5</h5><h6>Level 6</h6>',
        markdown: '# Level 1\n\n## Level 2\n\n### Level 3\n\n#### Level 4\n\n##### Level 5\n\n###### Level 6' + '\n',
    },
    {
        name: 'nested unordered and ordered lists retain nesting and start',
        html:
            '<ul><li>Alpha<ol start="3"><li>Three<ul><li>Nested</li></ul></li><li>Four</li></ol></li><li>Beta</li></ul>',
        markdown: '- Alpha\n\n  3. Three\n     - Nested\n  4. Four\n\n- Beta' + '\n',
    },
    {
        name: 'loose list items retain multiple paragraphs',
        html: '<ul><li><p>First paragraph</p><p>Second paragraph</p></li><li><p>Another item</p></li></ul>',
        markdown: '- First paragraph\n\n  Second paragraph\n\n- Another item' + '\n',
    },
    {
        name: 'blockquote retains multiple paragraphs',
        html: '<blockquote><p>First quote.</p><p>Second quote.</p></blockquote>',
        markdown: '> First quote.\n>\n> Second quote.' + '\n',
    },
    {
        name: 'br is an explicit Markdown hard break',
        html: '<p>First line<br>Second line</p>',
        markdown: 'First line\\\nSecond line' + '\n',
    },
    {
        name: 'inline code and fenced code preserve source whitespace',
        html: '<p>Run <code>a * b</code>.</p><pre><code>  first line\n\n\n    indented line\n</code></pre>',
        markdown: 'Run `a * b`.\n\n```\n  first line\n\n\n    indented line\n```' + '\n',
    },
    {
        name: 'strikethrough uses GFM syntax',
        html: '<p>Keep <del>old</del> text.</p>',
        markdown: 'Keep ~~old~~ text.' + '\n',
    },
    {
        name: 'literal Markdown punctuation is escaped as text',
        html: '<p>Keep *stars*, _underscores_, and [brackets].</p>',
        markdown: 'Keep \\*stars\\*, \\_underscores\\_, and \\[brackets].' + '\n',
    },
    {
        name: 'simple table uses GFM table syntax',
        html:
            '<table><thead><tr><th>Name</th><th>Count</th></tr></thead><tbody><tr><td>Horse</td><td>2</td></tr></tbody></table>',
        markdown: '| Name  | Count |\n| ----- | ----- |\n| Horse | 2     |' + '\n',
    },
    {
        name: 'ordinary block wrapper preserves its child block boundary',
        html: '<div class="wrapper"><p>First</p><p>Second</p></div>',
        markdown: 'First\n\nSecond' + '\n',
    },
];

export const wordpressHtmlFixtures: HtmlConversionFixture[] = [
    {
        name: 'complex colspan table is preserved as HTML',
        html: '<table><tr><td colspan="2">Combined</td></tr></table>',
        markdown: '<table><tbody><tr><td colspan="2">Combined</td></tr></tbody></table>' + '\n',
    },
    {
        name: 'embed fallback retains complete HTML',
        html: '<iframe src="https://video.example/embed/7" title="A video" allowfullscreen></iframe>',
        markdown: '<iframe src="https://video.example/embed/7" title="A video" allowfullscreen></iframe>' + '\n',
    },
    {
        name: 'unknown custom element fallback retains element and content',
        html: '<wp-special data-mode="keep"><p>Inside</p></wp-special>',
        markdown: '<wp-special data-mode="keep"><p>Inside</p></wp-special>' + '\n',
    },
    {
        name: 'single image with alt text',
        html: '<figure class="wp-block-image"><img src="https://media.example/picture.jpg" alt="A picture"></figure>',
        markdown: '![A picture](https://media.example/picture.jpg)' + '\n',
    },
    {
        name: 'linked image to an article retains article destination',
        html: '<a href="https://example.org/story"><img src="https://media.example/thumb.jpg" alt="Story"></a>',
        markdown: '[![Story](https://media.example/thumb.jpg)](https://example.org/story)' + '\n',
    },
    {
        name: 'linked image to media retains linked media destination',
        html:
            '<a href="https://media.example/full.jpg"><img src="https://media.example/thumb.jpg" alt="Full size"></a>',
        markdown: '[![Full size](https://media.example/thumb.jpg)](https://media.example/full.jpg)' + '\n',
    },
    {
        name: 'gallery retains image order and following caption',
        html:
            '<figure class="wp-block-gallery"><figure class="wp-block-image"><img src="https://media.example/one.jpg" alt="One"></figure><figure class="wp-block-image"><img src="https://media.example/two.jpg" alt="Two"></figure><figcaption>Gallery caption</figcaption></figure>',
        markdown: '![One](https://media.example/one.jpg)\n\n![Two](https://media.example/two.jpg)\n\nGallery caption' +
            '\n',
    },
    {
        name: 'image caption follows its image as a paragraph',
        html:
            '<figure class="wp-block-image"><img src="https://media.example/one.jpg" alt="One"><figcaption>Image caption</figcaption></figure>',
        markdown: '![One](https://media.example/one.jpg)\n\nImage caption' + '\n',
    },
    {
        name: 'video retains relevant attributes and fallback source',
        html:
            '<figure class="wp-block-video"><video controls muted poster="https://media.example/poster.jpg" src="https://media.example/clip.mp4"><source src="https://media.example/alternate.webm" type="video/webm"></video><figcaption>Clip caption</figcaption></figure>',
        markdown:
            '<video controls muted poster="https://media.example/poster.jpg" src="https://media.example/clip.mp4"><source src="https://media.example/alternate.webm" type="video/webm"></video>\n\nClip caption' +
            '\n',
    },
    {
        name: 'comments disappear while surrounding text remains',
        html: '<p>Before<!-- exporter note -->after</p>',
        markdown: 'Beforeafter' + '\n',
    },
    {
        name: 'ordinary wrappers are transparent without invented blocks',
        html: '<div class="wrapper"><span>Inside</span><span> wrapper</span></div>',
        markdown: 'Inside wrapper' + '\n',
    },
];
