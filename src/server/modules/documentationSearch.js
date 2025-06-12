const { Document, Charset } = require('flexsearch');

let docIndex = null;

function initDocumentationIndex(docs) {
    docIndex = new Document({
        worker: true,
        document: {
            id: 'id',
            store: true,
            index: [
                {
                    field: 'title',
                    tokenize: 'forward',
                    encoder: Charset.LatinBalance
                },
                {
                    field: 'content',
                    tokenize: 'forward',
                    encoder: Charset.LatinBalance
                }
            ],
            tag: [
                { field: 'documentationId' }
            ]
        }
    });
    for (const doc of docs) {
        docIndex.add(doc);
    }
}

async function searchDocumentation({ keywords = '', filters = [] }) {
    let tag = undefined;
    if (filters && Array.isArray(filters) && filters.length > 0) {
        tag = { documentationId: filters };
    }
    let results = [];
    if (keywords) {
        results = await docIndex.search({
            query: keywords,
            tag,
            suggest: true,
            enrich: true,
            merge: true
        });
    } else {
        results = await docIndex.where(tag ? tag : {});
    }

    // Enhanced sorting: first by title match, then others alphabetically by title
    if (keywords) {
        const lowerKeywords = keywords.toLowerCase();
        const titleMatches = [];
        const otherMatches = [];
        for (const doc of results) {
            // doc.title for direct search, doc.doc.title for enriched search
            const title = doc.title || (doc.doc && doc.doc.title) || '';
            if (title.toLowerCase().includes(lowerKeywords)) {
                titleMatches.push(doc);
            } else {
                otherMatches.push(doc);
            }
        }
        otherMatches.sort((a, b) => {
            const titleA = (a.title || (a.doc && a.doc.title) || '').toLowerCase();
            const titleB = (b.title || (b.doc && b.doc.title) || '').toLowerCase();
            return titleA.localeCompare(titleB);
        });
        return [...titleMatches, ...otherMatches];
    }
    return results;
}

module.exports = {
    initDocumentationIndex,
    searchDocumentation
}; 