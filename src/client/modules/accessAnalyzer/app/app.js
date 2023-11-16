import { LightningElement } from "lwc";
import {decodeError,getAllOrgs,chunkPromises,isEmpty} from 'shared/utils';
import {TabulatorFull as Tabulator} from 'tabulator-tables';
import ModalProfileFilter from "accessAnalyzer/ModalProfileFilter";

/* For Testing in Browser */
import Fake from 'shared/fake';

export default class App extends LightningElement {
    usernameOrAlias;
    
    orgs = [];

    metadatalist = [];
    metadataDetails = [];
    tableInstance;


    /* Filters */
    report = 'Profile';
    isFilteting_profiles = false;
    

    isLoading = false;
    /* Debug */
    isDebugMode = true;

    async connectedCallback(){
        this.orgs = await getAllOrgs(this.isDebugMode);
        this.usernameOrAlias = this.orgs.length > 0 ? this.orgs[0].alias:null;
        this.loadMetadata({force:false});
    }

    openModalFilter_profile = () => {
        ModalProfileFilter.open({
            profiles:this.metadataDetails['Profile'],
        });

    }

    refreshMetadata = async () => {
        this.loadMetadata({force:true});
    }

    loadMetadata = async ({force=false}) => {
        this.isLoading = true;
        this.metadatalist = [];
        this.metadataDetails = [];

        /** Metadata List */
        let _metadataResult = await this.getMetadataList({force,types:[
            {type: 'Profile', folder: null},
            {type: 'CustomObject', folder: null},
        ]});
        if(_metadataResult.res){
            this.metadatalist = _metadataResult.res.sort((a, b) => a.fullName.localeCompare(b.fullName));
        }
        console.log('--> metadatalist',this.metadatalist);

        /** Metadata Describe */
        chunkPromises(this.metadatalist.map(header => ({force,header})),40,this.getMetadataDetails)
        .then((metadataArray) => {
            this.metadataDetails = {'Profile':[],'CustomObject':[]};

            metadataArray
            .forEach(item => {
                let {res,header} = item;
                if(res){
                    this.metadataDetails[header.type].push({
                        ...res,
                        ...header
                    });
                }
            });
            console.log('--> metadataDetails',this.metadataDetails);
            this.displayReport();
            this.isLoading = false;
        });
    }

    /** Methods */

    getMetadataList = async ({force,types}) => {
        if(this.isDebugMode){
            return {res:Fake.Metadata};
        }

        let {res,error} = await window.electron.ipcRenderer.invoke('jsforce-metadataList',{
            force,
            types,
            alias:this.usernameOrAlias,
        });
        return {res,error};
    }

    getMetadataDetails = async ({force,header}) => {
        if(this.isDebugMode){
            return {res:Fake[header.type][header.fullName],header}
        }
        let {res,error} = await window.electron.ipcRenderer.invoke('jsforce-metadataRead',{
            force,
            type:header.type,
            fullName:header.fullName,
            alias:this.usernameOrAlias,
        });
        return {res,header,error};
    }

    getSObjectInfo = async ({force,type}) => {
        if(this.isDebugMode){
            return {res:Fake.SObject[type]}
        }
        let {res,error} = await window.electron.ipcRenderer.invoke('jsforce-describeSobject',{
            force,
            type,
            alias:this.usernameOrAlias,
        });
        return {res,error};
    }

    /** Events  **/
    usernameOrAlias_handleChange = (e) => {
        this.usernameOrAlias = e.detail.value;
    }

    report_handleChange = (e) => {
        this.report = e.detail.value;
        this.displayReport();
    }

    /** Getters **/

    get usernameOrAlias_options(){
        return this.orgs.map(x => ({label:x.alias,value:x.alias}));
    }

    get report_options(){
        return [
            {label:'Object Permissions',value:'CustomObject'},
            {label:'Profile Permissions',value:'Profile'},
            {label:'Field-Level Security',value:'FieldLevelSecurity'},
            {label:'Page Layout Assignement',value:'PageLayout'},
            {label:'Apex Class Access',value:'ApexClass'},
            {label:'Tab Settings',value:'TabSettings'},
            {label:'App Settings',value:'AppSettings'}
        ];
    }


    /** Filters */

    profileFiltering_handleClick = (e) => {

        this.openModalFilter_profile();
        //this.isFilteting_profiles = !this.isFilteting_profiles;
        
    }

    get profileFilteringVariant(){
        return this.isFilteting_profiles?'brand':'neutral'
    }



    /** Tabulator */

    displayReport = () => {
        switch(this.report){
            case 'CustomObject':
                this.setCustomObjectReport();
            break
            case 'Profile':
                this.setProfileReport();
            break
            default:
                console.log('No Default Report');
            break;
        }
    }

    setProfileReport = async (force=false) => {
        let {res} = await this.getSObjectInfo({type:'PermissionSet'});
        let permissions = [];
        if(res){
            permissions = res.fields.filter(x => x.name.startsWith('Permissions')).map(x => ({label:x.label,name:x.name}));
        }

        let profiles = this.metadataDetails['Profile'].map(x => ({
            ...x,
            ...{
                id:encodeURI(x.fullName),
                userPermissions:x.userPermissions?(
                    Array.isArray(x.userPermissions)?x.userPermissions:[x.userPermissions]
                ):[]
            }
        }));
        let filterColumns = {};


		let datas = []; 

		let colModel = [
			{ title: 'Label', field: 'label', frozen: true, headerHozAlign: "center", resizable: false,responsive:0,headerFilter:"input"},
			{ title: 'DeveloperName', field: 'api', frozen: true, headerHozAlign: "center", resizable: false, tooltip: true }
		];
        
		profiles.forEach(p => {
			if (!filterColumns[p.fullName]) {
                let _typeIndex = colModel.findIndex(x => x.field == p.userLicense);
                if(_typeIndex < 0){
                    /* Create User License */
                    colModel.push(
                        { 
                            title: p.userLicense, field: p.userLicense, columns: [], 
                            headerHozAlign: "center",  headerWordWrap: false, variableHeight: true, 
                            headerTooltip :p.userLicense, resizable: true, minWidth:120
                        }
                    );
                    _typeIndex = colModel.length - 1;
                }

				colModel[_typeIndex].columns.push(
					{ title: p.fullName, field: p.id, headerHozAlign: "center",hozAlign:"center",headerWordWrap: true, width: 80, formatter:"tickCross", formatterParams:{allowEmpty:true},headerSort:false}
				);
			}
		});

        permissions.forEach(item => {
			let data = {};
                data['label']   = item.label;
                data['api']     = item.name;

            profiles.forEach(p => {
                let index = p.userPermissions.findIndex(x => `Permissions${x.name}` == item.name);
                if(index > -1){
                    data[p.id] = p.userPermissions[index].enabled === 'true'; // Want to keep empty if doesn't exist instead of false
                }
            });

			datas.push(data);
		});

        if (this.tableInstance) {
			this.tableInstance.destroy();
		}
		this.tableInstance = new Tabulator(this.template.querySelector(".custom-table"), {
			height: document.body.clientHeight - 185,
			data: datas,
			layout: "fitDataFill",
			columns: colModel,
			columnHeaderVertAlign: "middle",
		});
    }

    setCustomObjectReport = (force=false) => {
        let sobjects = this.metadataDetails['CustomObject'];
        let profiles = this.metadataDetails['Profile'].map(x => ({
            ...x,
            ...{
                id:encodeURI(x.fullName),
                objectPermissions:x.objectPermissions?(
                    Array.isArray(x.objectPermissions)?x.objectPermissions:[x.objectPermissions]
                ):[]
            }
        }));
        let filterColumns = {};


		let datas = []; 

		let colModel = [
			{ title: 'Label', field: 'label', frozen: true, headerHozAlign: "center", resizable: false,responsive:0,headerFilter:"input"},
			{ title: 'DeveloperName', field: 'api', frozen: true, headerHozAlign: "center", resizable: false, tooltip: true }
		];
        
		profiles.forEach(p => {
			
			if (!filterColumns[p.fullName]) {
				let subCols = [];

				subCols.push({ title: 'Read',       field: p.id + '_r',   minWidth: 28, cssClass: 'vertical-title', width: 40, headerVertical: true, resizable: false ,formatter:"tickCross", formatterParams:{allowEmpty:true}});
				subCols.push({ title: 'Create',     field: p.id + '_c',   minWidth: 28, cssClass: 'vertical-title', width: 40, headerVertical: true, resizable: false ,formatter:"tickCross", formatterParams:{allowEmpty:true}});
				subCols.push({ title: 'Edit',       field: p.id + '_u',   minWidth: 28, cssClass: 'vertical-title', width: 40, headerVertical: true, resizable: false ,formatter:"tickCross", formatterParams:{allowEmpty:true}});
				subCols.push({ title: 'Delete',     field: p.id + '_d',   minWidth: 28, cssClass: 'vertical-title', width: 40, headerVertical: true, resizable: false ,formatter:"tickCross", formatterParams:{allowEmpty:true}});
				subCols.push({ title: 'All Read',   field: p.id + '_ar',  minWidth: 28, cssClass: 'vertical-title', width: 40, headerVertical: true, resizable: false ,formatter:"tickCross", formatterParams:{allowEmpty:true}});
				subCols.push({ title: 'All Edit',   field: p.id + '_au',  minWidth: 28, cssClass: 'vertical-title', width: 40, headerVertical: true, resizable: false ,formatter:"tickCross", formatterParams:{allowEmpty:true}});

				colModel.push(
					{ title: p.fullName, field: p.id, columns: subCols, headerHozAlign: "center",  headerWordWrap: true, variableHeight: true, headerTooltip :p.fullName, resizable: false }
				);
			}
		});
		sobjects.forEach(sobject => {
            
			let data = {};
                data['label']   = sobject.label;
                data['api']     = sobject.fullName;
                data['namespacePrefix'] = sobject.namespacePrefix || 'Default';

			profiles.forEach(p => {
                
				let op = p.objectPermissions.find(x => x.object == sobject.fullName);

				data[p.id + '_r'] = op && op.allowRead;
                data[p.id + '_c'] = op && op.allowCreate;
                data[p.id + '_u'] = op && op.allowEdit;
                data[p.id + '_u'] = op && op.allowEdit;
                data[p.id + '_d'] = op && op.allowDelete;
				data[p.id + '_ar'] = op && op.viewAllRecords;
                data[p.id + '_au'] = op && op.modifyAllRecords;
			});
        
            datas.push(data);
            
		});



		if (this.tableInstance) {
			this.tableInstance.destroy();
		}
		this.tableInstance = new Tabulator(this.template.querySelector(".custom-table"), {
			height: document.body.clientHeight - 185,
			data: datas,
			layout: "fitDataFill",
			columns: colModel,
			columnHeaderVertAlign: "middle",
            debugInvalidOptions:true,
            groupBy:"namespacePrefix",
            maxHeight:"100%",
            rowFormatter:function(row){
                if(row.getData().isCategory){
                    row.getElement().style.backgroundColor = "#1c96ff";
                }
            },        
		});

        

		//table.on("dataFiltered", updateCounter);
		//table.on("dataProcessed", function(){ $("#loading").removeClass("active").addClass("hidden"); } );
	}

}