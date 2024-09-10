import json from '../export.json';

// @ts-ignore
const { 'wp:category': rawCategories, item: rawItems, link: site } = json.rss.channel[0];

export type RawCategory = (typeof rawCategories)[number];
export type RawItem = (typeof rawItems)[number];

export { rawCategories, rawItems, site };
