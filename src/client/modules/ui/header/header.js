import { LightningElement,api } from 'lwc';
import launcher from "ui/launcher";
import versionApp from '@process/env/VERSION_APP';

export default class Header extends LightningElement {

    
    @api currentApplicationName = 'App Name';
    @api currentTabName = 'Home';
    @api applications;
    @api isUserLoggedIn = false

    @api version = versionApp || 'v0.0.0';

    connectedCallback(){}

    openLauncher = () => {
        console.log('openLauncher');
        launcher.open({
            isUserLoggedIn:this.isUserLoggedIn
        })
        .then((res) => {
            if(res){
                this.dispatchEvent(new CustomEvent("newapp",{detail:res}));
            }
        })
    }

    /** Events **/
    
    selectTab = (e) => {
        this.dispatchEvent(new CustomEvent("tabchange",{detail:{
            id:e.currentTarget.dataset.key
        }}));
    }

    deleteTab = (e) => {
        e.stopPropagation();
        this.dispatchEvent(new CustomEvent("tabdelete",{detail:{
            id:e.currentTarget.closest('li').dataset.key
        }}));
    }

    /** Getters */

    get formattedVersion(){
        return `${this.version}`;
    }

}