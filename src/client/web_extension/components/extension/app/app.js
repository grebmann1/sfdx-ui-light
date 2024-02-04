import { LightningElement} from "lwc";


export default class App extends LightningElement {


    /** Events */
    redirectToWebsite = (e) => {
        window.open('https://sf-toolkit.com/','_blank');
    }
}