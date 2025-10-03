import { createSlice, createAsyncThunk, createEntityAdapter } from '@reduxjs/toolkit';
import { SELECTORS } from 'core/store';
import { lowerCaseKey, isNotUndefinedOrNull, splitTextByTimestamp, ASSISTANT as ASSISTANT_UTILS } from 'shared/utils';
import ASSISTANTS from 'ai/assistants';
import LOGGER from 'shared/logger';

export const MODEL_OPTIONS = [
    { label: 'gpt-5', value: 'gpt-5-2025-08-07' },
    { label: 'gpt-5-nano', value: 'gpt-5-nano-2025-08-07' },
    { label: 'gpt-5-mini', value: 'gpt-5-mini-2025-08-07' },
    { label: 'gpt-4.1', value: 'gpt-4.1-2025-04-14' },
    { label: 'gpt-4.o', value: 'gpt-4o-2024-08-06' },
    { label: 'gpt-4.1.mini', value: 'gpt-4.1-mini-2025-04-14' },
    { label: 'o3.mini', value: 'o3-mini-2025-01-31' },
    { label: 'o1.mini', value: 'o1-mini-2024-09-12' },
    { label: 'gpt-4o.mini', value: 'gpt-4o-mini-2024-07-18' },
    { label: 'o4.mini', value: 'o4-mini-2025-04-16' },
];


export const PROVIDER_OPTIONS = [
    { label: 'OpenAI', value: 'openai' },
    { label: 'Apex (Salesforce)', value: 'apex' },
];


const test = `59.0 APEX_CODE,DEBUG
Execute Anonymous: aiplatform.ModelsAPI.createChatGenerations_Request request = new aiplatform.ModelsAPI.createChatGenerations_Request();
Execute Anonymous:         // Specify model
Execute Anonymous:         request.modelName = 'sfdc_ai__DefaultGPT35Turbo';
Execute Anonymous:         // Create request body
Execute Anonymous:         aiplatform.ModelsAPI_ChatGenerationsRequest body = new aiplatform.ModelsAPI_ChatGenerationsRequest();
Execute Anonymous:         request.body = body;
Execute Anonymous:         // Add chat messages to body
Execute Anonymous:         List <aiplatform.ModelsAPI_ChatMessageRequest> messagesList = new List <aiplatform.ModelsAPI_ChatMessageRequest> ();
Execute Anonymous:         aiplatform.ModelsAPI_ChatMessageRequest item_0 = new aiplatform.ModelsAPI_ChatMessageRequest();
Execute Anonymous:         item_0.content = 'write an email';
Execute Anonymous:         item_0.role = 'user';
Execute Anonymous:         messagesList.add(item_0);
Execute Anonymous:     
Execute Anonymous:         body.messages = messagesList;
Execute Anonymous:         aiplatform.ModelsAPI modelsAPI = new aiplatform.ModelsAPI();
Execute Anonymous:         aiplatform.ModelsAPI.createChatGenerations_Response response = modelsAPI.createChatGenerations(request);
Execute Anonymous:         for(aiplatform.ModelsAPI_ChatMessage message : response.Code200.generationDetails.generations) {
Execute Anonymous:             system.debug('START_EINSTEIN_TOOLKIT'+message.id+'###'+message.role+'###'+message.content+'END_EINSTEIN_TOOLKIT');
Execute Anonymous:         }
Execute Anonymous:     
17:52:11.98 (8098242356)|USER_INFO|[EXTERNAL]|005Hr00000GPi4K|storm.454b5500dfa9a9@salesforce.com|(GMT-07:00) Pacific Daylight Time (America/Los_Angeles)|GMT-07:00
17:52:11.98 (8098266846)|EXECUTION_STARTED
17:52:11.98 (8098286285)|CODE_UNIT_STARTED|[EXTERNAL]|execute_anonymous_apex
17:52:18.96 (15096475781)|USER_DEBUG|[18]|DEBUG|START_EINSTEIN_TOOLKIT13f601ff-a260-426f-95c2-657ac56df795###5ZCAyq262PAg5hI###assistant###5ZCAyq262PAg5hI###Oops! Something went wrong.

It looks like there was an error processing your request. 
This could be due to issues with the text characters or formatting, or possibly because there are too many messages in the current dialog.
Please try creating a new dialog, or log the issue on GitHub if the problem persists.

END_EINSTEIN_TOOLKIT
17:52:18.96 (15101249217)|CODE_UNIT_FINISHED|execute_anonymous_apex
17:52:18.96 (15101271193)|EXECUTION_FINISHED`;

const Schemas = {};
Schemas.ExecuteAnonymousResult = {
    column: 'number',
    compileProblem: 'string',
    compiled: 'boolean',
    exceptionMessage: 'boolean',
    exceptionStackTrace: 'boolean',
    line: 'number',
    success: 'boolean',
    debugLog: 'string',
};

const DEBUG = 'DEBUG';
const EINSTEIN_SETTINGS_KEY = 'EINSTEIN_SETTINGS_KEY';

//const INITIAL_TABS = [enrichTab({ id: guid(), body: '' }, null)];

/** Methods */

/* function enrichTabs(tabs, state, selector) {
    return tabs.map(tab => enrichTab(tab, state, selector));
} */

/* function enrichTab(tab, state, selector) {
    const file =
        tab.fileId && selector ? selector.selectById(state, lowerCaseKey(tab.fileId)) : null;
    const fileBody = file?.content || tab.fileBody;
    return {
        ...tab,
        fileBody: fileBody,
        isDraft: fileBody != tab.body && isNotUndefinedOrNull(tab.fileId),
    };
} */

function extractEinsteinToolkitContent(log) {
    const toolkitRegex = /START_EINSTEIN_TOOLKIT(.*?)END_EINSTEIN_TOOLKIT/s;
    const match = log.match(toolkitRegex);
    return match ? match[1].trim() : '';
}

function loadCacheSettings(alias) {
    try {
        const configText = localStorage.getItem(`${alias}-${EINSTEIN_SETTINGS_KEY}`);
        if (configText) return JSON.parse(configText);
    } catch (e) {
        console.error('Failed to load CONFIG from localStorage', e);
    }
    return null;
}

function saveCacheSettings(alias, state) {
    try {
        const { tabs, dialog, connectionAlias, provider, model } = state;
        localStorage.setItem(
            `${alias}-${EINSTEIN_SETTINGS_KEY}`,
            JSON.stringify({ tabs, dialog, connectionAlias, provider, model })
        );
    } catch (e) {
        console.error('Failed to save CONFIG to localstorage', e);
    }
}

/** Redux */

export const einsteinModelAdapter = createEntityAdapter();
const _executeApexAnonymous = (connector, body, headers) => {
    return connector.conn.soap._invoke(
        'executeAnonymous',
        { apexcode: body },
        Schemas.ExecuteAnonymousResult,
        {
            xmlns: 'http://soap.sforce.com/2006/08/apex',
            endpointUrl: connector.conn.instanceUrl + '/services/Soap/s/' + connector.conn.version,
            headers,
        }
    );
};
const formatHeaders = state => ({
    DebuggingHeader: {
        categories: [
            {
                category: 'Apex_code',
                level: state.debug_apexCode,
            },
        ],
    },
});

/* const testTimer = () => {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve();
        }, 4000);
    });
}; */
export const einsteinExecuteModel = createAsyncThunk(
    'einstein/executeModel',
    async ({ connector, body, alias, tabId, messages }, { dispatch, getState }) => {
        //console.log('connector, body,tabId',connector, body,tabId);
        //const apiPath = isAllRows ? '/queryAll' : '/query';
        //await testTimer();
        //throw new Error('ERROR_HTTP_503:test by gui');
        try {
            //console.log('headers', formatHeaders(getState().einstein));
            const res = await _executeApexAnonymous(
                connector,
                body,
                formatHeaders(getState().einstein)
            );
            if (!res.success) {
                //console.group('Einstein Error');
                //console.error(res.exceptionMessage || res.compileProblem);
                //console.groupEnd();
                throw new Error(
                    "Einstein Access: You org doesn't provide Einstein access to your user."
                );
            }
            const text = splitTextByTimestamp(res?.debugLog || test)
                .filter(x => x.includes('|USER_DEBUG|'))
                .join('');

            const [id, role, content] = extractEinsteinToolkitContent(text).split(ASSISTANT_UTILS.separator_token);
            return {
                data: [].concat(messages, { id, role, content }),
                body,
                alias,
                tabId,
            };
        } catch (err) {
            console.error(err);
            if (err.toString().startsWith('ERROR_HTTP_503')) {
                throw new Error('Server Error: Please try again later');
            } else {
                throw err;
            }
        }
    }
);

const _innerExecute = (dispatch, { assistant, messages, tabId, onStream, alias }) => {
    return new Promise((resolve, reject) => {
        try{
            assistant
            .setInstructions(ASSISTANT_UTILS.instructionFormatted)
            .init()
            .addMessages([...messages])
            .onStream(message => {
                resolve(message);
                if (onStream) onStream(message);
            })
            .onStreamEnd(message => {
                LOGGER.debug('message end --> ', message);
                dispatch(einsteinSlice.actions.updateStreamingMessage({ tabId, message, alias, isSave: true }));
            })
            .onError(error => {
                LOGGER.error('###### Error in execute:', error);
                reject(error);
            })
            .execute();
        }catch(err){
            LOGGER.error('###### Error in _innerExecute:', err);
            reject(err);
        }
    });
}

export const openaiExecuteModel = createAsyncThunk(
    'einstein/openaiExecuteModel',
    async ({ messages, tabId, alias, model = 'gpt-4o-mini', aiProvider = 'openai', onStream }, { dispatch, getState }) => {
        try {
            const assistant = new ASSISTANTS.Assistant({
                model,
                aiProvider
            });
            const responses = await _innerExecute(dispatch, {
                assistant,
                messages,
                tabId,
                onStream,
                alias,
            });
            LOGGER.debug('responses', responses);
            return {
                data: [].concat(messages, responses),
                alias,
                tabId,
            };
        } catch (err) {
            LOGGER.error('###### Error in einstein/openaiExecuteModel:', err);
            throw err;
        }
    }
);

// Create a slice with reducers and extraReducers
const einsteinSlice = createSlice({
    name: 'einstein',
    initialState: {
        debug_apexCode: DEBUG,
        dialog: einsteinModelAdapter.getInitialState(),
        body: null,
        currentDialogId: null,
        connectionAlias: null,
        provider: 'apex',
        model: MODEL_OPTIONS[0].value,
        errorIds: [], // No need to have it on dialog lvl
    },
    reducers: {
        loadCacheSettings: (state, action) => {
            const { alias } = action.payload;
            const cachedConfig = loadCacheSettings(alias);
            if (cachedConfig) {
                const { dialog, connectionAlias, provider, model } = cachedConfig;
                Object.assign(state, {
                    dialog,
                    connectionAlias,
                    provider: provider || 'apex',
                    model: model || 'gpt-5-mini-2025-08-07',
                });
            }
        },
        saveCacheSettings: (state, action) => {
            const { alias } = action.payload;
            if (isNotUndefinedOrNull(alias)) {
                saveCacheSettings(alias, state);
            }
        },
        updateConnectionAlias: (state, action) => {
            const { connectionAlias, alias } = action.payload;
            state.connectionAlias = connectionAlias;
            if (isNotUndefinedOrNull(alias)) {
                saveCacheSettings(alias, state);
            }
        },
        updateProvider: (state, action) => {
            const { provider, alias } = action.payload;
            state.provider = provider;
            if (isNotUndefinedOrNull(alias)) {
                saveCacheSettings(alias, state);
            }
        },
        updateModel: (state, action) => {
            const { model, alias } = action.payload;
            state.model = model;
            if (isNotUndefinedOrNull(alias)) {
                saveCacheSettings(alias, state);
            }
        },
        clearDialog: (state, action) => {
            const { id, alias } = action.payload;
            einsteinModelAdapter.removeOne(state.dialog, id);
            if (isNotUndefinedOrNull(alias)) {
                saveCacheSettings(alias, state);
            }
        },
        /*initTabs:(state,action) => {
            state.dialog = enrichTabs(state.tabs);
            // Set first tab
            if(state.tabs.length > 0){
                state.currentDialog = state.tabs[0];
            }
        },*/
        updateMessage: (state, action) => {
            const { dialogId, data, alias } = action.payload;
            einsteinModelAdapter.upsertOne(state.dialog, {
                id: lowerCaseKey(dialogId),
                data: data,
            });
            if (isNotUndefinedOrNull(alias)) {
                saveCacheSettings(alias, state);
            }
        },
        addTab: (state, action) => {
            const { tab } = action.payload;
            const tabId = tab.id;
            einsteinModelAdapter.upsertOne(state.dialog, {
                id: lowerCaseKey(tabId),
                data: null,
                isFetching: false,
            });
            // Assign new tab
            state.currentDialogId = tabId;
            //state.body = tab.body;
        },
        removeTab: (state, action) => {
            const { id, alias } = action.payload;
            //state.tabs = state.tabs.filter(x => x.id != id);
            einsteinModelAdapter.removeOne(state.dialog, id);
            // Assign last tab
            if (state.dialog.ids.length > 0 && state.currentDialogId == id) {
                const lastTabId = state.dialog.ids.slice(-1)[0];
                state.currentDialogId = lastTabId;
                //state.body = lastTab.body;
            }
            if (isNotUndefinedOrNull(alias)) {
                saveCacheSettings(alias, state);
            }
        },
        selectionTab: (state, action) => {
            const { id } = action.payload;
            state.currentDialogId = id;
        },
        updateStreamingMessage: (state, action) => {
            const { tabId, message, isSave, alias } = action.payload;
            const dialog = SELECTORS.einstein.selectById({einstein: state}, lowerCaseKey(tabId));
            if (dialog && dialog.data && dialog.data.length > 0) {
                // Create a new data array with the last message replaced
                const newData = [...dialog.data];
                newData[newData.length - 1] = message;
                einsteinModelAdapter.upsertOne(state.dialog, {
                    ...dialog,
                    id: lowerCaseKey(tabId),
                    data: newData,
                });
                if (isSave) {
                    saveCacheSettings(alias, state);
                }
            }
        },
    },
    extraReducers: builder => {
        builder
            .addCase(einsteinExecuteModel.pending, (state, action) => {
                const { tabId, createdDate } = action.meta.arg;
                einsteinModelAdapter.upsertOne(state.dialog, {
                    id: lowerCaseKey(tabId),
                    data: null,
                    createdDate,
                    isFetching: true,
                    error: null,
                });
            })
            .addCase(einsteinExecuteModel.fulfilled, (state, action) => {
                const { data, body, alias } = action.payload;
                const { tabId, createdDate, messages } = action.meta.arg;
                const lastMessage = messages[messages.length - 1];
                einsteinModelAdapter.upsertOne(state.dialog, {
                    id: lowerCaseKey(tabId),
                    data,
                    body,
                    isFetching: false,
                    createdDate,
                    error: null,
                });

                // Clean error messages
                state.errorIds = state.errorIds.filter(x => x != lastMessage.id);

                // Overwrite the alias (Not removing the alias in case we want to store it o)
                //alias = GLOBAL_EINSTEIN;
                if (isNotUndefinedOrNull(alias)) {
                    //console.log('--> save',alias);
                    saveCacheSettings(alias, state);
                }

                if (chrome?.runtime) {
                    chrome.runtime.sendMessage({
                        action: 'broadcastMessageToSidePanel',
                        content: { action: 'refresh' },
                    });
                }
            })
            .addCase(einsteinExecuteModel.rejected, (state, action) => {
                const { error } = action;
                const { tabId, messages } = action.meta.arg;
                const lastMessage = messages[messages.length - 1];
                einsteinModelAdapter.upsertOne(state.dialog, {
                    id: lowerCaseKey(tabId),
                    isFetching: false,
                    error,
                });

                // Monitor messages errors
                state.errorIds = [].concat(
                    state.errorIds.filter(x => x != lastMessage.id), // to be sure it's unique
                    lastMessage.id
                );
            })
            // OpenAI Thunk
            .addCase(openaiExecuteModel.pending, (state, action) => {
                const { tabId } = action.meta.arg;
                einsteinModelAdapter.upsertOne(state.dialog, {
                    id: lowerCaseKey(tabId),
                    data: null,
                    isFetching: true,
                    error: null,
                });
            })
            .addCase(openaiExecuteModel.fulfilled, (state, action) => {
                const { data, alias, tabId } = action.payload;
                einsteinModelAdapter.upsertOne(state.dialog, {
                    id: lowerCaseKey(tabId),
                    data,
                    isFetching: false,
                    error: null,
                });
                if (isNotUndefinedOrNull(alias)) {
                    saveCacheSettings(alias, state);
                }
                if (chrome?.runtime) {
                    chrome.runtime.sendMessage({
                        action: 'broadcastMessageToSidePanel',
                        content: { action: 'refresh' },
                    });
                }
            })
            .addCase(openaiExecuteModel.rejected, (state, action) => {
                const { tabId, messages } = action.meta.arg;
                const error = action.error;
                const lastMessage = messages && messages.length > 0 ? messages[messages.length - 1] : {};
                einsteinModelAdapter.upsertOne(state.dialog, {
                    id: lowerCaseKey(tabId),
                    isFetching: false,
                    error,
                });
                if (lastMessage.id) {
                    state.errorIds = [].concat(
                        state.errorIds.filter(x => x != lastMessage.id),
                        lastMessage.id
                    );
                }
            });
    },
});

export const reduxSlice = einsteinSlice;
