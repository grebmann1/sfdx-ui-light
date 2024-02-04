import { LightningElement,track,api} from "lwc";
import { guid,isNotUndefinedOrNull,isUndefinedOrNull,getCurrentRank,runActionAfterTimeOut,isEmpty } from "shared/utils";
import {Level,Rule,FileItem,Item} from './utils';

export default class App extends LightningElement {

    _fileData;

    // Sarif
    sarif_run;
    sarif_rules;
    sarif_groupedByRuleId;
    sarif_totalRecordsGroupedByLevel = [];
    sarif_formattedRecords = [];

    filter;
    
    // Table
    tableInstance;


    @api 
    get fileData(){
        return this._fileData;
    }
    set fileData(value){
        this._fileData = value;
        this.initFileProcessing();
    }


   

    connectedCallback(){
        runActionAfterTimeOut(null,(param) => {
            this.loadCachedFile();
        });
        
    }



    /** Events */

    handleFileChange = (e) => {
        const file = e.target.files[0];
        var reader = new FileReader()
            reader.onload = () => {
                var base64 = reader.result.split(',')[1]
                this.fileData = {
                    'filename': file.name,
                    'base64': base64,
                }
                /** Stored Current File in local storage **/
                try{
                    localStorage.setItem('sarif_lastFileName',file.name)
                    localStorage.setItem(file.name, base64);
                }catch(e){
                    console.warn(e);
                }
                
            }
        reader.readAsDataURL(file)
    }

    handleFileRemove = () => {
        this.fileData = null;
    }


    handleSearchInput = (e) => {
        let val = e.currentTarget.value;
        runActionAfterTimeOut(val,(newValue) => {
            this.filterWith(newValue);
        });
    }



    /** Methods  */

    loadCachedFile = () => {
        const lastFileName = localStorage.getItem('sarif_lastFileName');
        if(isNotUndefinedOrNull(lastFileName)){
            try{
                const fileData = localStorage.getItem(lastFileName);
                this.fileData = {
                    'filename': lastFileName,
                    'base64': fileData,
                }
            }catch(e){
                console.warn(e);
                localStorage.removeItem('sarif_lastFileName');
                localStorage.removeItem(lastFileName);
                this.fileData = null;
            }
        }
    }

    initFileProcessing = () => {
        if(isUndefinedOrNull(this.fileData)) return;

        console.log('initFileProcessing');
        const fileData = atob(this.fileData.base64);
        const record = JSON.parse(fileData);

        if(record.runs.length == 0) {
            console.error('There should be at least 1 run');
        }
        this.sarif_run  = record.runs[0];
        this.sarif_rules = this.sarif_run.tool.driver.rules;
    
        // Procesing
        this.sarif_formattedRecords = this.getStructuredData();
        this.sarif_formattedRecordsByFiles = this.getStructuredDataByFiles();
        console.log('sarif_formattedRecords',this.sarif_formattedRecords);
        console.log('sarif_formattedRecordsByFiles',this.sarif_formattedRecordsByFiles);
      
    }


    

    filterWith = (val) => {
        this.filter = val;
        this.sarif_formattedRecords = this.getStructuredData();
        this.sarif_formattedRecordsByFiles = this.getStructuredDataByFiles();
    }

    

    /** Processing Methods */

    getStructuredDataByFiles = () => {
        let files = {};
        this.getFilteredData.forEach((x,index) => {
            const {ruleId,kind,message,locations} = x;
            const level = x.level || this.getManualLevel(x);
            
            let _location = locations[0].physicalLocation;
            let path = _location.artifactLocation.uri;

            if(!files.hasOwnProperty(path)){
                files[path] = new FileItem(guid(),path,level);
            }

            files[path].items.push(
                new Item(
                    guid(),
                    level,
                    ruleId,
                    message.text,
                    _location
                )
            );
        });
        return Object.values(files).sort((a, b) => a.fileName.localeCompare(b.fileName));
    }

    getManualLevel = (x) => {
        const priorities = ['None','High','Medium High','Medium','Medium Low','Low'];
        const rule = this.sarif_rules.find(y => y.id == x.ruleId);
        
        return priorities[rule?.properties?.priority || 0];
    }

    getStructuredData = () => {
        let result = {};
        this.getFilteredData.forEach((x,index) => {
            const {ruleId,kind,message,locations} = x;
            const level = x.level || this.getManualLevel(x);

            if(!result.hasOwnProperty(level)){
                result[level] = new Level(
                    level
                );
            }

            if(!result[level].rules.hasOwnProperty(ruleId)){
                const rule = this.sarif_rules.find(y => y.id === ruleId);
                result[level].rules[ruleId] = new Rule(
                    ruleId,
                    rule,
                    result[level].label,
                );
            }
            let _location = locations[0].physicalLocation;
            let path = _location.artifactLocation.uri;

            if(!result[level].rules[ruleId].files.hasOwnProperty(path)){
                result[level].rules[ruleId].files[path] = new FileItem(
                    guid(),
                    path,
                    level,
                    true,
                )
            }

            result[level].rules[ruleId].files[path].items.push(
                new Item(
                    guid(),
                    level,
                    ruleId,
                    message.text,
                    _location,
                )
            );
        });
        return Object.values(result).sort((a, b) => a.order - b.order);
    }

    /** Getters */

    get isFileUploaderDisplayed(){
        return isUndefinedOrNull(this.fileData);
    }

    get fileName(){
        return 'hello'
    }

    get formattedFiles(){
        if(isUndefinedOrNull(this.fileData)) return [];

        return [
            {
                label: this._fileData.filename,
                name: this._fileData.filename,
            }
        ]
    }

    get getFilteredData(){
        if(isEmpty(this.filter)) return this.sarif_run.results;
        return this.sarif_run.results.filter(x => {
            const {message,locations} = x;
            return locations[0].physicalLocation.artifactLocation.uri.toLowerCase().includes(this.filter.toLowerCase()) || message.text.toLowerCase().includes(this.filter.toLowerCase())
        })
    }

}
