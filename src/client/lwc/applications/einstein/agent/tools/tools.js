import { agentTools } from './agentTools';
import { apexTools } from './apex';
import { apiAgentTools } from './api';
import { chromeTools } from './chrome';
import { connectionTools } from './connections';
import { generalTools } from './general';
import { metadataTools } from './metadata';
import { openaiBuiltInTools } from './openaiBuiltInTools';
import { soqlTools } from './soql';

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
