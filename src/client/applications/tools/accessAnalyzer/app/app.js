import { api } from "lwc";
import FeatureElement from 'element/featureElement';

import { groupBy,runActionAfterTimeOut,isUndefinedOrNull,isNotUndefinedOrNull,getFromStorage,classSet } from 'shared/utils';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import ModalProfileFilter from "accessAnalyzer/modalProfileFilter";
import ModalPermissionSetFilter from "accessAnalyzer/modalPermissionSetFilter";
import ModalUserSelector from "slds/modalUserSelector";
//import ModalPermissionSelector from "slds/modalPermissionSelector";


import { loadMetadata_async,setFieldPermission } from "shared/sf";
import { fileFormatter } from 'accessAnalyzer/utils';
const SVG_CHECKED = '<svg enable-background="new 0 0 24 24" height="14" width="14" viewBox="0 0 24 24" xml:space="preserve" lwc-1ctolp3d4fm=""><path fill="#2DC214" clip-rule="evenodd" d="M21.652,3.211c-0.293-0.295-0.77-0.295-1.061,0L9.41,14.34  c-0.293,0.297-0.771,0.297-1.062,0L3.449,9.351C3.304,9.203,3.114,9.13,2.923,9.129C2.73,9.128,2.534,9.201,2.387,9.351  l-2.165,1.946C0.078,11.445,0,11.63,0,11.823c0,0.194,0.078,0.397,0.223,0.544l4.94,5.184c0.292,0.296,0.771,0.776,1.062,1.07  l2.124,2.141c0.292,0.293,0.769,0.293,1.062,0l14.366-14.34c0.293-0.294,0.293-0.777,0-1.071L21.652,3.211z" fill-rule="evenodd" lwc-1ctolp3d4fm=""></path></svg>';
const SVG_UNCHECKED = '<svg enable-background="new 0 0 24 24" height="14" width="14" viewBox="0 0 24 24" xml:space="preserve" lwc-1ctolp3d4fm=""><path fill="#CE1515" d="M22.245,4.015c0.313,0.313,0.313,0.826,0,1.139l-6.276,6.27c-0.313,0.312-0.313,0.826,0,1.14l6.273,6.272  c0.313,0.313,0.313,0.826,0,1.14l-2.285,2.277c-0.314,0.312-0.828,0.312-1.142,0l-6.271-6.271c-0.313-0.313-0.828-0.313-1.141,0  l-6.276,6.267c-0.313,0.313-0.828,0.313-1.141,0l-2.282-2.28c-0.313-0.313-0.313-0.826,0-1.14l6.278-6.269  c0.313-0.312,0.313-0.826,0-1.14L1.709,5.147c-0.314-0.313-0.314-0.827,0-1.14l2.284-2.278C4.308,1.417,4.821,1.417,5.135,1.73  L11.405,8c0.314,0.314,0.828,0.314,1.141,0.001l6.276-6.267c0.312-0.312,0.826-0.312,1.141,0L22.245,4.015z" lwc-1ctolp3d4fm=""></path></svg>';
const CONFIG = [
    {
        metadataName:'profileFields',
        permissionName:'userPermissions',
        category:'General Permissions',
        permissionFieldId:'name',
        formatter:(x) => {return x.enabled;},
        report:['FullView'],
        key:'general'
    },
    {
        metadataName:'sobjects',
        permissionName:'objectPermissions',
        category:'Object Permissions',
        permissionFieldId:'sobjectType',
        subPermissions:['allowRead','allowCreate','allowEdit','allowDelete','viewAllRecords','modifyAllRecords'],
        formatter:(x) => {
            const arr = [x.allowRead,x.allowCreate,x.allowEdit,x.allowDelete,x.viewAllRecords,x.modifyAllRecords];
            return arr.map(bool => bool ? '1' : '0').join('');
        },
        report:['FullView','ObjectPermissions'],
        key:'objects'
    },
    {
        metadataName:'sobjects', // custom
        permissionName:'layoutAssigns',
        category:'Object Layouts',
        permissionFieldId:'key',
        formatter:(x,metadata) => {
            if(isNotUndefinedOrNull(x) && isNotUndefinedOrNull(metadata)){
                return metadata['layouts'][x.id].name
            }
            return null;
            //const arr = [x.allowRead,x.allowCreate,x.allowEdit,x.allowDelete,x.viewAllRecords,x.modifyAllRecords];
            //return arr.map(bool => bool ? '1' : '0').join('');
        },
        key:'layouts'
    },
    {
        metadataName:'apexClasses',
        permissionName:'classAccesses',
        category:'Apex Class Permissions',
        permissionFieldId:'name',
        formatter:(x) => {return true;},
        key:'apex'
    },
    {
        metadataName:'apexPages',
        permissionName:'pageAccesses',
        category:'Apex Page Permissions',
        permissionFieldId:'name',
        formatter:(x) => {return true;},
        key:'page'
    },
    {
        metadataName:'appDefinitions',
        permissionName:'appAccesses',
        category:'App Settings',
        permissionFieldId:'name',
        formatter:(x) => {return x.visibility === 'DefaultOn';},
        key:'app'
    },
    {
        metadataName:'tabDefinitions',
        permissionName:'tabAccesses',
        category:'Tab Settings',
        permissionFieldId:'name',
        formatter:(x) => {return x.visibility === 'DefaultOn';},
        key:'tab'
    }
];

export default class App extends FeatureElement {

    /* Metadata */
    metadata;
    permissionSets;

    /* Metadata Loaded */
    isMetadataReady = false;
    tableInstance;
    report = 'FullView';

    /* Filters */
    displayFilterContainer = false;
    filter_profiles = [];
    filter_permissionSets = [];
    filter_users = [];
    metadataFilter_value = Object.values(CONFIG).map(x => x.key); // Default select all
    namespaceFiltering_value = 'excluded';
    userLicenseFiltering_value = 'all';
    selectedObject;

    /* Compare */
    isDiffEnabled = false;

    /* Matrix */
    greenTreshold = 5;
    orangeTreshold = 10;

    isLoading = false;
    


    connectedCallback(){
        this.loadCachedSettings();
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

    loadCachedSettings = () => {
        if(isNotUndefinedOrNull(this.connector.header.alias)){
            this.filter_permissionSets  = getFromStorage(localStorage.getItem(`${this.connector.header.alias}-accessAnalyzer-filter_permissionSets`),[]);
            this.filter_profiles        = getFromStorage(localStorage.getItem(`${this.connector.header.alias}-accessAnalyzer-filter_profiles`),[]);
            this.greenTreshold          = getFromStorage(localStorage.getItem(`global-accessAnalyzer-greenTreshold`),5);
            this.orangeTreshold         = getFromStorage(localStorage.getItem(`global-accessAnalyzer-orangeTreshold`),10);
        }
    }

    loadMetadata_withNameSpaceCallback = async (res) => {
        const {entityAccess} = res;
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
        //console.log('this.permissionSets',this.permissionSets);
        //console.log('this.metadata',metadata);
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

    handleChangeGreenTreshold = (e) => {
       
        runActionAfterTimeOut(e.detail.value,(newValue) => {
            this.greenTreshold = newValue;
            localStorage.setItem(`global-accessAnalyzer-greenTreshold`,JSON.stringify(this.greenTreshold));
            this.displayReport();
        },{timeout:500});
    }

    handleChangeOrangeTreshold = (e) => {
        runActionAfterTimeOut(e.detail.value,(newValue) => {
            this.orangeTreshold = e.detail.value;
            localStorage.setItem(`global-accessAnalyzer-orangeTreshold`,JSON.stringify(this.orangeTreshold));
            this.displayReport();
        },{timeout:500});
    }

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
                filename,
                report:this.report,
                leftCellAlignement:this.report == 'Matrix' ? 1 : 2,
                greenTreshold:this.greenTreshold,
                orangeTreshold:this.orangeTreshold
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

    get isFiltering_permissionSets(){
        return this.filter_permissionSets.length > 0;
    }

    get isFiltering_users(){
        return this.filter_users.length > 0;
    }

    get report_options(){
        return [
            {label:'Full View',value:'FullView'},
            {label:'Matrix Diff Comparaison',value:'Matrix'},
            {label:'Permission Groups',value:'PermissionGroups'},
            {label:'Object Permissions',value:'CustomObject'},
            {label:'Field-Level Security',value:'FieldLevelSecurity'}
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
            options = options.concat(Object.keys(groupBy(Object.values(this.permissionSets),'userLicense')).filter(x => x != 'undefined').map(x => ({label:x,value:x})));
        }
        return options;
    }

    get isRefreshDisabled(){
        return isUndefinedOrNull(this.connector) || this.isLoading;
    }

    get isSObjectSelectorDisplayed(){
        return this.report === 'FieldLevelSecurity';
    }

    get isDiffCheckerDisplayed(){
        return this.report === 'FullView' || this.report === 'FieldLevelSecurity';
    }

    get isMetadataFilterDisplayed(){
        return this.report === 'Matrix';
    }

    get diffCheckerVariant(){
        return this.isDiffEnabled?'brand':'neutral';
    }
    get filteringVariant(){
        return this.displayFilterContainer?'brand':'neutral';
    }
    
    get filtering_variant(){
        return this.displayFilterContainer?'brand':'border-filled';
    }

    get profileFilteringVariant(){
        return this.isFiltering_profiles?'brand':'neutral'
    }

    get permissionSetsFilteringVariant(){
        return this.isFiltering_permissionSets?'brand':'neutral';
    }

    get namespaceFiltering_isExcluded(){
        return this.namespaceFiltering_value === 'excluded'
    }

    get sobject_options(){
        return Object.values(this.metadata.sobjects).map(x => ({label:`${x.label} (${x.name})`,value:x.name})).sort((a, b) => a.value.localeCompare(b.value));
    }

    get selectedObjectName(){
        return this.selectedObject?.name
    }

    get metadataFilter_options(){
        return Object.values(CONFIG).map(x => ({
            label:x.category,
            value:x.key
        }))
    }

    get filteredPermissions(){
        return Object.values(this.permissionSets).filter(x => this.getBasicFilter(x));
    }

    sobject_handleChange = (e) => {
        this.selectedObject = this.metadata.sobjects[e.detail.value];
        this.setFieldLevelSecurityReport(true);
    }

    metadataFilter_handleChange = (e) => {
        this.metadataFilter_value = e.detail.value;
        window.setTimeout(async () => {
            this.updateTable(this.calculateMatrixData());
        },1)
    }

    diff_handleChange = (e) => {
        this.isDiffEnabled = e.detail.checked;
        window.setTimeout(async () => {
            // for DiffData, we don't store it, we just reprocess the dataList
            this.updateTable(this.getDiffData(this.dataList));
        },1)
    }

    updateTable = async (data) => {
        if(!this.tableInstance) return;

        this.isLoading = true;
        await this.tableInstance.replaceData(data);
        this.isLoading = false;
    }

    getDiffData = (data) => {
        if(!this.isDiffEnabled) return data;
        const constants = ['label','name','namespacePrefix','category','type','_children','api','isRequired'];
        return data.filter(row => {
            const fields = Object.keys(row).filter(x => !constants.includes(x));
            const toCompare = fields.reduce((acc,field) => {
                acc.add(row[field]);
                return acc;
            },new Set());
            return toCompare.size > 1;
        })
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
                localStorage.setItem(`${this.connector.header.alias}-accessAnalyzer_filter_profiles`,JSON.stringify(this.filter_profiles));
                this.displayReport();
            }
        })
    }

    userFiltering_handleClick = (e) => {
        ModalUserSelector.open({
            conn:this.connector.conn,
            size:'full'
        }).then(res => {
            
        })
    }

    namespaceFiltering_handleChange = (e) => {
        this.namespaceFiltering_value = e.detail.value;
        this.displayReport(); // Reload the table
    }

    userLicenseFiltering_handleChange = (e) => {
        this.userLicenseFiltering_value = e.detail.value;
        this.displayReport(); // Reload the table
    }

    


    permissionSetsFiltering_handleClick = (e) => {
        ModalPermissionSetFilter.open({
            permissionSets:Object.values(this.permissionSets).filter(x => x.type !== 'Profile'),
            currentConnection:this.connector.conn,
            selected:this.filter_permissionSets
        }).then(res => {
            if(res?.action === 'applyFilter'){
                this.filter_permissionSets = res.filter || [];
                localStorage.setItem(`${this.connector.header.alias}-accessAnalyzer_filter_permissionSets`,JSON.stringify(this.filter_permissionSets));
                this.displayReport();
            }
        })
    }

    /** Tabulator */

    displayReportAsync = async () => {
        this.isLoading = true;
        switch(this.report){
            case 'CustomObject':
                await this.setCustomObjectReport();
            break
            case 'FieldLevelSecurity':
                await this.setFieldLevelSecurityReport();
            break;
            case 'FullView':
                await this.setFullViewReport();
            break;
            case 'Matrix':
                await this.setMatrixReport();
            break;
            case 'PermissionGroups':
                await this.setPermissionGroupReport();
            break;
            default:
                console.log('No Default Report');
            break;
        }
        this.isLoading = false;
    }

    displayReport = () => {
        window.setTimeout(() => {
            this.displayReportAsync();
        },1);
    }   

    /** Table Creation **/

    getBasicFilter = (p) => {
        return (this.filter_profiles.includes(p.id) || this.filter_permissionSets.includes(p.id))
        && (this.userLicenseFiltering_value === 'all' || this.userLicenseFiltering_value === p.userLicense)
    }

    generateFullDataList = (metadataFilter) => {
        var dataList = [];
        // Row processing
        Object.values(CONFIG).filter(x => isUndefinedOrNull(metadataFilter) || isNotUndefinedOrNull(metadataFilter) && metadataFilter.includes(x.key)).forEach(configItem => {

            Object.values(this.metadata[configItem.metadataName]) // sobjects.recordTypes
            .filter(x => this.namespaceFiltering_isExcluded && (x.namespacePrefix == null || x.namespacePrefix === '') || !this.namespaceFiltering_isExcluded)
            .forEach(item => {
                let data = {};
                    data['label']   = item.label || item.name;
                    data['name']    = item.name;
                    data['namespacePrefix'] = item.namespacePrefix || 'Default';
                    data['category'] = configItem.category;

                    this.filteredPermissions.forEach(permission => {
                        const permissionList = permission[configItem.permissionName];
                        let index = permissionList.findIndex(x => x[configItem.permissionFieldId] === item.name);
                        if(index > -1){
                            data[permission.id] = configItem.formatter(permissionList[index],this.metadata) // Want to keep empty if doesn't exist instead of false
                        }
                    });

                    if(configItem.key === 'layouts'){
                        // Run special logic for layouts
                        const children = Object.values(item.recordTypes).map(recordType => {
                            const permissionKey = `${item.name}-${recordType.id}`; // to be replaced in the SF method
                            const subData = {
                                name:`${data.name}.${recordType.name}`,
                                label:recordType.label,
                                category:data.category,
                                namespacePrefix : data.namespacePrefix
                            };
                            this.filteredPermissions.forEach(permission => {
                                const permissionList = permission[configItem.permissionName];
                                
                                let index = permissionList.findIndex(x => x[configItem.permissionFieldId] === permissionKey);
                                if(index > -1){
                                    subData[permission.id] = this.metadata['layouts'][permissionList[index].id].name // Want to keep empty if doesn't exist instead of false
                                }
                            });
                            return subData;
                        });
                        if(children && children.length > 0){
                            data._children = children; // avoid empty record types
                        }
                    }

                    if(configItem.subPermissions){
                        
                        // Check the children
                        data._children = configItem.subPermissions.map(key => {
                            const subData = {
                                name:`${data.name}.${key}`,
                                label:key,
                                category:data.category,
                                namespacePrefix : data.namespacePrefix
                            };
                            this.filteredPermissions.forEach(permission => {
                                const permissionList = permission[configItem.permissionName];
                                let index = permissionList.findIndex(x => x[configItem.permissionFieldId] === item.name);
                                if(index > -1){
                                    subData[permission.id] = permissionList[index][key] // Want to keep empty if doesn't exist instead of false
                                }
                            });
                            return subData;
                        });
                    }

                    dataList.push(data);
            });
        })
        
        return dataList;
    }

    calculateMatrixData = () => {
        const _dataList = this.generateFullDataList(this.metadataFilter_value);
        
        // Create Matrix
        const matrix = {}
        this.filteredPermissions.forEach(perm1 => {
            matrix[perm1.id] = {name:perm1.name,id:perm1.id};
            this.filteredPermissions.forEach(perm2 => {
                matrix[perm1.id][perm2.id] = {perm1:perm1.id,perm2:perm2.id}; // difference aggregator
            })
        });
        _dataList.forEach(data => {
            this.filteredPermissions.forEach(perm1 => {
                this.filteredPermissions.forEach(perm2 => {
                    if(data[perm1.id] != data[perm2.id]){
                        if(!matrix[perm1.id][perm2.id].hasOwnProperty(data.category)){
                            matrix[perm1.id][perm2.id][data.category] = 0
                        }
                        matrix[perm1.id][perm2.id][data.category]++;
                    }
                })
            })
        });

        return Object.values(matrix).sort((a, b) => (a.name || '').localeCompare(b.name)); 
    }

    setMatrixReport = async (metadataFilter) => {

        this.isLoading = true;
        if (this.tableInstance) {
			this.tableInstance.destroy();
		}
        
		let colModel = [
			{ title: 'Permission', field: 'name', resizable: true, headerHozAlign: "center", resizable: true,responsive:0,headerFilter:"input"},
		];
        
        // Columns processing
		this.filteredPermissions
        .sort((a, b) => (a.name || '').localeCompare(b.name))
        .forEach(permission => {
            colModel.push(
                {
                    title: permission.name,
                    field: permission.id,
                    /*tooltip: (e,cell) => {
                        if(cell.getValue() && Object.keys(cell.getValue()).length > 0){
                            return `<ul>${Object.keys(cell.getValue()).map(key => `<li>${key}: ${cell.getValue()[key]}</li>`).join('')}</ul>`;
                        }
                    },*/
                    clickPopup:function(e, component, onRendered){
                        if(component.getValue() && Object.keys(component.getValue()).length > 0){
                            return `<ul>${Object.keys(component.getValue()).filter(key => !['perm1','perm2'].includes(key) ).map(key => `<li>${key}: ${component.getValue()[key]}</li>`).join('')}</ul>`;
                        }else{
                            return 'No Difference'
                        }
                    },
                    headerHozAlign: "center",
                    hozAlign:"center",
                    headerWordWrap: true,
                    width: 80,
                    headerSort:false,                 
                    formatter:(cell,formatterParams,onRendered) =>{
                        if(cell.getValue()){
                            if(isNotUndefinedOrNull(cell.getValue().perm1) && cell.getValue().perm1 == cell.getValue().perm2){
                                // Cross mapping
                                cell.getElement().style.backgroundColor = "#747474";
                            }else{
                                const total =  Object.values(cell.getValue()).filter(x => typeof x === "number").reduce((acc,item) => acc + item,0);
                                if(total < this.greenTreshold){
                                    cell.getElement().style.backgroundColor = "#669900";
                                }else if(total < this.orangeTreshold){
                                    cell.getElement().style.backgroundColor = "#ff5d2d";
                                }
                                return total;
                            }
                        }
                    }
                }
            );
		});

        this.dataList = this.calculateMatrixData(metadataFilter);
		this.tableInstance = new Tabulator(this.template.querySelector(".custom-table"), {
			height: this.template.querySelector(".grid-container").clientHeight - this.template.querySelector('.slds-page-header_joined').clientHeight,
			data: this.dataList,
			layout: "fitDataFill",
			columns: colModel,
			columnHeaderVertAlign: "middle",
            debugInvalidOptions:true,
            movableColumns: true,
            movableRows: true,
            maxHeight:"100%",
            placeholder:()=>{
                return this.isDiffEnabled ? "No Matching Data (Diff Enabled)" : "No Data available"; 
            },
            rowFormatter:function(row){
                if(row.getData().isCategory){
                    row.getElement().style.backgroundColor = "#1c96ff";
                }
            },        
		});
        this.isLoading = false;
    }

    setFullViewReport = async (metadataFilter) => {
        console.log('setFullViewReport');
        this.isLoading = true;
        if (this.tableInstance) {
			this.tableInstance.destroy();
		}

		let colModel = [
			{ title: 'Label', field: 'label', resizable: true, headerHozAlign: "center", resizable: false,responsive:0,headerFilter:"input"},
			{ title: 'Developer Name', field: 'name', resizable: true, headerHozAlign: "center", resizable: false, tooltip: true }
		];

        // Columns processing
		this.filteredPermissions.forEach(permission => {
			
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
                        tooltip: true,
                        headerHozAlign: "center",
                        hozAlign:"center",
                        headerWordWrap: true,
                        width: 80,
                        headerSort:false,                   
                        formatter:function(cell,formatterParams,onRendered){
                            if(typeof cell.getValue() == 'boolean'){
                                return cell.getValue()?SVG_CHECKED:SVG_UNCHECKED;
                            }else{
                                return cell.getValue();
                            }
                        }
                    }
				);
		});
        
        
        // Diff Checker processing
        this.dataList = this.generateFullDataList(metadataFilter);
        const _dataList = this.getDiffData(this.dataList);

		this.tableInstance = new Tabulator(this.template.querySelector(".custom-table"), {
			height: this.template.querySelector(".grid-container").clientHeight - this.template.querySelector('.slds-page-header_joined').clientHeight,
			data: _dataList,
            dataTree:true,
            dataTreeStartExpanded:true,
            selectable:true,
			layout: "fitDataFill",
			columns: colModel,
			columnHeaderVertAlign: "middle",
            debugInvalidOptions:true,
            groupBy:"category",
            maxHeight:"100%",
            placeholder:()=>{
                return this.isDiffEnabled ? "No Matching Data (Diff Enabled)" : "No Data available"; 
            },
            rowFormatter:function(row){
                if(row.getData().isCategory){
                    row.getElement().style.backgroundColor = "#1c96ff";
                }
            },        
		});
        this.isLoading = false;
    }

    setFieldLevelSecurityReport = async (updateData) => {
        this.isLoading = true;
		if (this.tableInstance && !updateData) {
			this.tableInstance.destroy();
		}

        if(isUndefinedOrNull(this.selectedObject) && Object.values(this.metadata.sobjects).length > 0){
            this.selectedObject = this.metadata.sobjects[this.sobject_options[0].value];
        }

        await setFieldPermission(this.connector.conn,this.permissionSets,{targetObject:this.selectedObject});

		let dataList = [];
		let colModel = [
			{ title: 'Label', field: 'label', resizable: true, headerHozAlign: "center", minWidth: 200, tooltip: true},
			{ title: 'Developer Name', field: 'api', resizable: true, headerHozAlign: "center", minWidth: 200, tooltip: true },
            { title: 'Field Type', field: 'type', resizable:true, headerHozAlign: "center", minWidth: 100, tooltip: true },
            { title: 'Required', field: 'isRequired', resizable:true, headerHozAlign: "center", minWidth: 20, hozAlign: "center",formatter:"tickCross",formatterParams:{allowEmpty:true},}
		];
        
		this.filteredPermissions.forEach(permission => {
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
		});

        Object.values(this.selectedObject.fields).sort((a, b) => a.name.localeCompare(b.name))
        .filter(x => this.namespaceFiltering_isExcluded && (x.namespacePrefix == null || x.namespacePrefix === '') || !this.namespaceFiltering_isExcluded)
        .forEach(field => {
			let data = {};
                data['api']     = field.name;
                data['label']   = field.label;
                data['type']    = field.type;
			    data['isRequired'] = !field.isNillable;

            this.filteredPermissions.forEach(permission => {
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

        // Diff Checker processing
        this.dataList = dataList;
        const _dataList = this.getDiffData(dataList);
        if(updateData){
            await this.tableInstance.replaceData(_dataList);
        }else{
            this.tableInstance = new Tabulator(this.template.querySelector(".custom-table"), {
                height: this.template.querySelector(".grid-container").clientHeight - this.template.querySelector('.slds-page-header_joined').clientHeight,
                data: _dataList,
                selectable:true,
                layout: "fitDataFill",
                columns: colModel,
                columnHeaderVertAlign: "middle",
                debugInvalidOptions:true,
                groupBy:"namespacePrefix",
                maxHeight:"100%",
                placeholder:()=>{
                    return this.isDiffEnabled ? "No Matching Data (Diff Enabled)" : "No Data available"; 
                },
                rowFormatter:function(row){
                    if(row.getData().isCategory){
                        row.getElement().style.backgroundColor = "#1c96ff";
                    }
                },        
            });
        }

		
        this.isLoading = false;
	}

    setPermissionGroupReport = async () => {
        this.isLoading = true;
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
            selectable:true,
			layout: "fitDataFill",
			columns: colModel,
            groupBy:"namespacePrefix",
			columnHeaderVertAlign: "middle",
            placeholder:"No Data Available",
            groupStartOpen:function(value, count, data, group){
                return value === 'Default';
            },
            downloadConfig:{
                rowGroups:false, //do not include row groups in downloaded table
            },
		});
        this.isLoading = false;
    }


    setCustomObjectReport = async () => {
        this.isLoading = true;
		if (this.tableInstance) {
			this.tableInstance.destroy();
		}

		let dataList = [];
		let colModel = [
			{ title: 'Label', field: 'label', frozen: true, headerHozAlign: "center", resizable: false,responsive:0,headerFilter:"input"},
			{ title: 'Developer Name', field: 'name', frozen: true, headerHozAlign: "center", resizable: false, tooltip: true }
		];
        
		this.filteredPermissions.forEach(permission => {
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
		});

        Object.values(this.metadata.sobjects).sort((a, b) => a.name.localeCompare(b.name))
        .filter(x => this.namespaceFiltering_isExcluded && (x.namespacePrefix == null || x.namespacePrefix === '') || !this.namespaceFiltering_isExcluded)
        .forEach(sObject => {
            
			const data = {};
                data['label']   = sObject.label;
                data['name']    = sObject.name;
                data['namespacePrefix'] = sObject.namespacePrefix || 'Default';

            this.filteredPermissions.forEach(permission => {
                
				const op = permission.objectPermissions.find(x => x.sobjectType === sObject.name);

				data[permission.id + '_r'] = op && op.allowRead;
                data[permission.id + '_c'] = op && op.allowCreate;
                data[permission.id + '_u'] = op && op.allowEdit;
                data[permission.id + '_d'] = op && op.allowDelete;
				data[permission.id + '_ar'] = op && op.viewAllRecords;
                data[permission.id + '_au'] = op && op.modifyAllRecords;
			});

            dataList.push(data);
            
		});

		this.tableInstance = new Tabulator(this.template.querySelector(".custom-table"), {
			height: this.template.querySelector(".grid-container").clientHeight - this.template.querySelector('.slds-page-header_joined').clientHeight,
			data: dataList,
            selectable:true,
			layout: "fitDataFill",
			columns: colModel,
			columnHeaderVertAlign: "middle",
            debugInvalidOptions:true,
            groupBy:"namespacePrefix",
            maxHeight:"100%",
            placeholder:"No Data Available",
            rowFormatter:function(row){
                if(row.getData().isCategory){
                    row.getElement().style.backgroundColor = "#1c96ff";
                }
            },        
		});
        this.isLoading = false;
	}


    /** Filter Panel */

    handleCloseVerticalPanel = () => {
        this.displayFilterContainer = false;
    }

    





}