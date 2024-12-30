import { basename, join, relative } from '@std/path';
import { unThumbnail } from './unThumbnail.ts';

async function doDownload(url: string, targetFolder: string, relativeSourceFolder: string) {
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

export async function downloadImage(image: string, mediaFolder: string, postFolder: string): Promise<string> {
    const url = unThumbnail(image);

    if (url !== image) {
        try {
            const resultingUrl = await doDownload(url, mediaFolder, postFolder);
            console.log(`  🏞️  downloaded ${url} (full-sized)`);
            return resultingUrl;
        } catch (_e) {
            console.warn(`  ⚠️could not find full-sized replacement, downloading original ${image}`);
        }
    }

    try {
        const resultingUrl = await doDownload(image, mediaFolder, postFolder);
        console.log(`  🌄 downloaded ${image} (original)`);
        return resultingUrl;
    } catch (e) {
        throw new Error(`Failed to download image ${image}`, { cause: e });
    }
}

export async function downloadVideo(video: string, mediaFolder: string, postFolder: string): Promise<string> {
    try {
        const resultingUrl = await doDownload(video, mediaFolder, postFolder);
        console.log(`  📀️ downloaded ${video}`);
        return resultingUrl;
    } catch (e) {
        throw new Error(`Failed to download video ${video}`, { cause: e });
    }
}
