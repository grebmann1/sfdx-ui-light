import { LightningElement,api} from "lwc";
import { isEmpty,isElectronApp } from 'shared/utils';


export default class App extends LightningElement {

    @api connector;

    @api metadataObjects = [];
    @api sobjects = [];

    async connectedCallback(){
        this.sobjects = await this.load_toolingGlobal();
        this.metadataObjects = await this.load_metadataGlobal();
    }

    load_toolingGlobal = async () => {
        let result = await this.connector.conn.tooling.describeGlobal();
        return result?.sobjects || [];
    }

    load_metadataGlobal = async () => {
        let result = await this.connector.conn.metadata.describe(this.connector.conn.version);
        return result?.metadataObjects || [];
    }

    /** Methods */


    /** Getters */



    /** Events */


}