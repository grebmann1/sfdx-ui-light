
export const TEMPLATE = {
    BASIC: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Package xmlns="http://soap.sforce.com/2006/04/metadata"><types><members>*</members><name>ApexClass</name></types><version>{0}</version></Package>',
};

export const CATEGORY_SYSTEM = 'system';
export const CATEGORY_CUSTOM = 'custom';

export const CATEGORY_TYPE = {
    CATEGORY: 'category',
    ITEM: 'item',
};

export function sanitizeCategories(categories) {
    if(!categories) return [];
    return Array.isArray(categories) ? categories : Object.values(categories);
}

export function sanitizeItems(items) {
    if(!items) return [];
    return Array.isArray(items) ? items : Object.values(items);
}