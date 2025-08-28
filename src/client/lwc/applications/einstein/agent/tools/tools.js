import { soqlTools } from './soql';
import { apexTools } from './apex';
import { apiTools } from './api';
import { connectionTools } from './connections';
import { generalTools } from './general';
import { chromeTools } from './chrome';

export const tools = {
    soql: soqlTools,
    apex: apexTools,
    api: apiTools,
    connections: connectionTools,
    general: generalTools,
    chrome: chromeTools,
};