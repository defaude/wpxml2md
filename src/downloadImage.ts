import { mkdir, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import get from 'axios';

export async function downloadImage(url: string, postFolder: URL): Promise<string | undefined> {
    console.info(`downloading ${url}`);
    // const response = await get(url, { responseType: 'arraybuffer' });
    //
    // if (response.status !== 200) {
    //     throw new Error(`Failed to download ${url}\n(${response.statusText})`);
    // }
    //
    // const imageFolder = new URL('img/', postFolder);
    // await mkdir(imageFolder, { recursive: true });

    const filename = basename(url);
    // const imageFilePath = new URL(filename, imageFolder);

    // await writeFile(imageFilePath, Buffer.from(response.data));
    return `./img/${filename}`;
}
