type NormalizeStringConfig = {
    fallbackValue?: string;
    validValues?: string[];
    toLowerCase?: boolean;
};

export function normalizeString(
    value: string | null | undefined,
    config: NormalizeStringConfig = {}
): string {
    const { fallbackValue = '', validValues, toLowerCase = true } = config;
    let normalized = (typeof value === 'string' && value.trim()) || '';
    normalized = toLowerCase ? normalized.toLowerCase() : normalized;
    if (validValues && validValues.indexOf(normalized) === -1) {
        normalized = fallbackValue;
    }
    return normalized;
}

export function normalizeBoolean(value: unknown): boolean {
    return typeof value === 'string' || !!value;
}

export function normalizeArray<T>(value: T[] | unknown): T[] {
    if (Array.isArray(value)) {
        return value;
    }
    return [];
}

export function normalizeAriaAttribute(value: string | string[] | null | undefined): string | null {
    let arias = Array.isArray(value) ? value : [value];
    arias = arias
        .map(ariaValue => {
            if (typeof ariaValue === 'string') {
                return ariaValue.replace(/\s+/g, ' ').trim();
            }
            return '';
        })
        .filter(ariaValue => !!ariaValue);

    return arias.length > 0 ? arias.join(' ') : null;
}
