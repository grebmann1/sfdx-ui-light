import {isNotUndefinedOrNull,decodeError,classSet} from 'shared/utils';



export async function getSettings(alias){
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
    var {error} = await window.electron.ipcRenderer.invoke('org-logout',{alias});
    if (error) {
        throw decodeError(error)
    }
} 

export async function getAllConnection(){
    let res = await window.electron.ipcRenderer.invoke('org-getAllOrgs');
    let orgs = [].concat(
        res.nonScratchOrgs.map(x => ({
            ...x,
            _status:x.connectedStatus,
            _type:x.isDevHub?'DevHub':x.isSandbox?'Sandbox':''
        })),
        res.scratchOrgs.map(x => ({
            ...x,
            _status:x.status,
            _type:"Scratch"
        }))
    );

    orgs = orgs.filter(x => isNotUndefinedOrNull(x.alias)); // Remove empty alias
    orgs = orgs.map((item,index) => {
            let alias = item.alias || 'Empty'
            let _typeClass = classSet('').add({
                'slds-color-brand':item._type === 'DevHub',
                'slds-color-orange-light':item._type === 'Sandbox',
                'slds-color-orange-dark':item._type === 'Scratch'
            }).toString();

            return {
                ...item,
                ...{
                    alias,
                    id:`index-${index}`,
                    company:`${alias.split('-').length > 1?alias.split('-').shift():''}`.toUpperCase(),
                    name:alias.split('-').pop(),
                    sfdxAuthUrl:item.instanceUrl+'/secur/frontdoor.jsp?sid='+item.accessToken,
                    _typeClass,
                    _statusClass:item._status === 'RefreshTokenAuthError'?'slds-text-color_error':'slds-text-color_success slds-text-title_caps',
                }
            }
        });
        orgs = orgs.sort((a, b) => a.alias.localeCompare(b.alias));
    return orgs;
}