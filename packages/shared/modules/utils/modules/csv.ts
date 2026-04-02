import Papa from 'papaparse';

export const CSV_DELIMITERS = {
    COMMA: ',',
    SEMICOLON: ';',
    TAB: '\t',
    PIPE: '|',
};

type ParseCsvOptions = {
    delimiter?: string;
};

type ParsedCsvResult = {
    headers: string[];
    rows: Array<Record<string, unknown>>;
    error: string | null;
    meta: Record<string, unknown> | undefined;
};

export function parseCsvText(
    text: string,
    { delimiter = CSV_DELIMITERS.COMMA }: ParseCsvOptions = {}
): ParsedCsvResult {
    const parsed = Papa.parse(text, {
        header: true,
        skipEmptyLines: 'greedy',
        delimiter,
        // Normalize headers to avoid BOM/whitespace breaking mapping.
        transformHeader: header =>
            String(header || '')
                .replace(/^\uFEFF/, '')
                .trim(),
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

export function escapeCsvValue(
    separator: string,
    value: string | number | boolean | null | undefined
): string {
    if (value == null) return '';
    const s = String(value);
    if (s.includes(separator) || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}

export function serializeCsvFromObjects({
    headers,
    rows,
    separator = ',',
}: {
    headers: string[];
    rows: Array<Record<string, unknown>>;
    separator?: string;
}): string {
    const headerLine = (headers || []).join(separator);
    const dataLines = (rows || []).map(row => {
        return (headers || [])
            .map(h =>
                escapeCsvValue(
                    separator,
                    row?.[h] as string | number | boolean | null | undefined
                )
            )
            .join(separator);
    });
    return `${headerLine}\n${dataLines.join('\n')}`;
}
