export function getHighlightedRichText(text, keywords) {
    if (!keywords || keywords.length === 0) {
        return text;
    }
    const regex = new RegExp(`(${keywords.join('|')})`, 'gi');
    return text.replace(regex, `<strong>$1</strong>`);
}