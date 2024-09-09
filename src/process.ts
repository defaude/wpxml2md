import { mkdir, rm, writeFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { UTCDate } from '@date-fns/utc';
import { load } from 'cheerio';
import { getMonth } from 'date-fns/getMonth';
import { getYear } from 'date-fns/getYear';
import { downloadImage } from './downloadImage';
import { type Post, attachments, posts } from './items';
import { toMarkdown } from './toMarkdown';

const outputBase = '../output/';
const outputFolder = new URL(outputBase, import.meta.url);

console.info('purging output folder');
await rm(outputFolder, { recursive: true, force: true });

for (const post of posts.values()) {
    await processPost(post, 'https://fernheimweh.de');
}
// const lastPost = Array.from(posts.values())[posts.size - 1];
//
// //region MOCK CONTENT
// lastPost.content = `<!-- wp:paragraph -->
// <p>Vorgestern konnten wir endlich mal so richtig ausschlafen - und dieses Mal auch das Frühstück in Anspruch nehmen, das wir am ersten Tag hier in Neapel ja verpasst hatten. Das Frühstück wurde noch mehr versüßt, da wir zwischendrin immer wieder die Katzis knuddeln, die genau wie wir in unserer Unterkunft herumlungerten. Wir hatten wenig Lust, weiter in Neapel herumzuhatschen (oder wieder so einen Katastrophen-Kaffee zu bekommen wie am Tag zuvor) also sind wir einfach bis zum frühen Nachmittag in der Unterkunft geblieben, haben Katzen geschmust und mit den Besitzern gequatscht: Das Gebäude war ursprünglich einmal eine Lederfabrik, doch die Produktion wurde vor einigen Jahren aus der Stadt heraus verlagert. Das nun leerstehende Anwesen haben die Söhne der Familie in Eigenregie in ein kleines, aber feines Hotel umgebaut. Irgendwann hieß es aber dann doch "tschüss, Katzis", als wir uns eine wilde Taxifahrt zum Bahnhof gönnten.</p>
// <!-- /wp:paragraph -->
//
// <!-- wp:image {"id":3656,"sizeSlug":"large","linkDestination":"media"} -->
// <figure class="wp-block-image size-large">
//     <a href="https://fernheimweh.de/wp-content/uploads/2024/06/IMG_20240315_101431.jpg">
//         <img src="https://fernheimweh.de/wp-content/uploads/2024/06/IMG_20240315_101431-1024x768.jpg" alt="" class="wp-image-3656"/>
//     </a>
// </figure>
// <!-- /wp:image -->
//
// <!-- wp:paragraph -->
// <p>Im Bahnhofsviertel mussten wir uns natürlich zum Abschied noch einmal die geilen Sfogliatelle gönnen :) Die Zugfahrt nach Rom war pünktlich, ereignislos und entspannt. Am Romer Hauptbahnhof wurde natürlich als erste Station die Venchi-Eisdiele aufgesucht, bevor wir uns den Bus gesucht haben, mit dem wir zu unserer Unterkunft gefahren sind.</p>
// <!-- /wp:paragraph -->
//
// <!-- wp:gallery {"linkTo":"file"} -->
// <figure class="wp-block-gallery has-nested-images columns-default is-cropped">
//     <!-- wp:image {"id":3659,"sizeSlug":"large","linkDestination":"media"} -->
//     <figure class="wp-block-image size-large">
//         <a href="https://www.example.com">
//             <img src="https://fernheimweh.de/wp-content/uploads/2024/06/IMG_20240315_140155-768x1024.jpg" alt="foobar" class="wp-image-3659"/>
//         </a>
//     </figure>
// <!-- /wp:image -->
//
// <!-- wp:image {"id":3658,"sizeSlug":"large","linkDestination":"media"} -->
// <figure class="wp-block-image size-large"><a href="https://fernheimweh.de/wp-content/uploads/2024/06/IMG_20240315_140927.jpg"><img src="https://fernheimweh.de/wp-content/uploads/2024/06/IMG_20240315_140927-768x1024.jpg" alt="" class="wp-image-3658"/></a></figure>
// <!-- /wp:image -->
//
// <!-- wp:image {"id":3657,"sizeSlug":"large","linkDestination":"media"} -->
// <figure class="wp-block-image size-large"><a href="https://fernheimweh.de/wp-content/uploads/2024/06/IMG_20240315_161821.jpg"><img src="https://fernheimweh.de/wp-content/uploads/2024/06/IMG_20240315_161821-768x1024.jpg" alt="" class="wp-image-3657"/></a></figure>
// <!-- /wp:image --></figure>
// <!-- /wp:gallery -->
//
// <!-- wp:paragraph -->
// <p>Diese war super hochwertig, scheinbar nagelneu und auch schick, gleichzeitig aber auch irgendwie seltsam: Direkt an der Straße lässt man sich per elektronischem Code-Schloss in die Tür - und steht schon mitten im Schlafzimmer... D.h. auch nachts ist der Verkehr leider gut hörbar, da das Bett keine 50cm von der Glasfront / dem Rolladen steht. Egal, jetzt waren wir hier und haben erst einmal die Beine ausgestreckt und etwas gechillt. Zum Abend hin ging's ein Bisschen durch's Altstadtviertel, wo wir uns eine coole, aber seltsame Kunstausstellung in / an einem Kloster angeschaut haben - inkl. Café, das preislich leider eher auf Touri-Niveau war.</p>
// <!-- /wp:paragraph -->`;
// //endregion
//
// await processPost(lastPost, 'https://fernheimweh.de');

async function processPost(post: Post, site: string) {
    console.info(`processing post "${post.slug}"`);

    const publishedDate = new UTCDate(post.createdAt);
    const year = getYear(publishedDate);
    const month = `${getMonth(publishedDate) + 1}`.padStart(2, '0');

    const postFolder = new URL(`./${year}/${month}/${post.slug}/`, outputFolder);
    const imageFolder = new URL('img/', postFolder);
    await mkdir(imageFolder, { recursive: true });

    // download thumbnail
    const thumbnailUrl = attachments.get(post.thumbnailId)?.url;
    if (thumbnailUrl) {
        try {
            await downloadImage(thumbnailUrl, imageFolder);
            post.thumbnailUrl = `./img/${basename(thumbnailUrl)}`;
        } catch (e) {
            console.error('Could not download thumbnail', e);
        }
    }

    // go through all images & links with images, download & replace in post.content
    const $ = load(post.content, {}, false);

    const imagesToLoad: string[] = [];

    $('a:has(img)').replaceWith((_, element) => {
        const $this = load(element);
        const href = $this('a').attr('href');
        const hrefWithoutExtension = removeFileExtension(href);
        const $img = $this('img');
        const src = $img.attr('src');
        const alt = $img.attr('alt') || basename(href);

        if (src.startsWith(hrefWithoutExtension)) {
            imagesToLoad.push(href);
            const filename = basename(href);
            return `[![${alt}](./img/${filename})](./img/${filename})`;
        }

        return element;
    });

    $('img').replaceWith((_, element) => {
        const $this = load(element);
        const $img = $this('img');
        const src = $img.attr('src');
        const filename = basename(src);
        const alt = $img.attr('alt') || filename;

        if (src.startsWith(site)) {
            imagesToLoad.push(src);
            return `![${alt}](./img/${filename})`;
        }

        return element;
    });

    await Promise.all(imagesToLoad.map(img => downloadImage(img, imageFolder)));

    post.content = $.html();

    await writeFile(new URL('index.mdx', postFolder), toMarkdown(post));
}

function removeFileExtension(url: string): string {
    const extension = extname(url);
    return url.slice(0, -extension.length);
}
