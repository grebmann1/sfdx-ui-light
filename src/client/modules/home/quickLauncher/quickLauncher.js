import { api,wire } from "lwc";
import ToolkitElement from 'core/toolkitElement';

import { isEmpty,isElectronApp } from 'shared/utils';
import { CONFIG } from 'ui/app';
import { store_application,store } from 'shared/store';
import { NavigationContext, generateUrl, navigate } from 'lwr/navigation';

    


export default class QuickLauncher extends ToolkitElement {
    @wire(NavigationContext)
    navContext;
    
    connectedCallback(){
        //console.log('CONFIG',CONFIG);
    }

    /** Events */
    
    handleQuickAction = (e) => {
        const target = e.currentTarget.dataset.path;
        if(!isEmpty(target)){
            navigate(this.navContext,{type:'application',attributes:{applicationName:target}});
        }else{
            navigate(this.navContext,{type:'home'});
        }
    }

    handleRedirection = (e) => {
        const url = e.currentTarget.dataset.url;
        //console.log('url',url);
        store.dispatch(store_application.navigate(url));
    }

    /** Methods */
    
    /** Getters */
    
    get explorers(){
        const explorers = ['object/app','metadata/app','doc/app'];
        return CONFIG.APP_LIST.filter(x => explorers.includes(x.name));
    }

    get tools(){
        const tools = ['anonymousApex/app','soql/app','accessAnalyzer/app'];
        return CONFIG.APP_LIST.filter(x => tools.includes(x.name));
    }

}