import { api } from "lwc";
import FeatureElement from 'element/featureElement';

import { isEmpty,isElectronApp } from 'shared/utils';
import { CONFIG } from 'ui/app';
import { store_application,store } from 'shared/store';



export default class QuickLauncher extends FeatureElement {

    
    connectedCallback(){
        console.log('CONFIG',CONFIG);
    }

    /** Events */
    
    handleQuickAction = (e) => {
        const name = e.currentTarget.dataset.name;
        store.dispatch(store_application.open(name));
    }

    handleRedirection = (e) => {
        const url = e.currentTarget.dataset.url;
        console.log('url',url);
        store.dispatch(store_application.navigate(url));
    }

    /** Methods */
    
    /** Getters */
    
    get explorers(){
        const explorers = ['sobjectexplorer/app','metadata/app','doc/app'];
        return CONFIG.APP_LIST.filter(x => explorers.includes(x.name));
    }

    get tools(){
        const tools = ['code/app','soql/app','accessAnalyzer/app'];
        return CONFIG.APP_LIST.filter(x => tools.includes(x.name));
    }

}