import { writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import get from 'axios';

// -(3-5 digits)x(3-5 digits) with a positive lookahead to the extension and the end of the string
const thumbnailPattern = /-\d{3,5}x\d{3,5}(?=\.\w{3,4}$)/;

async function doDownload(url: string): Promise<[Buffer, null] | [null, string]> {
    const response = await get(url, { responseType: 'arraybuffer' });
    if (response.status === 200) {
        return [Buffer.from(response.data), null] as const;
    }

    return [null, response.statusText];
}

export async function downloadImage(url: string, imageFolder: URL) {
    const originalImageUrl = url.replace(thumbnailPattern, '');

    let buffer: Buffer;

    if (originalImageUrl !== url) {
        // the url seems to point to a thumbnail => attempt to download the original file instead
        console.info(`${url} seems to be a thumbnail\n => downloading ${originalImageUrl} instead`);
        const [originalBuffer, statusText] = await doDownload(originalImageUrl);
        if (statusText) {
            console.warn('Failed to download original image, continuing with the URL from the post');
        } else {
            buffer = originalBuffer;
        }
    }

    if (!buffer) {
        console.info(`Downloading ${url}`);
        const [urlBuffer, statusText] = await doDownload(url);
        if (statusText) {
            throw new Error(`Failed to download ${url}\n(${statusText})`);
        }
        buffer = urlBuffer;
    }

    const filename = basename(url);
    const imageFilePath = new URL(filename, imageFolder);
    await writeFile(imageFilePath, Buffer.from(buffer));
}
