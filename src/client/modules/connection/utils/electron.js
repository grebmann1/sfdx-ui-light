import {isNotUndefinedOrNull,decodeError} from 'shared/utils';



export async function getConnection(alias){
    console.log('electron.getConnection');
    var {res, error} = await window.electron.ipcRenderer.invoke('org-seeDetails',{alias});
    if (error) {
        throw decodeError(error)
    }
    res = {
        ...res,
        ...{
            id:res.alias,
            company:`${res.alias.split('-').length > 1?res.alias.split('-').shift():''}`.toUpperCase(),
            name:res.alias.split('-').pop()
        }
    }
    return res;
}


export async function renameConnection({oldAlias,newAlias,username}){
    console.log('electron.renameConnection');
    let {error} = await window.electron.ipcRenderer.invoke('org-setAlias',{
        alias: newAlias,
        username: username
    });
    if (error) {
        throw decodeError(error);
    }

    if(oldAlias !== 'Empty' || isNotUndefinedOrNull(oldAlias)){
        let {error} = await window.electron.ipcRenderer.invoke('org-unsetAlias',{alias:oldAlias});
        if (error) {
            throw decodeError(error)
        }
    }
}

export async function removeConnection(alias){
    // todo: need to be refactured
    console.log('electron.removeConnection');
    var {error} = await window.electron.ipcRenderer.invoke('org-unsetAlias',{alias});
    if (error) {
        throw decodeError(error)
    }
} 

export async function getAllConnection(){
    console.log('electron.getAllConnection');
    let res = await window.electron.ipcRenderer.invoke('org-getAllOrgs');
    console.log('res',res);
        res = res.filter(x => isNotUndefinedOrNull(x.alias)); // Remove empty alias
        res = res.map((item,index) => {
            let alias = item.alias || 'Empty'
            return {
                ...item,
                ...{
                    alias,
                    id:`index-${index}`,
                    company:`${alias.split('-').length > 1?alias.split('-').shift():''}`.toUpperCase(),
                    name:alias.split('-').pop(),
                    sfdxAuthUrl:item.instanceUrl+'/secur/frontdoor.jsp?sid='+item.accessToken
                }
            }
        });
        res = res.sort((a, b) => a.alias.localeCompare(b.alias));
    return res;
}