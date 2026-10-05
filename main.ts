import { parseArgs } from '@std/cli/parse-args';
import { readXml } from './src/readXml.ts';
import { processPost } from './src/processPost.ts';

export function parseOptions(args: string[]) {
    const flags = parseArgs(args, {
        boolean: ['dry-run', 'help'],
        alias: { help: 'h' },
        string: ['_'],
        unknown: (arg) => {
            if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`);
            return true;
        },
    });
    if (flags._.length > 1) throw new Error('Expected at most one XML input file.');
    return { input: String(flags._[0] ?? 'export.xml'), dryRun: flags['dry-run'], help: flags.help };
}

export async function main(args = Deno.args) {
    const { input, dryRun, help } = parseOptions(args);
    if (help) {
        console.log(
            'Usage: deno task start [--dry-run] [export.xml]\n\n--dry-run  Preview Markdown without downloads or filesystem changes.',
        );
        return;
    }
    if (!dryRun) {
        // Check before parsing; creation below also protects against concurrent creation.
        const exists = await Deno.lstat('output').then(() => true).catch((error) => {
            if (error instanceof Deno.errors.NotFound) return false;
            throw error;
        });
        if (exists) throw new Error('Target "output" already exists. Move or remove it, or use --dry-run.');
    }
    console.log(`Reading ${input}...`);
    const { link, posts, attachments } = await readXml(input);
    if (!dryRun) await Deno.mkdir('output');
    for (const post of posts) {
        const markdown = await processPost(post, link, attachments, dryRun);
        if (dryRun) console.log(`\n[dry-run] Markdown for ${post.slug}:\n${markdown}\n`);
    }
}

if (import.meta.main) {
    try {
        await main();
    } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        Deno.exitCode = 1;
    }
}
