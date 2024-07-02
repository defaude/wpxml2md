import { type RawCategory, rawCategories } from './importJson';

type Category = { id: string; slug: string; name: string };

export const categories = new Map<string, Category>();

function toCategory(raw: RawCategory): Category {
    const {
        'wp:term_id': [id],
        'wp:category_nicename': [slug],
        'wp:cat_name': [name],
    } = raw;
    return { id, slug, name };
}

for (const raw of rawCategories) {
    const category = toCategory(raw);
    categories.set(category.id, category);
}

export const defaultCategory = categories.get('1');
