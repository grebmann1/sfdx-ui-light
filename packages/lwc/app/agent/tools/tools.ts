import { openaiBuiltInTools } from './openaiBuiltInTools';
import { sharedTools } from './shared';

export const tools = {
    soql: [],
    apex: [],
    api: [],
    connections: [],
    general: [],
    chrome: [],
    browserAgent: sharedTools,
    metadata: [],
    agent: [],
};
export { openaiBuiltInTools };
export { filterToolsByModel } from './modelToolSupport';
export { createBashTools } from './shared';
