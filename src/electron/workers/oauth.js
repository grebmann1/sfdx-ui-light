const sfdx = require('sfdx-node');
const { encodeError } = require('../utils/errors.js');

createNewOrgAlias = async ({alias,instanceurl}) => {
    console.log('createNewOrgAlias - start');
    try{
        let res = await sfdx.auth.web.login({
            setalias: alias,
            instanceurl:instanceurl,
            _quiet:false,
            _rejectOnError: true
        });

        process.parentPort.postMessage({res})
    }catch(e){
        process.parentPort.postMessage({error: encodeError(e)})
    }
}

// Child process
process.parentPort.once('message', async (e) => {
    const {action,params} = e.data;
    
    if(action === 'oauth'){
        await createNewOrgAlias(params);
    }
})