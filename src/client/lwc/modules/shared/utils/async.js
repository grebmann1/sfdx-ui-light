/**
 * Async/promise utilities
 */

export function chunkPromises(arr, size, method) {
    if (!Array.isArray(arr) || !arr.length) {
        return Promise.resolve([]);
    }

    size = size ? size : 10;

    const chunks = [];
    for (let i = 0, j = arr.length; i < j; i += size) {
        chunks.push(arr.slice(i, i + size));
    }

    let collector = Promise.resolve([]);
    for (const chunk of chunks) {
        collector = collector.then(results =>
            Promise.all(chunk.map(params => method(params))).then(subResults =>
                results.concat(subResults)
            )
        );
    }
    return collector;
}

const buffer = {};
export function runActionAfterTimeOut(value, action, { timeout = 300 } = {}) {
    if (buffer._clearBufferId) {
        clearTimeout(buffer._clearBufferId);
    }
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    buffer._clearBufferId = setTimeout(() => {
        action(value);
    }, timeout);
}

export const runSilent = async (func, placeholder) => {
    try {
        return await func();
    } catch (e) {
        console.error('Run Silent', e);
    }
    return placeholder;
};
