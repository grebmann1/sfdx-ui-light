import { LightningElement,api} from "lwc";
import {decodeError,getAllOrgs,chunkArray,chunkPromises,isEmpty,groupBy,runActionAfterTimeOut,isUndefinedOrNull,isNotUndefinedOrNull} from 'shared/utils';
import {TabulatorFull as Tabulator} from 'tabulator-tables';
import ModalProfileFilter from "accessAnalyzer/modalProfileFilter";
import ModalPermissionSetFilter from "accessAnalyzer/modalPermissionSetFilter";
import ModalUserSelector from "slds/modalUserSelector";

import { loadMetadata_async,setFieldPermission } from "shared/sf";
import { fileFormatter } from 'accessAnalyzer/utils';

export default class App extends LightningElement {

    @api connector;


    /* Metadata */
    metadata;
    permissionSets;

    /* Metadata Loaded */
    isMetadataReady = false;

    tableInstance;


    /* Filters */
    displayFilterContainer = false;
    report = 'Profile';
    filter_profiles = [];
    filter_permissionSets = [];
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



    loadMetadata_withNameSpaceCallback = async (res) => {
        const {entityAccess} = res;
        console.log('res',res);
        // Assign Entity Access
        Object.keys(this.permissionSets).forEach(key => {
            if(this.permissionSets.hasOwnProperty(key) && entityAccess.hasOwnProperty(key)){
                this.permissionSets[key].classAccesses    = this.permissionSets[key].classAccesses.concat(entityAccess[key].classAccesses);
                this.permissionSets[key].pageAccesses     = this.permissionSets[key].pageAccesses.concat(entityAccess[key].pageAccesses);
                this.permissionSets[key].appAccesses      = this.permissionSets[key].appAccesses.concat(entityAccess[key].appAccesses);
            }
        });
        this.isMetadataReady = true;
        await this.cacheMetadata();
    }

    loadMetadata = async (refresh = false ) => {
        // Only run when a connection is available
        if(!this.connector)return;
        console.log('this.connector.conn',this.connector.conn)

        this.isLoading = true;
        var _metadata;
        try{
            // Cache loading only for full mode
            if(isNotUndefinedOrNull(this.connector.header.alias)){
                let key = `${this.connector.header.alias}-metadata`;
                _metadata = await window.defaultStore.getItem(key);
                if(isUndefinedOrNull(_metadata?.createdDate) || Date.now() > _metadata.createdDate + 2 * 60 * 60 * 1000){
                    refresh = true; // We force the refresh
                }
            }
            if(!_metadata || refresh){
                _metadata = await loadMetadata_async(this.connector.conn,this.loadMetadata_withNameSpaceCallback);
            }
        }catch(e){
            console.error(e);
            _metadata = await loadMetadata_async(this.connector.conn,this.loadMetadata_withNameSpaceCallback);
        }
        
        let {permissionSets,...metadata} = _metadata;
        this.permissionSets = permissionSets;
        this.metadata = metadata;
        
        // Pre filter the permissionSets
        if(this.filter_profiles.length == 0){
            this.filter_profiles = Object.values(this.permissionSets)
            .filter(x => [
                'Salesforce','Guest License','Salesforce Platform','Customer Community Plus','Customer Community Plus Login','Customer Community Login','Customer Community'
            ]
            .includes(x.userLicense) && x.type === 'Profile')
            .map(x => x.id);
        }

        this.displayReport();
        this.isLoading = false;
    }



    /** Events  **/

    refreshMetadata = async () => {
        this.loadMetadata(true);
    }

    cacheMetadata = async () => {
        let key = `${this.connector.header.alias}-metadata`;
        await window.defaultStore.setItem(key,{
            ...this.metadata,
            permissionSets:this.permissionSets,
            createdDate:Date.now()
        });
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

    adduser_handleClick = (e) => {
        ModalUserSelector.open()
        .then(res => {

        })
    }


    /** Getters **/

    get isFiltering_profiles(){
        return this.filter_profiles.length > 0;
    }

    get isFiltering_permissionSets(){
        return this.filter_permissionSets.length > 0;
    }

    get report_options(){
        return [

            {label:'General Permissions',value:'Profile'},
            {label:'Permission Groups',value:'PermissionGroups'},
            {label:'Object Permissions',value:'CustomObject'},
            {label:'Field-Level Security',value:'FieldLevelSecurity'},
            {label:'Apex Class Access',value:'ApexClass'},
            {label:'VisualForce Page Access',value:'ApexPage'},
            {label:'Tab Settings',value:'TabSettings'},
            {label:'App Settings',value:'AppSettings'},
            {label:'Page Layout Assignment',value:'PageLayout'}
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
        if(isNotUndefinedOrNull(this.permissionSets)){
            options = options.concat(Object.keys(groupBy(Object.values(this.permissionSets),'userLicense')).map(x => ({label:x,value:x})));
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

    get filteringVariant(){
        return this.displayFilterContainer?'brand':'neutral';
    }
    
    get filtering_title(){
        return this.displayFilterContainer?'Hide Filter':'Show Filter';
    }

    filtering_handleClick = (e) => {
        this.displayFilterContainer = !this.displayFilterContainer;
    }

    profileFiltering_handleClick = (e) => {
        ModalProfileFilter.open({
            profiles:Object.values(this.permissionSets).filter(x => x.type === 'Profile'),
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


    permissionSetsFiltering_handleClick = (e) => {
        ModalPermissionSetFilter.open({
            permissionSets:Object.values(this.permissionSets).filter(x => x.type !== 'Profile'),
            currentConnection:this.connector.conn,
            selected:this.filter_permissionSets
        }).then(res => {
            if(res?.action === 'applyFilter'){
                this.filter_permissionSets = res.filter || [];
                this.displayReport();
            }
        })
    }

    get permissionSetsFilteringVariant(){
        return this.isFiltering_permissionSets?'brand':'neutral';
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
                        { title: 'DeveloperName', field: 'name', frozen: true, headerHozAlign: "center", resizable: false, tooltip: true }
                    ],
                    (x) => {return x.visibility === 'DefaultOn';}
                );
            break;
            case 'PermissionGroups':
                await this.setPermissionGroupReport();
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

    getBasicFilter = (p) => {
        return (this.filter_profiles.includes(p.id) || this.filter_permissionSets.includes(p.id))
        && (this.userLicenseFiltering_value === 'all' || this.userLicenseFiltering_value === p.userLicense)
    }

    setGenericReport = async (records,listKey,permissionKey = 'name',cols,formatterMethod) => {

        let permissionSets    = Object.values(this.permissionSets);
		let dataList = [];

		let colModel = cols;
        
		permissionSets.forEach(permission => {
            
            if (
                this.getBasicFilter(permission)
            ){
                let _typeIndex = colModel.findIndex(x => x.field === permission.userLicense);
                if(_typeIndex < 0){
                    /* Create User License */
                    colModel.push({
                            title: permission.userLicense, field: permission.userLicense, columns: [], 
                            headerHozAlign: "center",  headerWordWrap: false, variableHeight: true, 
                            headerTooltip :permission.userLicense, resizable: true, minWidth:120
                    });
                    _typeIndex = colModel.length - 1;
                }

				colModel[_typeIndex].columns.push(
					{
                        title: permission.name,
                        field: permission.id,
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

                permissionSets.forEach(permission => {
                    let index = permission[listKey].findIndex(x => x[permissionKey] === item.name);
                    if(index > -1){
                        data[permission.id] = formatterMethod(permission[listKey][index]) // Want to keep empty if doesn't exist instead of false
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

        let permissionSets    = Object.values(this.permissionSets);
        let dataList = [];

        let colModel = [
            { title: 'Object Label', field: 'label', frozen: true, headerHozAlign: "center", resizable: false,responsive:0,headerFilter:"input"},
            { title: 'Record Type Label', field: 'recordTypeLabel', frozen: true, headerHozAlign: "center", resizable: false, tooltip: true },
        ];

        permissionSets.forEach(permission => {
            if (
                this.getBasicFilter(permission)
            ){
                let _typeIndex = colModel.findIndex(x => x.field === permission.userLicense);
                if(_typeIndex < 0){
                    /* Create User License */
                    colModel.push({
                        title: permission.userLicense, field: permission.userLicense, columns: [],
                        headerHozAlign: "center",  headerWordWrap: false, variableHeight: true,
                        headerTooltip :permission.userLicense, resizable: true, minWidth:120
                    });
                    _typeIndex = colModel.length - 1;
                }

                colModel[_typeIndex].columns.push(
                    {
                        title: permission.name,
                        field: permission.id,
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
            permissionSets.forEach(permission => {
                if(permission.layoutAssigns.hasOwnProperty(item.key)){
                    data[permission.id] = permission.layoutAssigns[item.key].name; // Want to keep empty if doesn't exist instead of false
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
        let permissionSets    = Object.values(this.permissionSets);//.filter(x => x.type === 'Profile');

		let dataList = [];

		let colModel = [
			{ title: 'Label', field: 'label', frozen: true, headerHozAlign: "center", resizable: false,responsive:0,headerFilter:"input"},
			{ title: 'Developer Name', field: 'name', frozen: true, headerHozAlign: "center", resizable: false, tooltip: true }
		];
        
		permissionSets.forEach(permission => {
			
			if (
                this.getBasicFilter(permission)
            ) {


                let subCols = [
                    { title: 'Read',       field: permission.id + '_r',   minWidth: 28, cssClass: 'vertical-title', width: 40, headerVertical: true, resizable: false ,formatter:"tickCross", formatterParams:{allowEmpty:true}},
				    { title: 'Create',     field: permission.id + '_c',   minWidth: 28, cssClass: 'vertical-title', width: 40, headerVertical: true, resizable: false ,formatter:"tickCross", formatterParams:{allowEmpty:true}},
				    { title: 'Edit',       field: permission.id + '_u',   minWidth: 28, cssClass: 'vertical-title', width: 40, headerVertical: true, resizable: false ,formatter:"tickCross", formatterParams:{allowEmpty:true}},
				    { title: 'Delete',     field: permission.id + '_d',   minWidth: 28, cssClass: 'vertical-title', width: 40, headerVertical: true, resizable: false ,formatter:"tickCross", formatterParams:{allowEmpty:true}},
				    { title: 'All Read',   field: permission.id + '_ar',  minWidth: 28, cssClass: 'vertical-title', width: 40, headerVertical: true, resizable: false ,formatter:"tickCross", formatterParams:{allowEmpty:true}},
				    { title: 'All Edit',   field: permission.id + '_au',  minWidth: 28, cssClass: 'vertical-title', width: 40, headerVertical: true, resizable: false ,formatter:"tickCross", formatterParams:{allowEmpty:true}},
                ];

				colModel.push(
					{ title: permission.name, field: permission.id, columns: subCols, headerHozAlign: "center",  headerWordWrap: true, variableHeight: true, headerTooltip :permission.fullName, resizable: false }
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

			permissionSets.forEach(permission => {
                
				let op = permission.objectPermissions.find(x => x.sobjectType === sObject.name);

				data[permission.id + '_r'] = op && op.allowRead;
                data[permission.id + '_c'] = op && op.allowCreate;
                data[permission.id + '_u'] = op && op.allowEdit;
                data[permission.id + '_d'] = op && op.allowDelete;
				data[permission.id + '_ar'] = op && op.viewAllRecords;
                data[permission.id + '_au'] = op && op.modifyAllRecords;
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

        await setFieldPermission(this.connector.conn,this.permissionSets,{targetObject:this.selectedObject});

        // setFieldPermission
        let permissionSets    = Object.values(this.permissionSets);
		let dataList = [];
		let colModel = [
			{ title: 'Label', field: 'label', frozen: true, headerHozAlign: "center", minWidth: 200, tooltip: true},
			{ title: 'Developer Name', field: 'api', frozen: true, headerHozAlign: "center", minWidth: 200, tooltip: true },
            { title: 'Field Type', field: 'type', frozen: true, headerHozAlign: "center", minWidth: 100, tooltip: true },
            { title: 'Required', field: 'isRequired', frozen: true, headerHozAlign: "center", minWidth: 20, hozAlign: "center",formatter:"tickCross",formatterParams:{allowEmpty:true},}
		];
        
		permissionSets.forEach(permission => {
			
			if (
                this.getBasicFilter(permission)
            ) {

                let _typeIndex = colModel.findIndex(x => x.field === permission.userLicense);
                if(_typeIndex < 0){
                    /* Create User License */
                    colModel.push({
                        title: permission.userLicense, field: permission.userLicense, columns: [],
                        headerHozAlign: "center",  headerWordWrap: false, variableHeight: true,
                        headerTooltip :permission.userLicense, resizable: true, minWidth:120
                    });
                    _typeIndex = colModel.length - 1;
                }

                colModel[_typeIndex].columns.push(
					{
                        title: permission.name,
                        field: permission.id,
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

            permissionSets.forEach(permission => {
				let fp = permission.fieldPermissions[field.name];

				if (fp && fp.allowEdit) {
					data[permission.id] = 'RW';
				} else if (fp && fp.allowRead) {
					data[permission.id] = 'R';
				} else {
					data[permission.id] = '';
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

    setPermissionGroupReport = async () => {
        console.log(this.metadata,this.permissionSets);
        let permissionGroups    = Object.values(this.metadata.permissionGroups);
		let dataList = [];

		let colModel = [
            { title: 'Permission',      field: 'label', frozen: true, headerHozAlign: "center", resizable: false,responsive:0,headerFilter:"input"},
            { title: 'DeveloperName',   field: 'name',  frozen: true, headerHozAlign: "center", resizable: false, tooltip: true },
            //{ title: 'Permission Groups',  frozen: true, headerHozAlign: "center", resizable: false, tooltip: true, columns: []},
        ];
        
		permissionGroups.forEach(permission => {
            
				colModel.push(
					{
                        title: permission.label,
                        field: permission.id,
                        headerHozAlign: "center",
                        hozAlign:"center",
                        headerWordWrap: true,
                        width: 120,
                        formatter:"tickCross",
                        formatterParams:{allowEmpty:true},
                        headerSort:false
                    }
				);
		});

        Object.values(this.permissionSets)
        .filter(x => ['Standard','Regular','Session'].includes(x.type))
        .filter(x => this.namespaceFiltering_isExcluded && (x.namespacePrefix == null || x.namespacePrefix === '') || !this.namespaceFiltering_isExcluded)
        .forEach(item => {
			let data = {};
                data['label']   = item.label || item.name;
                data['name']    = item.name;
                data['namespacePrefix'] = item.namespacePrefix || 'Default';
                
                permissionGroups.forEach(group => {
                    let index = group.members.findIndex(x => x === item.id);
                    if(index > -1){
                        data[group.id] = true;
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

}