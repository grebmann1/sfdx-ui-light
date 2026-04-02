import { promptWithHandoffInstructions, isUndefinedOrNull } from 'shared/utils';
const { Agent } = window.OpenAIAgentsBundle?.Agents || {};

import { tools } from 'agent/tools';
import { browserAgentInstructions } from './instructions/browserAgentInstructions';

export function createBrowserAgent({ toolsOverride } = {}) {
    if (isUndefinedOrNull(Agent)) return null;
    return new Agent({
        name: 'Browser Agent',
        instructions: context =>
            `${promptWithHandoffInstructions(browserAgentInstructions)}\n\n###Context:\n${JSON.stringify(context)}`,
        tools: Array.isArray(toolsOverride) ? toolsOverride : [...tools.browserAgent],
        toolUseBehavior: { stopAtToolNames: [] },
        modelSettings: { toolChoice: 'auto', parallelToolCalls: false },
    });
}
