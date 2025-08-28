import { loggedInAgent } from './loggedInAgent';
import { loggedOutAgent } from './loggedOutAgent';

// Handoff logic: each agent can suggest switching to the other if context changes
loggedInAgent.handoffs = [loggedOutAgent];
loggedOutAgent.handoffs = [loggedInAgent];

export { loggedInAgent, loggedOutAgent };