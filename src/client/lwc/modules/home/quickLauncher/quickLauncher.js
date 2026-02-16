import { api, wire } from 'lwc';
import ToolkitElement from 'core/toolkitElement';

import { isEmpty, isElectronApp } from 'shared/utils';
import { CONFIG } from 'ui/app';
import { store_application, store as legacyStore } from 'shared/store';
import { NavigationContext, generateUrl, navigate } from 'lwr/navigation';

export default class QuickLauncher extends ToolkitElement {
    @wire(NavigationContext)
    navContext;

    connectedCallback() {
        //console.log('CONFIG',CONFIG);
    }

    /** Events */

    handleQuickAction = e => {
        const target = e.currentTarget.dataset.path;
        if (!isEmpty(target)) {
            navigate(this.navContext, { type: 'application', state: { applicationName: target } });
        } else {
            navigate(this.navContext, { type: 'home' });
        }
    };

    handleRedirection = e => {
        const url = e.currentTarget.dataset.url;
        //console.log('url',url);
        legacyStore.dispatch(store_application.navigate(url));
    };

    /** Methods */

    /** Getters */

    get explorers() {
        const explorers = [
            'org/app',
            'accessAnalyzer/app',
            'metadata/app',
            'object/app',
            'recordviewer/app',
            'doc/app',
        ];
        return CONFIG.APP_LIST.filter(x => explorers.includes(x.name));
    }

    get tools() {
        const utilities = ['smartinput/app', 'textCompare/app'];
        return CONFIG.APP_LIST.filter(x => utilities.includes(x.name));
    }
}
