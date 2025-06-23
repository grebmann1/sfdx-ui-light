import { guid } from 'shared/utils';

const workerInstances = {};

// Method to get the status of the workers
export function getWorkerStatuses(workerId) {
    return workerInstances[workerId];
}

export function getAllWorkers() {
    return workerInstances;
}

export function getWorker(conn, workerName) {
    const proxyUrl = window.jsforceSettings.proxyUrl;
    const { instanceUrl, accessToken, refreshToken, version, loginUrl, oauth2 } = conn;
    let connectionParams = {
        instanceUrl,
        accessToken,
        refreshToken,
        proxyUrl,
        version,
        loginUrl,
        oauth2,
    };

    const workerId = guid();
    const instance = new Worker(`/libs/workers/${workerName}`);

    workerInstances[workerId] = {
        instance: instance,
        status: 'idle',
        id: workerId,
        type: workerName,
    };

    // Listen for messages from the worker
    workerInstances[workerId].instance.onmessage = event => {
        if (event?.data?.status) {
            workerInstances[workerId].status = event.data.status; // Worker status update
        }
    };

    // Handle worker errors
    workerInstances[workerId].instance.onerror = error => {
        console.error('Access Analyzer Worker Error:', error);
        workerInstances[workerId].status = 'error'; // Worker encountered an error
    };

    workerInstances[workerId].instance.postMessage({ action: 'init', connectionParams });

    return workerInstances[workerId];
}
