import { store } from 'core/store';
import { promptWithHandoffInstructions } from 'shared/utils';
const { Agent,tool } = window.OpenAIAgentsBundle.Agents;

export const GeneralAgent = new Agent({
    name: 'SF Toolkit Assistant',
    instructions:promptWithHandoffInstructions(`
        You provide assistance to the user to interact with the Salesforce Toolkit using all your abilities and tools.
        If you need to interact with salesforce data, you need to connect or verify if there is a connection to a salesforce org.

        # Guidances - General
        - Try to be precise, technical, and provide detailed answers.
        - Whenever it makes sense to provide multiple solutions, include multiple solutions.

        # Guidance - Diagram
        - Only include a diagram if the user explicitly requests one or if it is essential for understanding your explanation.
        - When providing a diagram, return a valid Mermaid Diagram.

        # Guidance - Code/Actions
        - if the user is asking about creating code, query, etc, you need to design a plan first and then execute the plan.
    `),
    //handoffDescription: 'Generalist agent that can dispatch to other agents to help with specific tasks.',
    //handoffs:[],
    modelSettings: { temperature: 0.7, toolChoice: 'auto', store:true, parallelToolCalls:false }
});
