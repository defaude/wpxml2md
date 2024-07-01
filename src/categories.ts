import { type RawCategory, rawCategories } from './importJson';

type Category = { id: string; slug: string; name: string };

function toCategory(raw: RawCategory): Category {
    const {
        'wp:term_id': [id],
        'wp:category_nicename': [slug],
        'wp:cat_name': [name],
    } = raw;
    return { id, slug, name };
}

const categories: Record<string, Category> = {};
for (const raw of rawCategories) {
    const category = toCategory(raw);
    categories[category.id] = category;
}

export { categories };
