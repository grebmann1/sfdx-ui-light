import { LightningElement,api} from "lwc";
import { isEmpty,isElectronApp } from 'shared/utils';


export default class App extends LightningElement {

    @api connector;

    @api metadataObjects = [];
    @api sobjects = [];
    
    @api defaultSelectedItem = "ApexClass";
    selectedItem;

    async connectedCallback(){
        this.sobjects = await this.load_toolingGlobal();
        this.metadataObjects = await this.load_metadataGlobal();
        this.selectedItem = this.metadataObjects.length > 0 ? this.metadataObjects[0].directoryName:null;
    }

    /** Events */

    handleItemSelection = (e) => {
        this.selectedItem = e.detail.name;
        this.load_specificMetadata();
    }
    

    /** Methods */

    load_toolingGlobal = async () => {
        let result = await this.connector.conn.tooling.describeGlobal();
        return result?.sobjects || [];
    }

    load_metadataGlobal = async () => {
        let result = await this.connector.conn.metadata.describe(this.connector.conn.version);
        console.log('result',result);
        return (result?.metadataObjects || []).sort((a, b) => a.xmlName.localeCompare(b.xmlName));
    }

    load_specificMetadata = async () => {
        console.log('load_specificMetadata');
        var types = [{type: this.selectedItem, folder: null}]; // Single type
        let result = await this.connector.conn.metadata.list(types,this.connector.conn.version);
        console.log('result',result);
    }
    


    /** Getters */



    


}