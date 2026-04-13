import { LightningElement } from 'lwc';
import { createRouter } from 'lwr/router';
import { isChromeExtension } from 'shared/utils';

// Route definition array
const routes = [
    // Keep more specific routes first so `app.html?applicationName=settings`
    // does not get swallowed by the generic `/{app}` home route.
    {
        id: 'namedApp',
        uri: '/{app}?applicationName=:applicationName',
        handler: () => import('skeleton/applicationHandler'),
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
        handler: () => import('skeleton/applicationHandler'),
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
        handler: () => import('skeleton/applicationHandler'),
        page: {
            type: 'application',
            state: {
                applicationName: ':applicationName',
                attribute1: ':attribute1',
                param1: ':param1',
            },
        },
    },
    {
        id: 'homeApp',
        uri: '/{app}',
        handler: () => import('skeleton/applicationHandler'),
        page: {
            type: 'home',
        },
    },
];

const CHROME_ROUTE_ENTRYPOINTS = ['app.html', 'tool.html'];

const initRouter = () => {
    const isChrome = isChromeExtension();
    if (isChrome) {
        const chromeRoutes = CHROME_ROUTE_ENTRYPOINTS.flatMap(entrypoint =>
            routes.map(route => ({
                ...route,
                id: `${route.id}_${entrypoint.replace('.', '_')}`,
                uri: route.uri.replace('{app}', entrypoint),
            }))
        );

        return createRouter({
            routes: chromeRoutes,
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

    handleNavigation = _event => {
        // Dev Extension ->  chrome-extension://dncmipbpdapfjancbhmbodlhllapmagf/views/app.html
    };

    /** Method **/
}
