import { extname, join, resolve } from '@std/path';
if (Deno.args.length < 1 || Deno.args.length > 2) {
    throw new Error('Usage: servePreview.ts DOWNLOAD_VERIFICATION_DIRECTORY [PORT]');
}
const root = resolve(Deno.args[0]);
const report = JSON.parse(await Deno.readTextFile(join(root, 'result.json')));
if (report.mode !== 'download') throw new Error('Use a completed download verification directory.');
const port = Number(Deno.args[1] ?? '38765');
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid preview port');
Deno.serve({ hostname: '127.0.0.1', port }, async (request) => {
    let file: Deno.FsFile | undefined;
    try {
        const pathname = decodeURIComponent(new URL(request.url).pathname);
        const path = resolve(join(root, pathname.slice(1) || 'preview.html'));
        if (!path.startsWith(root + '/')) return new Response('Forbidden', { status: 403 });
        const stat = await Deno.stat(path);
        if (!stat.isFile) return new Response('Not found', { status: 404 });
        const range = request.headers.get('range')?.match(/^bytes=(\d+)-(\d*)$/);
        const start = range ? Number(range[1]) : 0;
        const end = range && range[2] ? Math.min(Number(range[2]), stat.size - 1) : stat.size - 1;
        if (start > end) return new Response(null, { status: 416 });
        if (request.method === 'HEAD') return new Response(null, { headers: { 'content-length': String(stat.size) } });
        file = await Deno.open(path);
        await file.seek(start, Deno.SeekMode.Start);
        let remaining = end - start + 1;
        const close = () => {
            try {
                file?.close();
            } catch {
                // Stream cancellation or completion may already have closed the file.
            }
        };
        const stream = new ReadableStream<Uint8Array>({
            async pull(controller) {
                const chunk = new Uint8Array(Math.min(65536, remaining));
                try {
                    const read = await file!.read(chunk);
                    if (read === null) {
                        close();
                        controller.close();
                        return;
                    }
                    remaining -= read;
                    controller.enqueue(chunk.subarray(0, read));
                    if (remaining <= 0) {
                        close();
                        controller.close();
                    }
                } catch (error) {
                    close();
                    controller.error(error);
                }
            },
            cancel() {
                close();
            },
        });
        const types: Record<string, string> = {
            '.html': 'text/html; charset=utf-8',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.mp4': 'video/mp4',
            '.webm': 'video/webm',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.json': 'application/json',
        };
        const headers: Record<string, string> = {
            'content-type': types[extname(path)] ?? 'application/octet-stream',
            'accept-ranges': 'bytes',
            'content-length': String(end - start + 1),
        };
        if (range) headers['content-range'] = `bytes ${start}-${end}/${stat.size}`;
        return new Response(stream, { status: range ? 206 : 200, headers });
    } catch {
        try {
            file?.close();
        } catch {
            // Stream cancellation or completion may already have closed the file.
        }
        return new Response('Not found', { status: 404 });
    }
});
