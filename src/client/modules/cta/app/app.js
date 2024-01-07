import { LightningElement,api} from "lwc";
import { isEmpty } from 'shared/utils';


export default class App extends LightningElement {

    isMenuOpen = false;
    currentPosition = 0;
    links = [];

    connectedCallback(){
        this.initHashHandler();
    }

    scrollToTop = () => {
        window.scrollTo({
          top: 0,
          behavior: 'smooth' // Optional: smooth scrolling behavior
        });
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
            this.scrollToTop();
        }, false);
    }

    goPrevious = (e) => {
        e.preventDefault();
        if(this.currentPosition <= 0){
            this.currentPosition = 0;
        }else{
            this.currentPosition--;
        }
        window.location = this.links[this.currentPosition].href;
    }

    goNext = (e) => {
        e.preventDefault();
        if(this.currentPosition >= this.links.length - 1){
            this.currentPosition = this.links.length - 1;
        }else{
            this.currentPosition++;
        }
        window.location = this.links[this.currentPosition].href;
    }

    get previousClass(){
        return ` ${this.currentPosition <= 0?'slds-hide':''}`;
    }

    get nextClass(){
        return ` ${this.currentPosition >= this.links.length - 1?'slds-hide':''}`;
    }

    get previousTitle(){
        let previousPosition = this.currentPosition - 1;
        return this.links.length > previousPosition ? (this.links[previousPosition]?.title || 'Previous') : 'Previous';
    }

    get nextTitle(){
        let nextPosition = this.currentPosition + 1;
        return this.links.length > nextPosition ? (this.links[nextPosition]?.title || 'Next') : 'Next';
    }
}