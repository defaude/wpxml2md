import { writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import get from 'axios';

export async function downloadImage(url: string, imageFolder: URL) {
    console.info(`downloading ${url}`);
    const response = await get(url, { responseType: 'arraybuffer' });

    if (response.status !== 200) {
        throw new Error(`Failed to download ${url}\n(${response.statusText})`);
    }

    const filename = basename(url);
    const imageFilePath = new URL(filename, imageFolder);
    await writeFile(imageFilePath, Buffer.from(response.data));
}
