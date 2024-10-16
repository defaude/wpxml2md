import { readXml } from './src/readXml.ts';
import { processPost } from './src/processPost.ts';
import { parse } from '@libs/xml';

async function main() {
    const [inputFilePath = 'export.xml'] = Deno.args;

    console.log(`Reading ${inputFilePath}...`);
    const { link, posts, attachments } = await readXml(inputFilePath);
    console.log('Wordpress XML has been read and parsed!');

    // todo prompt if the user really wants to delete the output folder

    console.log('Deleting & recreating ./output...');
    await Deno.remove('output', { recursive: true });
    await Deno.mkdir('output');
    console.log('Fresh output folder is ready!');

    for (const post of posts) {
        await processPost(post, link, attachments);
    }
}

if (import.meta.main) {
    await main();
}
