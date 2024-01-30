import { LightningElement,api } from 'lwc';
import ModalLauncher from "ui/modalLauncher";
import constant from "global/constant";

export default class Header extends LightningElement {

    
    @api currentApplicationName = 'App Name';
    @api currentTabName = 'Home';
    @api applications;
    @api isUserLoggedIn = false

    @api version = constant.version || '';

    @api isMenuDisplayed = false;

    connectedCallback(){}

    openLauncher = () => {
        ModalLauncher.open({
            isUserLoggedIn:this.isUserLoggedIn
        })
        .then((res) => {
            if(res){
                this.dispatchEvent(new CustomEvent("newapp",{detail:res}));
            }
        })
    }

    /** Events **/
    
    handleToggle = (e) => {
        console.log('handleToggle');
        this.isMenuDisplayed = ! this.isMenuDisplayed;
        if(this.isFullPage){
            //appStore.dispatch(store_application.hideMenu());
        }else{
            //appStore.dispatch(store_application.showMenu());
        }
    }
    
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