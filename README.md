# WPxml2md

My attempt at a script that converts a Wordpress XML export into markdown that can be consumed by static site generators
like e.g. [Astro](https://astro.build/).

⚠️ Right now, it's hand-crafted, unfinished, hacky, and definitely doesn't cover all the different variants and styles
how content will come out of your worpress installation ⚠️

## How to

1. Download your Wordpress export file and save it as `export.html`.
2. Run `npm run readWpItems`. This will basically just translate the XML into a JSON file called `export.json`.
3. Run `npm run process`. This will attempt to read all posts and produce files in `output/<year>/<month>/<slug>/**/*`.

Each post folder contains its `index.md`. The `process` script attempts to download all images contained the post and
store them in a `./img` subfolder in the post's folder.

## TO DO

- [ ] produce better, cleaner output with less inline HTML and less HTML comments
- [ ] consider downloading videos
