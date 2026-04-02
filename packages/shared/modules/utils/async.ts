/**
 * Async/promise utilities
 */

export function chunkPromises<T, R>(
    arr: T[],
    size: number = 10,
    method: (item: T) => Promise<R>
): Promise<R[]> {
    if (!Array.isArray(arr) || !arr.length) {
        return Promise.resolve([]);
    }

    size = size ? size : 10;

    const chunks = [];
    for (let i = 0, j = arr.length; i < j; i += size) {
        chunks.push(arr.slice(i, i + size));
    }

    let collector: Promise<R[]> = Promise.resolve([]);
    for (const chunk of chunks) {
        collector = collector.then(results =>
            Promise.all(chunk.map(params => method(params))).then(subResults =>
                results.concat(subResults)
            )
        );
    }
    return collector;
}

type TimeoutOptions = {
    timeout?: number;
    key?: string;
};

const timeoutsByKey = new Map<string, ReturnType<typeof setTimeout>>();

function parseTimeoutOptions(optionsOrTimeout?: number | TimeoutOptions) {
    if (typeof optionsOrTimeout === 'number') {
        return { timeout: optionsOrTimeout, key: '__default__' };
    }
    if (optionsOrTimeout && typeof optionsOrTimeout === 'object') {
        return {
            timeout: typeof optionsOrTimeout.timeout === 'number' ? optionsOrTimeout.timeout : 300,
            key: optionsOrTimeout.key ?? '__default__',
        };
    }
    return { timeout: 300, key: '__default__' };
}

export function runActionAfterTimeOut<T>(
    value: T,
    action: (value: T) => void,
    optionsOrTimeout?: number | TimeoutOptions
): void {
    const { timeout, key } = parseTimeoutOptions(optionsOrTimeout);
    const existing = timeoutsByKey.get(key);
    if (existing) {
        clearTimeout(existing);
    }
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    const id = setTimeout(() => {
        timeoutsByKey.delete(key);
        action(value);
    }, timeout);
    timeoutsByKey.set(key, id);
}

export const runSilent = async <T>(func: () => Promise<T>, placeholder: T): Promise<T> => {
    try {
        return await func();
    } catch (e) {
        console.warn('Run Silent', e);
    }
    return placeholder;
};
