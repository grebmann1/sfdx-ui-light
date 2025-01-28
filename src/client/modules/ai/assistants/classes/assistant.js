import { ROLES,functionOutput,fetchCompletion } from 'ai/utils';
import { guid,isUndefinedOrNull } from 'shared/utils';
import { store} from 'core/store';
import { globalActions } from 'ai/functions';
import LOGGER from 'shared/logger';

class Assistant {
    name;
    model;
    tools;
    outputSchema;
    messages;
    toolLogic;
    instructions;
    constructor({name,model,instructions,tools,outputSchema,messages,toolLogic = {}}) {
        this.name = name;
        this.model = model || 'gpt-4o-mini';
        this.messages = messages || [];
        this.instructions = instructions || '';
        // Functions that the assistant can use
        this.tools = tools || [];
        this.toolLogic = { ...globalActions, ...toolLogic } || {};
        // outputSchema is the schema of the output of the assistant
        this.outputSchema = outputSchema;
    }

    init = () => {
        this.messages.push({
            role: ROLES.SYSTEM,
            content: this.instructions,
            id: guid()
        });
        return this;
    }

    addContext = (context) => {
        this.messages.push({
            role: ROLES.SYSTEM,
            content: context,
            id: guid()
        });
        return this;
    }

    addMessages = (messages) => {
        this.messages = [
            ...this.messages,
            ...messages.filter(msg => !this.messages.some(existingMsg => existingMsg.id === msg.id))
        ];
        return this;
    }

    execute = async () => {
        return this._executePrompt(this.messages);
    }

    executeWithRedux = async () => {
        /*store.dispatch(
            CONVERSATION.conversationExecutePrompt({
                messages: this.messages,
                assistant: this
            })
        );*/
    }

    reset() {
        this.messages = [];
        return this;
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