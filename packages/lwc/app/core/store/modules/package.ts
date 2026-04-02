import { createSlice, createAsyncThunk, createEntityAdapter } from '@reduxjs/toolkit';
import { lowerCaseKey, guid, isNotUndefinedOrNull } from 'shared/utils';
import * as BACKGROUNDJOB from './backgroundJob';
import type { ConnectorLike, ConnectionLike } from 'core/connector';

const PACKAGE_SETTINGS_KEY = 'PACKAGE_SETTINGS_KEY';

/** Methods */

function loadCacheSettings(alias) {
    try {
        const configText = localStorage.getItem(`${alias}-${PACKAGE_SETTINGS_KEY}`);
        if (configText) return JSON.parse(configText);
    } catch (e) {
        console.error('Failed to load CONFIG from localStorage', e);
    }
    return null;
}

function saveCacheSettings(alias, state) {
    console.log('saveCacheSettings');
    try {
        const { currentMethod, leftPanelToggled } = state;

        localStorage.setItem(
            `${alias}-${PACKAGE_SETTINGS_KEY}`,
            JSON.stringify({
                currentMethod,
                leftPanelToggled,
            })
        );
    } catch (e) {
        console.error('Failed to save CONFIG to localstorage', e);
    }
}

/** Redux */

const toTime = value => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? Date.now() : parsed;
};

const buildPackageJob = ({
    connector,
    createdDate,
    type,
}: {
    connector: ConnectionLike | null;
    createdDate: string | number | Date;
    type: string;
}) => {
    const alias = connector?.alias || connector?.instanceUrl || 'unknown';
    const startedAt = toTime(createdDate);
    return {
        id: `package-${type}-${alias}-${startedAt}`,
        category: 'package',
        label: `${type === 'deploy' ? 'Deploy' : 'Retrieve'} package (${alias})`,
        status: 'running',
        phase: 'start',
        message: `${type === 'deploy' ? 'Deploying' : 'Retrieving'} metadata package`,
        source: `package.${type}`,
        startedAt,
        updatedAt: Date.now(),
    };
};

export const executePackageDeploy = createAsyncThunk(
    'package/deploy',
    async (
        {
            connector,
            zip64,
            options,
            createdDate,
        }: {
            connector: ConnectorLike;
            zip64: string;
            options: Record<string, any>;
            createdDate: string | number | Date;
        },
        { dispatch }
    ) => {
        const job = buildPackageJob({
            connector: connector?.conn,
            createdDate,
            type: 'deploy',
        });
        dispatch(BACKGROUNDJOB.reduxSlice.actions.upsertJob(job));
        try {
            const result = await new Promise((resolve, reject) => {
                const asyncResult = connector.conn.metadata.deploy(zip64, options);
                asyncResult.then(res => resolve(res)).catch(e => reject(e));
            });
            dispatch(
                BACKGROUNDJOB.reduxSlice.actions.completeJob({
                    ...job,
                    phase: 'done',
                    message: 'Package deployment finished',
                    resultSummary: result?.status ? `Status: ${result.status}` : 'Deployment finished',
                    updatedAt: Date.now(),
                })
            );
            return result;
        } catch (error) {
            dispatch(
                BACKGROUNDJOB.reduxSlice.actions.failJob({
                    ...job,
                    phase: 'error',
                    message: 'Package deployment failed',
                    error: error?.message || 'Package deployment failed',
                    updatedAt: Date.now(),
                })
            );
            throw error;
        }
    }
);
const _retrievePackage = (
    connector: ConnectorLike,
    request: Record<string, any>,
    proxyUrl?: string | null
) => {
    return new Promise((resolve, reject) => {
        const metadataApi = connector.conn.metadata;
        metadataApi.pollTimeout = 1200000; // 20 min

        const requestPromise = metadataApi.retrieve(request);
        // Temporary solution as JSFORCE is crashing when the zip file is too large.
        requestPromise.on('complete', async res => {
            let body = `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><soapenv:Header xmlns="http://soap.sforce.com/2006/04/metadata"><SessionHeader><sessionId>${connector.conn.accessToken}</sessionId></SessionHeader></soapenv:Header><soapenv:Body xmlns="http://soap.sforce.com/2006/04/metadata"><checkRetrieveStatus><asyncProcessId>${res.id}</asyncProcessId></checkRetrieveStatus></soapenv:Body></soapenv:Envelope>`;

            // Fetch metadata using SOAP API
            const targetUrl = `${connector.conn.instanceUrl}/services/Soap/m/${connector.conn.version}`;
            const url = proxyUrl ? proxyUrl : targetUrl;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/xml',
                    SOAPAction: '""',
                    'salesforceproxy-endpoint': targetUrl,
                },
                body,
            });

            if (!response.ok) {
                reject(response.status);
            }

            const responseText = await response.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(responseText, 'text/xml');
            const zipFile = xmlDoc.getElementsByTagName('zipFile')[0]?.textContent;
            const id = xmlDoc.getElementsByTagName('id')[0]?.textContent;
            const success = xmlDoc.getElementsByTagName('success')[0]?.textContent;
            const status = xmlDoc.getElementsByTagName('status')[0]?.textContent;
            resolve({ zipFile, id, success, status });
        });
        requestPromise.on('error', e => reject(e));
        requestPromise.poll(3000, metadataApi.pollTimeout);
    });
};
export const executePackageRetrieve = createAsyncThunk(
    'package/retrieve',
    async (
        {
            connector,
            request,
            createdDate,
            proxyUrl,
        }: {
            connector: ConnectorLike;
            request: Record<string, any>;
            createdDate: string | number | Date;
            proxyUrl?: string | null;
        },
        { dispatch }
    ) => {
        const job = buildPackageJob({
            connector: connector?.conn,
            createdDate,
            type: 'retrieve',
        });
        dispatch(BACKGROUNDJOB.reduxSlice.actions.upsertJob(job));
        try {
            const response = await _retrievePackage(connector, request, proxyUrl);
            dispatch(
                BACKGROUNDJOB.reduxSlice.actions.completeJob({
                    ...job,
                    phase: 'done',
                    message: 'Package retrieve finished',
                    resultSummary: response?.status
                        ? `Status: ${response.status}`
                        : 'Retrieve finished',
                    actions:
                        response?.zipFile && response?.id
                            ? [
                                  {
                                      id: 'download-zip',
                                      kind: 'downloadBase64',
                                      label: 'Download ZIP',
                                      payload: {
                                          contentBase64: response.zipFile,
                                          mimeType: 'application/zip',
                                          fileName: `retrieve_${response.id}.zip`,
                                      },
                                  },
                              ]
                            : [],
                    updatedAt: Date.now(),
                })
            );
            return { data: response };
        } catch (error) {
            dispatch(
                BACKGROUNDJOB.reduxSlice.actions.failJob({
                    ...job,
                    phase: 'error',
                    message: 'Package retrieve failed',
                    error: error?.message || 'Package retrieve failed',
                    updatedAt: Date.now(),
                })
            );
            throw error;
        }
    }
);

/*
export const cancelPackageDeploy = createAsyncThunk(
    'package/cancel',
    async ({ connector, requestId}, { dispatch,getState }) => {
        // Get the promise, update the currentDeploymentJob with the deploymentId and then operate the "Complete"
        const cancelResult = connector.conn.metadata._invoke('cancelDeploy', { id:requestId });
        
        console.log('cancelResult',cancelResult);
        return cancelResult;
    }
);
*/
// Create a slice with reducers and extraReducers
const packageSlice = createSlice({
    name: 'package',
    initialState: {
        leftPanelToggled: false,
        currentMethod: null,
        currentDeploymentJob: null,
        currentRetrieveJob: null,
    },
    reducers: {
        loadCacheSettings: (state, action) => {
            const { alias } = action.payload;
            const cachedConfig = loadCacheSettings(alias);
            if (cachedConfig) {
                const { currentMethod } = cachedConfig;
                Object.assign(state, {
                    currentMethod,
                });
            }
            console.log('#cachedConfig#', cachedConfig);
        },
        saveCacheSettings: (state, action) => {
            const { alias } = action.payload;
            if (isNotUndefinedOrNull(alias)) {
                saveCacheSettings(alias, state);
            }
        },
        updateCurrentMethodPanel: (state, action) => {
            const { value, alias } = action.payload;
            state.currentMethod = value;
            if (isNotUndefinedOrNull(alias)) {
                saveCacheSettings(alias, state);
            }
        },
        updateLeftPanel: (state, action) => {
            const { value, alias } = action.payload;
            state.leftPanelToggled = value === true;
            if (isNotUndefinedOrNull(alias)) {
                saveCacheSettings(alias, state);
            }
        },
        clearCurrentDeploymentJob: (state, action) => {
            state.currentDeploymentJob = null;
        },
        clearCurrentRetrieveJob: (state, action) => {
            state.currentRetrieveJob = null;
        },
        /*setCurrentDeploymentJobId :(state, action) => {
            const { id } = action.payload;
            if(state.currentDeploymentJob){
                Object.assign(state.currentDeploymentJob,{id});
            }
        }*/
    },
    extraReducers: builder => {
        builder
            .addCase(executePackageDeploy.pending, (state, action) => {
                const { createdDate } = action.meta.arg;
                state.currentDeploymentJob = {
                    isFetching: true,
                    error: null,
                    createdDate,
                };
            })
            .addCase(executePackageDeploy.fulfilled, (state, action) => {
                Object.assign(state.currentDeploymentJob, {
                    isFetching: false,
                    data: action.payload,
                });
            })
            .addCase(executePackageDeploy.rejected, (state, action) => {
                const { error } = action;
                Object.assign(state.currentDeploymentJob, {
                    isFetching: false,
                    error,
                });
            })
            .addCase(executePackageRetrieve.pending, (state, action) => {
                const { createdDate } = action.meta.arg;
                state.currentRetrieveJob = {
                    isFetching: true,
                    error: null,
                    createdDate,
                };
            })
            .addCase(executePackageRetrieve.fulfilled, (state, action) => {
                Object.assign(state.currentRetrieveJob, {
                    isFetching: false,
                    data: action.payload.data,
                });
            })
            .addCase(executePackageRetrieve.rejected, (state, action) => {
                const { error } = action;
                Object.assign(state.currentRetrieveJob, {
                    isFetching: false,
                    error,
                });
            });
    },
});

export const reduxSlice = packageSlice;
