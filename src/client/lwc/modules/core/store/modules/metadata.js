import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { store, METADATA, SOBJECT, DESCRIBE, ERROR } from 'core/store';
import { cacheManager, CACHE_ORG_DATA_TYPES } from 'shared/cacheManager';
import LOGGER from 'shared/logger';
import {
    isNotUndefinedOrNull,
    formatFiles,
    isSalesforceId,
    sortObjectsByField,
    METADATA as METADATA_UTILS,
} from 'shared/utils';

const METADATA_SETTINGS_KEY = 'METADATA_SETTINGS_KEY';

/** Methods */

function loadCacheSettings(alias) {
    try {
        const configText = localStorage.getItem(`${alias}-${METADATA_SETTINGS_KEY}`);
        if (configText) return JSON.parse(configText);
    } catch (e) {
        console.error('Failed to load CONFIG from localStorage', e);
        store.dispatch(
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
        store.dispatch(
            ERROR.reduxSlice.actions.addError({
                message: 'Error saving metadata settings',
                details: e.message,
            })
        );
    }
}

const getMetadataConfig = async (connector, sobject) => {
    LOGGER.debug('getMetadataConfig', sobject, connector);
    const sobjectConfig = (
        await store.dispatch(
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
async function loadSpecificMetadata(connector, sobject, bypass) {
    const isSobject =
        store.getState().metadata.metadata_global.records.find(x => x.name == sobject)?.isSobject ||
        false;

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
    connector,
    exceptionMetadata,
    recordId,
    level,
    bypass
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
        store.dispatch(
            ERROR.reduxSlice.actions.addError({
                message: 'Error loading metadata',
                details: error.message,
            })
        );
        return { records: [], label: name };
    }
}

const handle_LWC = async (connector, sobject, key) => {
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

const handle_APEX = async (connector, sobject, data, extension = 'cls', bodyField = 'Body') => {
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

const handle_AURA = async (connector, sobject, data) => {
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

const runAndCacheQuery = async (connector, query, _byPassCaching) => {
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

const load_recordFromToolingAPI = async (connector, sobject, recordId) => {
    const urlQuery = `/services/data/v${connector.conn.version}/tooling/sobjects/${sobject}/${recordId}`;
    return await connector.conn.request(urlQuery);
};

const load_recordFromMetadataAPI = async (connector, sobject, fullName) => {
    return await connector.conn.metadata.read(sobject, fullName);
};

// Helper function to load a specific metadata record
const loadSpecificMetadataRecord2 = async (connector, { sobject, recordId, fullName }) => {
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
            store.getState().metadata.metadata_global.records.find(x => x.name == sobject)
                ?.isSobject || false;
        if (isSobject) {
            selectedRecord = await load_recordFromToolingAPI(connector, sobject, recordId);
        } else {
            const test = await load_recordFromMetadataAPI(connector, sobject, fullName);
            selectedRecord = test;
        }
    }

    return { selectedRecord, files };
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

            result = [...result, ...METADATA_UTILS.METADATA_EXCEPTION_LIST.filter(x => x.isSearchable)];
            return { records: result, label: 'Metadata' };
        } catch (error) {
            store.dispatch(
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
            await dispatch(METADATA.reduxSlice.actions.setAttributes({ sobject }));

            const { application, metadata } = getState();
            LOGGER.debug('application.connector', application.connector);
            const exceptionMetadata = METADATA_UTILS.METADATA_EXCEPTION_LIST.find(x => x.name === sobject) || null;
            // Check if the requested sobject differs from the current state
            if (metadata.currentMetadata !== sobject || force) {
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
            store.dispatch(
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
            const exceptionMetadata = METADATA_UTILS.METADATA_EXCEPTION_LIST.find(x => x.name === sobject) || null;

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
            return {
                tabkey,
                selectedRecord,
                files,
                ...flowVersions,
            };
        } catch (error) {
            console.error('Error fetching exception metadata:', error);
            store.dispatch(
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
            state.metadata_records = null;
        },
        updateMetadata: (state, action) => {
            const { metadata } = action.payload;
            state.metadata = metadata;
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
            });
    },
});

export const reduxSlice = metadataSlice;
export { fetchGlobalMetadata, fetchSpecificMetadata, fetchMetadataRecord };
