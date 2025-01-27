import { lowerCaseKey,guid,isNotUndefinedOrNull,safeParseJson } from 'shared/utils';
import { functionOutput } from 'ai/utils';
import LOGGER from 'shared/logger';

const assistantConfig = {
    name: 'DefaultAssistant',
    model: "gpt-4o-mini",
    publicDescription: '',
    instructions: ``,
    tools: [
        {
            type: "function",
            function: {
                name: "updateMetadata",
                description: "Update the metadata associated with an entity.",
                strict: true,
                parameters: {
                    type: "object",
                    description: "All the metadata",
                    required: [
                        "name",
                    ],
                    properties: {
                        name: {
                            type: "string",
                            description: "The name of the agent."
                        },
                    },
                    additionalProperties: false
                }
            }
        }
    ],
    toolLogic: {
        updateMetadata:async (parameters, { messages, tool_call_id, dispatch,isAnonymous }) => {
            LOGGER.info('[toolLogic] updateMetadata:',parameters);
            const response = {
                status:'Success',
                message:`updateMetadata function called successfully.`,
            }
            return functionOutput({tool_call_id,content:JSON.stringify(response)});
        }
    },
    messages:[]
}

export default assistantConfig;