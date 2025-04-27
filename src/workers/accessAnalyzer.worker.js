import jsforce from 'imported/jsforce';
import { loadMetadata_async } from 'imported/sf';
//import * as localForage from "localforage";

const STATUS = {
    FINISHED: 'finished',
    RUNNING: 'running',
    ERROR: 'error',
};
//const defaultStorage = localForage.createInstance({name: "defaultStore"});
let conn;

const initializeConnection = params => {
    conn = new jsforce.Connection(params);
    postMessage({ type: 'message', value: 'Web worker initiated', status: STATUS.RUNNING });
};

const executeJob = async () => {
    // Run job
    const result = await loadMetadata_async(
        conn,
        res => {
            postMessage({ type: 'callback', value: res, status: STATUS.RUNNING });
        },
        message => {
            postMessage({ type: 'message', value: message, status: STATUS.RUNNING });
        }
    );
    postMessage({ type: 'value', value: result, status: STATUS.FINISHED });
};

// Handle incoming messages
onmessage = async event => {
    const { action, connectionParams } = event.data;

    if (action === 'init') {
        initializeConnection(connectionParams);
    } else if (action === 'run') {
        executeJob();
    } else {
        postMessage({ type: 'error', value: `Unknown action: ${action}`, status: STATUS.ERROR });
    }
};
