// Bridge between ask_user tool's execute() and the LWC UI.
// The tool stores a deferred promise here; the UI resolves it when the user answers.

type DeferredResolver = {
    resolve: (answer: string) => void;
    reject: (reason?: unknown) => void;
};

const _pending = new Map<string, DeferredResolver>();

export function createQuestion(id: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        _pending.set(id, { resolve, reject });
    });
}

export function resolveQuestion(id: string, answer: string): void {
    const deferred = _pending.get(id);
    if (deferred) {
        _pending.delete(id);
        deferred.resolve(answer);
    }
}

export function rejectQuestion(id: string): void {
    const deferred = _pending.get(id);
    if (deferred) {
        _pending.delete(id);
        deferred.reject(new Error('Question dismissed'));
    }
}
