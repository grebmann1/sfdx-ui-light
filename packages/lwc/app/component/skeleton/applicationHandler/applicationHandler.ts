import { CONFIG } from 'skeleton/app';

export default class ApplicationHandler {
    callback;

    constructor(callback) {
        this.callback = callback;
    }

    dispose() {
        /* noop */
    }

    update(page) {
        this.callback({
            viewset: {
                default: () => null,
            },
        });
    }
}
