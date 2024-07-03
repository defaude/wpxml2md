import { categories, defaultCategory } from './categories';
import { attachments, posts } from './items';

console.info('Categories', categories, defaultCategory);
console.info('Attachment count', attachments.size);
console.info('Post count', posts.size);

console.info(Array.from(posts.values())[20]);
