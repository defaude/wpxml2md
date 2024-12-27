import { basename, join, relative } from '@std/path';

// -(3-5 digits)x(3-5 digits) with a positive lookahead to the extension and the end of the string
const thumbnailPattern = /-\d{3,5}x\d{3,5}(?=\.\w{3,4}$)/;

function getFullSizedUrl(url: string) {
    return url.replace(thumbnailPattern, '');
}

export async function doDownload(url: string, targetFolder: string, relativeSourceFolder: string) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to download ${url}\n(${response.statusText})`);
    }

    const buffer = await response.arrayBuffer();
    const filename = basename(url);
    const filePath = join(targetFolder, filename);

    await Deno.writeFile(filePath, new Uint8Array(buffer));

    return relative(relativeSourceFolder, filePath);
}

export async function downloadImage(image: string, imageFolder: string, postFolder: string): Promise<string> {
    const url = getFullSizedUrl(image);

    if (url !== image) {
        console.log(`${image} seems to be a thumbnail\n => downloading ${url} instead`);
        try {
            return await doDownload(url, imageFolder, postFolder);
        } catch (_e) {
            console.warn('Failed to download original image, continuing with the URL from the post');
        }
    }

    return await doDownload(image, imageFolder, postFolder);
}

export async function downloadVideo(video: string, videoFolder: string, postFolder: string): Promise<string> {
    return await doDownload(video, videoFolder, postFolder);
}
