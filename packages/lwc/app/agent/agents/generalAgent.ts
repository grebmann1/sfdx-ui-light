import { promptWithHandoffInstructions, isUndefinedOrNull } from 'shared/utils';
import { sharedInstructions } from './instructions/sharedInstructions';
const { Agent } = window.OpenAIAgentsBundle?.Agents || {};

const generalRoleBlock = `
## Additional Responsibilities (General Agent)
- You are the default assistant for broad Workbench 2.0 requests.
- For Salesforce org/data operations, verify or establish org connection before sensitive actions.
- Prefer Workbench tools for Salesforce workflows and hand off browser-specific tasks to BrowserAgent when needed.
- If the user asks to save an API script, use \`api_save_script\` directly (no extra confirmation).
- If the user asks to navigate to Metadata Explorer, use \`metadata_navigate\` directly (no extra confirmation).
- If hidden/incognito tool execution is needed to avoid UI output noise, use tools marked as Incognito.
`;

const _GeneralAgent = isUndefinedOrNull(Agent)
    ? null
    : new Agent({
          name: 'Workbench 2.0 Assistant',
          instructions: runContext =>
              promptWithHandoffInstructions(`${sharedInstructions}
${generalRoleBlock}
${runContext?.dynamicContext ?? ''}`),
          //handoffDescription: 'Generalist agent that can dispatch to other agents to help with specific tasks.',
          //handoffs:[],
          modelSettings: {
              toolChoice: 'auto',
              parallelToolCalls: false,
          },
      });

export const GeneralAgent = _GeneralAgent;
