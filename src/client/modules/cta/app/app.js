import { LightningElement,api} from "lwc";
import { isEmpty } from 'shared/utils';


export default class App extends LightningElement {

    isMenuOpen = false;
    currentPosition = 0;
    links = [];

    connectedCallback(){
        this.initHashHandler();
    }


    handleMenu = (e) => {
        this.currentPosition = e.detail.current;
        this.links = e.detail.links;
    }

    handleNavbarMenu() {
        console.log('toggleClassOnElements');
        // Get the elements by their IDs or any other suitable method
        const menu = this.template.querySelector('.menu-container');
        const documentation = this.template.querySelector('.documentation-container');

        // Toggle the class on the elements
        menu.classList.toggle('d-none');
        documentation.classList.toggle('d-none');
        this.isMenuOpen = !this.isMenuOpen;
    }

    initHashHandler = () => {
        window.addEventListener('hashchange', (e)=> {
            this.refs.viewer.updateComponent();
            this.refs.menu.updateComponent();
            if(this.isMenuOpen)this.handleNavbarMenu();
        }, false);
    }

    goPrevious = (e) => {
        e.preventDefault();
        if(this.currentPosition <= 0){
            this.currentPosition = 0;
        }else{
            this.currentPosition--;
        }
        window.location = this.links[this.currentPosition];
    }

    goNext = (e) => {
        e.preventDefault();
        if(this.currentPosition >= this.links.length - 1){
            this.currentPosition = this.links.length - 1;
        }else{
            this.currentPosition++;
        }
        window.location = this.links[this.currentPosition];
    }

    get previousClass(){
        return `page-link ${this.currentPosition <= 0?'slds-hide':''}`;
    }

    get nextClass(){
        return `page-link ${this.currentPosition >= this.links.length - 1?'slds-hide':''}`;
    }
}