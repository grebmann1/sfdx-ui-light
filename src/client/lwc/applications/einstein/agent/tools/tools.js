import { soqlTools } from './soql';
import { apexTools } from './apex';
import { apiAgentTools } from './api';
import { connectionTools } from './connections';
import { generalTools } from './general';
import { chromeTools } from './chrome';
import { metadataTools } from './metadata';
import { agentTools } from './agentTools';
import { openaiBuiltInTools } from './openaiBuiltInTools';

export const tools = {
    soql: soqlTools,
    apex: apexTools,
    api: apiAgentTools,
    connections: connectionTools,
    general: generalTools,
    chrome: chromeTools,
    metadata: metadataTools,
    agent: agentTools,
};
export { openaiBuiltInTools };
export { filterToolsByModel } from './modelToolSupport';