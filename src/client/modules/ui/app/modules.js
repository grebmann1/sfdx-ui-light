import home_app from "home/app";
import connection_app from "connection/app";
import accessAnalyzer_app from "accessAnalyzer/app";
import code_app from "code/app";
import metadata_app from "metadata/app";
import sobjectExplorer_app from "object/app";
import org_app from "org/app";
import sarif_app from "sarif/app";
import doc_app from "doc/app";
import soql_app from "soql/app";
import platformEvent_app from "platformevent/app";
import anonymousApex_app from "anonymousApex/app";
import api_app from "api/app";
import assistant_app from "assistant/app";
import package_app from "package/app";
import release_app from "release/app";
import settings_app from "settings/app";
/*
const KNOWN_TYPE = new Set([
    "home/app",
    "connection/app", 
    "accessAnalyzer/app",
    "org/app",
    "code/app",
    "metadata/app",
    "sarif/app",
    "doc/app",
    "object/app",
    "soql/app",
    "platformevent/app",
    "api/app",
    "assistant/app"
]);
*/

const i18n = {
    HOME : 'home',
    TOOL : 'tool',
    APPLICATION : 'application',
    CONNECTION : 'connection',
    DOCUMENTATION : 'documentation',
    EXTRA : 'extra'
}

const APP_MAPPING = {
    "home/app": {
        module:home_app,
        isFullHeight:false,
        label:"Home",
        isElectronOnly:false,
        isOfflineAvailable:true,
        isTabVisible:false,
        type:i18n.HOME,
        menuIcon:'utility:home',
        path:'home'
    },
    "connection/app": {
        module:connection_app,
        isFullHeight:false,
        label:"Salesforce Connections",
        isElectronOnly:false,
        isOfflineAvailable:true,
        isTabVisible:false,
        type:i18n.CONNECTION,
        menuIcon:'utility:salesforce1',
        menuLabel:'Connections',
        path:'connections'
    },
    "org/app":{
        module:org_app,
        isFullHeight:true,
        isDeletable:false,
        isElectronOnly:false,
        isOfflineAvailable:false,
        isMenuVisible:false,
        isTabVisible:true,
        label:"Org. Overview",
        type:i18n.APPLICATION,
        shortName:"Org",
        path:'org'
    },
    "accessAnalyzer/app": {
        module:accessAnalyzer_app,
        isFullHeight:true,
        isDeletable:true,
        isElectronOnly:false,
        isOfflineAvailable:false,
        isMenuVisible:true,
        isTabVisible:true,
        label:"Access Analyzer",
        type:i18n.APPLICATION,
        description:"Review/Compare the access provided by the Permission sets & Profiles.",
        quickActionIcon:"standard:portal",
        shortName:"Access.",
        path:'access'
    },
    "code/app":{
        module:code_app,
        isFullHeight:true,
        isDeletable:true,
        isElectronOnly:true,
        isOfflineAvailable:false,
        isMenuVisible:true,
        isTabVisible:true,
        label:"Code Toolkit",
        type:i18n.TOOL,
        description:"Retrieve Code, Run Static code analysis, Open visualforce. A perfect toolkit to simplify your life (Electron only).",
        quickActionIcon:"standard:apex",
        shortName:"Code",
        path:'code'
    },
    "metadata/app":{
        module:metadata_app,
        isFullHeight:true,
        isDeletable:true,
        isElectronOnly:false,
        isOfflineAvailable:false,
        isMenuVisible:true,
        isTabVisible:true,
        label:"Metadata Explorer",
        type:i18n.APPLICATION,
        description:"Review & Modify all your metadata. (Beta)",
        quickActionIcon:"standard:knowledge",
        shortName:"Metad.",
        path:'metadata'
    },
    "object/app":{
        module:sobjectExplorer_app,
        isFullHeight:true,
        isDeletable:true,
        isElectronOnly:false,
        isOfflineAvailable:false,
        isMenuVisible:true,
        isTabVisible:true,
        label:"SObject Explorer",
        type:i18n.APPLICATION,
        description:"Explore in details all your SObjects",
        quickActionIcon:"standard:knowledge",
        shortName:"SObject",
        path:'sobject'
    },
    "sarif/app":{
        module:sarif_app,
        isFullHeight:false
    },
    "doc/app":{
        module:doc_app,
        isFullHeight:true,
        isDeletable:true,
        isElectronOnly:false,
        isOfflineAvailable:true,
        isMenuVisible:true,
        isTabVisible:true,
        label:"Documentation",
        type:i18n.DOCUMENTATION,
        description:"Search through the Salesforce Documentation",
        menuIcon:"utility:knowledge_base",
        quickActionIcon:"standard:article",
        shortName:"Doc.",
        path:'documentation'
    },
    "soql/app":{
        module:soql_app,
        isFullHeight:true,
        isDeletable:true,
        isElectronOnly:false,
        isOfflineAvailable:false,
        isMenuVisible:true,
        isTabVisible:true,
        label:"Data Explorer",
        type:i18n.TOOL,
        description:"Build SOQL queries with fields suggestion and export them.",
        quickActionIcon:"standard:data_model",
        shortName:"SOQL",
        path:'soql'
    },
    "api/app":{
        module:api_app,
        isFullHeight:true,
        isDeletable:true,
        isElectronOnly:false,
        isOfflineAvailable:false,
        isMenuVisible:true,
        isTabVisible:true,
        label:"API Explorer",
        type:i18n.TOOL,
        description:"Explore Salesforce API",
        quickActionIcon:"standard:apex",
        shortName:"API",
        path:'api'
    },
    "platformevent/app":{
        module:platformEvent_app,
        isFullHeight:true,
        isDeletable:true,
        isElectronOnly:false,
        isOfflineAvailable:false,
        isMenuVisible:true,
        isTabVisible:true,
        label:"Event Explorer",
        type:i18n.TOOL,
        description:"Subscribe to platform event to visualize them.",
        quickActionIcon:"standard:events",
        shortName:"PLEV",
        path:'platformevent'
    },
    "anonymousApex/app":{
        module:anonymousApex_app,
        isFullHeight:true,
        isDeletable:true,
        isElectronOnly:false,
        isOfflineAvailable:false,
        isMenuVisible:true,
        isTabVisible:true,
        label:"Anonymous Apex",
        type:i18n.TOOL,
        description:"Execute Apex Scripts",
        quickActionIcon:"standard:apex",
        shortName:"APEX",
        path:'anonymousapex'
    },
    "package/app":{
        module:package_app,
        isFullHeight:true,
        isDeletable:true,
        isElectronOnly:false,
        isOfflineAvailable:false,
        isMenuVisible:true,
        isTabVisible:true,
        label:"Deploy/Retrieve",
        type:i18n.TOOL,
        description:"",
        quickActionIcon:"standard:maintenance_asset",
        shortName:"PACK",
        path:'package'
    },
    "assistant/app":{
        module:assistant_app,
        isFullHeight:true,
        isDeletable:true,
        isElectronOnly:false,
        isOfflineAvailable:false,
        isMenuVisible:true,
        isTabVisible:true,
        label:"AI Assistant",
        type:i18n.APPLICATION,
        description:"Interact with LLM Models",
        quickActionIcon:"standard:story",
        shortName:"AI",
        path:'assistant'
    },
    "settings/app":{
        module:settings_app,
        isFullHeight:true,
        isDeletable:true,
        isElectronOnly:false,
        isOfflineAvailable:true,
        isMenuVisible:true,
        isTabVisible:true,
        label:"Settings",
        type:i18n.EXTRA,
        description:"App settings.",
        menuIcon:"utility:settings",
        quickActionIcon:"standard:settings",
        shortName:"SE",
        path:'settings'
    },
    "release/app":{
        module:release_app,
        isFullHeight:true,
        isDeletable:true,
        isElectronOnly:false,
        isOfflineAvailable:true,
        isMenuVisible:true,
        isTabVisible:true,
        label:"Release Notes",
        type:i18n.EXTRA,
        description:"Review the changes.",
        menuIcon:"utility:notebook",
        quickActionIcon:"standard:entitlement",
        shortName:"RN",
        path:'release'
    },
};
/*
const DIRECT_LINK_MAPPING = {
    "documentation":{
        component:"doc/app",
        name:"Documentation Explorer",
        isDeletable:true
    },
    "soql":{
        component:"soql/app",
        name:"SOQL Explorer",
        isDeletable:true
    },
}
*/
const APP_LIST = (() => {
    return Object.keys(APP_MAPPING).map(name => ({name,...APP_MAPPING[name]}));
})()

export {
    //KNOWN_TYPE,
    //APP_MAPPING,
    //DIRECT_LINK_MAPPING,
    APP_LIST
}