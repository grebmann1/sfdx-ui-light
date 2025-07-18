// Entry point for bundling OpenAI agent libraries
import * as Agents from '@openai/agents';
import * as AgentsCore from '@openai/agents-core';
import * as AgentsOpenAI from '@openai/agents-openai';

window.openaiAgent = {
    Agents,
    AgentsCore,
    AgentsOpenAI
};