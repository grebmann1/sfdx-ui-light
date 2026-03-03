
export function hasSelectedDescendant(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return false;
    }
    return items.some((child) => child.isSelected || hasSelectedDescendant(child.children));
}