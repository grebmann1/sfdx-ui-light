import { tools } from 'agent/tools';
const { Agent } = window.OpenAIAgentsBundle?.Agents || {};
import { promptWithHandoffInstructions, isChromeExtension, isUndefinedOrNull } from 'shared/utils';

import { sharedInstructions } from './instructions/sharedInstructions';

const loggedInRoleBlock = `
## Additional Responsibilities (Logged In)
- **Toolkit & Org Actions:**
  - You can access and interact with Salesforce data and tools (SOQL, Apex, API, connections, etc.).
  - Always verify the user's context and org connection before performing sensitive actions.
  - Use Workbench actions as your primary tools for org and data operations.
- **Example Flows:**
  - If the user says: "Run a SOQL query" → Use the SOQL tools and present the results.
  - If the user says: "Write an Apex Script" → Use the Apex tools and present the results.
  - If the user says: "Open my org" → Use the org navigation tools.
  - If the user asks to navigate or automate the current webpage, hand off to BrowserAgent.
  - If the user asks: "What is SOQL?" → Answer directly using your available tools.
`;

export function createLoggedInAgent({ toolsOverride } = {}) {
    if (isUndefinedOrNull(Agent)) return null;
    return new Agent({
        name: 'Workbench Assistant (Logged In)',
        instructions: runContext =>
            promptWithHandoffInstructions(`${sharedInstructions}
${loggedInRoleBlock}
${runContext?.dynamicContext ?? ''}`),
        tools: Array.isArray(toolsOverride)
            ? toolsOverride
            : [
                  ...tools.soql,
                  ...tools.apex,
                  ...tools.api,
                  ...tools.connections,
                  ...tools.general,
                  ...tools.agent,
                  ...(isChromeExtension() ? tools.chrome : []),
              ],
        toolUseBehavior: { stopAtToolNames: ['chrome_screenshot'] },
        modelSettings: {
            toolChoice: 'auto',
            truncation: 'auto',
            parallelToolCalls: false,
        },
    });
}
