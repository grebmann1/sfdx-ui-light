import { LightningElement, api } from 'lwc';
import { createRouter } from 'lwr/router';
import { isChromeExtension } from 'shared/utils';

// Route definition array
const routes = [
    {
        id: 'homeApp',
        uri: '/{app}',
        handler: () => import('router/applicationHandler'),
        page: {
            type: 'home',
        },
    },
    {
        id: 'namedApp',
        uri: '/{app}?applicationName=:applicationName',
        handler: () => import('router/applicationHandler'),
        page: {
            type: 'application',
            state: {
                applicationName: ':applicationName',
            },
        },
    },
    {
        id: 'namedApp_singleAttribute',
        uri: '/{app}/:applicationName/:attribute1',
        handler: () => import('router/applicationHandler'),
        page: {
            type: 'application',
            state: {
                applicationName: ':applicationName',
                attribute1: ':attribute1',
            },
        },
    },
    {
        id: 'namedApp_doubleAttribute',
        uri: '/{app}/:applicationName/:attribute1?param1=:param1',
        handler: () => import('router/applicationHandler'),
        page: {
            type: 'application',
            state: {
                applicationName: ':applicationName',
                attribute1: ':attribute1',
                param1: ':param1',
            },
        },
    },
];

const initRouter = () => {
    const isChrome = isChromeExtension();
    if (isChrome) {
        // Chrome
        const _routes = routes.map(x => ({
            ...x,
            uri: x.uri.replace('{app}', 'app.html'),
        }));

        return createRouter({
            routes: _routes,
            basePath: '/views',
        });
    } else {
        // Default
        const _routes = routes.map(x => ({
            ...x,
            uri: x.uri.replace('{app}', 'app'),
        }));

        return createRouter({
            routes: _routes,
        });
    }
};

export default class Root extends LightningElement {
    router = initRouter();

    /** Events */

    handleNavigation = e => {
        // Dev Extension ->  chrome-extension://dmlgjapbfifmeopbfikbdmlgdcgcdmfb/views/app.html
    };

    /** Method **/
}
