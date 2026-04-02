import type { ToolCall as AiToolCall, ToolResultOutput } from '@ai-sdk/provider-utils';
export type ProcessMessageFinishReason =
    | 'stop'
    | 'length'
    | 'content-filter'
    | 'tool-calls'
    | 'error'
    | 'other';

export interface ProcessMessageUsage {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
}

export interface ProcessMessageStepStart {
    stepNumber: number;
    timestamp: number;
}

export interface ProcessMessageStepFinish {
    stepNumber: number;
    timestamp: number;
    finishReason: ProcessMessageFinishReason;
    usage: ProcessMessageUsage;
}

export type ToolCall = AiToolCall<string, unknown>;
export type ToolResult = ToolResultOutput;

export interface ProcessMessageToolStart {
    toolCall: ToolCall;
    timestamp: number;
}

export interface ProcessMessageToolFinish {
    toolCall: ToolCall;
    toolResult: ToolResult;
    timestamp: number;
}

export interface ProcessMessageError {
    message: string;
    timestamp: number;
}

export interface ProcessMessageObserver {
    onStepStart?(info: ProcessMessageStepStart): void;
    onStepFinish?(info: ProcessMessageStepFinish): void;
    onToolStart?(info: ProcessMessageToolStart): void;
    onToolFinish?(info: ProcessMessageToolFinish): void;
    onError?(info: ProcessMessageError): void;
}

export type StreamChunk =
    | { type: 'content'; content: string }
    | { type: 'reasoning'; content: string }
    | { type: 'tool_calls'; toolCalls: ToolCall[] }
    | { type: 'tool_call_delta'; toolCallId: string; toolName?: string; delta: string }
    | { type: 'tool_result'; toolCall: ToolCall; toolResult: ToolResult }
    | { type: 'error'; content: string }
    | { type: 'done' };

type AgentSettings = {
    openaiKey?: string;
    openaiUrl?: string;
    selectedModel?: string;
    selectedReasoning?: string;
    modelContextWindow?: number;
    systemPrompt?: string;
    maxToolRounds?: number;
    isStoreEnabled?: boolean;
    store: Store;
};

type SubagentStatus = {
    agent: string;
    description: string;
    detail?: string;
};