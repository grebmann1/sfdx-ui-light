const sfdx = require('sfdx-node');
const jsforce = require('jsforce');

const { hashCode } = require('../../utils/utils.js');
const Store = require('../../utils/store.js');
const { encodeError } = require('../../utils/errors.js');


/** QUERY **/
query = async (event,{refresh,alias,query,toolingApiEnabled,isCacheEnabled}) => {
    //console.log('{alias,query}',{alias,query});
    console.log('query - params',{refresh,alias,query,toolingApiEnabled,isCacheEnabled});
    const hash = hashCode(query);
    const store = new Store({configName:`${alias}/Query/${hash}`});
    try{
        if(!store.isEmpty() && isCacheEnabled && !refresh){
            return {res:store.data}
        }
        let orgInfo = await sfdx.force.org.display({
            _quiet:true,
            json:true,
            verbose:true,
            _rejectOnError: true,
            targetusername: alias
        });

        const conn = new jsforce.Connection({
            serverUrl : orgInfo.instanceUrl,
            accessToken : orgInfo.accessToken,
            version:'54.0'
        });
        let res;
        if(toolingApiEnabled){
            res = await conn.tooling.query(query);
        }else{
            res = await conn.query(query);
        }

        if(isCacheEnabled){
            store.set(null,res);
        }
        return {res};
    }catch(e){
        return {error: encodeError(e)}
    }
}

/** SOBJECT DESCRIBE **/
sobjectDescribe = async (event,{refresh= false,alias,type}) => {
    console.log('query - sobjectDescribe',{refresh,alias,type});
    const store = new Store({configName:`${alias}/SObject/${type}`});
    try{
        if(!store.isEmpty() && !refresh){
            return {res:store.data}
        }
        console.log('Fetch Mode - sobjectDescribe');
        let orgInfo = await sfdx.force.org.display({
            _quiet:true,
            json:true,
            verbose:true,
            _rejectOnError: true,
            targetusername: alias
        });

        const conn = new jsforce.Connection({
            serverUrl : orgInfo.instanceUrl,
            accessToken : orgInfo.accessToken,
            version:'54.0'
        });
        let res = await conn.sobject(type).describe();
        store.set(null,res);
        return {res};
    }catch(e){
        return {error: encodeError(e)}
    }
}

/** METADATA LIST **/
metadataList = async (event,{refresh = false,alias,types}) => {
    console.log('query - metadataList',{refresh,alias,types});
    console.log('metadataList',{alias,types});
    const store = new Store({configName:`${alias}/metadata`});
    try{
        if(store.contains('metadataList') && !refresh) return {res:store.get('metadataList')}

        console.log('Fetch Mode - metadataList');
        let orgInfo = await sfdx.force.org.display({
            _quiet:true,
            json:true,
            verbose:true,
            _rejectOnError: true,
            targetusername: alias
        });

        const conn = new jsforce.Connection({
            serverUrl : orgInfo.instanceUrl,
            accessToken : orgInfo.accessToken,
            version:'54.0'
        });
        let res = await conn.metadata.list(types, '54.0');
        store.set('metadataList',res);
        return {res};

        
    }catch(e){
        console.log('e',e);
        return {error: encodeError(e)}
    }
}

metadataRead = async (event,{refresh = false,alias,type,fullName}) => {
    //console.log('query - metadataRead',{refresh,alias,type,fullName});
    const store = new Store({configName:`${alias}/${type}/${fullName}`});
    try{
        if(!store.isEmpty() && !refresh){
            return {res:store.data}
        }
        
        console.log('Fetch Mode - metadataRead');
        let orgInfo = await sfdx.force.org.display({
            _quiet:true,
            json:true,
            verbose:true,
            _rejectOnError: true,
            targetusername: alias
        });

        const conn = new jsforce.Connection({
            serverUrl : orgInfo.instanceUrl,
            accessToken : orgInfo.accessToken,
            version:'54.0'
        });
        let res = await conn.metadata.read(type,fullName);
        store.set(null,res);
        return {res};
    }catch(e){
        console.log('e',e);
        return {error: encodeError(e)}
    }
}



module.exports = {
    metadataList,
    metadataRead,
    sobjectDescribe,
    query
}