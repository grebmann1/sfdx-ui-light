import { api} from "lwc";
import FeatureElement from 'element/featureElement';
import { isEmpty,isElectronApp,classSet } from 'shared/utils';


export default class App extends FeatureElement {

    selectedItem;

    async connectedCallback(){}

    /** Events */

    handleItemSelection = (e) => {
        this.selectedItem = e.detail.name;
        //this.load_specificMetadata();
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

    load_specificMetadata = async () => {
        var types = [{type: this.selectedItem, folder: null}]; // Single type
        let result = await this.connector.conn.metadata.list(types,this.connector.conn.version);
    }
    


    /** Getters */

    get isSObjectDisplayed(){
        return this.selectedItem === 'sobject';
    }

    get pageClass(){
        return super.pageClass+' slds-p-around_small';
    }

    


}