import { LightningElement,api} from "lwc";
import {decodeError,getAllOrgs,chunkArray,chunkPromises,isEmpty,groupBy,runActionAfterTimeOut,isUndefinedOrNull,isNotUndefinedOrNull} from 'shared/utils';
import {TabulatorFull as Tabulator} from 'tabulator-tables';
import ModalProfileFilter from "accessAnalyzer/modalProfileFilter";
import {loadMetadata_async,setFieldPermission} from "shared/sf";
import { fileFormatter } from 'accessAnalyzer/utils';

export default class App extends LightningElement {

    @api connector;


    /* Metadata */
    metadata;
    profiles;

    /* Metadata Loaded */
    isMetadataReady = false;

    tableInstance;


    /* Filters */
    report = 'CustomObject';
    filter_profiles = [];
    namespaceFiltering_value = 'excluded';
    userLicenseFiltering_value = 'all';
    selectedObject;
    

    isLoading = false;


    async connectedCallback(){
        this.loadMetadata(false);
        window.addEventListener('resize',this.tableResize);
    }

    disconnectedCallback(){
        window.removeEventListener('resize',this.tableResize);
    }


    tableResize = () => {
        runActionAfterTimeOut(null,(param) => {
            if(isNotUndefinedOrNull(this.tableInstance)){
                this.tableInstance.setHeight(this.template.querySelector(".grid-container").clientHeight - this.template.querySelector('.slds-page-header_joined').clientHeight);
            }
        });
    }

    

    cacheMetadata = async () => {
        let key = `${this.connector.header.alias}-metadata`;
        await window.defaultStore.setItem(key,{
            ...this.metadata,
            profiles:this.profiles
        });
    }

    loadMetadata_withNameSpaceCallback = async (res) => {
        const {entityAccess} = res;
        // Assign Entity Access
        Object.keys(this.profiles).forEach(key => {
            this.profiles[key].classAccesses    = this.profiles[key].classAccesses.concat(entityAccess[key].classAccesses);
            this.profiles[key].pageAccesses     = this.profiles[key].pageAccesses.concat(entityAccess[key].pageAccesses);
            this.profiles[key].appAccesses      = this.profiles[key].appAccesses.concat(entityAccess[key].appAccesses);
        });
        this.isMetadataReady = true;
        await this.cacheMetadata();
    }

    loadMetadata = async (refresh = false ) => {
        // Only run when a connection is available
        if(!this.connector)return;

        this.isLoading = true;
        let key = `${this.connector.header.alias}-metadata`;
        let _metadata = await window.defaultStore.getItem(key);
        if(!_metadata || refresh){
            _metadata = await loadMetadata_async(this.connector.conn,this.loadMetadata_withNameSpaceCallback);
        }
        let {profiles,...metadata} = _metadata;
        this.profiles = profiles;
        this.metadata = metadata;
        
        // Pre filter the profiles
        if(this.filter_profiles.length == 0){
            this.filter_profiles = Object.values(this.profiles).filter(x => [
                'Salesforce','Guest License','Salesforce Platform','Customer Community Plus','Customer Community Plus Login','Customer Community Login','Customer Community'
            ].includes(x.userLicense)).map(x => x.id);
        }

        this.displayReport();
        this.isLoading = false;
    }



    /** Events  **/

    refreshMetadata = async () => {
        this.loadMetadata(true);
    }

    downloadCSV = async () => {
        if(this.tableInstance){
            this.isLoading = true;
            await this.tableInstance.download("csv", `${this.connector.header.orgId}_${this.report}.csv`);
            this.isLoading = false;
        }
    }

    downloadPDF = async () => {
        if(this.tableInstance){
            this.isLoading = true;
            let filename = `${this.connector.header.orgId}_${this.report}.pdf`;
            await this.tableInstance.download(fileFormatter,filename,{
                useImage:true,
                title:this.report_options.find(x => x.value == this.report).label,
                filename
            });
            this.isLoading = false;
        }
    }

    report_handleChange = (e) => {
        this.report = e.detail.value;
        this.displayReport();
    }


    /** Getters **/

    get isFiltering_profiles(){
        return this.filter_profiles.length > 0;
    }

    get report_options(){
        return [
            {label:'Object Permissions',value:'CustomObject'},
            {label:'Profile Permissions',value:'Profile'},
            {label:'Field-Level Security',value:'FieldLevelSecurity'},
            {label:'Page Layout Assignment',value:'PageLayout'},
            {label:'Apex Class Access',value:'ApexClass'},
            {label:'VisualForce Page Access',value:'ApexPage'},
            {label:'Tab Settings',value:'TabSettings'},
            //{label:'App Settings',value:'AppSettings'}
        ];
    }

    get namespaceFiltering_options(){
        return [
            {label:'Excluded',value:'excluded'},
            {label:'Included',value:'included'}
        ];
    }

    get userLicenseFiltering_options(){
        let options = [{label:'All',value:'all'}];
        if(this.profiles){
            options = options.concat(Object.keys(groupBy(Object.values(this.profiles),'userLicense')).map(x => ({label:x,value:x})));
        }
        return options;
    }

    get isRefreshDisabled(){
        return isUndefinedOrNull(this.connector) || this.isLoading;
    }

    get isSObjectSelectorDisplayed(){
        return this.report === 'FieldLevelSecurity';
    }


    /** Filters */

    profileFiltering_handleClick = (e) => {
        ModalProfileFilter.open({
            profiles:Object.values(this.profiles),
            currentConnection:this.connector.conn,
            selected:this.filter_profiles
        }).then(res => {
            if(res?.action === 'applyFilter'){
                this.filter_profiles = res.filter || [];
                this.displayReport();
            }
        })
    }

    get profileFilteringVariant(){
        return this.isFiltering_profiles?'brand':'neutral'
    }

    namespaceFiltering_handleChange = (e) => {
        this.namespaceFiltering_value = e.detail.value;
        this.displayReport(); // Reload the table
    }

    get namespaceFiltering_isExcluded(){
        return this.namespaceFiltering_value === 'excluded'
    }

    userLicenseFiltering_handleChange = (e) => {
        this.userLicenseFiltering_value = e.detail.value;
        this.displayReport(); // Reload the table
    }
    

    get sobject_options(){
        return Object.values(this.metadata.sobjects).map(x => ({label:`${x.label} (${x.name})`,value:x.name})).sort((a, b) => a.value.localeCompare(b.value));
    }

    get selectedObjectName(){
        return this.selectedObject?.name
    }

    sobject_handleChange = (e) => {
        this.selectedObject = this.metadata.sobjects[e.detail.value];
    }



    /** Tabulator */

    displayReport = async () => {
        this.isLoading = true;
        switch(this.report){
            case 'CustomObject':
                await this.setCustomObjectReport();
            break
            case 'Profile':
                await this.setGenericReport(Object.values(this.metadata.profileFields),'userPermissions','name', [
                        { title: 'Permission Name', field: 'label', frozen: true, headerHozAlign: "center", resizable: false,responsive:0,headerFilter:"input"},
                        { title: 'Developer Name', field: 'name', frozen: true, headerHozAlign: "center", resizable: false, tooltip: true }
                    ],
                    (x) => {return x.enabled;}
                );
            break
            case 'ApexClass':
                await this.setGenericReport(Object.values(this.metadata.apexClasses),'classAccesses','name', [
                        { title: 'Class Name', field: 'label', width:200, frozen: true, headerHozAlign: "center", resizable: false,responsive:0,headerFilter:"input"},
                    ],
                    (x) => {return true;}
                );
            break
            case 'ApexPage':
                await this.setGenericReport(Object.values(this.metadata.apexPages),'pageAccesses','name', [
                        { title: 'Page Name', field: 'label', width:200, frozen: true, headerHozAlign: "center", resizable: false,responsive:0,headerFilter:"input"},
                        { title: 'Developer Name', field: 'name', frozen: true, headerHozAlign: "center", resizable: false, tooltip: true }
                    ],
                    (x) => {return true;}
                );
            break;
            case 'TabSettings':
                await this.setGenericReport(Object.values(this.metadata.tabDefinitions),'tabAccesses','name', [
                        { title: 'Tab Name', field: 'label', frozen: true, headerHozAlign: "center", resizable: false,responsive:0,headerFilter:"input"},
                        { title: 'DeveloperName', field: 'name', frozen: true, headerHozAlign: "center", resizable: false, tooltip: true }
                    ],
                    (x) => {return x.visibility === 'DefaultOn';}
                );
            break;
            case 'AppSettings':
                await this.setGenericReport(Object.values(this.metadata.appDefinitions),'appAccesses','name', [
                        { title: 'Tab Name', field: 'label', frozen: true, headerHozAlign: "center", resizable: false,responsive:0,headerFilter:"input"},
                        { title: 'DeveloperName', field: 'api', frozen: true, headerHozAlign: "center", resizable: false, tooltip: true }
                    ],
                    (x) => {return x.visibility === 'DefaultOn';}
                );
            break;
            case 'PageLayout':
                await this.setLayoutAssignment();
            break;
            case 'FieldLevelSecurity':
                await this.setFieldLevelSecurityReport();
            break;
            default:
                console.log('No Default Report');
            break;
        }
        this.isLoading = false;
    }

    /** Table Creation **/

    setGenericReport = async (records,listKey,profileKey = 'name',cols,formatterMethod) => {

        let profilesKeys    = Object.keys(this.profiles);
		let dataList = [];

		let colModel = cols;
        
		profilesKeys.forEach(profileId => {
            let profile = this.profiles[profileId];
            if (
                (this.filter_profiles.length === 0 || this.filter_profiles.includes(profileId))
                && (this.userLicenseFiltering_value === 'all' || this.userLicenseFiltering_value === profile.userLicense)
            ){
                let _typeIndex = colModel.findIndex(x => x.field === profile.userLicense);
                if(_typeIndex < 0){
                    /* Create User License */
                    colModel.push({
                            title: profile.userLicense, field: profile.userLicense, columns: [], 
                            headerHozAlign: "center",  headerWordWrap: false, variableHeight: true, 
                            headerTooltip :profile.userLicense, resizable: true, minWidth:120
                    });
                    _typeIndex = colModel.length - 1;
                }

				colModel[_typeIndex].columns.push(
					{
                        title: profile.name,
                        field: profile.id,
                        headerHozAlign: "center",
                        hozAlign:"center",
                        headerWordWrap: true,
                        width: 80,
                        formatter:"tickCross",
                        formatterParams:{allowEmpty:true},
                        headerSort:false
                    }
				);
			}
		});

        records
        .filter(x => this.namespaceFiltering_isExcluded && (x.namespacePrefix == null || x.namespacePrefix === '') || !this.namespaceFiltering_isExcluded)
        .forEach(item => {
            
			let data = {};
                data['label']   = item.label || item.name;
                data['name']    = item.name;
                data['namespacePrefix'] = item.namespacePrefix || 'Default';

                profilesKeys.forEach(profileId => {
                    let profile = this.profiles[profileId];
                    let index = profile[listKey].findIndex(x => x[profileKey] === item.name);
                    if(index > -1){
                        data[profileId] = formatterMethod(profile[listKey][index]) // Want to keep empty if doesn't exist instead of false
                    }
                });

            dataList.push(data);
		});

        if (this.tableInstance) {
			this.tableInstance.destroy();
		}
		this.tableInstance = new Tabulator(this.template.querySelector(".custom-table"), {
			height: this.template.querySelector(".grid-container").clientHeight - this.template.querySelector('.slds-page-header_joined').clientHeight,
			data: dataList,
			layout: "fitDataFill",
			columns: colModel,
            groupBy:"namespacePrefix",
			columnHeaderVertAlign: "middle",
            groupStartOpen:function(value, count, data, group){
                return value === 'Default';
            },
            downloadConfig:{
                rowGroups:false, //do not include row groups in downloaded table
            },
		});
    }

    setLayoutAssignment = async () => {

        let profiles    = Object.values(this.profiles);
        let dataList = [];

        let colModel = [
            { title: 'Object Label', field: 'label', frozen: true, headerHozAlign: "center", resizable: false,responsive:0,headerFilter:"input"},
            { title: 'Record Type Label', field: 'recordTypeLabel', frozen: true, headerHozAlign: "center", resizable: false, tooltip: true },
        ];

        profiles.forEach(p => {
            if (
                (this.filter_profiles.length === 0 || this.filter_profiles.includes(p.id))
                && (this.userLicenseFiltering_value === 'all' || this.userLicenseFiltering_value === p.userLicense)
            ){
                let _typeIndex = colModel.findIndex(x => x.field === p.userLicense);
                if(_typeIndex < 0){
                    /* Create User License */
                    colModel.push({
                        title: p.userLicense, field: p.userLicense, columns: [],
                        headerHozAlign: "center",  headerWordWrap: false, variableHeight: true,
                        headerTooltip :p.userLicense, resizable: true, minWidth:120
                    });
                    _typeIndex = colModel.length - 1;
                }

                colModel[_typeIndex].columns.push(
                    {
                        title: p.name,
                        field: p.id,
                        headerHozAlign: "center",
                        hozAlign:"center",
                        headerWordWrap: false,
                        minWidth: 120,
                        headerSort:false
                    }
                );
            }
        });

        /*
        {
            'layoutName':layout.fullName,
            'layoutLabel':layout.label,
            'recordTypeName':x.fullName,
            'recordTypeLabel':x.label,
            'objectName':x.fullName,
            'objectLabel':x.label,
            'namespacePrefix':x.namespacePrefix
        }
         */
        const _sobjectWithRecordTypes = [];
        Object.values(this.metadata.sobjects).forEach(sobject => {
            let sobjectRecordTypes = Object.values(sobject.recordTypes);
            if(sobjectRecordTypes.length === 0){
                _sobjectWithRecordTypes.push({
                    ...sobject,
                    key:sobject.name,
                })
            }else{
                sobjectRecordTypes.forEach(recordType => {
                    _sobjectWithRecordTypes.push({
                        ...sobject,
                        key:sobject.name+'-'+recordType.id,
                        recordTypeLabel:recordType.label,
                        recordTypeName:recordType.name,
                        recordTypeId:recordType.id
                    })
                })
            }
            
        })

        _sobjectWithRecordTypes.sort((a, b) => a.name.localeCompare(b.name))
        .filter(x => this.namespaceFiltering_isExcluded && (x.namespacePrefix == null || x.namespacePrefix === '') || !this.namespaceFiltering_isExcluded)
        .forEach(item => {
            let data = {...item};
            profiles.forEach(p => {
                if(p.layoutAssigns.hasOwnProperty(item.key)){
                    data[p.id] = p.layoutAssigns[item.key].name; // Want to keep empty if doesn't exist instead of false
                }
            });

            dataList.push(data);
        });

        if (this.tableInstance) {
            this.tableInstance.destroy();
        }
        this.tableInstance = new Tabulator(this.template.querySelector(".custom-table"), {
            height: this.template.querySelector(".grid-container").clientHeight - this.template.querySelector('.slds-page-header_joined').clientHeight,
            data: dataList,
            layout: "fitDataFill",
            columns: colModel,
            groupBy:"name",
            columnHeaderVertAlign: "middle",
            groupStartOpen:function(value, count, data, group){
                return count > 1;
            }
        });
    }

    setCustomObjectReport = () => {
        let profiles    = Object.values(this.profiles);

		let dataList = [];

		let colModel = [
			{ title: 'Label', field: 'label', frozen: true, headerHozAlign: "center", resizable: false,responsive:0,headerFilter:"input"},
			{ title: 'Developer Name', field: 'name', frozen: true, headerHozAlign: "center", resizable: false, tooltip: true }
		];
        
		profiles.forEach(p => {
			
			if (
                (this.filter_profiles.length === 0 || this.filter_profiles.includes(p.id))
                && (this.userLicenseFiltering_value === 'all' || this.userLicenseFiltering_value === p.userLicense)
            ) {


                let subCols = [
                    { title: 'Read',       field: p.id + '_r',   minWidth: 28, cssClass: 'vertical-title', width: 40, headerVertical: true, resizable: false ,formatter:"tickCross", formatterParams:{allowEmpty:true}},
				    { title: 'Create',     field: p.id + '_c',   minWidth: 28, cssClass: 'vertical-title', width: 40, headerVertical: true, resizable: false ,formatter:"tickCross", formatterParams:{allowEmpty:true}},
				    { title: 'Edit',       field: p.id + '_u',   minWidth: 28, cssClass: 'vertical-title', width: 40, headerVertical: true, resizable: false ,formatter:"tickCross", formatterParams:{allowEmpty:true}},
				    { title: 'Delete',     field: p.id + '_d',   minWidth: 28, cssClass: 'vertical-title', width: 40, headerVertical: true, resizable: false ,formatter:"tickCross", formatterParams:{allowEmpty:true}},
				    { title: 'All Read',   field: p.id + '_ar',  minWidth: 28, cssClass: 'vertical-title', width: 40, headerVertical: true, resizable: false ,formatter:"tickCross", formatterParams:{allowEmpty:true}},
				    { title: 'All Edit',   field: p.id + '_au',  minWidth: 28, cssClass: 'vertical-title', width: 40, headerVertical: true, resizable: false ,formatter:"tickCross", formatterParams:{allowEmpty:true}},
                ];

				colModel.push(
					{ title: p.name, field: p.id, columns: subCols, headerHozAlign: "center",  headerWordWrap: true, variableHeight: true, headerTooltip :p.fullName, resizable: false }
				);
			}
		});

        Object.values(this.metadata.sobjects).sort((a, b) => a.name.localeCompare(b.name))
        .filter(x => this.namespaceFiltering_isExcluded && (x.namespacePrefix == null || x.namespacePrefix === '') || !this.namespaceFiltering_isExcluded)
        .forEach(sObject => {
            
			let data = {};
                data['label']   = sObject.label;
                data['name']    = sObject.name;
                data['namespacePrefix'] = sObject.namespacePrefix || 'Default';

			profiles.forEach(p => {
                
				let op = p.objectPermissions.find(x => x.sobjectType === sObject.name);

				data[p.id + '_r'] = op && op.allowRead;
                data[p.id + '_c'] = op && op.allowCreate;
                data[p.id + '_u'] = op && op.allowEdit;
                data[p.id + '_d'] = op && op.allowDelete;
				data[p.id + '_ar'] = op && op.viewAllRecords;
                data[p.id + '_au'] = op && op.modifyAllRecords;
			});

            dataList.push(data);
            
		});



		if (this.tableInstance) {
			this.tableInstance.destroy();
		}
		this.tableInstance = new Tabulator(this.template.querySelector(".custom-table"), {
			height: this.template.querySelector(".grid-container").clientHeight - this.template.querySelector('.slds-page-header_joined').clientHeight,
			data: dataList,
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
	}

    setFieldLevelSecurityReport = async () => {

        if(isUndefinedOrNull(this.selectedObject) && Object.values(this.metadata.sobjects).length > 0){
            this.selectedObject = this.metadata.sobjects[this.sobject_options[0].value];
        }

        await setFieldPermission(this.connector.conn,this.profiles,this.metadata.profilesForPermissionSet,this.selectedObject);

        // setFieldPermission
        let profiles    = Object.values(this.profiles);
		let dataList = [];
		let colModel = [
			{ title: 'Label', field: 'label', frozen: true, headerHozAlign: "center", minWidth: 200, tooltip: true},
			{ title: 'Developer Name', field: 'api', frozen: true, headerHozAlign: "center", minWidth: 200, tooltip: true },
            { title: 'Field Type', field: 'type', frozen: true, headerHozAlign: "center", minWidth: 100, tooltip: true },
            { title: 'Required', field: 'isRequired', frozen: true, headerHozAlign: "center", minWidth: 20, hozAlign: "center",formatter:"tickCross",formatterParams:{allowEmpty:true},}
		];
        
		profiles.forEach(p => {
			
			if (
                (this.filter_profiles.length === 0 || this.filter_profiles.includes(p.id))
                && (this.userLicenseFiltering_value === 'all' || this.userLicenseFiltering_value === p.userLicense)
            ) {

                let _typeIndex = colModel.findIndex(x => x.field === p.userLicense);
                if(_typeIndex < 0){
                    /* Create User License */
                    colModel.push({
                        title: p.userLicense, field: p.userLicense, columns: [],
                        headerHozAlign: "center",  headerWordWrap: false, variableHeight: true,
                        headerTooltip :p.userLicense, resizable: true, minWidth:120
                    });
                    _typeIndex = colModel.length - 1;
                }

                colModel[_typeIndex].columns.push(
					{
                        title: p.name,
                        field: p.id,
                        headerHozAlign: "center",
                        hozAlign:"center",
                        headerWordWrap: true,
                        width: 80,
                        headerSort:false
                    }
				);
			}
		});

        Object.values(this.selectedObject.fields).sort((a, b) => a.name.localeCompare(b.name))
        .filter(x => this.namespaceFiltering_isExcluded && (x.namespacePrefix == null || x.namespacePrefix === '') || !this.namespaceFiltering_isExcluded)
        .forEach(field => {
			let data = {};
                data['api']     = field.name;
                data['label']   = field.label;
                data['type']    = field.type;
			    data['isRequired'] = !field.isNillable;

            profiles.forEach(p => {
				let fp = p.fieldPermissions[field.name];

				if (fp && fp.allowEdit) {
					data[p.id] = 'RW';
				} else if (fp && fp.allowRead) {
					data[p.id] = 'R';
				} else {
					data[p.id] = '';
				}
			});

            dataList.push(data);
            
		});


		if (this.tableInstance) {
			this.tableInstance.destroy();
		}
		this.tableInstance = new Tabulator(this.template.querySelector(".custom-table"), {
			height: this.template.querySelector(".grid-container").clientHeight - this.template.querySelector('.slds-page-header_joined').clientHeight,
			data: dataList,
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
	}

}