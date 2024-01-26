import connection_app from "connection/app";
import accessAnalyzer_app from "accessAnalyzer/app";
import code_app from "code/app";
import metadata_app from "metadata/app";
import sobjectExplorer_app from "sobjectexplorer/app";
import extension_app from "extension/app";
import org_app from "org/app";
import sarif_app from "sarif/app";
import doc_app from "doc/app";
import soql_app from "soql/app";

const KNOWN_TYPE = new Set(["connection/app", "accessAnalyzer/app","extension/app","org/app","code/app","metadata/app","sarif/app","doc/app","soql/app","sobjectexplorer/app"]);
const APP_MAPPING = {
    "connection/app": {
        module:connection_app,
        isFullHeight:false,
    },
    "accessAnalyzer/app": {
        module:accessAnalyzer_app,
        isFullHeight:false
    },
    "code/app":{
        module:code_app,
        isFullHeight:false
    },
    "extension/app":{
        module:extension_app,
        isFullHeight:false
    },
    "org/app":{
        module:org_app,
        isFullHeight:false
    },
    "metadata/app":{
        module:metadata_app,
        isFullHeight:true
    },
    "sobjectexplorer/app":{
        module:sobjectExplorer_app,
        isFullHeight:true
    },
    "sarif/app":{
        module:sarif_app,
        isFullHeight:false
    },
    "doc/app":{
        module:doc_app,
        isFullHeight:true
    },
    "soql/app":{
        module:soql_app,
        isFullHeight:true
    }
};

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

export {
    KNOWN_TYPE,
    APP_MAPPING,
    DIRECT_LINK_MAPPING
}