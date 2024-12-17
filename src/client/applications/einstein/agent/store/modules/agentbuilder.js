import { createSlice, createAsyncThunk,createEntityAdapter } from '@reduxjs/toolkit';
import { AGENTBUILDER,store } from 'core/store';
import { lowerCaseKey,guid,isNotUndefinedOrNull,ROLES,safeParseJson } from 'shared/utils';
import { FUNCTIONS,generateInstructionForBotCreation, /*createSalesforceZip*/ } from 'agent/utils';

const AGENT_BUILDER_SETTINGS_KEY = 'AGENT_BUILDER_SETTINGS_KEY';

/** Methods */

function loadCacheSettings(alias) {
    try {
        const configText = localStorage.getItem(`${alias}-${AGENT_BUILDER_SETTINGS_KEY}`);
        if (configText) return JSON.parse(configText);
    } catch (e) {
        console.error('Failed to load CONFIG from localStorage', e);
    }
    return null;
}

function saveCacheSettings(alias,state) {
    
    try {
        const { messages } = state
        localStorage.setItem(
            `${alias}-${AGENT_BUILDER_SETTINGS_KEY}`,
            JSON.stringify({ messages })
        );
    } catch (e) {
        console.error('Failed to save CONFIG to localstorage', e);
    }
}


// Agent Methods
const processResponseFromLLM = async (message, { originalMessages, dispatch }) => {
    let messages = [...originalMessages, { ...message, id: guid() }];

    if (message.content) {
        // If the message has content, return the updated messages
        return messages;
    } else if (message.tool_calls && message.tool_calls.length > 0) {
        const toolCall = message.tool_calls[0];
        const tool_call_id = toolCall.id;
        const parameters = JSON.parse(toolCall.function.arguments);

        if (actions.hasOwnProperty(toolCall.function.name)) {
            // Call the corresponding action and get updated messages
            const actionResponseMessages = await actions[toolCall.function.name](parameters, { messages, tool_call_id, dispatch });
            return actionResponseMessages;
        } else {
            console.error(`Unknown tool call: ${toolCall.function.name}`);
            return messages;
        }
    }
    // If no content or tool calls, return the messages as is
    return messages;
};

const actions = {
    'createAgent': async (parameters, { messages, tool_call_id, dispatch }) => {
        await dispatch(AGENTBUILDER.reduxSlice.actions.updateLoadingMessage({
            loadingMessage:'Definition of the Agent'
        }));
        console.log('--> createAgent <--',parameters);
        const dummyMessage = {
            id: guid(),
            role: ROLES.TOOL,
            content: '',
            tool_call_id
        };
        const newMessage = {
            id: guid(),
            role: ROLES.SYSTEM,
            content: generateInstructionForBotCreation(
                null,
                `Job that the agent should perform: ${parameters.agentJob}, Specific requirements for onboarding the agent: ${parameters.agentSpecificRequirement}`,
                parameters.companyName,
                null
            )
        };

        const response = await dispatch(AGENTBUILDER.agentBuilderExecutePrompt({
            messages: [...messages,dummyMessage, newMessage]
        }));


        // Return the updated messages from the response
        return response.payload.messages;
    },
    'updateAgentBuilder': async (parameters, { messages, tool_call_id, dispatch }) => {
        console.log('--> updateAgentBuilder <--',parameters);
        dispatch(AGENTBUILDER.reduxSlice.actions.updateBody({
            body: JSON.stringify(parameters, null, 4)
        }));
        const newMessage = {
            id: guid(),
            role: ROLES.TOOL,
            content: 'Body Updated',
            tool_call_id,
            hidden: true
        };
        const response = await dispatch(AGENTBUILDER.agentBuilderExecutePrompt({
            messages: [...messages, newMessage]
        }));

        // Return the updated messages from the response
        return response.payload.messages;
    },
    'deployToSalesforce':async (parameters, { messages, tool_call_id, dispatch }) => {
        console.log('--> deployToSalesforce <--',parameters);
        await dispatch(AGENTBUILDER.reduxSlice.actions.updateLoadingMessage({
            loadingMessage:'Deploying to Salesforce'
        }));
        const { application,agentBuilder } = store.getState();
        const connector = application.connector;
        await fetch("XXX", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${connector.conn.accessToken}`
            },
            body: JSON.stringify({
                company_website: parameters.company_website,
                company_name: parameters.company_name,
                bot_api_name:parameters.bot_api_name,
                "domain": "login",
                "agent_type": "External",
                "metadata":safeParseJson(agentBuilder.body)
            })
        });
        const newMessage = {
            id: guid(),
            role: ROLES.TOOL,
            content: 'Agent Deployed.',
            tool_call_id
        };

        const response = await dispatch(AGENTBUILDER.agentBuilderExecutePrompt({
            messages: [...messages, newMessage]
        }));

        // Return the updated messages from the response
        return response.payload.messages;
    },
    'fetchDeploymentDetails':async (parameters, { messages, tool_call_id, dispatch }) => {
        await dispatch(AGENTBUILDER.reduxSlice.actions.updateLoadingMessage({
            loadingMessage:'Fetching deployment Details'
        }));
        const query = `
                SELECT Id, Type, Status, NumberTestErrors, NumberTestsCompleted, NumberComponentsTotal,
                    NumberComponentErrors, NumberComponentsDeployed, StartDate, CompletedDate, ErrorMessage, CreatedDate, NumberTestsTotal,
                    LastModifiedDate, IsDeleted, ChangeSetName, StateDetail, ErrorStatusCode, RunTestsEnabled, RollbackOnError,
                    IgnoreWarnings, CheckOnly, CanceledById,CanceledBy.Name, AllowMissingFiles, AutoUpdatePackage, PurgeOnDelete, SinglePackage,
                    TestLevel, LastModifiedBy.Name, CreatedBy.Name
                FROM DeployRequest
                WHERE CreatedDate = TODAY
                ORDER BY CreatedDate DESC
                LIMIT 1
            `;
        const { application } = store.getState();
        const connector = application.connector;
        const result = (await connector.conn.tooling.query(query)).records;
        const newMessage = {
            id: guid(),
            role: ROLES.TOOL,
            content: result.length > 0 ?JSON.stringify(result[0]):'No deployment detected. Error',
            tool_call_id,
            isDeployment:true
        };

        const response = await dispatch(AGENTBUILDER.agentBuilderExecutePrompt({
            messages: [...messages, newMessage]
        }));

        // Return the updated messages from the response
        return response.payload.messages;
    }
};

/** Redux */

export const agentBuilderExecutePrompt = createAsyncThunk(
    'agentbuilder/executePrompt',
    async ({ messages, isSilent }, { dispatch, getState }) => {
        const { alias, openaiKey } = getState().agentBuilder;
        let allMessages = messages;

        try {
            while (true) {
                const response = await fetch("https://api.openai.com/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${openaiKey}`
                    },
                    body: JSON.stringify({
                        model: "gpt-4o",
                        messages: allMessages,
                        tools: FUNCTIONS.tools
                    })
                });

                const data = await response.json();

                const newMessage = data.choices[0].message;

                // Process the new message and get the updated message chain
                allMessages = await processResponseFromLLM(newMessage, { originalMessages: allMessages, dispatch });

                const lastMessage = allMessages[allMessages.length - 1];
                if (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
                    // No more tool calls; exit the loop
                    break;
                }
                // Continue the loop to process the next tool call
            }

            return {
                messages: allMessages,
                alias,
            };
        } catch (err) {
            console.error(err);
            throw new Error('Server Error: Please try again later');
        }
    }
);

const DEFAULT_LOADING_MESSAGE = 'Analyzing your request';

// Create a slice with reducers and extraReducers
const agentBuilderSlice = createSlice({
    name: 'agentBuilder',
    initialState: {
        body:null,
        errorIds: [],
        messages: [],
        isFetching: false,
        error: null,
        alias: null,
        openaiKey: null,
        loadingMessage:DEFAULT_LOADING_MESSAGE
    },
    reducers: {
        init: (state, action) => {
            const { alias, openaiKey } = action.payload;
            state.alias = alias;
            state.openaiKey = openaiKey;
            // We reset
            state.messages = [];
            state.isFetching = false;
            state.loadingMessage = DEFAULT_LOADING_MESSAGE
        },
        loadCacheSettings: (state, action) => {
            const { alias } = action.payload;
            const cachedConfig = loadCacheSettings(alias);
            if (cachedConfig) {
                const { messages } = cachedConfig;
                Object.assign(state, { messages });
            }
        },
        saveCacheSettings: (state, action) => {
            const { alias } = action.payload;
            if (alias) {
                saveCacheSettings(alias, state);
            }
        },
        clearDialog: (state) => {
            state.messages = [];
        },
        updateBody: (state, action) => {
            const { body } = action.payload;
            state.body = body || [];
        },
        updateMessages: (state, action) => {
            const { messages } = action.payload;
            state.messages = messages || [];
        },
        updateLoadingMessage: (state,action) => {
            const { loadingMessage } = action.payload;
            state.loadingMessage = loadingMessage || DEFAULT_LOADING_MESSAGE;
        },
        initialize: (state, action) => {
            const { messages } = action.payload;
            state.messages = messages || [];
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(agentBuilderExecutePrompt.pending, (state, action) => {
                const { messages,  } = action.meta.arg;
                state.isFetching = true;
                state.messages = messages;
                state.error = null;
                
            })
            .addCase(agentBuilderExecutePrompt.fulfilled, (state, action) => {
                const { messages, alias } = action.payload;
                state.messages = messages;
                state.isFetching = false;
                state.error = null;
                if (alias) {
                    saveCacheSettings(alias, state);
                }
            })
            .addCase(agentBuilderExecutePrompt.rejected, (state, action) => {
                const { error } = action;
                state.isFetching = false;
                state.error = error;
            });
    }
});

export const reduxSlice = agentBuilderSlice;