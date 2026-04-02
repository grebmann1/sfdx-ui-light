import { isChromeExtension } from 'shared/utils';
import { createBrowserAgent } from './browserAgent';
import { createLoggedInAgent } from './loggedInAgent';
import { createLoggedOutAgent } from './loggedOutAgent';

function setHandoffs(agent, candidates) {
    if (!agent) return;
    const valid = (Array.isArray(candidates) ? candidates : []).filter(Boolean);
    // Deduplicate by agent name to avoid repeated handoff candidates.
    const deduped = [];
    const names = new Set();
    valid.forEach(candidate => {
        const key = candidate?.name || String(candidate);
        if (!names.has(key)) {
            names.add(key);
            deduped.push(candidate);
        }
    });
    agent.handoffs = deduped;
}

export function createAgentSet() {
    const browserAgent = createBrowserAgent();
    const loggedInAgent = createLoggedInAgent();
    const loggedOutAgent = createLoggedOutAgent();

    const extensionBrowserAvailable = isChromeExtension() && browserAgent;
    // Primary routing between auth-context agents.
    setHandoffs(loggedInAgent, [loggedOutAgent, extensionBrowserAvailable ? browserAgent : null]);
    setHandoffs(loggedOutAgent, [loggedInAgent, extensionBrowserAvailable ? browserAgent : null]);
    // Browser specialist can return control based on context.
    setHandoffs(browserAgent, [loggedInAgent, loggedOutAgent]);

    return { browserAgent, loggedInAgent, loggedOutAgent };
}

export { browserAgentInstructions } from './instructions/browserAgentInstructions';
export { sharedInstructions } from './instructions/sharedInstructions';