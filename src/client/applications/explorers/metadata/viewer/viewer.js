import { api,track} from "lwc";
import FeatureElement from 'element/featureElement';
import jsonview from '@pgrabovets/json-view';
import { isEmpty,isElectronApp,classSet,isUndefinedOrNull,isNotUndefinedOrNull,runActionAfterTimeOut,formatFiles,sortObjectsByField,removeDuplicates } from 'shared/utils';

const AUDIT_FIELDS = [
    'Id',
    'CreatedById',
    'CreatedDate',
    'IsDeleted',
    'LastModifiedById',
    'LastModifiedDate',
    'IsDeleted',
    'SystemModstamp',
    'ManageableState',
    'NamespacePrefix',
    'Type',
    'Language',
    'DeveloperName',
]
export default class Viewer extends FeatureElement {

    isLoading = false;
    visualizer;
    currentTab = 'Default';

    @track formattedArray;
    @track formattedMetadata;
    @track formattedAuditFields;
    
    @track _record;
    @api 
    get record(){
        return this._record;
    }

    set record(value){
        this._record = null;
        this._record = value;
        if(this._record){
            this.displayData();
            this.formatRecord(this._record);
        }else{
            this.hideJsonViewer();
            this.formattedArray = null;
            this.formattedMetadata = null;
        }
    }


    connectedCallback(){
        console.log('has loaded');
    }

    renderedCallback(){
        console.log('renderedCallback');
    }

    /** Events **/

    handleSelectTab(event) {
        this.currentTab = event.target.value;
    }

    /** Methods **/
    
    formatArray = (record) => {
        const res = {};
        Object.keys(record).map(key => {
            if(Array.isArray(record[key])){
                res[key] = record[key].join('\n');
            }else{
                res[key] = record[key];
            }
        })

        return res;
    }

    extractFieldsFromArray = (key,records) => {
        var header,rows;
        if(records.length == 0) return {rows,header};
        if(typeof records[0] != 'object'){
            header = [{ label: `${key} values`, fieldName: 'value', type: 'text',wrapText: true}];
            rows = records.map((x,index) => ({_index:index,value:x}));
        }else{
            header = Object.keys(records[0]).map(x => ({ label: x, fieldName: x, type: 'text',wrapText: true}));
            rows = records.map((x,index) => ({_index:index,...this.formatArray(x)}));
        }
        return {rows,header};
    }

    extractFields = (record,objectArray) => {
        let records = [];
        Object.keys(record).forEach(key => {
            const type = typeof record[key];
            const value = record[key];
            //console.log('record[key]',record[key],type);
            if(type ==='object' && isNotUndefinedOrNull(value) && key !== 'attributes'){
                if(Array.isArray(value)){
                    const {header,rows} = this.extractFieldsFromArray(key,value);
                    //console.log('value',value,header,rows); //
                    objectArray.push({
                        title:key,
                        header,
                        rows,
                        isArray:true,
                    });
                }else{
                    objectArray.push({
                        title:key,
                        records:this.extractFields(value,objectArray)
                    });
                }
            }
            else if(!AUDIT_FIELDS.includes(key) && (type !== 'object' || isUndefinedOrNull(value))){
                records.push({
                    field:key,
                    value,
                    type,
                    class:"slds-col slds-size_1-of-2"
                });
            }
        });
        return records;
    }

    formatRecord = (record) => {
        const objects = [];
        const records = this.extractFields(record,objects);
        //console.log('objects',objects,records);
        this.formattedObjects = objects.sort((a,b) => {
           return (b.title == 'Metadata' ? 1:0) - (a.title == 'Metadata' ? 1:0);
        });
        this.formattedArray = records;

        //console.log('this.formattedObjects',this.formattedObjects);
    }

    hideJsonViewer = () => {
        if(this.visualizer){
            try{
                jsonview.destroy(this.visualizer);
            }catch(e){console.error(e)}
        }
    }

    displayData = () => {
        runActionAfterTimeOut(null,async () => {
            this.hideJsonViewer();
            this.visualizer = jsonview.create(JSON.stringify(this.record));
                jsonview.render(this.visualizer,this.refs.container);
                jsonview.expand(this.visualizer);
        },{timeout:500});
    }


    /** Getters **/

    get isArrayDisplayed(){
        return isNotUndefinedOrNull(this.record);
    }

    get defaultContainerClass(){
        return classSet("slds-full-height slds-scrollable_y").add({'slds-hide':!(this.currentTab === 'Default')}).toString();
    }

    get jsonContainerClass(){
        return classSet("slds-full-height slds-scrollable_y").add({'slds-hide':!(this.currentTab === 'JSON')}).toString();
    }

}