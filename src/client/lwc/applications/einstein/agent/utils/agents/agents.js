import { ApexAgent } from './apexAgent';
import { GeneralAgent } from './generalAgent';

// Initialize handoffs
ApexAgent.handoffs = [GeneralAgent];
GeneralAgent.handoffs = [ApexAgent];

export const agents = {
    apex: ApexAgent,
    general: GeneralAgent,
};