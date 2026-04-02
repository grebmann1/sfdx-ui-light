import { isEmpty } from 'shared/utils';

export function structurizedMarkdown(markdownContent) {
    const content = [];
    var currentCategory;
    var currentSubCategory;

    markdownContent.split('\n').forEach(line => {
        if (line.startsWith('### ')) {
            // Detect category
            if (currentSubCategory) {
                currentCategory.children.push(currentSubCategory);
            }
            if (currentCategory) {
                content.push(currentCategory);
            }
            currentCategory = {
                content: `\r${line}`,
                children: [],
                links: [],
                before: [],
                after: [],
            };
            currentSubCategory = null; // reset;
        } else if (line.startsWith('#### ')) {
            // Detect subCategories
            if (currentSubCategory) {
                currentCategory.children.push(currentSubCategory);
            }
            currentSubCategory = { content: `\r${line}`, links: [], before: [], after: [] };
        } else if (line.startsWith('- ')) {
            // Detect link
            if (currentSubCategory) {
                currentSubCategory.links.push(line);
            } else {
                currentCategory.links.push(line);
            }
        } else {
            if (!isEmpty(line)) {
                if (currentSubCategory) {
                    if (currentSubCategory.links > 0) {
                        currentSubCategory.after.push(line);
                    } else {
                        currentSubCategory.before.push(line);
                    }
                } else if (currentCategory) {
                    if (currentCategory.links > 0) {
                        currentCategory.after.push(line);
                    } else {
                        currentCategory.before.push(line);
                    }
                } else {
                    content.push(line);
                }
            }
        }
    });

    // Add left over
    if (currentSubCategory && currentCategory) {
        currentCategory.children.push(currentSubCategory);
    }
    if (currentCategory) {
        content.push(currentCategory);
    }

    return content;
}
