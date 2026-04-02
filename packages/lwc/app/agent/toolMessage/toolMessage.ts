import { api, LightningElement } from 'lwc';
import { safeParseJson } from 'shared/utils';
import { Constants } from 'agent/utils';

function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function stringifyValue(value) {
    if (typeof value === 'string') return value;
    if (value == null) return '';
    try {
        return JSON.stringify(value, null, 2);
    } catch (e) {
        return String(value);
    }
}

function pickResultTextFromOutput(output) {
    if (!output || typeof output !== 'object') return '';
    if (typeof output.text === 'string' && output.text.trim().length > 0) return output.text;
    if (typeof output.type === 'string') {
        if (
            output.type === 'text' ||
            output.type === 'error-text'
        ) {
            return typeof output.value === 'string' && output.value.trim().length > 0
                ? output.value
                : '';
        }
        if (
            output.type === 'json' ||
            output.type === 'error-json'
        ) {
            if (output.value == null) return '';
            try {
                return JSON.stringify(output.value, null, 2);
            } catch (e) {
                return String(output.value);
            }
        }
        if (output.type === 'content' && Array.isArray(output.value)) {
            const textParts = output.value
                .map(item => (typeof item?.text === 'string' ? item.text : ''))
                .filter(Boolean);
            if (textParts.length > 0) return textParts.join('\n');
        }
    }
    if (typeof output.stdout === 'string' && output.stdout.trim().length > 0) return output.stdout;
    if (typeof output.error === 'string' && output.error.trim().length > 0) return output.error;
    if (typeof output.content === 'string' && output.content.trim().length > 0) return output.content;
    return '';
}

export default class ToolMessage extends LightningElement {
    @api toolCall: any;
    @api toolResult: any;
    @api isRunning = false;
    @api toolPart: any; // AI SDK UIMessage tool invocation part
    expanded = false;

    get _effectiveToolCall() {
        const part = this.toolPart;
        if (!part || typeof part !== 'object') {
            return this.toolCall || null;
        }
        const toolCallId =
            part.toolCallId || part.callId || part.call_id || part.id || `tool-${Date.now()}`;
        const toolName =
            part.toolName ||
            part.name ||
            (typeof part.type === 'string' && part.type.startsWith('tool-')
                ? part.type.slice('tool-'.length)
                : 'tool');
        const input = part.input ?? part.args ?? part.arguments;
        const argsText =
            input === undefined ? '' : typeof input === 'string' ? input : stringifyValue(input);
        return {
            toolCallId,
            callId: toolCallId,
            call_id: toolCallId,
            toolName,
            name: toolName,
            input,
            arguments: argsText || '{}',
        };
    }

    get _effectiveToolResult() {
        const part = this.toolPart;
        if (!part || typeof part !== 'object') {
            return this.toolResult || null;
        }
        const state = typeof part.state === 'string' ? part.state : '';
        if (state === 'output-available') {
            return { output: part.output };
        }
        if (state === 'output-error') {
            return { output: { isError: true, text: part.errorText || 'Tool error' } };
        }
        if (state === 'output-denied') {
            return { output: { isError: true, text: 'Tool execution denied.' } };
        }
        if (part.type === 'tool-result') {
            return { output: part.result ?? part.output ?? part.content };
        }
        return null;
    }

    get effectiveToolResult() {
        return this._effectiveToolResult;
    }

    get hasToolResult() {
        return !!this._effectiveToolResult;
    }

    get hasSuccessfulResult() {
        const output = this._effectiveToolResult?.output;
        if (output && typeof output === 'object') {
            if (output.isError) return false;
            if (typeof output.type === 'string' && output.type.startsWith('error')) return false;
        }
        return this.hasToolResult;
    }

    get _effectiveIsRunning() {
        const part = this.toolPart;
        if (!part || typeof part !== 'object') {
            return !!this.isRunning;
        }
        const state = typeof part.state === 'string' ? part.state : '';
        return (
            state === 'input-streaming' ||
            state === 'input-available' ||
            state === 'approval-requested' ||
            state === 'approval-responded' ||
            part.type === 'tool-call'
        );
    }

    _rawArguments() {
        const call = this._effectiveToolCall;
        if (typeof call?.arguments === 'string') return call.arguments;
        if (call?.input != null) return stringifyValue(call.input);
        return '';
    }

    get _parsedArguments() {
        const raw = this._rawArguments();
        if (!raw) return null;
        return safeParseJson(raw);
    }

    get title() {
        const parsed = this._parsedArguments;
        const description = normalizeText(parsed?.description);
        if (description) return description;
        const call = this._effectiveToolCall;
        const fromName = normalizeText(call?.name || call?.toolName);
        return fromName || Constants.TOOL_FINISHED_TITLE;
    }

    get statusIconName() {
        return this.hasToolResult ? 'utility:success' : 'utility:automate';
    }

    get statusIconVariant() {
        return this.hasSuccessfulResult ? 'success' : undefined;
    }

    get statusIconClass() {
        return !this.hasToolResult
            ? 'tool-status-icon tool-status-icon-running'
            : 'tool-status-icon';
    }

    get statusClass() {
        return this._effectiveIsRunning
            ? 'tool-status tool-status-running tool-status-pulse'
            : 'tool-status';
    }

    get toggleIconName() {
        return this.expanded ? 'utility:chevrondown' : 'utility:chevronright';
    }

    get toggleAriaLabel() {
        return this.expanded ? 'Collapse tool details' : 'Expand tool details';
    }

    get commandLabel() {
        return Constants.TOOL_COMMAND_LABEL;
    }

    get resultLabel() {
        return Constants.TOOL_RESULT_LABEL;
    }

    get commandText() {
        const parsed = this._parsedArguments;
        if (parsed && typeof parsed === 'object') {
            const preferred = ['command', 'script', 'input', 'query', 'prompt'];
            for (const key of preferred) {
                const value = normalizeText(parsed[key]);
                if (value) return value;
            }
            return stringifyValue(parsed);
        }
        const raw = this._rawArguments();
        return raw || '{}';
    }

    get resultText() {
        if (this._effectiveIsRunning) return 'Running...';
        const output = this._effectiveToolResult?.output;
        if (typeof output === 'string' && output.trim().length > 0) return output;
        if (output && typeof output === 'object') {
            const chosenText = pickResultTextFromOutput(output);
            if (chosenText) return chosenText;
            const serializedOutput = stringifyValue(output);
            if (serializedOutput) return serializedOutput;
        }
        const content = this._effectiveToolResult?.content;
        if (typeof content === 'string' && content.trim().length > 0) return content;
        if (Array.isArray(content) && content.length > 0) {
            const textParts = content
                .map(item => (typeof item?.text === 'string' ? item.text : ''))
                .filter(Boolean);
            if (textParts.length > 0) return textParts.join('\n');
        }
        return '{}';
    }

    get resultImages() {
        if (this._effectiveIsRunning) return [];
        const output = this._effectiveToolResult?.output;
        const imageCandidates = [];
        if (output && typeof output === 'object') {
            if (output.type === 'content' && Array.isArray(output.value)) {
                imageCandidates.push(...output.value);
            }
            if (Array.isArray(output.images)) {
                imageCandidates.push(...output.images);
            }
            if (Array.isArray(output.content)) {
                imageCandidates.push(...output.content);
            }
        }
        if (Array.isArray(this._effectiveToolResult?.content)) {
            imageCandidates.push(...this._effectiveToolResult.content);
        }

        return imageCandidates
            .map((item, index) => {
                const isImageType =
                    item?.type === Constants.CONTENT_TYPE.INPUT_IMAGE ||
                    item?.type === Constants.CONTENT_TYPE.IMAGE ||
                    item?.type === Constants.CONTENT_TYPE.OUTPUT_IMAGE;
                if (!isImageType) return null;
                const imageSrc =
                    typeof item?.image === 'string'
                        ? item.image
                        : typeof item?.dataUrl === 'string'
                          ? item.dataUrl
                        : typeof item?.data === 'string'
                          ? `data:${item?.mediaType || 'image/png'};base64,${item.data}`
                          : null;
                if (!imageSrc) return null;
                return {
                    key: item?.key || `result-image-${index}`,
                    src: imageSrc,
                };
            })
            .filter(Boolean);
    }

    handleToggle = () => {
        this.expanded = !this.expanded;
    };
}
