import { type RawCategory, rawCategories } from './importJson';

export type Category = { slug: string; name: string };

export const categories = new Map<string, Category>();

function toCategory(raw: RawCategory): Category {
    return {
        slug: raw['wp:category_nicename'][0],
        name: raw['wp:cat_name'][0],
    };
}

for (const raw of rawCategories) {
    const category = toCategory(raw);
    categories.set(category.slug, category);
}

export const defaultCategory = categories.get('dies-und-das');
