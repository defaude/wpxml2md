import { readXml } from './src/readXml.ts';
import { processPost } from './src/processPost.ts';

async function main() {
    const [inputFilePath = 'export.xml'] = Deno.args;

    console.log(`Reading ${inputFilePath}...`);
    const { link, posts, attachments } = await readXml(inputFilePath);
    console.log('Wordpress XML has been read and parsed!');

    const fileInfo = await Deno.stat('output').catch(() => {});
    if (fileInfo) {
        if (fileInfo.isFile) {
            console.error('%cA file named "output" already exists; exiting.', 'color: red');
            Deno.exit(1);
        }
        if (fileInfo.isDirectory) {
            const deleteOutput = confirm('The folder "output" already exists; do you want to delete it first');
            if (deleteOutput) {
                await Deno.remove('output', { recursive: true });
                await Deno.mkdir('output');
                console.log('Fresh output folder is ready!');
            }
        }
    }

    for (const post of posts) {
        await processPost(post, link, attachments);
    }
}

if (import.meta.main) {
    await main();
}
