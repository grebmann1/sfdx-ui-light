import constant from 'core/constant';


let metadataWorkerInstance;

// chrome.runtime.getURL('workers/openaiWorker/worker.js')


export function getMetadataWorker(conn) {
    const proxyUrl = window.jsforceSettings.proxyUrl;
    const { instanceUrl, accessToken, refreshToken,version,loginUrl,oauth2 } = conn;
    let connectionParams = {
        instanceUrl,
        accessToken,
        refreshToken,
        proxyUrl,
        version,
        loginUrl,
        oauth2
    }
    if (!metadataWorkerInstance) {
        metadataWorkerInstance = new Worker('/workers/metadata/metadata.worker.js'); // Update with the correct path to your web worker
        metadataWorkerInstance.postMessage({action:'init',connectionParams});
    }
    return metadataWorkerInstance;
}
