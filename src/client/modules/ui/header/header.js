import { LightningElement,api } from 'lwc';
import launcher from "ui/launcher";

export default class Header extends LightningElement {

    
    @api currentApplicationName = 'App Name';
    @api currentTabName = 'Home';
    @api applications;

    connectedCallback(){
        
    }

    openLauncher = () => {
        console.log('openLauncher');
        launcher.open()
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


}