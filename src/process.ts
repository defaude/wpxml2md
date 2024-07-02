import { categories, defaultCategory } from './categories';
import { attachmentItems, postItems } from './items';

console.info('Categories', categories, defaultCategory);

console.info('Attachment count', attachmentItems.size);
console.info('Post count', postItems.size);
