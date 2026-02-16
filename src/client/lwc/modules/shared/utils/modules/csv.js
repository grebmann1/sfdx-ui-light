import Papa from 'papaparse';

export const CSV_DELIMITERS = {
    COMMA: ',',
    SEMICOLON: ';',
    TAB: '\t',
    PIPE: '|',
};

export function parseCsvText(text, { delimiter = CSV_DELIMITERS.COMMA } = {}) {
    const parsed = Papa.parse(text, {
        header: true,
        skipEmptyLines: 'greedy',
        delimiter,
    });

    const error = parsed?.errors?.length
        ? parsed.errors[0]?.message || 'Failed to parse CSV'
        : null;

    return {
        headers: parsed?.meta?.fields || [],
        rows: Array.isArray(parsed?.data) ? parsed.data : [],
        error,
        meta: parsed?.meta,
    };
}

export function escapeCsvValue(separator, value) {
    if (value == null) return '';
    const s = String(value);
    if (s.includes(separator) || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}

export function serializeCsvFromObjects({ headers, rows, separator = ',' }) {
    const headerLine = (headers || []).join(separator);
    const dataLines = (rows || []).map(row => {
        return (headers || [])
            .map(h => escapeCsvValue(separator, row?.[h]))
            .join(separator);
    });
    return `${headerLine}\n${dataLines.join('\n')}`;
}

