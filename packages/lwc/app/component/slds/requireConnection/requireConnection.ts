import { wire, api } from 'lwc';
import ToolkitElement from 'core/toolkitElement';
import { NavigationContext, navigate } from 'lwr/navigation';
import { isChromeExtension } from 'shared/utils';

export default class RequireConnection extends ToolkitElement {
    @wire(NavigationContext)
    navContext;

    @api title = 'No Salesforce Connection';
    @api subTitle = "It's required to be connected to an Org to use this feature";
    @api isRequired = false;

    /** Events */

    goToConnection = () => {
        if (isChromeExtension()) {
            const appUrl = new URL(chrome.runtime.getURL('/views/app.html'));
            appUrl.searchParams.set('applicationName', 'connections');
            window.location.assign(appUrl.toString());
            return;
        }

        navigate(this.navContext, {
            type: 'application',
            state: {
                applicationName: 'connections',
            },
        });
    };

    /** Methods */

    /** Getters */
    get isDisplayed() {
        return !this.isRequired || (this.isRequired && this.isUserLoggedIn);
    }
}
