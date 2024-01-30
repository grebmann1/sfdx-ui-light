export default class NamedPageHandler {
    callback;

    constructor(callback) {
        console.log('namedPageHandler');
        this.callback = callback;
    }

    dispose() {
        /* noop */
    }

    update({ attributes }) {
        let viewGetter;

        // Get the "pageName" from the incoming page reference
        switch (attributes.pageName) {
            case 'products':
                //viewGetter = () => import('example/products');
                break;
            case 'recipes':
                //viewGetter = () => import('example/recipes');
                break;
            case 'contact':
                //viewGetter = () => import('example/contact');
                break;
            default:
                return;
        }

        this.callback({
            viewset: {
                default: viewGetter,
            },
        });
    }
}