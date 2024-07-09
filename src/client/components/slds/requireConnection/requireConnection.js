import { wire,api } from "lwc";
import ToolkitElement from 'core/toolkitElement';
import { NavigationContext, navigate } from 'lwr/navigation';


export default class RequireConnection extends ToolkitElement {
    @wire(NavigationContext)
    navContext;

    @api title = "No Salesforce Connection";
    @api subTitle = "It's required to be connected to an Org to use this feature";
    @api isRequired = false;

    /** Events */

    goToConnection = () => {
        navigate(this.navContext,{
            type:'application',
            attributes:{
                applicationName:'connections',
            }
        });
    }

    /** Methods */

    /** Getters */
    get isDisplayed(){
        return !this.isRequired || this.isRequired && this.isUserLoggedIn;
    }
}