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
];
export default class fullView extends LightningElement {
    router = createRouter({ routes });

    /** Events */
    
    handleNavigation = (e) => {
        //console.log('handleNavigation',e);
    }

}
