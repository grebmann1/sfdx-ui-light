const sfdx = require('sfdx-node');
const jsforce = require('jsforce');

const Store = require('../../utils/store.js');
const { encodeError } = require('../../utils/errors.js');

describeSobject = async (event,{force=false,alias,type}) => {
    const store = new Store({configName:`${alias}/SObject/${type}`});
    try{
        if(!store.isEmpty() && !force){
            return {res:store.data}
        }
        console.log('Fetch Mode - describeSobject');
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

metadataList = async (event,{force=false,alias,types}) => {
    console.log('metadataList',{alias,types});
    const store = new Store({configName:`${alias}/metadata`});
    try{
        if(store.contains('metadataList') && !force) return {res:store.get('metadataList')}

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

metadataRead = async (event,{force=false,alias,type,fullName}) => {
    const store = new Store({configName:`${alias}/${type}/${fullName}`});
    try{
        if(!store.isEmpty() && !force){
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
    describeSobject
}