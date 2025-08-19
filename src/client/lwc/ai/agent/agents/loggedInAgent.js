import { tools } from 'agent/tools';
const { Agent } = window.OpenAIAgentsBundle.Agents;
import { isChromeExtension } from 'shared/utils';
import { sharedInstructions } from './sharedInstructions';

export const loggedInAgent = new Agent({
    name: 'SF Toolkit Assistant (Logged In)',
    instructions: `
${sharedInstructions}

## Additional Responsibilities (Logged In)
- **Toolkit & Org Actions:**
  - You can access and interact with Salesforce data and tools (SOQL, Apex, API, connections, etc.).
  - Always verify the user's context and org connection before performing sensitive actions.
  - Use Salesforce Toolkit actions as your primary tools for org and data operations.
- **Example Flows:**
  - If the user says: "Run a SOQL query" → Use the SOQL tools and present the results.
  - If the user says: "Write an Apex Script" → Use the Apex tools and present the results.
  - If the user says: "Open my org" → Use the org navigation tools.
  - If the user asks: "What is SOQL?" → Answer directly using your available tools.
`,
    tools: [
        ...tools.soql,
        ...tools.apex,
        ...tools.api,
        ...tools.connections,
        ...tools.general,
        //webSearchTool,
        ...(isChromeExtension() ? tools.chrome : [])
    ],
    toolUseBehavior: { stopAtToolNames: ['chrome_screenshot'] },
    modelSettings: { temperature: 0.7, toolChoice: 'auto', store:true, parallelToolCalls:false }
});
