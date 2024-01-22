const sfdx = require('sfdx-node');
const { encodeError } = require('../utils/errors.js');
const path = require('node:path');

retrieve = async ({alias,manifestPath}) => {
    console.log('retrieve - start',alias);
    try{
        let res = await sfdx.force.source.retrieve({
            targetusername: alias,
            manifest:manifestPath,
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
    console.log('retrieve - message')
    const { params } = e.data;
    retrieve(params);
})
