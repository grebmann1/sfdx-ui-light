export async function mapWithConcurrency<T, R>(
    items: T[] | null | undefined,
    concurrency: number,
    fn: (item: T, idx: number) => Promise<R>
) {
    const list = Array.isArray(items) ? items : [];
    const limit = Math.max(1, Math.min(concurrency || 4, list.length || 1));
    const out = new Array(list.length) as R[];
    let nextIdx = 0;
    const workers = Array.from({ length: limit }, async () => {
        while (nextIdx < list.length) {
            const idx = nextIdx;
            nextIdx += 1;
            // eslint-disable-next-line no-await-in-loop
            out[idx] = await fn(list[idx], idx);
        }
    });
    await Promise.all(workers);
    return out;
}

const buffer: Record<string, ReturnType<typeof setTimeout>> = {};

export function runActionAfterTimeOut<T>(
    value: T,
    action: (nextValue: T) => void,
    { timeout = 300, key = 'default' }: { timeout?: number; key?: string } = {}
) {
    if (buffer[key]) {
        clearTimeout(buffer[key]);
    }
    // eslint-disable-next-line no-restricted-globals
    buffer[key] = setTimeout(() => {
        action(value);
    }, timeout);
}
