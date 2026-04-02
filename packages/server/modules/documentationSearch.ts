import { Charset, Document } from 'flexsearch';

type DocumentationEntry = {
    id: string | number;
    title: string;
    content: string;
    documentationId?: string;
};

type SearchArgs = {
    keywords?: string;
    filters?: string[];
};

let docIndex: any = null;

export function initDocumentationIndex(docs: DocumentationEntry[]) {
    docIndex = new Document({
        worker: true,
        document: {
            id: 'id',
            store: true,
            index: [
                {
                    field: 'title',
                    tokenize: 'forward',
                    encoder: Charset.LatinBalance,
                },
                {
                    field: 'content',
                    tokenize: 'forward',
                    encoder: Charset.LatinBalance,
                },
            ],
            tag: [{ field: 'documentationId' }],
        },
    });
    for (const doc of docs) {
        docIndex.add(doc);
    }
}

export async function searchDocumentation({ keywords = '', filters = [] }: SearchArgs) {
    if (!docIndex) {
        return [];
    }
    let tag: any = undefined;
    if (filters && Array.isArray(filters) && filters.length > 0) {
        tag = { documentationId: filters };
    }
    let results: any[] = [];
    if (keywords) {
        results = await docIndex.search({
            query: keywords,
            tag,
            suggest: true,
            enrich: true,
            merge: true,
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
