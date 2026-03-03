/**
 * Language/file type utilities
 */

const languageMapping = {
    css: 'css',
    scss: 'scss',
    js: 'javascript',
    json: 'json',
    md: 'markdown',
    ts: 'typescript',
    txt: 'text',
    apex: 'apex', // We map apex to JAVA,
    cls: 'apex', // We map cls to JAVA
    xml: 'xml',
    design: 'xml', // We map cls to xml
    trigger: 'apex',
    html: 'html',
    page: 'html',
    auradoc: 'html',
    cmp: 'html',
    png: 'png',
    svg: 'xml',
};

export function getLanguage(extension) {
    return languageMapping.hasOwnProperty(extension) ? languageMapping[extension] : null;
}

export function formatFiles(files, defaultLanguage) {
    return [...files].map(file => {
        const extension = file?.name.includes('.') ? file?.name.split('.').pop() : null;
        return {
            ...file,
            ...{
                extension: extension, // we remove the '.' for the editor
                language: getLanguage(extension) || defaultLanguage,
            },
        };
    });
}
