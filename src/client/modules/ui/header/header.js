import { LightningElement,api } from 'lwc';

export default class Header extends LightningElement {

    
    @api currentApplicationName = 'App Name';
    @api currentTabName = 'Home';

    connectedCallback(){
        
    }


}