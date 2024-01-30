import { CONFIG } from 'ui/app';


export default class ApplicationHandler {
    callback;

    constructor(callback) {
        this.callback = callback;
    }

    dispose() {
        /* noop */
    }

    update(page) {
        console.log('ApplicationHandler.page',page);
        const {attributes,type} = page.pageReference;
        let viewGetter;

        // Get the "pageName" from the incoming page reference
        switch (type) {
            case 'home':
                viewGetter = () => import('home/app')
                break;
            case 'app':
                viewGetter = getApplicationView(attributes.appName);
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

    /** Methods */
    getApplicationView = (appName) => {
        console.log('ApplicationHandler.appName',appName)
        const pageIndex = CONFIG.APP_LIST.findIndex(x => x.path === appName);
        if(pageIndex >= 0){
            return () => import(CONFIG.APP_LIST[pageIndex].name)
        }

        return;
    }
    

    /** Getters */

    get applications(){
        return CONFIG.APP_LIST.filter(x => ['connection','home','application'].includes(x.type));
    }
}