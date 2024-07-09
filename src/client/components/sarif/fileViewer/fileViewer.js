import { LightningElement,track,api} from "lwc";
import { isNotUndefinedOrNull,isUndefinedOrNull,getCurrentRank,runActionAfterTimeOut } from "shared/utils";

export default class FileViewer extends LightningElement {

    @api data = [];
    @api selectedFile;



    /** Events */


    handleFileDisplay = (e) => {
        e.preventDefault();
        const {file} = e.currentTarget.dataset;
        //console.log('this.data.find(x => x.key === file)',this.data,file);
        this.selectedFile = this.data.find(x => x.key === file);
    }

    handleItemDisplay = (e) => {
        e.preventDefault();
        const {file} = e.currentTarget.dataset;
        this.selectedFile = this.data.find(x => x.key === file);
    }


    /** Methods  */


    

    /** Processing Methods */

    

    /** Getters */

    get isPreviewDisplayed(){
        return isNotUndefinedOrNull(this.selectedFile);
    }

}
