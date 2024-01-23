const sfdx = require('sfdx-node');
const { encodeError } = require('../utils/errors.js');
const path = require('node:path');
const { spawn } = require('child_process');

scanner = async ({alias}) => {
    console.log('scanner - start',alias);
    try{
        const command = 'sfdx scanner:run --target "force-app/main/default" -f json -o "Inspection/report.json"  --normalize-severit';
        console.log('command',command);
        const childProcess = spawn(command,[]);

        // Handle standard output data
        childProcess.stdout.on('data', (data) => {
            console.log(`stdout: ${data}`);
        });
    
        // Handle standard error data
        childProcess.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
        });
    
        // Handle on close
        childProcess.on('close', (code) => {
            console.log(`Child process exited with code ${code}`);
        });
    
        // Handle errors
        childProcess.on('error', (error) => {
            console.error(`Error: ${error.message}`);
        });

        process.parentPort.postMessage({res:null})
    }catch(e){
        process.parentPort.postMessage({error: encodeError(e)})
    }
}

// Child process
process.parentPort.once('message', async (e) => {
    console.log('scanner - message')
    const { params } = e.data;
    scanner(params);
})
