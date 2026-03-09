export function getHighlightedRichText(text, keywords) {
    if (!keywords || keywords.length === 0) {
        return text;
    }
    const regex = new RegExp(`(${keywords.join('|')})`, 'gi');
    return text.replace(regex, `<strong>$1</strong>`);
}

const TREE_ITEM_TAG = 'slds-file-tree-item';

/**
 * Get the first child tree item from the current component's shadow DOM.
 */
export function getFirstChildTreeItem(template) {
    const childGroup = template.querySelector('ul.slds-tree__group');
    if (!childGroup) {
        return null;
    }
    const firstChildLi = childGroup.querySelector('li');
    return firstChildLi ? firstChildLi.querySelector(TREE_ITEM_TAG) : null;
}

/**
 * Get the deepest visible tree item in the given li's subtree (for Arrow Up navigation).
 */
function getDeepestVisibleNode(li) {
    const component = li.querySelector(TREE_ITEM_TAG);
    if (!component) {
        return null;
    }
    const childGroup = component.shadowRoot
        ? component.shadowRoot.querySelector('ul.slds-tree__group')
        : null;
    if (!childGroup) {
        return component;
    }
    const children = Array.from(childGroup.querySelectorAll(':scope > li'));
    if (children.length === 0) {
        return component;
    }
    const lastChildLi = children[children.length - 1];
    return getDeepestVisibleNode(lastChildLi) || component;
}

/**
 * Get the previous tree item in navigation/visual order.
 */
export function getPreviousTreeItem(template) {
    const hostElement = template.host;
    const parentLi = hostElement.closest('li');
    if (!parentLi) {
        return null;
    }
    const prevLi = parentLi.previousElementSibling;
    if (prevLi) {
        return getDeepestVisibleNode(prevLi) || prevLi.querySelector(TREE_ITEM_TAG);
    }
    const parentUl = parentLi.parentElement;
    const parentParentLi = parentUl ? parentUl.closest('li') : null;
    if (parentParentLi) {
        return parentParentLi.querySelector(TREE_ITEM_TAG);
    }
    return null;
}

/**
 * Get the next tree item in navigation order.
 */
export function getNextTreeItem(template) {
    const firstChild = getFirstChildTreeItem(template);
    if (firstChild) {
        return firstChild;
    }
    const hostElement = template.host;
    const parentLi = hostElement.closest('li');
    if (!parentLi) {
        return null;
    }
    let nextLi = parentLi.nextElementSibling;
    if (nextLi) {
        return nextLi.querySelector(TREE_ITEM_TAG);
    }
    let currentLi = parentLi;
    while (currentLi) {
        const parentUl = currentLi.parentElement;
        const parentParentLi = parentUl ? parentUl.closest('li') : null;
        if (!parentParentLi) {
            break;
        }
        nextLi = parentParentLi.nextElementSibling;
        if (nextLi) {
            return nextLi.querySelector(TREE_ITEM_TAG);
        }
        currentLi = parentParentLi;
    }
    return null;
}

/**
 * Get the parent tree item.
 */
export function getParentTreeItem(template) {
    const hostElement = template.host;
    const parentLi = hostElement.closest('li');
    if (!parentLi) {
        return null;
    }
    const parentUl = parentLi.parentElement;
    const parentParentLi = parentUl ? parentUl.closest('li') : null;
    return parentParentLi ? parentParentLi.querySelector(TREE_ITEM_TAG) : null;
}
