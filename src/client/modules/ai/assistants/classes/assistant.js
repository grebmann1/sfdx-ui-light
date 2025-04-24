import { ROLES,functionOutput,fetchCompletion,fetchCompletionStream } from 'ai/utils';
import { guid,isUndefinedOrNull,safeParseJson } from 'shared/utils';
import { store} from 'core/store';
import { globalActions } from 'ai/functions';
import LOGGER from 'shared/logger';

// Process the stream
const processStream = async (stream, callback) => {
    return new Promise(async (resolve, reject) => {
        try {
            let index = 0;
            const reader = stream.getReader();
            const decoder = new TextDecoder('utf-8');
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                // Process the chunk in 'value'
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.replace('data: ', '');
                        if (data === '[DONE]') {
                            resolve();
                        } else {
                            await callback(data, index);
                            index++;
                        }
                    }
                }
            }
        } catch (error) {
            reject(error);
        }
    });
};


class Assistant {
    name;
    model;
    tools;
    outputSchema;
    messages;
    toolLogic;
    instructions;
    handoffs = [];
    isExecuting = false;

    // Text callback
    onTextCallback = null;
    onTextEndCallback = null;


    constructor({name,model,instructions,tools,outputSchema,messages,toolLogic = {},handoffs = []  }) {
        this.name = name;
        this.model = model || 'gpt-4o-mini';
        this.messages = messages || [];
        this.instructions = instructions || '';
        // Functions that the assistant can use
        this.tools = tools || [];
        this.toolLogic = { ...globalActions, ...toolLogic } || {};
        // outputSchema is the schema of the output of the assistant
        if (outputSchema) this.outputSchema = outputSchema;
        if (handoffs.length > 0) this.handoffs = [...handoffs];

        // Create proxied versions of the tool functions that have access to the assistant instance
        this._createToolLogicProxy();
    }

    _createToolLogicProxy() {
        const originalToolLogic = this.toolLogic;
        const assistantInstance = this;

        // Create a proxy for each function in toolLogic
        const proxiedToolLogic = {};

        Object.keys(originalToolLogic).forEach((key) => {
            const originalFunction = originalToolLogic[key];
            if (typeof originalFunction === 'function') {
                proxiedToolLogic[key] = async function (args, context) {
                    // Ensure the assistant property points to the correct instance
                    const enhancedContext = {
                        ...context,
                        assistant: assistantInstance,
                    };
                    return originalFunction(args, enhancedContext);
                };
            } else {
                proxiedToolLogic[key] = originalFunction;
            }
        });

        this.toolLogic = proxiedToolLogic;
    }

    init() {
        this.messages = [];
        return this;
    }

    setInstructions(instructions) {
        this.messages = [
            ...this.messages,
            {
                role: ROLES.SYSTEM,
                content: instructions || this.instructions,
                id: guid().slice(0, 32),
                isInstruction: true,
            },
        ];
        return this;
    }

    addContext(context) {
        if (!context) return this;

        this.messages = [
            ...this.messages,
            {
                role: ROLES.SYSTEM,
                content: context,
                id: guid().slice(0, 32),
                hidden: true,
                isContext: true,
            },
        ];
        return this;
    }

    addMessages = (messages) => {
        if (!messages || !messages.length) return this;

        LOGGER.agent('addMessages', this.messages, messages);
        // Create a Set of existing message IDs for faster lookup
        const existingIds = new Set(this.messages.map((msg) => msg.id));

        // Filter and add only new messages
        const newMessages = messages.filter((msg) => !existingIds.has(msg.id));
        if (newMessages.length > 0) {
            this.messages = [...this.messages, ...newMessages];
        }

        return this;
    }

    onText(callback) {
        this.onTextCallback = callback;
        return this;
    }

    onTextEnd(callback) {
        this.onTextEndCallback = callback;
        return this;
    }

    reset() {
        this.messages = [];
        return this;
    }

    execute = async () => {
        this.isExecuting = true;
        // Filter out all but the last context message
        const messages = [...this.messages];
        LOGGER.agent('execute ->', messages);
        const contextMessages = messages.filter((msg) => msg.isContext);
        const nonContextMessages = messages.filter((msg) => !msg.isContext);

        if (contextMessages.length > 0) {
            // Keep only the last context message
            nonContextMessages.push(contextMessages[contextMessages.length - 1]);
        }

        let result;
        try {
            result = await this._executePromptStream(nonContextMessages);
            dispatchEvent(new CustomEvent('textend', {
                detail: {
                    content: result[result.length - 1].content,
                },
            }));
        } finally {
            this.isExecuting = false;
        }
        return result;
    }

    

    async _executePromptStream(_messages) {
        if (!_messages?.length) {
            throw new Error('No messages provided to execute prompt');
        }

        const messages = [..._messages];
        const MAX_ITERATIONS = 10;

        try {
            // Handle message processing in a separate method for clarity
            return await this._processMessageStream(messages, MAX_ITERATIONS);
        } catch (error) {
            LOGGER.error('Error in _executePromptStream:', error);
            throw error;
        }
    }

    async _processMessageStream(messages, maxIterations) {
        for (let iteration = 0; iteration < maxIterations && this.isExecuting; iteration++) {
            const message = this._createInitialMessage();
            this._upsertMessage(message);

            const params = {
                model: this.model,
                messages,
                ...this._addAdditionalParams(),
            };

            const { body, abort } = await fetchCompletionStream(params);
            if (!body) {
                throw new Error('No data returned from the assistant');
            }

            // Store the abort function for later use
            this._currentAbort = abort;

            const toolCallsAccumulator = {};
            const result = await this._handleStreamProcessing(
                body,
                { ...message },
                toolCallsAccumulator,
                messages,
            );

            // Clear the abort function after processing
            this._currentAbort = null;

            if (result.isFinished) {
                return messages;
            }
        }

        if (!this.isExecuting) {
            throw new Error('Execution was stopped');
        }

        throw new Error(
            'Maximum iterations reached without a suitable answer. Please try again with a more specific input.',
        );
    }

    async _handleStreamProcessing(stream, message, toolCallsAccumulator, messages) {
        let isFinished = false;

        await processStream(stream, async (data, index) => {
            if (index === 0) {
                message.isLoading = false;
                message.content = null;
            }

            const parsedData = safeParseJson(data);
            const { finish_reason, delta } = parsedData.choices[0];

            this._updateMessageFromDelta(message, delta);

            if (delta.tool_calls) {
                this._accumulateToolCalls(delta.tool_calls, toolCallsAccumulator, message);
            }

            if (finish_reason === 'tool_calls' && message.tool_calls) {
                await this._handleToolCalls(message, messages);
            } else if (finish_reason === 'stop') {
                messages.push(message);
                this._upsertMessage(message);
                isFinished = true;
                if (this.onTextEndCallback) {
                    this.onTextEndCallback(message.content);
                }
            }
        });

        return { isFinished };
    }

    _updateMessageFromDelta(message, delta) {
        if (delta.role) message.role = delta.role;
        if (delta.refusal) message.refusal = delta.refusal;
        if (delta.content) {
            
            // Update the message content
            message.content = isUndefinedOrNull(message.content) ? delta.content : message.content + delta.content;
            // Send the message to the callback
            if (this.onTextCallback) {
                this.onTextCallback(message.content);
            }
        }
    }

    _accumulateToolCalls(toolCalls, accumulator, message) {
        for (const toolCall of toolCalls) {
            const { index } = toolCall;
            if (!accumulator[index]) {
                accumulator[index] = {
                    id: toolCall.id || guid().slice(0, 32),
                    type: toolCall.type || 'function',
                    function: {
                        name: toolCall.function?.name || '',
                        arguments: toolCall.function?.arguments || '',
                    },
                };
            } else {
                // Accumulate function arguments
                if (toolCall.function?.arguments) {
                    accumulator[index].function.arguments += toolCall.function.arguments;
                }
                // Update function name if present
                if (toolCall.function?.name) {
                    accumulator[index].function.name = toolCall.function.name;
                }
            }
        }
        // Update message with accumulated tool calls
        message.tool_calls = Object.values(accumulator);
    }

    executeWithRedux = async () => {
        /*store.dispatch(
            CONVERSATION.conversationExecutePrompt({
                messages: this.messages,
                assistant: this
            })
        );*/
    }

    _createInitialMessage() {
        return {
            id: guid().slice(0, 32),
            content: '', // Thinking... was removed
            role: ROLES.ASSISTANT,
            isLoading: true,
        };
    }

    _addAdditionalParams = () => {
        const params = {};
        if (this.tools?.length > 0) {
            params.tools = this.tools;
        }

        if (this.outputSchema) {
            params.response_format = this.outputSchema;
        }

        return params;
    }

    _executePrompt = async (_messages) => {
        LOGGER.debug('messages',_messages);
        let messages = [..._messages];
        for (let i = 0; i < 5; i++) {
            const params = {
                model: this.model,
                messages,
                ...this._addAdditionalParams()
            };
            LOGGER.debug('params',params);
            const response = await (await fetchCompletion(params)).json();
            LOGGER.debug('response',response);
            if (isUndefinedOrNull(response)) throw new Error('No data returned from the assistant');

            const { finish_reason, message } = response.choices[0];
            message.id = message.id || guid();

            if (finish_reason === "tool_calls" && message.tool_calls) {
                messages.push(message);
                for (const toolCall of message.tool_calls) {
                    const functionToCall = this.toolLogic[toolCall.function.name];
                    const functionArgs = JSON.parse(toolCall.function.arguments);
                    const functionResponse = await functionToCall(functionArgs, { messages, tool_call_id: toolCall.id, dispatch: store.dispatch });
                    messages.push(...functionResponse);
                }
            } else if (finish_reason === "stop") {
                messages.push(message);
                return messages;
            }
        }
        throw new Error('Maximum iterations reached without a suitable answer. Please try again with a more specific input.');
    }

    stopExecution() {
        this.isExecuting = false;
        if (this._currentAbort) {
            this._currentAbort();
            this._currentAbort = null;
        }
        if (this.client) {
            this.client.stop();
        }
    }

    // ===== REDUX MESSAGE MANAGEMENT METHODS =====

    _upsertMessage(message) {
        LOGGER.debug('upsertMessage --> ', message);
        const messageExists = this.messages.some((item) => item.id === message.id);
        if (!messageExists) {
            this.messages = [...this.messages, message];
        } else {
            this.messages = this.messages.map((item) => {
                if (item.id === message.id) {
                    return {
                        ...item,
                        ...message,
                    };
                }
                return item;
            });
        }
    }

}

export default Assistant;


/** For Redux */

/* 
export const conversationExecutePrompt = createAsyncThunk(
    'conversation/executePrompt',
    async ({ assistant}, { dispatch, getState }) => {

        try {
            const messages = await assistant.execute();
            return { messages };
        } catch (error) {
            LOGGER.error(error);
            throw new Error('Server Error: Please try again later');
        }
    }
); 
*/