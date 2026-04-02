import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { cacheManager, CACHE_CONFIG, CACHE_ORG_DATA_TYPES } from 'shared/cacheManager';
import LOGGER from 'shared/logger';
import {
    isNotUndefinedOrNull,
    formatFiles,
    isSalesforceId,
    sortObjectsByField,
    METADATA as METADATA_UTILS,
} from 'shared/utils';
import type { ConnectorLike } from 'core/connector';

import { getStore } from '../storeRef';

import * as DESCRIBE from './describe';
import * as BACKGROUNDJOB from './backgroundJob';
import * as ERROR from './error';
import * as SOBJECT from './sobject';
import { getWorker } from 'core/worker';

const METADATA_SETTINGS_KEY = 'METADATA_SETTINGS_KEY';
let metadataSyncWorkerInstance = null;
type Connector = ConnectorLike;

const getMetadataSyncJobId = (alias, startedAt = Date.now()) =>
    `metadata-sync-${alias || 'unknown'}-${startedAt}`;

const getMetadataResultSummary = result => {
    if (!result || typeof result !== 'object') {
        return null;
    }
    if (Number.isFinite(result.writtenCount)) {
        return `Wrote ${result.writtenCount} entries`;
    }
    if (Number.isFinite(result.totalEntries)) {
        return `Processed ${result.totalEntries} entries`;
    }
    return null;
};

/** Methods */

function loadCacheSettings(alias) {
    try {
        const configText = localStorage.getItem(`${alias}-${METADATA_SETTINGS_KEY}`);
        if (configText) return JSON.parse(configText);
    } catch (e) {
        console.error('Failed to load CONFIG from localStorage', e);
        getStore()?.dispatch(
            ERROR.reduxSlice.actions.addError({
                message: 'Error loading metadata settings',
                details: e.message,
            })
        );
    }
    return null;
}

function saveCacheSettings(alias, state) {
    console.log('saveCacheSettings');
    try {
        const { tabs } = state;

        localStorage.setItem(
            `${alias}-${METADATA_SETTINGS_KEY}`,
            JSON.stringify({
                tabs,
            })
        );
    } catch (e) {
        console.error('Failed to save CONFIG to localstorage', e);
        getStore()?.dispatch(
            ERROR.reduxSlice.actions.addError({
                message: 'Error saving metadata settings',
                details: e.message,
            })
        );
    }
}

const getMetadataConfig = async (connector: Connector, sobject: string) => {
    LOGGER.debug('getMetadataConfig', sobject, connector);
    const sobjectConfig = (
        await getStore()?.dispatch(
            SOBJECT.describeSObject({
                connector: connector.conn,
                sObjectName: sobject,
                useToolingApi: true,
            })
        )
    ).payload;

    LOGGER.debug('sobjectConfig', sobjectConfig);

    const fields = sobjectConfig.data.fields
        .map(field => field.name)
        .filter(field =>
            ['Id', 'Name', 'DeveloperName', 'MasterLabel', 'NamespacePrefix'].includes(field)
        );

    return {
        fields,
        sobject,
    };
};

// Helper function to load specific metadata
async function loadSpecificMetadata(connector: Connector, sobject: string, bypass?: boolean) {
    const isSobject =
        getStore()
            ?.getState()
            .metadata.metadata_global.records.find(x => x.name == sobject)?.isSobject || false;

    if (!isSobject) {
        // Metadata API
        const result = await connector.conn.metadata.list(
            [{ type: sobject, folder: null }],
            connector.conn.version
        );
        return {
            records: result
                .map(record => ({
                    ...record,
                    label: record.fullName,
                    name: record.fullName || record.id,
                    key: record.fullName || record.id,
                    isSobject: false,
                    _developerName: record.fullName,
                }))
                .sort((a, b) => (a.label || '').localeCompare(b.label)),
            label: sobject,
        };
    }

    // Tooling API

    //const metadataConfig = await connector.conn.tooling.describeSObject$(sobject);
    const { fields } = await getMetadataConfig(connector, sobject);

    const query = `SELECT ${fields.join(',')} FROM ${sobject}`;
    const result = (await runAndCacheQuery(connector, query, bypass)) || [];
    return {
        records: (result || [])
            .map(record => ({
                ...record,
                name: record.Id,
                label: record.Name || record.MasterLabel || record.DeveloperName,
                key: record.Id,
                isSobject: true,
                _developerName: record.DeveloperName || record.Name || record.MasterLabel,
            }))
            .sort((a, b) => (a.label || '').localeCompare(b.label)),
        label: sobject,
    };
}

// Helper function to load exception metadata
async function loadSpecificMetadataException(
    connector: Connector,
    exceptionMetadata: Record<string, any>,
    recordId: string | null,
    level: number,
    bypass?: boolean
) {
    const {
        name,
        label,
        queryFields,
        queryObject,
        labelFunc,
        field_id,
        manualFilter,
        badgeFunc,
        compareFunc,
        filterFunc,
    } = exceptionMetadata;

    const defaultCompare = (a, b) => (a.label || '').localeCompare(b.label);
    const newCompare = compareFunc || defaultCompare;

    try {
        // Describe the object to get metadata configuration
        const { fields } = await getMetadataConfig(connector, queryObject);

        // Build and execute the query
        const query = `SELECT ${[...fields, ...queryFields].join(
            ','
        )} FROM ${queryObject} ${filterFunc(recordId)}`;
        const result = (await runAndCacheQuery(connector, query, false, bypass)) || [];

        // Filter and map the results
        const records = result
            .filter(manualFilter)
            .map(record => {
                const badge = badgeFunc ? badgeFunc(record) : null;
                const recordLabel = labelFunc(record);
                return {
                    ...record,
                    name: record[field_id],
                    label: recordLabel,
                    key: record[field_id],
                    badgeLabel: badge ? badge.label : null,
                    badgeClass: badge ? badge.class : null,
                    _developerName: recordLabel,
                };
            })
            .sort(newCompare);

        return { records, label };
    } catch (error) {
        console.error('Error loading specific metadata exception:', error);
        getStore()?.dispatch(
            ERROR.reduxSlice.actions.addError({
                message: 'Error loading metadata',
                details: error.message,
            })
        );
        return { records: [], label: name };
    }
}

const handle_LWC = async (connector: Connector, sobject: string, key: string) => {
    var queryString = `SELECT LightningComponentBundleId,LightningComponentBundle.MasterLabel,Format,FilePath,Source FROM LightningComponentResource WHERE `;
    if (isSalesforceId(key)) {
        queryString += `LightningComponentBundleId = '${key}' OR LightningComponentBundle.DeveloperName = '${key}'`; // in case developername match record Id length
    } else {
        queryString += `LightningComponentBundle.DeveloperName = '${key}'`;
    }
    let resources = (await connector.conn.tooling.query(queryString)).records || [];
    let files = formatFiles(
        resources.map(x => ({
            path: x.FilePath,
            name: x.FilePath.split('/').pop(),
            body: x.Source,
            apiVersion: x.ApiVersion,
            metadata: sobject,
            id: x.LightningComponentBundleId,
            _source: x,
        }))
    );

    // Added from Extension redirection
    /*if (resources.length > 0) {
        this.label1 = resources[0].LightningComponentBundle.MasterLabel;
    }*/
    return sortObjectsByField(files, 'extension', ['html', 'js', 'css', 'xml']);
};

const handle_APEX = async (
    connector: Connector,
    sobject: string,
    data: any,
    extension = 'cls',
    bodyField = 'Body'
) => {
    return formatFiles([
        {
            path: `${data.FullName || data.Name}.${extension}`,
            name: `${data.FullName || data.Name}.${extension}`,
            body: data[bodyField],
            apiVersion: data.ApiVersion,
            metadata: sobject,
            id: data.Id,
        },
    ]);
};

const handle_AURA = async (connector: Connector, sobject: string, data: any) => {
    let resources =
        (
            await connector.conn.tooling.query(
                `SELECT AuraDefinitionBundleId,Format,DefType,Source FROM AuraDefinition WHERE AuraDefinitionBundleId = '${data.Id}'`
            )
        ).records || [];
    let files = formatFiles(
        resources.map(x => {
            let _name = _auraNameMapping(data.FullName, x.DefType);
            return {
                path: _name,
                name: _name,
                body: x.Source,
                apiVersion: data.ApiVersion,
                metadata: sobject,
                id: data.Id,
                _source: x,
            };
        })
    );
    return sortObjectsByField(files, 'extension', ['cmp', 'html', 'js', 'css', 'xml']);
};

const _auraNameMapping = (name, type) => {
    switch (type) {
        case 'COMPONENT':
            return `${name}.cmp`;
        case 'CONTROLLER':
            return `${name}Controller.js`;
        case 'HELPER':
            return `${name}Helper.js`;
        case 'RENDERER':
            return `${name}Renderer.js`;
        case 'DOCUMENTATION':
            return `${name}.auradoc`;
        case 'DESIGN':
            return `${name}.design`;
        case 'SVG':
            return `${name}.svg`;
        default:
            return name;
    }
};

const runAndCacheQuery = async (connector: Connector, query: string, _byPassCaching?: boolean) => {
    const fetchAndSave = async query => {
        let queryExec = connector.conn.tooling.query(query);
        let result =
            (await queryExec.run({
                responseTarget: 'Records',
                autoFetch: true,
                maxFetch: 10000,
            })) || [];
        cacheManager.saveOrgData(
            connector.conn.alias,
            CACHE_ORG_DATA_TYPES.METADATA_QUERY,
            query,
            result
        );
        return result;
    };

    const cachedQuery = await cacheManager.loadOrgData(
        connector.conn.alias,
        CACHE_ORG_DATA_TYPES.METADATA_QUERY,
        query
    );
    if (cachedQuery && !_byPassCaching) {
        LOGGER.debug('cachedQuery', cachedQuery);
        fetchAndSave(query);
        return cachedQuery;
    } else {
        return await fetchAndSave(query);
    }
};

const load_recordFromToolingAPI = async (
    connector: Connector,
    sobject: string,
    recordId: string
) => {
    const urlQuery = `/services/data/v${connector.conn.version}/tooling/sobjects/${sobject}/${recordId}`;
    return await connector.conn.request(urlQuery);
};

const load_recordFromMetadataAPI = async (
    connector: Connector,
    sobject: string,
    fullName: string
) => {
    return await connector.conn.metadata.read(sobject, fullName);
};

// Helper function to load a specific metadata record
const loadSpecificMetadataRecord2 = async (
    connector: Connector,
    { sobject, recordId, fullName }: { sobject: string; recordId?: string; fullName?: string }
) => {
    let selectedRecord = null;
    let files = null;

    const recordLoaders = {
        LightningComponentBundle: async () => handle_LWC(connector, sobject, recordId),
        ApexClass: async () =>
            handle_APEX(
                connector,
                sobject,
                await load_recordFromToolingAPI(connector, sobject, recordId)
            ),
        AuraDefinitionBundle: async () =>
            handle_AURA(
                connector,
                sobject,
                await load_recordFromToolingAPI(connector, sobject, recordId)
            ),
        ApexTrigger: async () =>
            handle_APEX(
                connector,
                sobject,
                await load_recordFromToolingAPI(connector, sobject, recordId),
                'trigger'
            ),
        ApexPage: async () =>
            handle_APEX(
                connector,
                sobject,
                await load_recordFromToolingAPI(connector, sobject, recordId),
                'page',
                'Markup'
            ),
        ApexComponent: async () =>
            handle_APEX(
                connector,
                sobject,
                await load_recordFromToolingAPI(connector, sobject, recordId),
                'page',
                'Markup'
            ),
    };

    if (recordLoaders[sobject]) {
        files = await recordLoaders[sobject]();
    } else {
        const isSobject =
            getStore()
                ?.getState()
                .metadata.metadata_global.records.find(x => x.name == sobject)?.isSobject || false;
        if (isSobject) {
            selectedRecord = await load_recordFromToolingAPI(connector, sobject, recordId);
        } else {
            const test = await load_recordFromMetadataAPI(connector, sobject, fullName);
            selectedRecord = test;
        }
    }

    return { selectedRecord, files };
};

const getMetadataStorageConfig = async () => {
    return cacheManager.loadConfig([
        CACHE_CONFIG.METADATA_STORAGE_ENABLED.key,
        CACHE_CONFIG.METADATA_STORAGE_TYPES.key,
        CACHE_CONFIG.METADATA_STORAGE_BACKGROUND_SYNC_ENABLED.key,
    ]);
};

const shouldPersistMetadata = (config, alias, metadataType) => {
    if (!alias) return false;
    if (!config?.[CACHE_CONFIG.METADATA_STORAGE_ENABLED.key]) return false;
    const selectedTypes = Array.isArray(config?.[CACHE_CONFIG.METADATA_STORAGE_TYPES.key])
        ? config[CACHE_CONFIG.METADATA_STORAGE_TYPES.key]
        : [];
    return selectedTypes.includes(metadataType);
};

const persistMetadataViaWorker = async ({
    connector,
    alias,
    metadataType,
    files = [],
    selectedRecord = null,
    label1 = null,
    recordId = null,
    debug = false,
}: {
    connector: Connector;
    alias: string;
    metadataType: string;
    files?: Array<Record<string, any>>;
    selectedRecord?: Record<string, any> | null;
    label1?: string | null;
    recordId?: string | null;
    debug?: boolean;
}) => {
    const workerEntry = getWorker(connector, 'metadata.worker.js', { debug });
    const worker = workerEntry.instance;
    return await new Promise((resolve, reject) => {
        worker.onmessage = event => {
            const { type, status, value } = event.data || {};
            if (type === 'result' && status === 'finished') {
                resolve(value?.persistence || { status: 'unknown' });
                worker.terminate();
            } else if (type === 'error' || status === 'error') {
                reject(new Error(value || 'Metadata worker persist failed'));
                worker.terminate();
            }
        };

        worker.onerror = error => {
            reject(error);
            worker.terminate();
        };

        worker.postMessage({
            action: 'persistRecord',
            alias,
            metadataType,
            payload: {
                files,
                selectedRecord,
                label1,
                recordId,
            },
        });
    });
};

const normalizeMetadataTypes = value => {
    if (Array.isArray(value)) {
        return value.filter(Boolean);
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return [];
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
                return parsed.filter(Boolean);
            }
        } catch (_) {
            // Ignore JSON parse errors and fallback to comma-separated parsing.
        }
        return trimmed
            .split(',')
            .map(item => item.trim())
            .filter(Boolean);
    }
    if (value && typeof value === 'object') {
        return Object.values(value).filter(Boolean);
    }
    return [];
};

/** Redux */

const fetchGlobalMetadata = createAsyncThunk(
    'metadata/fetchGlobalMetadata',
    async (_, { dispatch, getState, rejectWithValue }) => {
        try {
            const { application } = getState();
            // Fetch available metadata objects
            LOGGER.debug('application.connector', application.connector);
            const { tooling } = (
                await dispatch(
                    DESCRIBE.describeSObjects({
                        connector: application.connector.conn,
                    })
                )
            ).payload;
            const sobjects = tooling.sobjects.map(obj => obj.name);
            const { metadataObjects } = (
                await dispatch(
                    DESCRIBE.describeVersion({
                        connector: application.connector.conn,
                    })
                )
            ).payload;
            // TODO : Seperate the metadata from the objects. Some metadata are not sobjects
            let result = metadataObjects
                .filter(obj => !METADATA_UTILS.METADATA_EXCLUDE_LIST.includes(obj.xmlName))
                .map(obj => ({
                    ...obj,
                    name: obj.xmlName,
                    label: obj.xmlName,
                    key: obj.xmlName,
                    isSobject: sobjects.includes(obj.xmlName),
                }));

            result = [
                ...result,
                ...METADATA_UTILS.METADATA_EXCEPTION_LIST.filter(x => x.isSearchable),
            ];
            return { records: result, label: 'Metadata' };
        } catch (error) {
            getStore()?.dispatch(
                ERROR.reduxSlice.actions.addError({
                    message: 'Error fetching global metadata',
                    details: error.message,
                })
            );
            return rejectWithValue(error.message);
        }
    }
);

const fetchSpecificMetadata = createAsyncThunk(
    'metadata/fetchSpecificMetadata',
    async ({ sobject, bypass = false, force = false }, { dispatch, getState, rejectWithValue }) => {
        try {
            //bypass = bypass || false; // Default is false;
            await dispatch(reduxSlice.actions.setAttributes({ sobject }));

            const { application, metadata } = getState();
            LOGGER.debug('application.connector', application.connector);
            const exceptionMetadata =
                METADATA_UTILS.METADATA_EXCEPTION_LIST.find(x => x.name === sobject) || null;
            // Check if the requested sobject differs from the current state
            // Also reload if metadata_records is null (e.g., after goBack)
            if (metadata.currentMetadata !== sobject || force || !metadata.metadata_records) {
                const _metadata = exceptionMetadata
                    ? await loadSpecificMetadataException(
                          application.connector,
                          exceptionMetadata,
                          null,
                          1,
                          bypass
                      )
                    : await loadSpecificMetadata(application.connector, sobject, bypass);
                return {
                    currentMetadata: sobject,
                    metadata: _metadata,
                };
            }
            return {
                currentMetadata: metadata.currentMetadata,
                metadata: metadata.metadata_records,
                //currentLevel: metadata.currentLevel
            };
        } catch (error) {
            console.error('Error fetching specific metadata:', error);
            getStore()?.dispatch(
                ERROR.reduxSlice.actions.addError({
                    message: 'Error fetching specific metadata',
                    details: error.message,
                })
            );
            return rejectWithValue(error.message);
        }
    }
);

// Async Thunk for fetching Metadata
const fetchMetadataRecord = createAsyncThunk(
    'metadata/fetchMetadataRecord',
    async ({ sobject, param1, param2, label1 }, { getState, dispatch, rejectWithValue }) => {
        const tabkey = `${sobject}-${param1}`;

        try {
            const { application } = getState();
            const exceptionMetadata =
                METADATA_UTILS.METADATA_EXCEPTION_LIST.find(x => x.name === sobject) || null;

            const flowVersions = { flowVersionOptions: [], flowVersionValue: null };
            if (exceptionMetadata) {
                const lvl2ExceptionMetadata = METADATA_UTILS.METADATA_EXCEPTION_LIST.find(
                    x => x.name === exceptionMetadata.lvl2Type
                );
                const result = await loadSpecificMetadataException(
                    application.connector,
                    lvl2ExceptionMetadata,
                    param1,
                    2,
                    false
                );
                const flowVersionOptions = result.records.map(record => ({
                    value: record.key,
                    label: record.label,
                }));
                let flowVersionValue = flowVersionOptions[0]?.value || null;
                if (flowVersionOptions.find(x => x.value == param2)) {
                    flowVersionValue = flowVersionOptions.find(x => x.value == param2).value;
                }

                Object.assign(flowVersions, {
                    flowVersionOptions,
                    flowVersionValue,
                });
                //await dispatch(METADATA.reduxSlice.actions.setAttributes(flowVersions));
                // We overwrite the value with the FlowVersion
                param1 = flowVersions.flowVersionValue;
                if (exceptionMetadata.soapObject) {
                    // Reassign the sobject for soap call
                    sobject = exceptionMetadata.soapObject;
                }
            }

            const { selectedRecord, files } = await loadSpecificMetadataRecord2(
                application.connector,
                {
                    sobject,
                    recordId: param1,
                    fullName: label1,
                }
            );
            const alias = application?.connector?.conn?.alias;
            const storageConfig = await getMetadataStorageConfig();
            let persistence = { status: 'skipped' };
            if (shouldPersistMetadata(storageConfig, alias, sobject)) {
                persistence = await persistMetadataViaWorker({
                    connector: application.connector.conn,
                    alias,
                    metadataType: sobject,
                    files: files || [],
                    selectedRecord,
                    label1,
                    recordId: param1,
                    debug: false,
                });
            }
            return {
                tabkey,
                selectedRecord,
                files,
                persistence,
                ...flowVersions,
            };
        } catch (error) {
            console.error('Error fetching exception metadata:', error);
            getStore()?.dispatch(
                ERROR.reduxSlice.actions.addError({
                    message: 'Error fetching exception metadata',
                    details: error.message,
                })
            );
            return rejectWithValue({
                error: error.message,
                tabkey,
            });
        }
    }
);

const startMetadataBackgroundSync = createAsyncThunk(
    'metadata/startMetadataBackgroundSync',
    async ({ metadataTypes, debug = false } = {}, { dispatch, getState, rejectWithValue }) => {
        try {
            const { application } = getState();
            const alias = application?.connector?.conn?.alias;
            const startedAt = Date.now();
            const jobId = getMetadataSyncJobId(alias, startedAt);
            if (!alias) {
                return rejectWithValue('Metadata sync requires a connection alias.');
            }

            const storageConfig = await getMetadataStorageConfig();
            const isStorageEnabled = Boolean(storageConfig[CACHE_CONFIG.METADATA_STORAGE_ENABLED.key]);
            const isBackgroundEnabled = Boolean(
                storageConfig[CACHE_CONFIG.METADATA_STORAGE_BACKGROUND_SYNC_ENABLED.key]
            );
            if (!isStorageEnabled || !isBackgroundEnabled) {
                return rejectWithValue('Metadata storage or background sync is disabled in settings.');
            }

            const requestedTypes = normalizeMetadataTypes(metadataTypes);
            const configuredTypes = normalizeMetadataTypes(
                storageConfig[CACHE_CONFIG.METADATA_STORAGE_TYPES.key]
            );
            const selectedTypes = Array.from(
                new Set((requestedTypes.length > 0 ? requestedTypes : configuredTypes).filter(Boolean))
            );
            if (selectedTypes.length === 0) {
                return rejectWithValue('No metadata types selected for storage.');
            }

            dispatch(
                BACKGROUNDJOB.reduxSlice.actions.upsertJob({
                    id: jobId,
                    category: 'metadata',
                    label: `Metadata sync (${alias})`,
                    status: 'running',
                    phase: 'init',
                    message: 'Preparing metadata sync job',
                    source: 'metadata.worker',
                    progress: { completed: 0, total: 0, percent: 0 },
                    startedAt,
                })
            );
            dispatch(
                reduxSlice.actions.updateSyncJob({
                    jobId,
                })
            );

            // eslint-disable-next-line no-console
            console.log('[metadata-sync] launching worker', {
                alias,
                selectedTypes,
                debug,
            });
            const workerEntry = getWorker(application.connector.conn, 'metadata.worker.js', {
                debug,
            });
            metadataSyncWorkerInstance = workerEntry.instance;

            const syncResult = await new Promise((resolve, reject) => {
                metadataSyncWorkerInstance.onmessage = event => {
                    const { type, status, value, progress, phase, metadataType } = event.data || {};
                    if (type === 'progress' || type === 'phase' || type === 'message') {
                        dispatch(
                            reduxSlice.actions.updateSyncJob({
                                status: status || 'running',
                                progress,
                                phase,
                                metadataType,
                                message: value,
                                jobId,
                            })
                        );
                        dispatch(
                            BACKGROUNDJOB.reduxSlice.actions.upsertJob({
                                id: jobId,
                                category: 'metadata',
                                label: `Metadata sync (${alias})`,
                                status: status || 'running',
                                phase: phase || null,
                                message: value || null,
                                source: 'metadata.worker',
                                progress,
                                updatedAt: Date.now(),
                            })
                        );
                    } else if (type === 'result' && status === 'finished') {
                        dispatch(
                            BACKGROUNDJOB.reduxSlice.actions.completeJob({
                                id: jobId,
                                category: 'metadata',
                                label: `Metadata sync (${alias})`,
                                phase: 'done',
                                message: 'Metadata sync completed',
                                source: 'metadata.worker',
                                progress: progress || { completed: 0, total: 0, percent: 100 },
                                resultSummary: getMetadataResultSummary(value),
                                updatedAt: Date.now(),
                            })
                        );
                        resolve(value);
                        metadataSyncWorkerInstance?.terminate();
                        metadataSyncWorkerInstance = null;
                    } else if (type === 'result' && status === 'cancelled') {
                        dispatch(
                            BACKGROUNDJOB.reduxSlice.actions.cancelJob({
                                id: jobId,
                                category: 'metadata',
                                label: `Metadata sync (${alias})`,
                                phase: 'cancelled',
                                message: 'Metadata sync cancelled',
                                source: 'metadata.worker',
                                updatedAt: Date.now(),
                            })
                        );
                        reject(new Error('Metadata sync cancelled'));
                        metadataSyncWorkerInstance?.terminate();
                        metadataSyncWorkerInstance = null;
                    } else if (type === 'error' || status === 'error') {
                        dispatch(
                            BACKGROUNDJOB.reduxSlice.actions.failJob({
                                id: jobId,
                                category: 'metadata',
                                label: `Metadata sync (${alias})`,
                                phase: 'error',
                                message: 'Metadata sync failed',
                                source: 'metadata.worker',
                                error: value || 'Metadata sync failed',
                                updatedAt: Date.now(),
                            })
                        );
                        reject(new Error(value || 'Metadata sync failed'));
                        metadataSyncWorkerInstance?.terminate();
                        metadataSyncWorkerInstance = null;
                    }
                };

                metadataSyncWorkerInstance.onerror = error => {
                    dispatch(
                        BACKGROUNDJOB.reduxSlice.actions.failJob({
                            id: jobId,
                            category: 'metadata',
                            label: `Metadata sync (${alias})`,
                            phase: 'error',
                            message: 'Metadata sync failed',
                            source: 'metadata.worker',
                            error: error?.message || 'Worker runtime error',
                            updatedAt: Date.now(),
                        })
                    );
                    reject(error);
                    metadataSyncWorkerInstance?.terminate();
                    metadataSyncWorkerInstance = null;
                };

                metadataSyncWorkerInstance.postMessage({
                    action: 'startSync',
                    alias,
                    apiVersion: application?.connector?.conn?.version,
                    metadataTypes: selectedTypes,
                });
            });
            return syncResult;
        } catch (error) {
            console.error('Error starting metadata sync:', error);
            dispatch(
                BACKGROUNDJOB.reduxSlice.actions.failJob({
                    id:
                        getState()?.metadata?.syncJob?.jobId ||
                        getMetadataSyncJobId(getState()?.application?.connector?.conn?.alias),
                    category: 'metadata',
                    label: `Metadata sync (${getState()?.application?.connector?.conn?.alias || 'unknown'})`,
                    phase: 'error',
                    message: 'Metadata sync failed',
                    source: 'metadata.worker',
                    error: error?.message || 'Failed to start metadata sync',
                    updatedAt: Date.now(),
                })
            );
            return rejectWithValue(error.message || 'Failed to start metadata sync');
        }
    }
);

const cancelMetadataBackgroundSync = createAsyncThunk(
    'metadata/cancelMetadataBackgroundSync',
    async (_, { getState, dispatch, rejectWithValue }) => {
        try {
            const alias = getState()?.application?.connector?.conn?.alias;
            const jobId =
                getState()?.metadata?.syncJob?.jobId || getMetadataSyncJobId(alias, Date.now());
            if (metadataSyncWorkerInstance) {
                metadataSyncWorkerInstance.postMessage({ action: 'cancelSync' });
                metadataSyncWorkerInstance.terminate();
                metadataSyncWorkerInstance = null;
            }
            dispatch(
                BACKGROUNDJOB.reduxSlice.actions.cancelJob({
                    id: jobId,
                    category: 'metadata',
                    label: `Metadata sync (${alias || 'unknown'})`,
                    phase: 'cancelled',
                    message: 'Metadata sync cancelled',
                    source: 'metadata.worker',
                    updatedAt: Date.now(),
                })
            );
            return true;
        } catch (error) {
            return rejectWithValue(error.message || 'Failed to cancel metadata sync');
        }
    }
);

const _addTab = (state, { tab }) => {
    state.tabs.push(tab);
    // Assign new tab
    state.currentTabId = tab.id;
};

const _updateTab = (state, { tab }) => {
    const tabIndex = state.tabs.findIndex(x => x.id == tab.id);
    // Assign new tab
    if (tabIndex > -1) {
        state.tabs[tabIndex] = tab;
        state.currentTabId = tab.id;
    }
};

const _setAttributes = (state, payload) => {
    const validParams = [
        'param1',
        'param2',
        'label1',
        'label2',
        'sobject',
        'developerName',
        'flowVersionOptions',
        'flowVersionValue',
        'selectedRecord',
        'files',
        'currentTabId',
    ];
    validParams.forEach(key => {
        if (key in payload && payload[key] !== undefined) {
            state[key] = payload[key];
        }
    });
};

// Create a slice with reducers and extraReducers
const metadataSlice = createSlice({
    name: 'metadata',
    initialState: {
        tabs: [],
        currentTab: null,
        param1: null,
        param2: null,
        label1: null,
        label2: null,
        sobject: null,
        developerName: null,
        flowVersionOptions: [],
        flowVersionValue: null,
        //currentLevel: 0,
        metadata: [], // { records: [], label: 'Metadata' }
        isLoading: false,
        isLoadingRecord: false,
        loadingMessage: '',
        error: null,
        // Displayed Data
        currentTabId: null,
        files: null,
        selectedRecord: null,
        metadata_global: null,
        metadata_records: null,
        syncJob: {
            jobId: null,
            status: 'idle',
            phase: null,
            progress: null,
            metadataType: null,
            message: null,
            error: null,
            lastRun: null,
            result: null,
        },
    },
    reducers: {
        loadCacheSettings: (state, action) => {
            const { alias } = action.payload;
            const cachedConfig = loadCacheSettings(alias);
            if (cachedConfig) {
                const { tabs } = cachedConfig;
                Object.assign(state, {
                    tabs,
                });
            }
        },
        saveCacheSettings: (state, action) => {
            const { alias } = action.payload;
            if (isNotUndefinedOrNull(alias)) {
                saveCacheSettings(alias, state);
            }
        },
        setAttributes: (state, action) => {
            const { payload } = action;
            _setAttributes(state, payload);
        },
        initTabs: (state, action) => {
            // Set first tab
            if (state.tabs.length > 0) {
                state.currentTabId = state.tabs[0].id;
            }
        },
        addTab: (state, action) => {
            _addTab(state, action.payload);
        },
        updateTab: (state, action) => {
            _updateTab(state, action.payload);
        },
        removeTab: (state, action) => {
            const { id, alias } = action.payload;
            state.tabs = state.tabs.filter(x => x.id != id);
            // Assign last tab
            if (state.tabs.length > 0 && state.currentTabId == id) {
                const lastTab = state.tabs[state.tabs.length - 1];
                state.currentTabId = lastTab.id;
                _setAttributes(state, {
                    ...lastTab.attributes,
                    ...lastTab.data,
                    ...lastTab.flowVersions,
                });
            }
            if (state.tabs.length == 0) {
                state.currentTabId = null;
                state.selectedRecord = null;
                state.files = null;
            }
            if (isNotUndefinedOrNull(alias)) {
                saveCacheSettings(alias, state);
            }
            // can't remove the last one !!!
        },
        selectionTab: (state, action) => {
            const { id } = action.payload;
            const tab = state.tabs.find(x => x.id == id);
            // Assign new tab
            if (tab) {
                state.currentTabId = id;
                _setAttributes(state, {
                    ...tab.attributes,
                    ...tab.data,
                    ...tab.flowVersions,
                });
            }
        },
        goBack: (state, action) => {
            // Back is only from records to global
            // Reset currentMetadata and related fields to allow reselecting the same metadata type
            state.metadata_records = null;
            state.currentMetadata = null;
            state.param1 = null;
            state.label1 = null;
        },
        updateMetadata: (state, action) => {
            const { metadata } = action.payload;
            state.metadata = metadata;
        },
        updateSyncJob: (state, action) => {
            state.syncJob = {
                ...state.syncJob,
                ...action.payload,
            };
        },
    },
    extraReducers: builder => {
        builder
            // fetchGlobalMetadata
            .addCase(fetchGlobalMetadata.pending, state => {
                state.isLoading = true;
                state.loadingMessage = 'Loading All Metadata';
                state.error = null;
            })
            .addCase(fetchGlobalMetadata.fulfilled, (state, action) => {
                state.isLoading = false;
                state.metadata_global = action.payload;
                //state.currentLevel = action.payload.currentLevel;
            })
            .addCase(fetchGlobalMetadata.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload || 'Failed to fetch metadata';
            })
            // fetchSpecificMetadata
            .addCase(fetchSpecificMetadata.pending, state => {
                state.isLoading = true;
                state.loadingMessage = 'Loading Records';
                state.error = null;
            })
            .addCase(fetchSpecificMetadata.fulfilled, (state, action) => {
                state.isLoading = false;
                state.metadata_records = action.payload.metadata;
                state.currentMetadata = action.payload.currentMetadata;
                //state.currentLevel = action.payload.currentLevel;
            })
            .addCase(fetchSpecificMetadata.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload;
            })
            // fetchMetadataRecord
            .addCase(fetchMetadataRecord.pending, (state, action) => {
                state.isLoading = true;
                state.isLoadingRecord = true;
                state.loadingMessage = 'Loading Specific Record';
                state.error = null;
            })
            .addCase(fetchMetadataRecord.fulfilled, (state, action) => {
                state.isLoading = false;
                state.isLoadingRecord = false;
                const { files, selectedRecord, tabkey, flowVersionOptions, flowVersionValue } =
                    action.payload;
                state.files = files;
                state.selectedRecord = selectedRecord;
                state.currentTabId = tabkey;
                state.flowVersionOptions = flowVersionOptions;
                state.flowVersionValue = flowVersionValue;

                const tab = {
                    id: tabkey,
                    name: state.label1, // for now it's enough but might need to change
                    attributes: {
                        param1: state.param1,
                        label1: state.label1,
                        param2: flowVersionOptions.length > 0 ? state.param2 : null,
                        label2: flowVersionOptions.length > 0 ? state.label2 : null,
                        sobject: state.sobject,
                        developerName: state.developerName,
                    },
                    data: {
                        files,
                        selectedRecord,
                        error: null,
                    },
                    flowVersions: {
                        flowVersionOptions,
                        flowVersionValue,
                    },
                };
                if (!state.tabs.find(x => x.id === tabkey)) {
                    _addTab(state, { tab });
                } else {
                    _updateTab(state, { tab });
                }
                //state.currentLevel = action.payload.currentLevel;
            })
            .addCase(fetchMetadataRecord.rejected, (state, action) => {
                const { error, tabkey } = action.payload;
                // Not Used for now ()
                state.isLoading = false;
                state.isLoadingRecord = false;
                state.currentTabId = tabkey;

                const tab = {
                    id: tabkey,
                    name: state.label1, // for now it's enough but might need to change
                    attributes: {
                        param1: state.param1,
                        label1: state.label1,
                        param2: null,
                        label2: null,
                        sobject: state.sobject,
                        developerName: state.developerName,
                    },
                    data: {
                        files: null,
                        selectedRecord: null,
                        error,
                    },
                };
                if (!state.tabs.find(x => x.id === tabkey)) {
                    _addTab(state, { tab });
                } else {
                    _updateTab(state, { tab });
                }
            })
            .addCase(startMetadataBackgroundSync.pending, state => {
                state.syncJob = {
                    ...state.syncJob,
                    status: 'running',
                    phase: 'init',
                    error: null,
                    result: null,
                    progress: { completed: 0, total: 0, percent: 0 },
                    lastRun: Date.now(),
                };
            })
            .addCase(startMetadataBackgroundSync.fulfilled, (state, action) => {
                state.syncJob = {
                    ...state.syncJob,
                    status: 'finished',
                    phase: 'done',
                    error: null,
                    result: action.payload,
                    progress: state.syncJob.progress || { completed: 0, total: 0, percent: 100 },
                };
            })
            .addCase(startMetadataBackgroundSync.rejected, (state, action) => {
                state.syncJob = {
                    ...state.syncJob,
                    status: 'error',
                    phase: 'error',
                    error: action.payload || action.error?.message || 'Metadata sync failed',
                };
            })
            .addCase(cancelMetadataBackgroundSync.fulfilled, state => {
                state.syncJob = {
                    ...state.syncJob,
                    status: 'cancelled',
                    phase: 'cancelled',
                };
            })
            .addCase(cancelMetadataBackgroundSync.rejected, (state, action) => {
                state.syncJob = {
                    ...state.syncJob,
                    status: 'error',
                    phase: 'error',
                    error: action.payload || action.error?.message || 'Failed to cancel metadata sync',
                };
            });
    },
});

export const reduxSlice = metadataSlice;
export {
    fetchGlobalMetadata,
    fetchSpecificMetadata,
    fetchMetadataRecord,
    startMetadataBackgroundSync,
    cancelMetadataBackgroundSync,
    shouldPersistMetadata,
    getMetadataStorageConfig,
};
