import { basename, join, relative } from '@std/path';
import { unThumbnail } from './unThumbnail.ts';

async function doDownload(url: string, targetFolder: string, relativeSourceFolder: string, dryRun: boolean) {
    const filename = basename(new URL(url).pathname);
    const filePath = join(targetFolder, filename);
    if (dryRun) {
        console.log(`  [dry-run] Would download ${url}`);
    } else {
        const response = await fetch(url);
        if (!response.ok) {
            await response.body?.cancel();
            throw new Error(`Failed to download ${url} (${response.status} ${response.statusText})`);
        }
        await Deno.writeFile(filePath, new Uint8Array(await response.arrayBuffer()));
    }
    return relative(relativeSourceFolder, filePath).replaceAll('\\', '/');
}

export async function downloadImage(
    image: string,
    mediaFolder: string,
    postFolder: string,
    dryRun = false,
): Promise<string> {
    const url = unThumbnail(image);

    if (url !== image) {
        try {
            const resultingUrl = await doDownload(url, mediaFolder, postFolder, dryRun);
            if (!dryRun) console.log(`  🏞️  downloaded ${url} (full-sized)`);
            return resultingUrl;
        } catch (_e) {
            console.warn(`  ⚠️could not find full-sized replacement, downloading original ${image}`);
        }
    }

    try {
        const resultingUrl = await doDownload(image, mediaFolder, postFolder, dryRun);
        if (!dryRun) console.log(`  🌄 downloaded ${image} (original)`);
        return resultingUrl;
    } catch (e) {
        throw new Error(`Failed to download image ${image}`, { cause: e });
    }
}

export async function downloadVideo(
    video: string,
    mediaFolder: string,
    postFolder: string,
    dryRun = false,
): Promise<string> {
    try {
        const resultingUrl = await doDownload(video, mediaFolder, postFolder, dryRun);
        if (!dryRun) console.log(`  📀️ downloaded ${video}`);
        return resultingUrl;
    } catch (e) {
        throw new Error(`Failed to download video ${video}`, { cause: e });
    }
}
