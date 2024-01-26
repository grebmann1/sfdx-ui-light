import { api} from "lwc";
import FeatureElement from 'element/featureElement';


export default class App extends FeatureElement {

    selectedItem;

    async connectedCallback(){}

    /** Events */

    handleItemSelection = (e) => {
        this.selectedItem = e.detail.name;
    }
    

    /** Methods */

    load_toolingGlobal = async () => {
        let result = await this.connector.conn.tooling.describeGlobal();
        return result?.sobjects || [];
    }

    load_metadataGlobal = async () => {
        let result = await this.connector.conn.metadata.describe(this.connector.conn.version);
        return (result?.metadataObjects || []).sort((a, b) => a.xmlName.localeCompare(b.xmlName));
    }
    


    /** Getters */

    get isSObjectDisplayed(){
        return this.selectedItem === 'sobject';
    }

    get pageClass(){
        return super.pageClass+' slds-p-around_small';
    }
}