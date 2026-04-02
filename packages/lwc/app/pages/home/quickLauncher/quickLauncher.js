import { wire } from 'lwc';
import ToolkitElement from 'core/toolkitElement';

import { isEmpty } from 'shared/utils';
import { CONFIG } from 'skeleton/app';
import { store_application, store as legacyStore } from 'shared/store';
import { NavigationContext, navigate } from 'lwr/navigation';
import { runQuickConnect } from 'connection/quickConnect';

export default class QuickLauncher extends ToolkitElement {
    @wire(NavigationContext)
    navContext;

    connectedCallback() {}

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
        legacyStore.dispatch(store_application.navigate(url));
    };

    handleQuickConnect = async () => {
        await runQuickConnect();
    };

    handleItemKeydown = e => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.currentTarget.click();
        }
    };

    /** Methods */
    getAppsByName(names = []) {
        return names.map(name => CONFIG.APP_LIST.find(app => app.name === name)).filter(Boolean);
    }

    /** Getters */

    get explorers() {
        const names = [
            'org/app',
            'accessAnalyzer/app',
            'metadata/app',
            'object/app',
            'recordviewer/app',
            'doc/app',
        ];
        return this.getAppsByName(names);
    }

    get developerTools() {
        const names = ['soql/app', 'api/app', 'anonymousApex/app', 'platformevent/app'];
        return this.getAppsByName(names);
    }

    get dataAndDeployTools() {
        const names = ['dataImport/app', 'package/app'];
        return this.getAppsByName(names);
    }

    get utilities() {
        const names = ['smartinput/app', 'textCompare/app'];
        return this.getAppsByName(names);
    }
}
