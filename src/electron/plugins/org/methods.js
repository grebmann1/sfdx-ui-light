const sfdx = require('sfdx-node');
const { shell } = require('electron');
const { encodeError } = require('../../utils/errors.js');

getAllOrgs = async (_) => {
    let res = await sfdx.force.org.list({
        json:true,
        verbose:true
    });
    console.log('res',res);
    return res?.nonScratchOrgs || [];
}

seeDetails = async (_,{alias}) => {
    try{
        let res = await sfdx.force.org.display({
            _quiet:true,
            json:true,
            verbose:true,
            _rejectOnError: true,
            targetusername: alias
        });
        /** Catch it directly */
        let loginObject = await sfdx.force.org.open({
            targetusername:alias,
            urlonly:true
        });
        res = {
            ...res,
            ...{
                loginUrl:loginObject.url,
                orgId:res.id
            }
        };
        return {res};
    }catch(e){
        console.log('error',e);
        return {error: encodeError(e)}
    }
}

openOrgUrl = async (_,{alias,redirectUrl}) => {
    const result = await sfdx.force.org.open({
        targetusername:alias,
        urlonly:true
    });
    if(result){
        let url = result.url+(redirectUrl?`&retURL=${encodeURIComponent(redirectUrl)}`:'');
        shell.openExternal(url);
    }
}

createNewOrgAlias = async (_,{alias,instanceurl}) => {
    console.log('createNewOrgAlias');

    try{
        let res = await sfdx.auth.web.login({
            setalias: alias,
            instanceurl:instanceurl,
            _quiet:false,
            _rejectOnError: true
        });
        return {res};
    }catch(e){
        return {error: encodeError(e)}
    }
}

unsetAlias = async (_,{alias}) => {
    try{
        let res = await sfdx.alias.unset({
            _quiet:true,
            _rejectOnError: true,
        },{args: [`${alias}`]});
        return {res};
    }catch(e){
        return {error: encodeError(e)}
    }
}

setAlias = async (_,{alias,username}) => {
    try{
        let response = await sfdx.alias.set({
            _quiet:true,
            _rejectOnError: true,
        },{args: [`${alias}=${username}`]});
        return {result:response};
    }catch(e){
        return {error: encodeError(e)}
    }
}

module.exports = {
    getAllOrgs,
    openOrgUrl,
    createNewOrgAlias,
    seeDetails,
    unsetAlias,
    setAlias
}