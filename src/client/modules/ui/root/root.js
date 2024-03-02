import { LightningElement,api} from "lwc";
import { createRouter } from 'lwr/router';
// Route definition array
const routes = [
    {
        id: 'homeApp',
        uri: '/app',
        handler: () => import('router/applicationHandler'),
        page: {
            type: 'home',
        },
    },
    {
        id: 'namedApp',
        uri: '/app/:applicationName',
        handler: () => import('router/applicationHandler'),
        page: {
            type: 'application',
            attributes: {
                applicationName: ':applicationName',
            },
        },
    },
    {
        id: 'namedApp_singleAttribute',
        uri: '/app/:applicationName/:attribute1',
        handler: () => import('router/applicationHandler'),
        page: {
            type: 'application',
            attributes: {
                applicationName: ':applicationName',
                attribute1:':attribute1',
            },
        },
    },
    {
        id: 'namedApp_doubleAttribute',
        uri: '/app/:applicationName/:attribute1?param1=:param1',
        handler: () => import('router/applicationHandler'),
        page: {
            type: 'application',
            attributes: {
                applicationName: ':applicationName',
                attribute1:':attribute1',
            },
            state:{
                param1:':param1'
            }
        },
    },
];
export default class fullView extends LightningElement {
    router = createRouter({ routes });

    /** Events */
    
    handleNavigation = (e) => {
        //console.log('handleNavigation',e);
    }

}
