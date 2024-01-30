export default class HomePageHandler {
    callback;

    constructor(callback) {
        console.log('HomePageHandler');
        this.callback = callback;
    }

    dispose() {
        /* noop */
    }

    update() {
        this.callback({
            viewset: {
                default: () => import('ui/app'),
            },
        });
    }
}