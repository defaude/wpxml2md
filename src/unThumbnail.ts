/*
EITHER  -(3-5 digits)x(3-5 digits)
 OR -scaled
 with a positive lookahead to the extension and the end of the string
 */
const thumbnailPattern = /-(?:(?:\d{3,5}x\d{3,5})|scaled)(?=\.\w{3,4}$)/;

export function unThumbnail(url: string): string {
    return url.replace(thumbnailPattern, '');
}
