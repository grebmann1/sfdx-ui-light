const sfdx = require('sfdx-node');
const path = require('path');
const { app,shell,utilityProcess,MessageChannelMain } = require('electron');
const { execSync } = require('child_process');
const { encodeError } = require('../../utils/errors.js');
const { runActionAfterTimeOut } = require('../../utils/utils.js');


/** Worker Processing **/
const workers = {};

_handleOAuthInWorker = ({alias,instanceurl}) => {
    return new Promise(
        (resolve,reject) => {
            // Kill child process in case it's too long
            let timeout = runActionAfterTimeOut(workers.oauth,(param) => {
                if(param){
                    reject(new Error('The link expired, please retry'));
                    param.kill();
                }
            },{timeout:15000*2});

            workers.oauth = utilityProcess.fork(path.join(__dirname, '../../workers/oauth.js'))
            workers.oauth.postMessage({action:'oauth',params:{alias,instanceurl}});
            workers.oauth.once('exit',  () => {
                clearTimeout(timeout);
                workers.oauth = null;
                resolve(null);
            })
            workers.oauth.once('message', async ({res,error}) => {
                clearTimeout(timeout);
                workers.oauth.kill();
                if(res){
                    resolve(res);
                }else{
                    reject(error);
                }
            });
            
        }
    ); 
}

/** Methods **/

killOauth = async (_) => {
    console.log('killOauth');
    try{
        if(workers.oauth){
            workers.oauth.kill();
        }
        return {res};
    }catch(e){
        return {error: encodeError(e)}
    }
}


getAllOrgs = async (_) => {
    let res = await sfdx.force.org.list({
        json:true,
        verbose:true
    });
    //console.log('res',res);
    return res || [];
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
    try{
        let res = await _handleOAuthInWorker({alias,instanceurl}); 
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

logout = async (_,{alias}) => {
    /** To Refactore later **/
    try{
        const command = `sf org logout -o ${alias} -p --json`;
        console.log('command',command);
        let res = execSync(command,{cwd: app.getAppPath()}).toString();
        return {res}
    }catch(e){
        return {res:null}
        //return {error: encodeError(e)}
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
    killOauth,
    getAllOrgs,
    openOrgUrl,
    createNewOrgAlias,
    seeDetails,
    unsetAlias,
    setAlias,
    logout
}