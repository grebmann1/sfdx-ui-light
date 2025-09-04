import { soqlTools } from './soql';
import { apexTools } from './apex';
import { apiAgentTools } from './api';
import { connectionTools } from './connections';
import { generalTools } from './general';
import { chromeTools } from './chrome';
import { metadataTools } from './metadata';

export const tools = {
    soql: soqlTools,
    apex: apexTools,
    api: apiAgentTools,
    connections: connectionTools,
    general: generalTools,
    chrome: chromeTools,
    metadata: metadataTools,
};