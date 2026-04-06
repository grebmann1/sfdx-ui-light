async function runAgentLoop(e, t, r, n, a, s) {
    const o = [...e]
      , l = {
        ...t,
        messages: [...t.messages, ...e]
    };
    await n({
        type: "agent_start"
    }),
    await n({
        type: "turn_start"
    });
    for (const u of e)
        await n({
            type: "message_start",
            message: u
        }),
        await n({
            type: "message_end",
            message: u
        });
    return await runLoop(l, o, r, a, n, s),
    o
}
async function runAgentLoopContinue(e, t, r, n, a) {
    if (e.messages.length === 0)
        throw new Error("Cannot continue: no messages in context");
    if (e.messages[e.messages.length - 1].role === "assistant")
        throw new Error("Cannot continue from message role: assistant");
    const s = []
      , o = {
        ...e
    };
    return await r({
        type: "agent_start"
    }),
    await r({
        type: "turn_start"
    }),
    await runLoop(o, s, t, n, r, a),
    s
}
async function runLoop(e, t, r, n, a, s) {
    let o = !0
      , l = await r.getSteeringMessages?.() || [];
    for (; ; ) {
        let u = !0;
        for (; u || l.length > 0; ) {
            if (o ? o = !1 : await a({
                type: "turn_start"
            }),
            l.length > 0) {
                for (const h of l)
                    await a({
                        type: "message_start",
                        message: h
                    }),
                    await a({
                        type: "message_end",
                        message: h
                    }),
                    e.messages.push(h),
                    t.push(h);
                l = []
            }
            const p = await streamAssistantResponse(e, r, n, a, s);
            if (t.push(p),
            p.stopReason === "error" || p.stopReason === "aborted") {
                await a({
                    type: "turn_end",
                    message: p,
                    toolResults: []
                }),
                await a({
                    type: "agent_end",
                    messages: t
                });
                return
            }
            u = p.content.filter(h => h.type === "toolCall").length > 0;
            const f = [];
            if (u) {
                f.push(...await executeToolCalls(e, p, r, n, a));
                for (const h of f)
                    e.messages.push(h),
                    t.push(h)
            }
            await a({
                type: "turn_end",
                message: p,
                toolResults: f
            }),
            l = await r.getSteeringMessages?.() || []
        }
        const c = await r.getFollowUpMessages?.() || [];
        if (c.length > 0) {
            l = c;
            continue
        }
        break
    }
    await a({
        type: "agent_end",
        messages: t
    })
}
async function streamAssistantResponse(e, t, r, n, a) {
    let s = e.messages;
    t.transformContext && (s = await t.transformContext(s, r));
    const o = await t.convertToLlm(s)
      , l = {
        systemPrompt: e.systemPrompt,
        messages: o,
        tools: e.tools
    }
      , u = a || streamSimple
      , c = (t.getApiKey ? await t.getApiKey(t.model.provider) : void 0) || t.apiKey
      , p = await u(t.model, l, {
        ...t,
        apiKey: c,
        signal: r
    });
    let d = null
      , f = !1;
    for await(const m of p)
        switch (m.type) {
        case "start":
            d = m.partial,
            e.messages.push(d),
            f = !0,
            await n({
                type: "message_start",
                message: {
                    ...d
                }
            });
            break;
        case "text_start":
        case "text_delta":
        case "text_end":
        case "thinking_start":
        case "thinking_delta":
        case "thinking_end":
        case "toolcall_start":
        case "toolcall_delta":
        case "toolcall_end":
            d && (d = m.partial,
            e.messages[e.messages.length - 1] = d,
            await n({
                type: "message_update",
                assistantMessageEvent: m,
                message: {
                    ...d
                }
            }));
            break;
        case "done":
        case "error":
            {
                const g = await p.result();
                return f ? e.messages[e.messages.length - 1] = g : e.messages.push(g),
                f || await n({
                    type: "message_start",
                    message: {
                        ...g
                    }
                }),
                await n({
                    type: "message_end",
                    message: g
                }),
                g
            }
        }
    const h = await p.result();
    return f ? e.messages[e.messages.length - 1] = h : (e.messages.push(h),
    await n({
        type: "message_start",
        message: {
            ...h
        }
    })),
    await n({
        type: "message_end",
        message: h
    }),
    h
}
async function executeToolCalls(e, t, r, n, a) {
    const s = t.content.filter(o => o.type === "toolCall");
    return r.toolExecution === "sequential" ? executeToolCallsSequential(e, t, s, r, n, a) : executeToolCallsParallel(e, t, s, r, n, a)
}
async function executeToolCallsSequential(e, t, r, n, a, s) {
    const o = [];
    for (const l of r) {
        await s({
            type: "tool_execution_start",
            toolCallId: l.id,
            toolName: l.name,
            args: l.arguments
        });
        const u = await prepareToolCall(e, t, l, n, a);
        if (u.kind === "immediate")
            o.push(await emitToolCallOutcome(l, u.result, u.isError, s));
        else {
            const c = await executePreparedToolCall(u, a, s);
            o.push(await finalizeExecutedToolCall(e, t, u, c, n, a, s))
        }
    }
    return o
}
async function executeToolCallsParallel(e, t, r, n, a, s) {
    const o = []
      , l = [];
    for (const c of r) {
        await s({
            type: "tool_execution_start",
            toolCallId: c.id,
            toolName: c.name,
            args: c.arguments
        });
        const p = await prepareToolCall(e, t, c, n, a);
        p.kind === "immediate" ? o.push(await emitToolCallOutcome(c, p.result, p.isError, s)) : l.push(p)
    }
    const u = l.map(c => ({
        prepared: c,
        execution: executePreparedToolCall(c, a, s)
    }));
    for (const c of u) {
        const p = await c.execution;
        o.push(await finalizeExecutedToolCall(e, t, c.prepared, p, n, a, s))
    }
    return o
}
async function prepareToolCall(e, t, r, n, a) {
    const s = e.tools?.find(o => o.name === r.name);
    if (!s)
        return {
            kind: "immediate",
            result: createErrorToolResult(`Tool ${r.name} not found`),
            isError: !0
        };
    try {
        const o = validateToolArguments(s, r);
        if (n.beforeToolCall) {
            const l = await n.beforeToolCall({
                assistantMessage: t,
                toolCall: r,
                args: o,
                context: e
            }, a);
            if (l?.block)
                return {
                    kind: "immediate",
                    result: createErrorToolResult(l.reason || "Tool execution was blocked"),
                    isError: !0
                }
        }
        return {
            kind: "prepared",
            toolCall: r,
            tool: s,
            args: o
        }
    } catch (o) {
        return {
            kind: "immediate",
            result: createErrorToolResult(o instanceof Error ? o.message : String(o)),
            isError: !0
        }
    }
}
async function executePreparedToolCall(e, t, r) {
    const n = [];
    try {
        const a = await e.tool.execute(e.toolCall.id, e.args, t, s => {
            n.push(Promise.resolve(r({
                type: "tool_execution_update",
                toolCallId: e.toolCall.id,
                toolName: e.toolCall.name,
                args: e.toolCall.arguments,
                partialResult: s
            })))
        }
        );
        return await Promise.all(n),
        {
            result: a,
            isError: !1
        }
    } catch (a) {
        return await Promise.all(n),
        {
            result: createErrorToolResult(a instanceof Error ? a.message : String(a)),
            isError: !0
        }
    }
}
async function finalizeExecutedToolCall(e, t, r, n, a, s, o) {
    let l = n.result
      , u = n.isError;
    if (a.afterToolCall) {
        const c = await a.afterToolCall({
            assistantMessage: t,
            toolCall: r.toolCall,
            args: r.args,
            result: l,
            isError: u,
            context: e
        }, s);
        c && (l = {
            content: c.content ?? l.content,
            details: c.details ?? l.details
        },
        u = c.isError ?? u)
    }
    return await emitToolCallOutcome(r.toolCall, l, u, o)
}
function createErrorToolResult(e) {
    return {
        content: [{
            type: "text",
            text: e
        }],
        details: {}
    }
}
async function emitToolCallOutcome(e, t, r, n) {
    await n({
        type: "tool_execution_end",
        toolCallId: e.id,
        toolName: e.name,
        result: t,
        isError: r
    });
    const a = {
        role: "toolResult",
        toolCallId: e.id,
        toolName: e.name,
        content: t.content,
        details: t.details,
        isError: r,
        timestamp: Date.now()
    };
    return await n({
        type: "message_start",
        message: a
    }),
    await n({
        type: "message_end",
        message: a
    }),
    a
}
function defaultConvertToLlm(e) {
    return e.filter(t => t.role === "user" || t.role === "assistant" || t.role === "toolResult")
}
class Agent {
    _state = {
        systemPrompt: "",
        model: getModel("google", "gemini-2.5-flash-lite-preview-06-17"),
        thinkingLevel: "off",
        tools: [],
        messages: [],
        isStreaming: !1,
        streamMessage: null,
        pendingToolCalls: new Set,
        error: void 0
    };
    listeners = new Set;
    abortController;
    convertToLlm;
    transformContext;
    steeringQueue = [];
    followUpQueue = [];
    steeringMode;
    followUpMode;
    streamFn;
    _sessionId;
    getApiKey;
    _onPayload;
    runningPrompt;
    resolveRunningPrompt;
    _thinkingBudgets;
    _transport;
    _maxRetryDelayMs;
    _toolExecution;
    _beforeToolCall;
    _afterToolCall;
    constructor(t={}) {
        this._state = {
            ...this._state,
            ...t.initialState
        },
        this.convertToLlm = t.convertToLlm || defaultConvertToLlm,
        this.transformContext = t.transformContext,
        this.steeringMode = t.steeringMode || "one-at-a-time",
        this.followUpMode = t.followUpMode || "one-at-a-time",
        this.streamFn = t.streamFn || streamSimple,
        this._sessionId = t.sessionId,
        this.getApiKey = t.getApiKey,
        this._onPayload = t.onPayload,
        this._thinkingBudgets = t.thinkingBudgets,
        this._transport = t.transport ?? "sse",
        this._maxRetryDelayMs = t.maxRetryDelayMs,
        this._toolExecution = t.toolExecution ?? "parallel",
        this._beforeToolCall = t.beforeToolCall,
        this._afterToolCall = t.afterToolCall
    }
    get sessionId() {
        return this._sessionId
    }
    set sessionId(t) {
        this._sessionId = t
    }
    get thinkingBudgets() {
        return this._thinkingBudgets
    }
    set thinkingBudgets(t) {
        this._thinkingBudgets = t
    }
    get transport() {
        return this._transport
    }
    setTransport(t) {
        this._transport = t
    }
    get maxRetryDelayMs() {
        return this._maxRetryDelayMs
    }
    set maxRetryDelayMs(t) {
        this._maxRetryDelayMs = t
    }
    get toolExecution() {
        return this._toolExecution
    }
    setToolExecution(t) {
        this._toolExecution = t
    }
    setBeforeToolCall(t) {
        this._beforeToolCall = t
    }
    setAfterToolCall(t) {
        this._afterToolCall = t
    }
    get state() {
        return this._state
    }
    subscribe(t) {
        return this.listeners.add(t),
        () => this.listeners.delete(t)
    }
    setSystemPrompt(t) {
        this._state.systemPrompt = t
    }
    setModel(t) {
        this._state.model = t
    }
    setThinkingLevel(t) {
        this._state.thinkingLevel = t
    }
    setSteeringMode(t) {
        this.steeringMode = t
    }
    getSteeringMode() {
        return this.steeringMode
    }
    setFollowUpMode(t) {
        this.followUpMode = t
    }
    getFollowUpMode() {
        return this.followUpMode
    }
    setTools(t) {
        this._state.tools = t
    }
    replaceMessages(t) {
        this._state.messages = t.slice()
    }
    appendMessage(t) {
        this._state.messages = [...this._state.messages, t]
    }
    steer(t) {
        this.steeringQueue.push(t)
    }
    followUp(t) {
        this.followUpQueue.push(t)
    }
    clearSteeringQueue() {
        this.steeringQueue = []
    }
    clearFollowUpQueue() {
        this.followUpQueue = []
    }
    clearAllQueues() {
        this.steeringQueue = [],
        this.followUpQueue = []
    }
    hasQueuedMessages() {
        return this.steeringQueue.length > 0 || this.followUpQueue.length > 0
    }
    dequeueSteeringMessages() {
        if (this.steeringMode === "one-at-a-time") {
            if (this.steeringQueue.length > 0) {
                const r = this.steeringQueue[0];
                return this.steeringQueue = this.steeringQueue.slice(1),
                [r]
            }
            return []
        }
        const t = this.steeringQueue.slice();
        return this.steeringQueue = [],
        t
    }
    dequeueFollowUpMessages() {
        if (this.followUpMode === "one-at-a-time") {
            if (this.followUpQueue.length > 0) {
                const r = this.followUpQueue[0];
                return this.followUpQueue = this.followUpQueue.slice(1),
                [r]
            }
            return []
        }
        const t = this.followUpQueue.slice();
        return this.followUpQueue = [],
        t
    }
    clearMessages() {
        this._state.messages = []
    }
    abort() {
        this.abortController?.abort()
    }
    waitForIdle() {
        return this.runningPrompt ?? Promise.resolve()
    }
    reset() {
        this._state.messages = [],
        this._state.isStreaming = !1,
        this._state.streamMessage = null,
        this._state.pendingToolCalls = new Set,
        this._state.error = void 0,
        this.steeringQueue = [],
        this.followUpQueue = []
    }
    async prompt(t, r) {
        if (this._state.isStreaming)
            throw new Error("Agent is already processing a prompt. Use steer() or followUp() to queue messages, or wait for completion.");
        if (!this._state.model)
            throw new Error("No model configured");
        let a;
        if (Array.isArray(t))
            a = t;
        else if (typeof t == "string") {
            const s = [{
                type: "text",
                text: t
            }];
            r && r.length > 0 && s.push(...r),
            a = [{
                role: "user",
                content: s,
                timestamp: Date.now()
            }]
        } else
            a = [t];
        await this._runLoop(a)
    }
    async continue() {
        if (this._state.isStreaming)
            throw new Error("Agent is already processing. Wait for completion before continuing.");
        const t = this._state.messages;
        if (t.length === 0)
            throw new Error("No messages to continue from");
        if (t[t.length - 1].role === "assistant") {
            const r = this.dequeueSteeringMessages();
            if (r.length > 0) {
                await this._runLoop(r, {
                    skipInitialSteeringPoll: !0
                });
                return
            }
            const n = this.dequeueFollowUpMessages();
            if (n.length > 0) {
                await this._runLoop(n);
                return
            }
            throw new Error("Cannot continue from message role: assistant")
        }
        await this._runLoop(void 0)
    }
    _processLoopEvent(t) {
        switch (t.type) {
        case "message_start":
            this._state.streamMessage = t.message;
            break;
        case "message_update":
            this._state.streamMessage = t.message;
            break;
        case "message_end":
            this._state.streamMessage = null,
            this.appendMessage(t.message);
            break;
        case "tool_execution_start":
            {
                const r = new Set(this._state.pendingToolCalls);
                r.add(t.toolCallId),
                this._state.pendingToolCalls = r;
                break
            }
        case "tool_execution_end":
            {
                const r = new Set(this._state.pendingToolCalls);
                r.delete(t.toolCallId),
                this._state.pendingToolCalls = r;
                break
            }
        case "turn_end":
            t.message.role === "assistant" && t.message.errorMessage && (this._state.error = t.message.errorMessage);
            break;
        case "agent_end":
            this._state.isStreaming = !1,
            this._state.streamMessage = null;
            break
        }
        this.emit(t)
    }
    async _runLoop(t, r) {
        const n = this._state.model;
        if (!n)
            throw new Error("No model configured");
        this.runningPrompt = new Promise(u => {
            this.resolveRunningPrompt = u
        }
        ),
        this.abortController = new AbortController,
        this._state.isStreaming = !0,
        this._state.streamMessage = null,
        this._state.error = void 0;
        const a = this._state.thinkingLevel === "off" ? void 0 : this._state.thinkingLevel
          , s = {
            systemPrompt: this._state.systemPrompt,
            messages: this._state.messages.slice(),
            tools: this._state.tools
        };
        let o = r?.skipInitialSteeringPoll === !0;
        const l = {
            model: n,
            reasoning: a,
            sessionId: this._sessionId,
            onPayload: this._onPayload,
            transport: this._transport,
            thinkingBudgets: this._thinkingBudgets,
            maxRetryDelayMs: this._maxRetryDelayMs,
            toolExecution: this._toolExecution,
            beforeToolCall: this._beforeToolCall,
            afterToolCall: this._afterToolCall,
            convertToLlm: this.convertToLlm,
            transformContext: this.transformContext,
            getApiKey: this.getApiKey,
            getSteeringMessages: async () => o ? (o = !1,
            []) : this.dequeueSteeringMessages(),
            getFollowUpMessages: async () => this.dequeueFollowUpMessages()
        };
        try {
            t ? await runAgentLoop(t, s, l, async u => this._processLoopEvent(u), this.abortController.signal, this.streamFn) : await runAgentLoopContinue(s, l, async u => this._processLoopEvent(u), this.abortController.signal, this.streamFn)
        } catch (u) {
            const c = {
                role: "assistant",
                content: [{
                    type: "text",
                    text: ""
                }],
                api: n.api,
                provider: n.provider,
                model: n.id,
                usage: {
                    input: 0,
                    output: 0,
                    cacheRead: 0,
                    cacheWrite: 0,
                    totalTokens: 0,
                    cost: {
                        input: 0,
                        output: 0,
                        cacheRead: 0,
                        cacheWrite: 0,
                        total: 0
                    }
                },
                stopReason: this.abortController?.signal.aborted ? "aborted" : "error",
                errorMessage: u?.message || String(u),
                timestamp: Date.now()
            };
            this.appendMessage(c),
            this._state.error = u?.message || String(u),
            this.emit({
                type: "agent_end",
                messages: [c]
            })
        } finally {
            this._state.isStreaming = !1,
            this._state.streamMessage = null,
            this._state.pendingToolCalls = new Set,
            this.abortController = void 0,
            this.resolveRunningPrompt?.(),
            this.runningPrompt = void 0,
            this.resolveRunningPrompt = void 0
        }
    }
    emit(t) {
        for (const r of this.listeners)
            r(t)
    }
}
const WORKSPACE_REQUEST = "WORKSPACE_REQUEST"
  , WORKSPACE_RESPONSE = "WORKSPACE_RESPONSE";
function isWorkspaceRequest(e) {
    if (!e || typeof e != "object")
        return !1;
    const t = e;
    return t.type !== WORKSPACE_REQUEST || typeof t.id != "string" ? !1 : t.operation === "status" || t.operation === "sheets.createSpreadsheet" || t.operation === "sheets.getSpreadsheet" || t.operation === "sheets.listSheets" || t.operation === "sheets.requestAccess" || t.operation === "sheets.readRange" || t.operation === "sheets.batchRead" || t.operation === "sheets.writeRange" || t.operation === "sheets.batchWrite" || t.operation === "sheets.appendRows" || t.operation === "sheets.clearRange" || t.operation === "sheets.batchClear" || t.operation === "sheets.batchUpdate"
}
const API_BASE_URL$8 = "https://www.dobrowser.io";
async function requestSheetsAccess(e) {
    const t = chrome.runtime?.id;
    if (!t)
        throw new Error("Chrome extension runtime is unavailable.");
    const r = new URLSearchParams({
        extensionId: t,
        source: e?.source ?? "agent"
    });
    e?.spreadsheetId && r.set("spreadsheetId", e.spreadsheetId);
    const n = `${API_BASE_URL$8}/auth/extension-sheets?${r.toString()}`;
    return await chrome.tabs.create({
        url: n
    }),
    {
        opened: !0,
        url: n
    }
}
async function handleWorkspaceRequest(e) {
    try {
        switch (e.operation) {
        case "status":
            {
                const t = await redoClient.workspace.status.get();
                return {
                    type: WORKSPACE_RESPONSE,
                    id: e.id,
                    success: !0,
                    result: t
                }
            }
        case "sheets.createSpreadsheet":
            {
                const t = await redoClient.workspace.sheets.createSpreadsheet(e.input);
                return {
                    type: WORKSPACE_RESPONSE,
                    id: e.id,
                    success: !0,
                    result: t
                }
            }
        case "sheets.getSpreadsheet":
            {
                const t = await redoClient.workspace.sheets.getSpreadsheet(e.input);
                return {
                    type: WORKSPACE_RESPONSE,
                    id: e.id,
                    success: !0,
                    result: t
                }
            }
        case "sheets.listSheets":
            {
                const t = await redoClient.workspace.sheets.listSheets(e.input);
                return {
                    type: WORKSPACE_RESPONSE,
                    id: e.id,
                    success: !0,
                    result: t
                }
            }
        case "sheets.requestAccess":
            {
                const t = await requestSheetsAccess(e.input);
                return {
                    type: WORKSPACE_RESPONSE,
                    id: e.id,
                    success: !0,
                    result: t
                }
            }
        case "sheets.readRange":
            {
                const t = await redoClient.workspace.sheets.readRange(e.input);
                return {
                    type: WORKSPACE_RESPONSE,
                    id: e.id,
                    success: !0,
                    result: t
                }
            }
        case "sheets.batchRead":
            {
                const t = await redoClient.workspace.sheets.batchRead(e.input);
                return {
                    type: WORKSPACE_RESPONSE,
                    id: e.id,
                    success: !0,
                    result: t
                }
            }
        case "sheets.writeRange":
            {
                const t = await redoClient.workspace.sheets.writeRange(e.input);
                return {
                    type: WORKSPACE_RESPONSE,
                    id: e.id,
                    success: !0,
                    result: t
                }
            }
        case "sheets.batchWrite":
            {
                const t = await redoClient.workspace.sheets.batchWrite(e.input);
                return {
                    type: WORKSPACE_RESPONSE,
                    id: e.id,
                    success: !0,
                    result: t
                }
            }
        case "sheets.appendRows":
            {
                const t = await redoClient.workspace.sheets.appendRows(e.input);
                return {
                    type: WORKSPACE_RESPONSE,
                    id: e.id,
                    success: !0,
                    result: t
                }
            }
        case "sheets.clearRange":
            {
                const t = await redoClient.workspace.sheets.clearRange(e.input);
                return {
                    type: WORKSPACE_RESPONSE,
                    id: e.id,
                    success: !0,
                    result: t
                }
            }
        case "sheets.batchClear":
            {
                const t = await redoClient.workspace.sheets.batchClear(e.input);
                return {
                    type: WORKSPACE_RESPONSE,
                    id: e.id,
                    success: !0,
                    result: t
                }
            }
        case "sheets.batchUpdate":
            {
                const t = await redoClient.workspace.sheets.batchUpdate(e.input);
                return {
                    type: WORKSPACE_RESPONSE,
                    id: e.id,
                    success: !0,
                    result: t
                }
            }
        }
    } catch (t) {
        return {
            type: WORKSPACE_RESPONSE,
            id: e.id,
            success: !1,
            error: t instanceof Error ? t.message : String(t)
        }
    }
}
const log$b = logger.scoped("CdpHandler")
  , MAX_IMAGE_DIMENSION = 1568
  , WEBP_QUALITY = .82;
class CdpHandler {
    iframe;
    deps;
    attachedTabId = null;
    webpEncodingSupported = null;
    getAttachedTabId() {
        return this.attachedTabId
    }
    pending = new Map;
    tabTargetInfo = {
        targetId: "tabTargetId",
        type: "tab",
        title: "tab",
        url: "about:blank",
        attached: !1,
        canAccessOpener: !1
    };
    pageTargetInfo = {
        targetId: "pageTargetId",
        type: "page",
        title: "page",
        url: "about:blank",
        attached: !1,
        canAccessOpener: !1
    };
    boundHandleSandboxMessage;
    boundHandleCdpEvent;
    boundHandleCdpDetach;
    static GLOW_ELEMENT_ID = "redo-active-glow";
    glowScriptId = null;
    glowPingTimer = null;
    constructor(t, r) {
        this.iframe = t,
        this.deps = r,
        this.boundHandleSandboxMessage = this.handleSandboxMessage.bind(this),
        this.boundHandleCdpEvent = this.handleCdpEvent.bind(this),
        this.boundHandleCdpDetach = this.handleCdpDetach.bind(this),
        window.addEventListener("message", this.boundHandleSandboxMessage),
        chrome.debugger.onEvent.addListener(this.boundHandleCdpEvent),
        chrome.debugger.onDetach.addListener(this.boundHandleCdpDetach)
    }
    cleanup() {
        window.removeEventListener("message", this.boundHandleSandboxMessage),
        chrome.debugger.onEvent.removeListener(this.boundHandleCdpEvent),
        chrome.debugger.onDetach.removeListener(this.boundHandleCdpDetach);
        for (const [t,r] of this.pending)
            clearTimeout(r.timer),
            r.reject(new Error("CdpHandler destroyed")),
            this.pending.delete(t);
        if (this.attachedTabId) {
            const t = this.attachedTabId;
            this.attachedTabId = null,
            this.stopGlowHeartbeat(),
            this.removeGlowEffect(t).finally( () => {
                chrome.debugger.detach({
                    tabId: t
                }).catch( () => {}
                )
            }
            )
        }
    }
    detachDebugger() {
        if (log$b.log("detachDebugger called, attachedTabId:", this.attachedTabId),
        this.attachedTabId) {
            const t = this.attachedTabId;
            this.attachedTabId = null,
            this.stopGlowHeartbeat(),
            log$b.log("Sending CDP_CLOSE to sandbox for tab:", t),
            this.iframe.contentWindow?.postMessage({
                type: "CDP_CLOSE",
                tabId: t,
                reason: "Debugger detached by cleanup"
            }, "*"),
            this.removeGlowEffect(t).finally( () => chrome.debugger.detach({
                tabId: t
            })).then( () => log$b.log("Debugger detached successfully from tab:", t)).catch(r => log$b.log("Debugger detach error:", r))
        }
    }
    execInSandbox(t, r) {
        return new Promise( (n, a) => {
            const s = crypto.randomUUID();
            log$b.log("execInSandbox called, id:", s, "timeout:", r);
            const o = r ?? 3e4
              , l = setTimeout( () => {
                this.pending.has(s) && (log$b.log("execInSandbox timeout, id:", s),
                this.pending.delete(s),
                a(new Error("Execution timeout")))
            }
            , o + 1e3);
            this.pending.set(s, {
                resolve: u => {
                    log$b.log("execInSandbox resolved, id:", s),
                    clearTimeout(l),
                    n(u)
                }
                ,
                reject: u => {
                    clearTimeout(l),
                    a(u)
                }
                ,
                timer: l
            }),
            log$b.log("[CdpHandler] Posting EVAL_REQUEST to sandbox, iframe:", !!this.iframe, "contentWindow:", !!this.iframe.contentWindow),
            this.iframe.contentWindow?.postMessage({
                type: "EVAL_REQUEST",
                id: s,
                code: t,
                timeout: o
            }, "*")
        }
        )
    }
    abortExecution() {
        log$b.log("abortExecution called, pending requests:", this.pending.size),
        this.iframe.contentWindow?.postMessage({
            type: "ABORT"
        }, "*");
        for (const [t,r] of this.pending)
            log$b.log("Aborting eval request:", t),
            clearTimeout(r.timer),
            r.reject(new DOMException("Execution aborted by user","AbortError"));
        this.pending.clear()
    }
    waitForSandboxReady() {
        return new Promise(t => {
            log$b.log("waitForSandboxReady called");
            const r = n => {
                log$b.log("[CdpHandler] Received message:", n.data?.type, "from:", n.source === this.iframe.contentWindow ? "sandbox" : "other"),
                n.data?.type === "SANDBOX_READY" && (log$b.log("SANDBOX_READY received, resolving"),
                window.removeEventListener("message", r),
                t())
            }
            ;
            window.addEventListener("message", r),
            log$b.log("[CdpHandler] Sending SANDBOX_PING, iframe:", !!this.iframe, "contentWindow:", !!this.iframe.contentWindow),
            this.iframe.contentWindow?.postMessage({
                type: "SANDBOX_PING"
            }, "*")
        }
        )
    }
    getGlowInjectionScript() {
        const t = CdpHandler.GLOW_ELEMENT_ID;
        return `
      (function() {
        // Only inject in the top-level frame, not iframes
        if (window.self !== window.top) return;
        if (document.getElementById('${t}')) return;

        function removeGlow() {
          const overlay = document.getElementById('${t}');
          const style = document.getElementById('${t}-style');
          if (overlay) overlay.remove();
          if (style) style.remove();

          const state = window.__redoGlowState;
          if (state?.monitor) clearInterval(state.monitor);
          if (window.__redoGlowState) delete window.__redoGlowState;
          if (window.__redoGlowPing) delete window.__redoGlowPing;
        }

        function inject() {
          if (document.getElementById('${t}')) return;

          // Track last ping to auto-remove on disconnect
          const state = (window.__redoGlowState ||= {
            lastPing: Date.now(),
            monitor: null,
          });
          state.lastPing = Date.now();

          // Create keyframes for smooth glow animation
          const style = document.createElement('style');
          style.id = '${t}-style';
          style.textContent = \`
            @keyframes redo-glow {
              0%, 100% {
                opacity: 0.6;
              }
              50% {
                opacity: 1;
              }
            }
          \`;

          // Create overlay div with soft glow effect
          const overlay = document.createElement('div');
          overlay.id = '${t}';
          overlay.style.cssText = \`
            position: fixed !important;
            inset: 0 !important;
            pointer-events: none !important;
            z-index: 2147483647 !important;
            border: none !important;
            box-shadow:
              inset 0 0 60px 20px rgba(99, 102, 241, 0.4),
              inset 0 0 100px 40px rgba(99, 102, 241, 0.2),
              inset 0 0 140px 60px rgba(99, 102, 241, 0.1) !important;
            animation: redo-glow 3s ease-in-out infinite !important;
          \`;

          document.documentElement.appendChild(style);
          document.documentElement.appendChild(overlay);

          if (!state.monitor) {
            state.monitor = setInterval(() => {
              if (Date.now() - state.lastPing > 10000) {
                removeGlow();
              }
            }, 2000);
          }

          window.__redoGlowPing = () => {
            if (window.__redoGlowState) {
              window.__redoGlowState.lastPing = Date.now();
            }
          };
        }

        // Try immediately, or wait for DOM
        if (document.documentElement) {
          inject();
        } else {
          document.addEventListener('DOMContentLoaded', inject);
        }
      })();
    `
    }
    async injectGlowEffect(t) {
        const r = this.getGlowInjectionScript();
        try {
            await chrome.debugger.sendCommand({
                tabId: t
            }, "Page.enable");
            const n = await chrome.debugger.sendCommand({
                tabId: t
            }, "Page.addScriptToEvaluateOnNewDocument", {
                source: r
            });
            this.glowScriptId = n.identifier,
            log$b.log("Glow script registered with id:", this.glowScriptId),
            await chrome.debugger.sendCommand({
                tabId: t
            }, "Runtime.evaluate", {
                expression: r
            }),
            log$b.log("Glow effect injected for tab:", t),
            this.startGlowHeartbeat(t)
        } catch (n) {
            log$b.log("Failed to inject glow effect:", n)
        }
    }
    async removeGlowEffect(t) {
        try {
            this.stopGlowHeartbeat(),
            this.glowScriptId && (await chrome.debugger.sendCommand({
                tabId: t
            }, "Page.removeScriptToEvaluateOnNewDocument", {
                identifier: this.glowScriptId
            }),
            this.glowScriptId = null);
            const r = CdpHandler.GLOW_ELEMENT_ID
              , n = `
        (function() {
          const overlay = document.getElementById('${r}');
          const style = document.getElementById('${r}-style');
          if (overlay) overlay.remove();
          if (style) style.remove();
          if (window.__redoGlowState?.monitor) clearInterval(window.__redoGlowState.monitor);
          if (window.__redoGlowState) delete window.__redoGlowState;
          if (window.__redoGlowPing) delete window.__redoGlowPing;
        })();
      `;
            await chrome.debugger.sendCommand({
                tabId: t
            }, "Runtime.evaluate", {
                expression: n
            }),
            log$b.log("Glow effect removed for tab:", t)
        } catch (r) {
            log$b.log("Failed to remove glow effect:", r)
        }
    }
    startGlowHeartbeat(t) {
        this.stopGlowHeartbeat();
        const r = async () => {
            if (this.attachedTabId !== t) {
                this.stopGlowHeartbeat();
                return
            }
            try {
                await chrome.debugger.sendCommand({
                    tabId: t
                }, "Runtime.evaluate", {
                    expression: "window.__redoGlowPing && window.__redoGlowPing()"
                })
            } catch (n) {
                log$b.log("Glow heartbeat stopped:", n),
                this.stopGlowHeartbeat()
            }
        }
        ;
        r(),
        this.glowPingTimer = setInterval(r, 3e3)
    }
    stopGlowHeartbeat() {
        this.glowPingTimer && (clearInterval(this.glowPingTimer),
        this.glowPingTimer = null)
    }
    async handleSandboxMessage(t) {
        const r = t.data
          , n = ["CDP_REQUEST", "CDP_ATTACH", "CDP_DETACH", "LIST_TABS_REQUEST", "CREATE_TAB_REQUEST", "CLOSE_TAB_REQUEST", "ACTIVATE_TAB_REQUEST", "EVAL_RESULT", "SANDBOX_READY", "FS_READ_REQUEST", "FS_WRITE_REQUEST", "FS_LIST_REQUEST", "FS_DELETE_REQUEST", "FS_MKDIR_REQUEST", "FS_EXISTS_REQUEST", "FS_STAT_REQUEST", "BASH_REQUEST", "WORKSPACE_REQUEST"];
        if (!(!r?.type || !n.includes(r.type)))
            if (log$b.log("handleSandboxMessage:", r.type),
            r?.type === "CDP_REQUEST") {
                const a = r.tabId ?? this.attachedTabId
                  , s = await this.handleCdpCommand(r.payload, a);
                this.iframe.contentWindow?.postMessage({
                    type: "CDP_RESPONSE",
                    tabId: a,
                    payload: s
                }, "*")
            } else if (r?.type === "CDP_ATTACH")
                try {
                    const a = await this.handleCdpAttach(r.tabId);
                    this.iframe.contentWindow?.postMessage({
                        type: "CDP_ATTACH_RESPONSE",
                        id: r.id,
                        success: !0,
                        tabId: a.tabId
                    }, "*")
                } catch (a) {
                    this.iframe.contentWindow?.postMessage({
                        type: "CDP_ATTACH_RESPONSE",
                        id: r.id,
                        success: !1,
                        error: a instanceof Error ? a.message : String(a)
                    }, "*")
                }
            else if (r?.type === "CDP_DETACH") {
                const a = r.tabId ?? this.attachedTabId;
                a && (await chrome.debugger.detach({
                    tabId: a
                }).catch( () => {}
                ),
                this.attachedTabId === a && (this.attachedTabId = null))
            } else
                r?.type === "LIST_TABS_REQUEST" ? await this.handleListTabsRequest(r.id) : r?.type === "CREATE_TAB_REQUEST" ? await this.handleCreateTabRequest(r.id, r.url) : r?.type === "CLOSE_TAB_REQUEST" ? await this.handleCloseTabRequest(r.id, r.tabId) : r?.type === "ACTIVATE_TAB_REQUEST" ? await this.handleActivateTabRequest(r.id, r.tabId) : r?.type === "EVAL_RESULT" ? await this.handleEvalResult(r) : isWorkspaceRequest(r) ? await this.handleWorkspaceRequest(r) : isRequest(r) && await this.handleFsOrBashRequest(r)
    }
    handleCdpEvent(t, r, n) {
        t.tabId === this.attachedTabId && this.iframe.contentWindow?.postMessage({
            type: "CDP_EVENT",
            tabId: t.tabId,
            payload: {
                sessionId: t.sessionId ?? "pageTargetSessionId",
                method: r,
                params: n
            }
        }, "*")
    }
    handleCdpDetach(t) {
        if (log$b.log("[CdpHandler] handleCdpDetach called, source.tabId:", t.tabId, "attachedTabId:", this.attachedTabId),
        t.tabId === this.attachedTabId) {
            this.stopGlowHeartbeat();
            const r = this.attachedTabId;
            this.attachedTabId = null,
            log$b.log("Sending CDP_CLOSE from handleCdpDetach for tab:", r),
            this.iframe.contentWindow?.postMessage({
                type: "CDP_CLOSE",
                tabId: r,
                reason: "Debugger detached"
            }, "*")
        } else
            log$b.log("handleCdpDetach: tabId mismatch, not sending CDP_CLOSE")
    }
    async isBackgroundModeActive() {
        return await isGroupAgentTabsEnabled() && await hasTabGroupsPermission()
    }
    async maybeApplyBackgroundMode(t) {
        await this.isBackgroundModeActive() && await ensureAgentTabGroup(t).catch(r => {
            log$b.warn("Failed to apply Background Mode to agent tab:", r)
        }
        )
    }
    async maybeApplyBackgroundModeByTabId(t) {
        if (await this.isBackgroundModeActive())
            try {
                const r = await chrome.tabs.get(t);
                await ensureAgentTabGroup(r)
            } catch (r) {
                log$b.warn("Failed to apply Background Mode to agent tab:", r)
            }
    }
    async handleCdpAttach(t) {
        log$b.log("handleCdpAttach called, tabId:", t);
        const r = t ?? (await chrome.tabs.query({
            active: !0,
            currentWindow: !0
        }))[0]?.id;
        if (!r)
            throw log$b.log("handleCdpAttach: No active tab"),
            new Error("No active tab");
        return log$b.log("[CdpHandler] handleCdpAttach targetTabId:", r, "attachedTabId:", this.attachedTabId),
        this.attachedTabId !== r && (this.attachedTabId && (log$b.log("Detaching from previous tab:", this.attachedTabId),
        await this.removeGlowEffect(this.attachedTabId),
        await chrome.debugger.detach({
            tabId: this.attachedTabId
        }).catch( () => {}
        )),
        log$b.log("Attaching to tab:", r),
        await chrome.debugger.attach({
            tabId: r
        }, "1.3"),
        log$b.log("Attached successfully"),
        this.attachedTabId = r,
        await this.maybeApplyBackgroundModeByTabId(r),
        await this.injectGlowEffect(r)),
        {
            tabId: r
        }
    }
    dispatchCdpResponse(t, r) {
        this.iframe.contentWindow?.postMessage({
            type: "CDP_RESPONSE",
            tabId: t,
            payload: r
        }, "*")
    }
    dispatchCdpEvent(t, r) {
        this.iframe.contentWindow?.postMessage({
            type: "CDP_EVENT",
            tabId: t,
            payload: r
        }, "*")
    }
    async handleCdpCommand(t, r) {
        switch (log$b.log("[CdpHandler] handleCdpCommand:", t.method, "sessionId:", t.sessionId, "tabId:", r),
        t.method) {
        case "Browser.getVersion":
            return {
                id: t.id,
                sessionId: t.sessionId,
                result: {
                    protocolVersion: "1.3",
                    product: "chrome",
                    revision: "unknown",
                    userAgent: navigator.userAgent,
                    jsVersion: "unknown"
                }
            };
        case "Target.getBrowserContexts":
            return {
                id: t.id,
                sessionId: t.sessionId,
                result: {
                    browserContextIds: []
                }
            };
        case "Target.setDiscoverTargets":
            return setTimeout( () => {
                this.dispatchCdpEvent(r, {
                    method: "Target.targetCreated",
                    params: {
                        targetInfo: this.tabTargetInfo
                    }
                }),
                this.dispatchCdpEvent(r, {
                    method: "Target.targetCreated",
                    params: {
                        targetInfo: this.pageTargetInfo
                    }
                })
            }
            , 0),
            {
                id: t.id,
                sessionId: t.sessionId,
                result: {}
            };
        case "Target.setAutoAttach":
            {
                if (t.sessionId === "tabTargetSessionId")
                    return setTimeout( () => {
                        this.dispatchCdpEvent(r, {
                            method: "Target.attachedToTarget",
                            sessionId: "tabTargetSessionId",
                            params: {
                                targetInfo: this.pageTargetInfo,
                                sessionId: "pageTargetSessionId"
                            }
                        })
                    }
                    , 0),
                    {
                        id: t.id,
                        sessionId: t.sessionId,
                        result: {}
                    };
                if (!t.sessionId)
                    return setTimeout( () => {
                        this.dispatchCdpEvent(r, {
                            method: "Target.attachedToTarget",
                            params: {
                                targetInfo: this.tabTargetInfo,
                                sessionId: "tabTargetSessionId"
                            }
                        })
                    }
                    , 0),
                    {
                        id: t.id,
                        sessionId: t.sessionId,
                        result: {}
                    };
                break
            }
        }
        if (!this.attachedTabId)
            try {
                await this.handleCdpAttach(r ?? void 0)
            } catch (s) {
                return {
                    id: t.id,
                    sessionId: t.sessionId,
                    error: {
                        message: s instanceof Error ? s.message : String(s)
                    }
                }
            }
        const n = t.sessionId === "pageTargetSessionId" ? void 0 : t.sessionId
          , a = {
            tabId: this.attachedTabId,
            sessionId: n
        };
        try {
            const s = await chrome.debugger.sendCommand(a, t.method, t.params);
            return {
                id: t.id,
                sessionId: t.sessionId ?? "pageTargetSessionId",
                result: s
            }
        } catch (s) {
            const o = s;
            return {
                id: t.id,
                sessionId: t.sessionId ?? "pageTargetSessionId",
                error: {
                    code: o?.code,
                    data: o?.data,
                    message: o?.message ?? "CDP error had no message"
                }
            }
        }
    }
    async handleListTabsRequest(t) {
        try {
            const n = (await chrome.tabs.query({
                currentWindow: !0
            })).map(a => ({
                id: a.id,
                title: a.title,
                url: a.url,
                active: a.active
            }));
            this.iframe.contentWindow?.postMessage({
                type: "LIST_TABS_RESPONSE",
                id: t,
                success: !0,
                tabs: n
            }, "*")
        } catch (r) {
            this.iframe.contentWindow?.postMessage({
                type: "LIST_TABS_RESPONSE",
                id: t,
                success: !1,
                error: r instanceof Error ? r.message : String(r)
            }, "*")
        }
    }
    async handleCreateTabRequest(t, r) {
        try {
            const n = await this.isBackgroundModeActive()
              , a = await chrome.tabs.create({
                url: r || "about:blank",
                active: !n
            });
            await this.maybeApplyBackgroundMode(a),
            this.iframe.contentWindow?.postMessage({
                type: "CREATE_TAB_RESPONSE",
                id: t,
                success: !0,
                tab: {
                    id: a.id,
                    title: a.title || "",
                    url: a.url || r || "about:blank",
                    active: a.active ?? !1
                }
            }, "*")
        } catch (n) {
            this.iframe.contentWindow?.postMessage({
                type: "CREATE_TAB_RESPONSE",
                id: t,
                success: !1,
                error: n instanceof Error ? n.message : String(n)
            }, "*")
        }
    }
    async handleCloseTabRequest(t, r) {
        try {
            this.attachedTabId === r && (await chrome.debugger.detach({
                tabId: r
            }).catch( () => {}
            ),
            this.attachedTabId = null,
            this.iframe.contentWindow?.postMessage({
                type: "CDP_CLOSE",
                tabId: r,
                reason: "Tab closed by closeTab()"
            }, "*")),
            await chrome.tabs.remove(r),
            this.iframe.contentWindow?.postMessage({
                type: "CLOSE_TAB_RESPONSE",
                id: t,
                success: !0
            }, "*")
        } catch (n) {
            this.iframe.contentWindow?.postMessage({
                type: "CLOSE_TAB_RESPONSE",
                id: t,
                success: !1,
                error: n instanceof Error ? n.message : String(n)
            }, "*")
        }
    }
    async handleActivateTabRequest(t, r) {
        try {
            await this.isBackgroundModeActive() ? await this.maybeApplyBackgroundModeByTabId(r) : await chrome.tabs.update(r, {
                active: !0
            }),
            this.iframe.contentWindow?.postMessage({
                type: "ACTIVATE_TAB_RESPONSE",
                id: t,
                success: !0
            }, "*")
        } catch (n) {
            this.iframe.contentWindow?.postMessage({
                type: "ACTIVATE_TAB_RESPONSE",
                id: t,
                success: !1,
                error: n instanceof Error ? n.message : String(n)
            }, "*")
        }
    }
    async handleEvalResult(t) {
        const r = this.pending.get(t.id);
        if (r) {
            this.pending.delete(t.id);
            const n = t.images ?? []
              , a = await this.encodeImagesAsWebp(n);
            r.resolve({
                output: t.output,
                hasError: t.hasError,
                images: a,
                aborted: t.aborted
            })
        }
    }
    async encodeImagesAsWebp(t) {
        if (t.length === 0)
            return [];
        if (this.webpEncodingSupported === !1)
            return this.asPngImages(t);
        if (typeof document > "u" || typeof Image > "u")
            return this.webpEncodingSupported = !1,
            this.asPngImages(t);
        const r = [];
        for (const n of t) {
            const a = await this.convertBase64PngToWebp(n);
            if (!a)
                return this.webpEncodingSupported = !1,
                this.asPngImages(t);
            const s = this.base64ByteLength(n)
              , o = this.base64ByteLength(a)
              , l = s > 0 ? (o - s) / s * 100 : 0;
            log$b.log(`[CdpHandler] logImage compress: png ${s} bytes -> webp ${o} bytes (${l.toFixed(1)}%)`),
            r.push({
                data: a,
                mediaType: "image/webp"
            })
        }
        return this.webpEncodingSupported = !0,
        r
    }
    asPngImages(t) {
        return t.map(r => ({
            data: r,
            mediaType: "image/png"
        }))
    }
    async convertBase64PngToWebp(t) {
        if (!t)
            return null;
        try {
            const r = `data:image/png;base64,${t}`
              , n = new Image;
            n.decoding = "async";
            const a = new Promise( (f, h) => {
                n.onload = () => f(),
                n.onerror = () => h(new Error("Failed to decode image"))
            }
            );
            n.src = r,
            await a;
            const s = n.naturalWidth || n.width
              , o = n.naturalHeight || n.height;
            if (!s || !o)
                return null;
            const l = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(s, o))
              , u = Math.max(1, Math.round(s * l))
              , c = Math.max(1, Math.round(o * l))
              , p = document.createElement("canvas");
            p.width = u,
            p.height = c;
            const d = p.getContext("2d");
            return d ? (d.imageSmoothingEnabled = !0,
            d.imageSmoothingQuality = "high",
            d.drawImage(n, 0, 0, u, c),
            this.encodeCanvasAsBase64Webp(p)) : null
        } catch (r) {
            return log$b.warn("Failed to encode image as webp:", r),
            null
        }
    }
    async encodeCanvasAsBase64Webp(t) {
        if (typeof t.toBlob == "function") {
            const r = await new Promise(n => {
                t.toBlob(n, "image/webp", WEBP_QUALITY)
            }
            );
            if (r) {
                const n = await this.readBlobAsBase64(r, "image/webp");
                if (n)
                    return n
            }
        }
        return this.extractBase64FromDataUrl(t.toDataURL("image/webp", WEBP_QUALITY), "image/webp")
    }
    async readBlobAsBase64(t, r) {
        if (typeof FileReader > "u")
            return null;
        const n = await new Promise( (a, s) => {
            const o = new FileReader;
            o.onload = () => a(typeof o.result == "string" ? o.result : null),
            o.onerror = () => s(o.error ?? new Error("Failed to read blob")),
            o.readAsDataURL(t)
        }
        );
        return this.extractBase64FromDataUrl(n, r)
    }
    extractBase64FromDataUrl(t, r) {
        const n = `data:${r};base64,`;
        return t?.startsWith(n) ? t.slice(n.length) : null
    }
    base64ByteLength(t) {
        const r = t.match(/=+$/)
          , n = r ? r[0].length : 0;
        return Math.max(0, Math.floor(t.length * 3 / 4 - n))
    }
    async handleWorkspaceRequest(t) {
        const r = await handleWorkspaceRequest(t);
        this.iframe.contentWindow?.postMessage(r, "*")
    }
    async handleFsOrBashRequest(t) {
        const r = this.deps.getFsInstance()
          , n = this.deps.getBashInstance();
        if (!r) {
            const s = t.type.replace("_REQUEST", "_RESPONSE");
            this.iframe.contentWindow?.postMessage({
                type: s,
                id: t.id,
                success: !1,
                error: "Filesystem not initialized"
            }, "*");
            return
        }
        const a = await handleFsRequest(t, {
            fs: r,
            bash: n ?? void 0
        });
        this.iframe.contentWindow?.postMessage(a, "*")
    }
}
const MAX_TOOL_OUTPUT_CHARS = 3e4
  , TAIL_CHARS = 2e3
  , TOOL_OUTPUT_DIR = "/tmp/tool-outputs"
  , TOOL_OUTPUT_TRUNCATED_MARKER = "[OUTPUT TRUNCATED]"
  , PAGE_SIZE = 200
  , SECTION_SEPARATOR = `

`
  , SECTION_CONTENT_SEPARATOR = `
`;
function sanitizeToolName(e) {
    return e.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-") || "tool"
}
function buildCapNotice(e, t) {
    return [`${TOOL_OUTPUT_TRUNCATED_MARKER} Full output (${t} chars) saved to ${e}.`, "Page through it with bash:", `sed -n '1,${PAGE_SIZE}p' "${e}"`, `sed -n '${PAGE_SIZE + 1},${PAGE_SIZE * 2}p' "${e}"`, `rg "pattern" "${e}"`].join(`
`)
}
function buildHeadSectionHeader(e) {
    return `[HEAD: first ${e} chars of output]`
}
function buildTailSectionHeader() {
    return `[TAIL: last ${TAIL_CHARS} chars of output]`
}
function buildTruncationSummary(e, t) {
    return `[... TRUNCATED (${t} chars total, saved to ${e}) ...]`
}
function buildTruncatedText(e, t, r) {
    const n = e.length
      , a = e.slice(-TAIL_CHARS)
      , s = buildTailSectionHeader()
      , o = buildTruncationSummary(t, n)
      , l = d => Math.max(0, MAX_TOOL_OUTPUT_CHARS - a.length - r.length - o.length - d.length - s.length - SECTION_CONTENT_SEPARATOR.length * 2 - SECTION_SEPARATOR.length * 3);
    let u = l(buildHeadSectionHeader(0));
    for (; ; ) {
        const d = l(buildHeadSectionHeader(u));
        if (d === u)
            break;
        u = d
    }
    let c = e.slice(0, u)
      , p = [`${buildHeadSectionHeader(c.length)}${SECTION_CONTENT_SEPARATOR}${c}`, o, `${s}${SECTION_CONTENT_SEPARATOR}${a}`, r].join(SECTION_SEPARATOR);
    return p.length > MAX_TOOL_OUTPUT_CHARS && (c = c.slice(0, Math.max(0, c.length - (p.length - MAX_TOOL_OUTPUT_CHARS))),
    p = [`${buildHeadSectionHeader(c.length)}${SECTION_CONTENT_SEPARATOR}${c}`, o, `${s}${SECTION_CONTENT_SEPARATOR}${a}`, r].join(SECTION_SEPARATOR)),
    p
}
function containsToolOutputCapNotice(e) {
    return e.includes(TOOL_OUTPUT_TRUNCATED_MARKER)
}
async function capToolOutput(e, t, r) {
    if (e.length <= MAX_TOOL_OUTPUT_CHARS)
        return {
            text: e,
            wasCapped: !1
        };
    const n = `${sanitizeToolName(t)}-${Date.now()}.txt`
      , a = `${TOOL_OUTPUT_DIR}/${n}`;
    await r.mkdir(TOOL_OUTPUT_DIR, {
        recursive: !0
    }),
    await r.writeFile(a, e, "utf-8");
    const s = buildCapNotice(a, e.length);
    return {
        text: buildTruncatedText(e, a, s),
        wasCapped: !0,
        savedPath: a
    }
}
const loadSkillParams = Type.Object({
    name: Type.String({
        description: 'The name of the skill to load (e.g., "flight-booking")'
    })
});
function createLoadSkillTool(e, t) {
    return {
        name: "loadSkill",
        label: "Load Skill",
        description: "Load a skill to gain its specialized capabilities. Use this when the task matches a skill's description from the <available_skills> list. Returns the skill instructions and its working directory path.",
        parameters: loadSkillParams,
        execute: async (r, n) => {
            try {
                const a = await e.loadSkill(n.name)
                  , s = `# Skill Loaded: ${n.name}

Working Directory: ${a.path}

---

${a.content}`;
                return {
                    content: [{
                        type: "text",
                        text: (await capToolOutput(s, "loadSkill", t)).text
                    }],
                    details: {
                        skillName: n.name
                    }
                }
            } catch (a) {
                const s = a instanceof Error ? a.message : "Unknown error";
                return {
                    content: [{
                        type: "text",
                        text: `Error loading skill: ${s}`
                    }],
                    details: {
                        error: s
                    }
                }
            }
        }
    }
}
const webSearchParams = Type.Object({
    query: Type.String({
        description: "The search query to find information about"
    }),
    numResults: Type.Optional(Type.Number({
        description: "Number of results to return (default: 5)"
    }))
});
function createWebSearchTool(e) {
    return {
        name: "webSearch",
        label: "Web Search",
        description: "Search the web for real-time information. Use this when you need current data, facts, documentation, or any information that may not be in your training data.",
        parameters: webSearchParams,
        execute: async (t, r) => {
            console.log("[web-search] Searching:", r.query);
            try {
                const n = await redoClient.webSearch.query({
                    query: r.query,
                    numResults: r.numResults
                });
                if (n.results.length === 0)
                    return {
                        content: [{
                            type: "text",
                            text: "No results found."
                        }],
                        details: {
                            resultCount: 0
                        }
                    };
                const a = n.results.map( (o, l) => `[${l + 1}] ${o.title}
    URL: ${o.url}
    ${o.text}`).join(`

`);
                return {
                    content: [{
                        type: "text",
                        text: (await capToolOutput(`Found ${n.results.length} results:

${a}`, "webSearch", e)).text
                    }],
                    details: {
                        resultCount: n.results.length
                    }
                }
            } catch (n) {
                console.error("[web-search] Error:", n);
                const a = n instanceof Error ? n.message : String(n);
                return {
                    content: [{
                        type: "text",
                        text: `Web search failed: ${a}`
                    }],
                    details: {
                        error: a
                    }
                }
            }
        }
    }
}
const DOCX_MIME_TYPE$1 = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  , DOC_PAID_PLAN_MESSAGE = "DOCX reading is only availible on the paid plan";
function getFilenameFromPath$2(e) {
    const t = e.trim();
    if (!t)
        throw new Error("DOCX path is required");
    const n = t.split("/").filter(Boolean).at(-1);
    if (!n)
        throw new Error("DOCX path must point to a file");
    return n
}
function inferMimeType$1(e, t) {
    return t?.trim() ? t : DOCX_MIME_TYPE$1
}
function formatDocAnswer(e) {
    if (e.answer) {
        const t = e.evidence.length > 0 ? e.evidence.map( (r, n) => {
            const a = r.section ? ` (${r.section})` : "";
            return `${n + 1}. ${r.snippet}${a}`
        }
        ).join(`
`) : "No evidence snippets returned.";
        return [`Answer: ${e.answer}`, "", "Evidence:", t, "", `Extracted characters: ${e.metadata.extractedChars}`].join(`
`)
    }
    return [`Extracted characters: ${e.metadata.extractedChars}`, "", "Extracted text:", e.content || "[No readable text extracted.]"].join(`
`)
}
async function readDocFromBrowser(e) {
    let t = e.file
      , r = e.fileName
      , n = e.mimeType;
    const a = e.path;
    if (a) {
        const o = await (await getUnifiedFsInstance()).readFileBuffer(a)
          , l = new Uint8Array(o.byteLength);
        l.set(o),
        r = getFilenameFromPath$2(a),
        n = inferMimeType$1(r, n),
        t = new Blob([l.buffer],{
            type: n
        })
    }
    if (!t)
        throw new Error("DOCX input is required");
    if (!r)
        throw new Error("DOCX filename is required");
    if (t.size === 0)
        throw new Error("DOCX file is empty");
    return redoClient.doc.read({
        file: t,
        fileName: r,
        mimeType: inferMimeType$1(r, n),
        ...e.query ? {
            query: e.query
        } : {},
        ...e.extractOnly ? {
            extractOnly: !0
        } : {}
    })
}
const PDF_PAID_PLAN_MESSAGE = "PDF reading is only availible on the paid plan";
function isHttpUrl(e) {
    try {
        const t = new URL(e);
        return t.protocol === "http:" || t.protocol === "https:"
    } catch {
        return !1
    }
}
function extractViewerPdfUrl(e) {
    if (!e)
        return null;
    try {
        const r = new URL(e).searchParams.get("src");
        return !r || !isHttpUrl(r) ? null : r
    } catch {
        return null
    }
}
async function getTargetTab(e) {
    if (typeof e == "number") {
        const r = await chrome.tabs.get(e);
        if (!r.id)
            throw new Error(`Tab ${e} not found`);
        return r
    }
    const [t] = await chrome.tabs.query({
        active: !0,
        currentWindow: !0
    });
    if (!t?.id)
        throw new Error("No active tab available");
    return t
}
function formatPdfAnswer(e) {
    const t = e.evidence.length > 0 ? e.evidence.map( (r, n) => {
        const a = r.page ? ` (page ${r.page})` : "";
        return `${n + 1}. ${r.snippet}${a}`
    }
    ).join(`
`) : "No evidence snippets returned.";
    return [`Answer: ${e.answer}`, "", "Evidence:", t, "", `Source type: ${e.metadata.sourceType}`].join(`
`)
}
function getFilenameFromPath$1(e) {
    const t = e.trim();
    if (!t)
        throw new Error("PDF path is required");
    const n = t.split("/").filter(Boolean).at(-1);
    if (!n)
        throw new Error("PDF path must point to a file");
    return n
}
async function readPdfFromBrowser(e) {
    const t = e.path ?? e.filePath;
    if (t) {
        const a = await (await getUnifiedFsInstance()).readFileBuffer(t)
          , s = new Uint8Array(a.byteLength);
        return s.set(a),
        redoClient.pdf.read({
            query: e.query,
            source: {
                type: "file",
                file: new Blob([s.buffer],{
                    type: "application/pdf"
                }),
                filename: getFilenameFromPath$1(t)
            }
        })
    }
    let r;
    if (e.url) {
        if (!isHttpUrl(e.url))
            throw new Error("PDF URL must be http(s)");
        r = {
            type: "url",
            url: e.url
        }
    } else {
        const a = (await getTargetTab(e.tabId)).url
          , s = extractViewerPdfUrl(a);
        if (s)
            r = {
                type: "url",
                url: s
            };
        else if (a && isHttpUrl(a))
            r = {
                type: "url",
                url: a
            };
        else
            throw new Error("No accessible PDF URL found. Use read-pdf --url <pdf-url> <query>.")
    }
    return redoClient.pdf.read({
        query: e.query,
        source: r
    })
}
const XLSX_MIME_TYPE$1 = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  , SHEET_PAID_PLAN_MESSAGE = "Spreadsheet reading is only availible on the paid plan";
function getFilenameFromPath(e) {
    const t = e.trim();
    if (!t)
        throw new Error("Spreadsheet path is required");
    const n = t.split("/").filter(Boolean).at(-1);
    if (!n)
        throw new Error("Spreadsheet path must point to a file");
    return n
}
function inferMimeType(e, t) {
    return t?.trim() ? t : e.toLowerCase().endsWith(".csv") ? "text/csv" : XLSX_MIME_TYPE$1
}
function formatWorkbookSummary(e) {
    return e.workbook.sheets.map(t => {
        const r = t.headers.length > 0 ? ` | headers: ${t.headers.join(", ")}` : "";
        return `- ${t.name}: ${t.rowCount} rows, ${t.columnCount} columns${r}`
    }
    ).join(`
`)
}
function formatPreview(e) {
    return e.rows.length === 0 ? "No rows returned." : e.rows.map( (t, r) => `${e.rowStart + r}. ${t.join(" | ")}`).join(`
`)
}
function formatSheetAnswer(e) {
    const t = e.evidence.length > 0 ? e.evidence.map( (n, a) => {
        const s = n.columns && n.columns.length > 0 ? ` | columns: ${n.columns.join(", ")}` : "";
        return `${a + 1}. ${n.sheet} rows ${n.rowStart}-${n.rowEnd}${s}`
    }
    ).join(`
`) : "No evidence ranges returned.";
    return (e.answer ? [`Answer: ${e.answer}`, "", "Evidence:", t, "", "Workbook:", formatWorkbookSummary(e), "", `Preview: ${e.preview.sheetName} rows ${e.preview.rowStart}-${e.preview.rowEnd}`, formatPreview(e.preview)] : ["Workbook:", formatWorkbookSummary(e), "", `Preview: ${e.preview.sheetName} rows ${e.preview.rowStart}-${e.preview.rowEnd}`, formatPreview(e.preview)]).join(`
`)
}
async function readSheetFromBrowser(e) {
    let t = e.file
      , r = e.fileName
      , n = e.mimeType;
    const a = e.path;
    if (a) {
        const o = await (await getUnifiedFsInstance()).readFileBuffer(a)
          , l = new Uint8Array(o.byteLength);
        l.set(o),
        r = getFilenameFromPath(a),
        n = inferMimeType(r, n),
        t = new Blob([l.buffer],{
            type: n
        })
    }
    if (!t)
        throw new Error("Spreadsheet input is required");
    if (!r)
        throw new Error("Spreadsheet filename is required");
    if (t.size === 0)
        throw new Error("Spreadsheet file is empty");
    return redoClient.sheet.read({
        file: t,
        fileName: r,
        mimeType: inferMimeType(r, n),
        ...e.query ? {
            query: e.query
        } : {},
        ...e.sheetName ? {
            sheetName: e.sheetName
        } : {},
        ...typeof e.rowStart == "number" ? {
            rowStart: e.rowStart
        } : {},
        ...typeof e.rowLimit == "number" ? {
            rowLimit: e.rowLimit
        } : {},
        ...e.previewOnly ? {
            previewOnly: !0
        } : {}
    })
}
const log$a = logger.scoped("js-command")
  , EXISTING_CAP_OUTPUT_SLACK_CHARS = 1024
  , JS_HELP = `Execute JavaScript in the sandbox with Puppeteer browser automation and filesystem access.
Use 'return' to get a result back.

Usage:
  js -e '<code>'              Inline code (like node -e)
  js -e <<'EOF'               Multiline inline via heredoc
  code here
  EOF
  js <file>                   Run a script file from the filesystem
  js --timeout 30000 -e '...' With custom timeout (default: 10000ms)
  js --help                   Show this help

Available globals:

BROWSER AUTOMATION:
- listTabs(): Returns all browser tabs as [{id, title, url, active}, ...]
- connectToPage(tabId): Connects to a tab and returns a real Puppeteer Page object
- logImage(base64): Log a PNG screenshot for visual inspection (prefer viewport shots; limit 5 per call)
- createTab(url?): Creates a new browser tab and returns {id, title, url, active}
- closeTab(tabId): Closes a browser tab by id
- waitForPageLoad(page, options?): Wait for page to finish loading
- getSnapshot(page): Get LLM-friendly ARIA snapshot of page in YAML format
- getElementByRef(page, ref): Get DOM element by snapshot ref (e.g., "e5")
- clearInput(element): Clear contents of an input field

FILESYSTEM (virtual /workspace directory):
- readFile(path): Read file contents as string
- writeFile(path, content): Write string content to file
- listFiles(path): List directory contents as string[]
- deleteFile(path): Delete file or directory
- mkdir(path): Create directory (recursive)
- exists(path): Check if path exists, returns boolean
- stat(path): Get file metadata {type, size, mtime}

BASH (Linux-like environment):
- bash(command, options?): Execute bash command, returns {stdout, stderr, exitCode}

The Page object supports the full Puppeteer API including:
- Navigation: page.goto(), page.reload(), page.goBack(), page.goForward()
- Selectors: page.$(), page.$$(), page.waitForSelector()
- Input: page.type(), page.click(), page.focus(), page.hover()
- Evaluation: page.evaluate(), page.evaluateHandle()
- Screenshots: page.screenshot() (viewport by default)
- Content: page.content(), page.title(), page.url()

Use page.screenshot({ encoding: 'base64' }) with logImage() to share screenshots with the model.
Prefer viewport screenshots for accuracy. Only use fullPage: true when the user explicitly asks for the entire page.

Examples:

  # List all open tabs
  js -e 'const tabs = await listTabs(); return tabs;'

  # Navigate and interact with a page
  js -e <<'EOF'
  const tabs = await listTabs();
  const page = await connectToPage(tabs[0].id);
  await page.goto('https://example.com');
  return await page.title();
  EOF

  # Fill a form and submit
  js -e <<'EOF'
  const page = await connectToPage(123);
  await page.type('#search', 'hello world');
  await page.click('button[type="submit"]');
  await page.waitForNavigation();
  return 'done';
  EOF

  # Extract data from a page
  js -e <<'EOF'
  const page = await connectToPage(123);
  const data = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('h2')).map(el => el.textContent);
  });
  return data;
  EOF

  # Take a screenshot
  js -e <<'EOF'
  const page = await connectToPage(123);
  const screenshot = await page.screenshot({ encoding: 'base64' });
  logImage(screenshot);
  EOF

  # Wait for elements
  js -e <<'EOF'
  const page = await connectToPage(123);
  await page.waitForSelector('.results');
  const count = await page.$$eval('.results li', els => els.length);
  return count;
  EOF

  # Clear and replace input text
  js -e <<'EOF'
  const page = await connectToPage(123);
  const searchBox = await getElementByRef(page, "e3");
  await clearInput(searchBox);
  await searchBox.type("new search term");
  EOF

  # Wait for page to fully load
  js -e <<'EOF'
  const page = await connectToPage(123);
  await page.goto('https://example.com');
  const result = await waitForPageLoad(page);
  return result;
  EOF

  # Read and write files
  js -e <<'EOF'
  const config = JSON.parse(await readFile('/workspace/config.json'));
  config.version = '2.0.0';
  await writeFile('/workspace/config.json', JSON.stringify(config, null, 2));
  return 'Updated config';
  EOF

  # List and process files
  js -e <<'EOF'
  const files = await listFiles('/workspace/src');
  return files.filter(f => f.endsWith('.ts'));
  EOF

  # Execute bash commands
  js -e <<'EOF'
  const { stdout, exitCode } = await bash('ls -la /workspace');
  return { stdout, exitCode };
  EOF

  # Pure computation (no browser needed)
  js -e 'return Math.sqrt(16);'

  # Run a script file with timeout
  js --timeout 30000 /workspace/scrape.js
`
  , READ_PDF_HELP = `Read and answer questions about a PDF from the browser or sandbox filesystem.

Usage:
  read-pdf <query>                               Ask a question about the active tab PDF
  read-pdf --url <pdf-url> <query>              Read a specific web PDF URL
  read-pdf --path <sandbox-pdf-path> <query>    Read an attached PDF from the sandbox filesystem
  read-pdf --tab <tabId> <query>                Target a specific tab
  read-pdf --help                               Show this help

Examples:
  read-pdf "Summarize this document"
  read-pdf --url "https://example.com/report.pdf" "Summarize this PDF"
  read-pdf --path "/tmp/chat-attachments/thread-1/pdf-1/contract.pdf" "Summarize the pricing terms"
  read-pdf --tab 123 "What is the renewal date?"
`
  , READ_DOC_HELP = `Read or extract text from a DOCX file in the sandbox filesystem.

Usage:
  read-doc --path <sandbox-docx-path> <query>   Ask a question about an attached DOCX
  read-doc --path <sandbox-docx-path> --extract Extract raw text from an attached DOCX
  read-doc --help                               Show this help

Examples:
  read-doc --path "/tmp/chat-attachments/thread-1/doc-1/brief.docx" "Summarize this document"
  read-doc --path "/tmp/chat-attachments/thread-1/doc-1/brief.docx" --extract
`
  , READ_SHEET_HELP = `Read or preview an XLSX/CSV file in the sandbox filesystem.

Usage:
  read-sheet --path <sandbox-sheet-path> --preview           Show workbook metadata and a preview window
  read-sheet --path <sandbox-sheet-path> <query>            Ask a question about the selected preview window
  read-sheet --path <sandbox-sheet-path> --sheet <name> --rows <start:end> <query>
  read-sheet --help                                         Show this help

Examples:
  read-sheet --path "/tmp/chat-attachments/thread-1/sheet-1/budget.xlsx" --preview
  read-sheet --path "/tmp/chat-attachments/thread-1/sheet-1/budget.xlsx" --sheet Revenue --rows 1:50 "Which row has the highest revenue?"
  read-sheet --path "/tmp/chat-attachments/thread-1/sheet-2/export.csv" --preview
`
  , bashParams = Type.Object({
    description: Type.String({
        description: 'What this command does in max 5 words (e.g., "Listing open browser tabs")'
    }),
    command: Type.String({
        description: "The bash command to execute"
    })
})
  , readFileParams = Type.Object({
    path: Type.String({
        description: "The path to the file to read"
    })
})
  , writeFileParams = Type.Object({
    path: Type.String({
        description: "The path where the file should be written"
    }),
    content: Type.String({
        description: "The content to write to the file"
    })
});
function generateBashDescription(e, t) {
    const r = ["Execute bash commands in the sandbox environment.", "", `WORKING DIRECTORY: ${e}`, "All commands execute from this directory. Use relative paths from here.", "Use 'ls' to see available files.", ""];
    return t?.toolPrompt && (r.push(t.toolPrompt),
    r.push("")),
    r.push("Custom commands:"),
    r.push("  js -e '<code>'      # Execute JavaScript in sandbox (run `js --help` for full docs)"),
    r.push("  js <file>           # Run a JS script file"),
    t?.readPdf && r.push("  read-pdf <query>    # Ask questions about a PDF (use --path for attachments)"),
    t?.readDoc && r.push("  read-doc <query>    # Ask questions about a DOCX attachment (use --extract for raw text)"),
    t?.readSheet && r.push("  read-sheet <query>  # Preview or query an XLSX/CSV attachment"),
    r.push("  open <file>         # Open file in browser viewer"),
    r.push(""),
    r.push("Common operations:"),
    r.push("  ls -la              # List files with details"),
    r.push("  find . -name '*.ts' # Find files by pattern"),
    r.push("  grep -r 'pattern' . # Search file contents"),
    r.push("  cat <file>          # View file contents"),
    r.push(""),
    t?.extraInstructions && (r.push(t.extraInstructions),
    r.push("")),
    r.join(`
`).trim()
}
function parsePositiveInteger(e) {
    const t = Number.parseInt(e, 10);
    return !Number.isInteger(t) || t <= 0 ? null : t
}
function parseRowWindow(e) {
    const [t,r] = e.split(":");
    if (!t || !r)
        return null;
    const n = parsePositiveInteger(t)
      , a = parsePositiveInteger(r);
    return !n || !a || a < n ? null : {
        rowStart: n,
        rowLimit: a - n + 1
    }
}
function createBashTools(e, t, r) {
    const n = e.getCwd()
      , a = [];
    if (r?.execInSandbox) {
        const u = r.execInSandbox
          , c = Tx("js", async (p, d) => {
            if (p.includes("--help") || p.includes("-h"))
                return {
                    stdout: JS_HELP,
                    stderr: "",
                    exitCode: 0
                };
            let f;
            const h = [];
            for (let x = 0; x < p.length; x++)
                if (p[x] === "--timeout" && x + 1 < p.length) {
                    if (f = parseInt(p[x + 1], 10),
                    isNaN(f))
                        return {
                            stdout: "",
                            stderr: `Error: --timeout requires a numeric value
`,
                            exitCode: 1
                        };
                    x++
                } else
                    h.push(p[x]);
            const m = h.indexOf("-e");
            let g;
            if (m !== -1) {
                const x = h.slice(m + 1);
                if (x.length > 0)
                    g = x.join(" ");
                else if (d.stdin)
                    g = d.stdin;
                else
                    return {
                        stdout: "",
                        stderr: `Usage: js -e '<code>'
`,
                        exitCode: 1
                    }
            } else {
                const x = h[0];
                if (!x)
                    return {
                        stdout: "",
                        stderr: `Usage: js -e '<code>' or js <file>
Run js --help for full documentation.
`,
                        exitCode: 1
                    };
                const b = d.fs.resolvePath(d.cwd, x);
                try {
                    g = await d.fs.readFile(b, "utf-8")
                } catch {
                    return {
                        stdout: "",
                        stderr: `Error: Cannot read file: ${b}
`,
                        exitCode: 1
                    }
                }
            }
            try {
                log$a.log("Executing js command");
                const x = performance.now()
                  , b = await u(g, f)
                  , y = performance.now() - x;
                return log$a.log(`Completed in ${y.toFixed(0)}ms, hasError: ${b.hasError}`),
                b.images.length > 0 && a.push(...b.images),
                {
                    stdout: (await capToolOutput(b.output, "js", t)).text,
                    stderr: "",
                    exitCode: b.hasError ? 1 : 0
                }
            } catch (x) {
                const b = x instanceof Error ? x.message : String(x);
                return log$a.error("Error:", x),
                {
                    stdout: "",
                    stderr: `Error: ${b}
`,
                    exitCode: 1
                }
            }
        }
        );
        e.registerCommand(c)
    }
    if (r?.readPdf) {
        const u = r.readPdf
          , c = Tx("read-pdf", async (p, d) => {
            if (p.includes("--help") || p.includes("-h"))
                return {
                    stdout: READ_PDF_HELP,
                    stderr: "",
                    exitCode: 0
                };
            let f, h, m;
            const g = [];
            let x = 0;
            for (let y = 0; y < p.length; y++) {
                const w = p[y];
                if (w === "--tab") {
                    const R = p[y + 1];
                    if (!R)
                        return {
                            stdout: "",
                            stderr: `Usage: read-pdf [--url <pdf-url>] [--path <sandbox-pdf-path>] [--tab <id>] <query>
`,
                            exitCode: 1
                        };
                    if (x++,
                    x > 1)
                        return {
                            stdout: "",
                            stderr: `Usage: read-pdf [--url <pdf-url>] [--path <sandbox-pdf-path>] [--tab <id>] <query>
`,
                            exitCode: 1
                        };
                    const T = Number.parseInt(R, 10);
                    if (!Number.isInteger(T) || T <= 0)
                        return {
                            stdout: "",
                            stderr: `Error: --tab requires a positive integer
`,
                            exitCode: 1
                        };
                    f = T,
                    y++
                } else if (w === "--url") {
                    const R = p[y + 1];
                    if (!R)
                        return {
                            stdout: "",
                            stderr: `Usage: read-pdf [--url <pdf-url>] [--path <sandbox-pdf-path>] [--tab <id>] <query>
`,
                            exitCode: 1
                        };
                    if (x++,
                    x > 1)
                        return {
                            stdout: "",
                            stderr: `Usage: read-pdf [--url <pdf-url>] [--path <sandbox-pdf-path>] [--tab <id>] <query>
`,
                            exitCode: 1
                        };
                    try {
                        const T = new URL(R);
                        if (T.protocol !== "http:" && T.protocol !== "https:")
                            throw new Error("invalid")
                    } catch {
                        return {
                            stdout: "",
                            stderr: `Error: --url must be a valid http(s) URL
`,
                            exitCode: 1
                        }
                    }
                    h = R,
                    y++
                } else if (w === "--path") {
                    const R = p[y + 1];
                    if (!R)
                        return {
                            stdout: "",
                            stderr: `Usage: read-pdf [--url <pdf-url>] [--path <sandbox-pdf-path>] [--tab <id>] <query>
`,
                            exitCode: 1
                        };
                    if (x++,
                    x > 1)
                        return {
                            stdout: "",
                            stderr: `Usage: read-pdf [--url <pdf-url>] [--path <sandbox-pdf-path>] [--tab <id>] <query>
`,
                            exitCode: 1
                        };
                    m = d.fs.resolvePath(d.cwd, R),
                    y++
                } else
                    g.push(w)
            }
            const b = g.join(" ").trim() || d.stdin?.trim() || "";
            if (!b)
                return {
                    stdout: "",
                    stderr: `Usage: read-pdf [--url <pdf-url>] [--path <sandbox-pdf-path>] [--tab <id>] <query>
`,
                    exitCode: 1
                };
            try {
                const y = await u({
                    query: b,
                    ...typeof h == "string" ? {
                        url: h
                    } : {},
                    ...typeof m == "string" ? {
                        path: m
                    } : {},
                    ...typeof f == "number" ? {
                        tabId: f
                    } : {}
                });
                return {
                    stdout: `${formatPdfAnswer(y)}
`,
                    stderr: "",
                    exitCode: 0
                }
            } catch (y) {
                const w = y instanceof Error ? y.message : String(y);
                return w === PDF_PAID_PLAN_MESSAGE ? {
                    stdout: "",
                    stderr: `${w}
`,
                    exitCode: 1
                } : {
                    stdout: "",
                    stderr: `PDF read failed: ${w}
`,
                    exitCode: 1
                }
            }
        }
        );
        e.registerCommand(c)
    }
    if (r?.readDoc) {
        const u = r.readDoc
          , c = Tx("read-doc", async (p, d) => {
            if (p.includes("--help") || p.includes("-h"))
                return {
                    stdout: READ_DOC_HELP,
                    stderr: "",
                    exitCode: 0
                };
            let f, h = !1;
            const m = [];
            for (let x = 0; x < p.length; x++) {
                const b = p[x];
                if (b === "--path") {
                    const y = p[x + 1];
                    if (!y)
                        return {
                            stdout: "",
                            stderr: `Usage: read-doc --path <sandbox-docx-path> [--extract] [query]
`,
                            exitCode: 1
                        };
                    f = d.fs.resolvePath(d.cwd, y),
                    x++
                } else
                    b === "--extract" ? h = !0 : m.push(b)
            }
            if (!f)
                return {
                    stdout: "",
                    stderr: `Usage: read-doc --path <sandbox-docx-path> [--extract] [query]
`,
                    exitCode: 1
                };
            const g = m.join(" ").trim() || d.stdin?.trim() || "";
            if (!h && !g)
                return {
                    stdout: "",
                    stderr: `Usage: read-doc --path <sandbox-docx-path> [--extract] [query]
`,
                    exitCode: 1
                };
            try {
                const x = await u({
                    path: f,
                    ...g ? {
                        query: g
                    } : {},
                    ...h ? {
                        extractOnly: !0
                    } : {}
                });
                return {
                    stdout: `${formatDocAnswer(x)}
`,
                    stderr: "",
                    exitCode: 0
                }
            } catch (x) {
                const b = x instanceof Error ? x.message : String(x);
                return b === DOC_PAID_PLAN_MESSAGE ? {
                    stdout: "",
                    stderr: `${b}
`,
                    exitCode: 1
                } : {
                    stdout: "",
                    stderr: `DOCX read failed: ${b}
`,
                    exitCode: 1
                }
            }
        }
        );
        e.registerCommand(c)
    }
    if (r?.readSheet) {
        const u = r.readSheet
          , c = Tx("read-sheet", async (p, d) => {
            if (p.includes("--help") || p.includes("-h"))
                return {
                    stdout: READ_SHEET_HELP,
                    stderr: "",
                    exitCode: 0
                };
            let f, h, m, g, x = !1;
            const b = [];
            for (let w = 0; w < p.length; w++) {
                const R = p[w];
                if (R === "--path") {
                    const T = p[w + 1];
                    if (!T)
                        return {
                            stdout: "",
                            stderr: `Usage: read-sheet --path <sandbox-sheet-path> [--preview] [--sheet <name>] [--rows <start:end>] [query]
`,
                            exitCode: 1
                        };
                    f = d.fs.resolvePath(d.cwd, T),
                    w++
                } else if (R === "--sheet") {
                    const T = p[w + 1];
                    if (!T)
                        return {
                            stdout: "",
                            stderr: `Usage: read-sheet --path <sandbox-sheet-path> [--preview] [--sheet <name>] [--rows <start:end>] [query]
`,
                            exitCode: 1
                        };
                    h = T,
                    w++
                } else if (R === "--rows") {
                    const T = p[w + 1];
                    if (!T)
                        return {
                            stdout: "",
                            stderr: `Usage: read-sheet --path <sandbox-sheet-path> [--preview] [--sheet <name>] [--rows <start:end>] [query]
`,
                            exitCode: 1
                        };
                    const C = parseRowWindow(T);
                    if (!C)
                        return {
                            stdout: "",
                            stderr: `Error: --rows must use start:end with positive integers
`,
                            exitCode: 1
                        };
                    m = C.rowStart,
                    g = C.rowLimit,
                    w++
                } else
                    R === "--preview" ? x = !0 : b.push(R)
            }
            if (!f)
                return {
                    stdout: "",
                    stderr: `Usage: read-sheet --path <sandbox-sheet-path> [--preview] [--sheet <name>] [--rows <start:end>] [query]
`,
                    exitCode: 1
                };
            const y = b.join(" ").trim() || d.stdin?.trim() || "";
            if (!x && !y)
                return {
                    stdout: "",
                    stderr: `Usage: read-sheet --path <sandbox-sheet-path> [--preview] [--sheet <name>] [--rows <start:end>] [query]
`,
                    exitCode: 1
                };
            try {
                const w = await u({
                    path: f,
                    ...h ? {
                        sheetName: h
                    } : {},
                    ...typeof m == "number" ? {
                        rowStart: m
                    } : {},
                    ...typeof g == "number" ? {
                        rowLimit: g
                    } : {},
                    ...y ? {
                        query: y
                    } : {},
                    ...x ? {
                        previewOnly: !0
                    } : {}
                });
                return {
                    stdout: `${formatSheetAnswer(w)}
`,
                    stderr: "",
                    exitCode: 0
                }
            } catch (w) {
                const R = w instanceof Error ? w.message : String(w);
                return R === SHEET_PAID_PLAN_MESSAGE ? {
                    stdout: "",
                    stderr: `${R}
`,
                    exitCode: 1
                } : {
                    stdout: "",
                    stderr: `Spreadsheet read failed: ${R}
`,
                    exitCode: 1
                }
            }
        }
        );
        e.registerCommand(c)
    }
    return [{
        name: "bash",
        label: "Run Command",
        description: generateBashDescription(n, r),
        parameters: bashParams,
        execute: async (u, c) => {
            try {
                const p = await e.exec(c.command)
                  , d = [p.stdout ? `stdout:
${p.stdout}` : "", p.stderr ? `stderr:
${p.stderr}` : "", `exit code: ${p.exitCode}`].filter(Boolean).join(`

`)
                  , m = [{
                    type: "text",
                    text: (containsToolOutputCapNotice(d) && d.length <= MAX_TOOL_OUTPUT_CHARS + EXISTING_CAP_OUTPUT_SLACK_CHARS ? {
                        text: d
                    } : await capToolOutput(d, "bash", t)).text
                }]
                  , g = a.splice(0);
                for (const x of g)
                    m.push({
                        type: "image",
                        data: x.data,
                        mimeType: x.mediaType
                    });
                return {
                    content: m,
                    details: {
                        stdout: p.stdout,
                        stderr: p.stderr,
                        exitCode: p.exitCode
                    }
                }
            } catch (p) {
                const d = p instanceof Error ? p.message : String(p);
                return {
                    content: [{
                        type: "text",
                        text: `Error: ${d}`
                    }],
                    details: {
                        error: d
                    }
                }
            }
        }
    }, {
        name: "readFile",
        label: "Read File",
        description: "Read the contents of a file from the sandbox.",
        parameters: readFileParams,
        execute: async (u, c) => {
            try {
                return {
                    content: [{
                        type: "text",
                        text: await t.readFile(c.path, "utf-8")
                    }],
                    details: {
                        path: c.path
                    }
                }
            } catch (p) {
                const d = p instanceof Error ? p.message : String(p);
                return {
                    content: [{
                        type: "text",
                        text: `Error reading file: ${d}`
                    }],
                    details: {
                        error: d,
                        path: c.path
                    }
                }
            }
        }
    }, {
        name: "writeFile",
        label: "Write File",
        description: "Write content to a file in the sandbox. Creates parent directories if needed.",
        parameters: writeFileParams,
        execute: async (u, c) => {
            try {
                const p = c.path.substring(0, c.path.lastIndexOf("/"));
                if (p)
                    try {
                        await t.mkdir(p, {
                            recursive: !0
                        })
                    } catch {}
                return await t.writeFile(c.path, c.content),
                {
                    content: [{
                        type: "text",
                        text: `Successfully wrote to ${c.path}`
                    }],
                    details: {
                        path: c.path,
                        success: !0
                    }
                }
            } catch (p) {
                const d = p instanceof Error ? p.message : String(p);
                return {
                    content: [{
                        type: "text",
                        text: `Error writing file: ${d}`
                    }],
                    details: {
                        error: d,
                        path: c.path,
                        success: !1
                    }
                }
            }
        }
    }]
}

var grayMatterExports = requireGrayMatter();
const matter = getDefaultExportFromCjs(grayMatterExports);
function parseSkillFrontmatter(e) {
    try {
        const {data: t} = matter(e);
        if (!t.name || !t.description)
            return null;
        const r = {
            name: String(t.name),
            description: String(t.description)
        };
        if (t.license && (r.license = String(t.license)),
        t.compatibility && (r.compatibility = String(t.compatibility)),
        t["allowed-tools"]) {
            const n = String(t["allowed-tools"]);
            r.allowedTools = n.split(/\s+/).filter(Boolean)
        }
        return t.metadata && typeof t.metadata == "object" && (r.metadata = Object.fromEntries(Object.entries(t.metadata).map( ([n,a]) => [n, String(a)]))),
        r
    } catch {
        return null
    }
}
function extractSkillBody(e) {
    const {content: t} = matter(e);
    return t.trim()
}
function validateSkillName(e) {
    const t = [];
    return !e || e.length === 0 ? (t.push({
        field: "name",
        message: "Name is required"
    }),
    t) : (e.length > 64 && t.push({
        field: "name",
        message: "Name must be 64 characters or less"
    }),
    /^[a-z0-9-]+$/.test(e) || t.push({
        field: "name",
        message: "Name must contain only lowercase letters, numbers, and hyphens"
    }),
    e.startsWith("-") && t.push({
        field: "name",
        message: "Name cannot start with a hyphen"
    }),
    e.endsWith("-") && t.push({
        field: "name",
        message: "Name cannot end with a hyphen"
    }),
    e.includes("--") && t.push({
        field: "name",
        message: "Name cannot contain consecutive hyphens"
    }),
    t)
}
function validateSkillMetadata(e, t) {
    const r = [];
    return r.push(...validateSkillName(e.name)),
    e.name !== t && r.push({
        field: "name",
        message: `Name "${e.name}" must match folder name "${t}"`
    }),
    !e.description || e.description.length === 0 ? r.push({
        field: "description",
        message: "Description is required"
    }) : e.description.length > 1024 && r.push({
        field: "description",
        message: "Description must be 1024 characters or less"
    }),
    e.compatibility && e.compatibility.length > 500 && r.push({
        field: "compatibility",
        message: "Compatibility must be 500 characters or less"
    }),
    {
        valid: r.length === 0,
        errors: r
    }
}
const log$9 = logger.scoped("skills")
  , SKILLS_PATH = "/workspace/skills"
  , SYS_SKILLS_PATH = "/sys/skills";
async function loadSkillInfo(e, t) {
    const r = `${t}/SKILL.md`
      , n = t.split("/").pop() || "";
    if (!await e.exists(r))
        return null;
    let a;
    try {
        a = await e.readFile(r, "utf-8")
    } catch {
        return log$9.warn(`Failed to read ${r}`),
        {
            success: !1,
            error: {
                path: t,
                folderName: n,
                errors: [{
                    field: "file",
                    message: `Failed to read ${r}`
                }]
            }
        }
    }
    const s = parseSkillFrontmatter(a);
    if (!s)
        return log$9.warn(`Invalid frontmatter in ${r}`),
        {
            success: !1,
            error: {
                path: t,
                folderName: n,
                errors: [{
                    field: "frontmatter",
                    message: "Invalid or missing YAML frontmatter"
                }]
            }
        };
    const o = validateSkillMetadata(s, n);
    return o.valid ? {
        success: !0,
        skill: {
            metadata: s,
            path: t,
            skillMdPath: r
        }
    } : (log$9.warn(`Validation failed for ${r}:`, o.errors),
    {
        success: !1,
        error: {
            path: t,
            folderName: n,
            errors: o.errors
        }
    })
}
async function discoverSkills(e, t=SKILLS_PATH) {
    const r = []
      , n = [];
    if (!await e.exists(t))
        return log$9.log(`Skills directory not found: ${t}`),
        {
            skills: r,
            validationErrors: n
        };
    let a;
    try {
        a = await e.readdir(t)
    } catch {
        return log$9.warn(`Failed to read skills directory: ${t}`),
        {
            skills: r,
            validationErrors: n
        }
    }
    for (const s of a) {
        if (s.startsWith("."))
            continue;
        const o = `${t}/${s}`;
        try {
            if (!(await e.stat(o)).isDirectory)
                continue
        } catch {
            continue
        }
        const l = await loadSkillInfo(e, o);
        l !== null && (l.success ? r.push(l.skill) : n.push(l.error))
    }
    return r.sort( (s, o) => s.metadata.name.localeCompare(o.metadata.name)),
    n.sort( (s, o) => s.folderName.localeCompare(o.folderName)),
    log$9.log(`Discovered ${r.length} skills`),
    n.length > 0 && log$9.warn(`${n.length} skills failed validation`),
    {
        skills: r,
        validationErrors: n
    }
}
async function discoverSkillsFromPaths(e, t) {
    const r = []
      , n = []
      , a = new Set;
    for (const s of t) {
        const o = await discoverSkills(e, s);
        for (const l of o.skills)
            a.has(l.metadata.name) || (a.add(l.metadata.name),
            r.push(l));
        for (const l of o.validationErrors)
            a.has(l.folderName) || n.push(l)
    }
    return r.sort( (s, o) => s.metadata.name.localeCompare(o.metadata.name)),
    n.sort( (s, o) => s.folderName.localeCompare(o.folderName)),
    {
        skills: r,
        validationErrors: n
    }
}
const DEFAULT_SKILL_PATHS = [SKILLS_PATH, SYS_SKILLS_PATH];
class SkillsService {
    fs;
    skillPaths;
    cachedResult = null;
    constructor(t, r=DEFAULT_SKILL_PATHS) {
        this.fs = t,
        this.skillPaths = r
    }
    async getDiscoveryResult() {
        return this.cachedResult === null && (this.cachedResult = await discoverSkillsFromPaths(this.fs, this.skillPaths)),
        this.cachedResult
    }
    async getAvailableSkills() {
        return (await this.getDiscoveryResult()).skills
    }
    async getValidationErrors() {
        return (await this.getDiscoveryResult()).validationErrors
    }
    async refreshSkills() {
        return this.cachedResult = await discoverSkillsFromPaths(this.fs, this.skillPaths),
        this.cachedResult
    }
    async findSkill(t) {
        return (await this.getAvailableSkills()).find(n => n.metadata.name === t) || null
    }
    async loadSkill(t) {
        const r = await this.findSkill(t);
        if (!r)
            throw new Error(`Skill not found: "${t}"`);
        const n = await this.fs.readFile(r.skillMdPath, "utf-8");
        return {
            content: extractSkillBody(n),
            path: r.path,
            metadata: r.metadata
        }
    }
    generateSkillsPrompt(t) {
        return t.length === 0 ? "" : `<available_skills>
${t.map(n => `  <skill>
    <name>${escapeXml(n.metadata.name)}</name>
    <description>${escapeXml(n.metadata.description)}</description>
    <location>${escapeXml(n.skillMdPath)}</location>
  </skill>`).join(`
`)}
</available_skills>`
    }
}
function escapeXml(e) {
    return e.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;")
}
const NEW_CHAT_SOURCE_ID = "new-chat";
let notificationCounter = 0;
const useNotificationStore = create(e => ({
    notifications: [],
    addNotification: (t, r, n, a) => {
        const s = `notification-${++notificationCounter}`
          , o = {
            id: s,
            type: t,
            title: r,
            details: a,
            timestamp: Date.now(),
            sourceId: n
        };
        return e(l => ({
            notifications: [...l.notifications, o]
        })),
        s
    }
    ,
    removeNotification: t => {
        e(r => ({
            notifications: r.notifications.filter(n => n.id !== t)
        }))
    }
    ,
    clearAll: () => {
        e({
            notifications: []
        })
    }
    ,
    clearByType: t => {
        e(r => ({
            notifications: r.notifications.filter(n => n.type !== t)
        }))
    }
    ,
    clearBySource: t => {
        e(r => ({
            notifications: r.notifications.filter(n => n.sourceId !== t)
        }))
    }
}));
function createNotifier(e) {
    return {
        warning: (t, r) => useNotificationStore.getState().addNotification("warning", t, e, r),
        error: (t, r) => useNotificationStore.getState().addNotification("error", t, e, r),
        clear: () => useNotificationStore.getState().clearBySource(e)
    }
}
const systemPromptContent = `# Do Browser - Browser Automation Agent

You are a browser automation specialist running inside the Do Browser extension. You have deep expertise in web automation, DOM manipulation, and browser workflows. You control browser tabs using Puppeteer through a sandboxed JavaScript environment.

You also have access to a persistent Linux-like bash environment with a filesystem that survives page refreshes. Use the bash tools for file operations, text processing, and general scripting tasks.

The filesystem has two main areas:

- \`/workspace\` - Virtual filesystem (IndexedDB-backed) for storing files you create
- \`/mnt/<name>\` - Mounted directories from the user's local computer (if any are configured)

Break complex tasks into small, verifiable actions.

**IMPORTANT** The user is not technical. Be terse and efficient when explaining what you are doing / have done, unless the user specifies otherwise.

## File Links In Final Responses

When you create or update deliverable files for the user, you MUST append file links at the very end of your final response message.

Use markdown links with the \`dobrowser:\` scheme and an absolute path:

- \`[report.csv](dobrowser:/workspace/report.csv)\`
- \`[output.json](dobrowser:/mnt/data/output.json)\`

Rules:

1. Put this file-links block at the very end of the message.
2. Include one link per deliverable file.
3. Use only absolute paths under \`/workspace\` or \`/mnt\`.
4. Do not output plain file paths for downloadable deliverables.

Incorrect:

- \`/workspace/report.csv\`
- \`report.csv saved in workspace\`

## Tool Call Format

When calling tools, you MUST provide ALL required parameters. Empty tool calls will fail.

### bash tool - REQUIRED parameters:

- \`command\` (string): The bash command to execute

The bash environment includes a \`js\` command for executing JavaScript in the sandbox plus \`read-pdf\`, \`read-doc\`, and \`read-sheet\` commands for querying attached documents. Run \`js --help\`, \`read-pdf --help\`, \`read-doc --help\`, or \`read-sheet --help\` for full usage.

**Use a heredoc (\`<<'EOF'\`) whenever the code is more than 2 lines.** Single-line expressions can use inline \`js -e '...'\`.

\`\`\`bash
# List all open tabs
js -e 'const tabs = await listTabs(); return tabs;'

# Navigate and interact with a page
js -e <<'EOF'
const tabs = await listTabs();
const page = await connectToPage(tabs[0].id);
await page.goto('https://example.com');
return await page.title();
EOF

# Fill a form and submit
js -e <<'EOF'
const page = await connectToPage(123);
await page.type('#search', 'hello world');
await page.click('button[type="submit"]');
await page.waitForNavigation();
return 'done';
EOF

# Extract data from a page
js -e <<'EOF'
const page = await connectToPage(123);
const data = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('h2')).map(el => el.textContent);
});
return data;
EOF

# Take a screenshot
js -e <<'EOF'
const page = await connectToPage(123);
const screenshot = await page.screenshot({ encoding: 'base64' });
logImage(screenshot);
EOF

# Wait for elements
js -e <<'EOF'
const page = await connectToPage(123);
await page.waitForSelector('.results');
const count = await page.$$eval('.results li', els => els.length);
return count;
EOF

# Clear and replace input text
js -e <<'EOF'
const page = await connectToPage(123);
const searchBox = await getElementByRef(page, "e3");
await clearInput(searchBox);
await searchBox.type("new search term");
EOF

# Wait for page to fully load
js -e <<'EOF'
const page = await connectToPage(123);
await page.goto('https://example.com');
const result = await waitForPageLoad(page);
return result;
EOF

# Read and write files
js -e <<'EOF'
const config = JSON.parse(await readFile('/workspace/config.json'));
config.version = '2.0.0';
await writeFile('/workspace/config.json', JSON.stringify(config, null, 2));
return 'Updated config';
EOF

# List and process files
js -e <<'EOF'
const files = await listFiles('/workspace/src');
return files.filter(f => f.endsWith('.ts'));
EOF

# Execute bash commands
js -e <<'EOF'
const { stdout, exitCode } = await bash('ls -la /workspace');
return { stdout, exitCode };
EOF

# Pure computation (no browser needed)
js -e 'return Math.sqrt(16);'

# Run a script file
js /workspace/scrape.js

# With timeout for long-running operations
js --timeout 30000 -e <<'EOF'
const data = await page.$$eval('.item', els => els.map(e => e.textContent));
return data;
EOF
\`\`\`

### readFile tool - REQUIRED parameters:

- \`path\` (string): The file path to read

### writeFile tool - REQUIRED parameters:

- \`path\` (string): The file path to write
- \`content\` (string): The content to write

### Document reading commands:

Use the bash command:

\`\`\`bash
read-pdf [--url <pdf-url>] [--path <sandbox-pdf-path>] [--tab <id>] <query>
read-doc --path <sandbox-docx-path> [--extract] [query]
read-sheet --path <sandbox-sheet-path> [--preview] [--sheet <name>] [--rows <start:end>] [query]
\`\`\`

Examples:

\`\`\`bash
read-pdf "Summarize this PDF"
read-pdf --url "https://example.com/report.pdf" "Summarize this PDF"
read-pdf --path "/tmp/chat-attachments/thread-1/pdf-1/contract.pdf" "Summarize the pricing terms"
read-pdf --tab 123 "What is the renewal date?"
read-doc --path "/tmp/chat-attachments/thread-1/docx-1/brief.docx" "Summarize this agreement"
read-doc --path "/tmp/chat-attachments/thread-1/docx-1/brief.docx" --extract
read-sheet --path "/tmp/chat-attachments/thread-1/xlsx-1/budget.xlsx" --preview
read-sheet --path "/tmp/chat-attachments/thread-1/csv-1/export.csv" --rows 1:50 "Which row has the highest total?"
\`\`\`

Use \`read-pdf\` whenever the user asks to read, summarize, extract, or answer questions from PDF content.
If the tab URL is not a web URL (for example blob/file/internal viewers), use \`--url\` with a direct \`http(s)\` PDF link.
If a user message includes an attachment tag with \`mimeType="application/pdf"\`, use \`read-pdf --path <path> ...\` to inspect it.
Do not use \`readFile()\` on raw PDF bytes unless the user explicitly asks for the binary file itself.
Use \`read-doc\` whenever a user attaches a DOCX file or asks about Word document contents. Use \`--extract\` when you need the raw text.
Use \`read-sheet --preview\` first for XLSX/CSV attachments, then narrow with \`--sheet\` or \`--rows\` before asking a focused question.
If a user message includes an attachment tag with a DOCX/XLSX/CSV mime type, prefer \`read-doc\` or \`read-sheet\` over \`readFile()\` because the attachment is stored as raw bytes.

## Choosing Your Approach

Always inspect the page first before writing automation code. Never assume you know how a page is structured—even familiar sites change their markup frequently.

**Recommended workflow:**

1. Use \`getSnapshot(page)\` to get an LLM-friendly accessibility tree
2. Find elements by their accessible name and role in the YAML output
3. Use \`getElementByRef(page, 'eN')\` to interact with discovered elements
4. Take screenshots for visual verification if needed
5. Iterate: snapshot → find ref → interact → new snapshot → verify

This approach is more reliable than guessing selectors, even for well-known sites. The snapshot shows you exactly what's on the page and gives you stable references to interact with elements.

## Workflow Loop

Follow this pattern for complex tasks:

1. **Write** - Create a small script to perform ONE action
2. **Run** - Execute it via the \`js\` command
3. **Evaluate** - Check the output. Did it work? What's the current state?
4. **Decide** - Is the task complete, or do we need another action?
5. **Repeat** - Continue until the task is done

This incremental approach is more reliable than writing large scripts that might fail partway through.

## Key Principles

1. **Small Scripts** - Each \`js\` call should do ONE thing: navigate, click, fill a field, or extract data. Don't try to do everything at once.

2. **Evaluate State** - Always return or log the current state at the end of each script. This helps you decide what to do next.

3. **Plain JavaScript** - Code inside \`page.evaluate()\` runs in the browser. Use plain JavaScript only - no TypeScript, no imports.

4. **Report Progress** - Before each action, explain what you're about to do and why.

## Execution Strategy

**Use a single \`js\` call when:**

- The operations are atomic and must succeed together
- You're doing a simple read-only inspection
- The task is straightforward with no conditional logic

**Use multiple sequential \`js\` calls when:**

- You need to verify each step before proceeding
- The workflow has branching logic based on page state
- You're debugging or exploring an unknown page
- Recovery from partial failure matters

## Strategic Patterns for Complex Tasks

These patterns help avoid common pitfalls when automating complex, multi-step workflows.

### Verify Starting Position

Before list-based tasks (e.g., "scrape the first 5 posts", "get all items from the feed"), verify your current URL. If you're on a detail page, comment thread, or deep-linked location, navigate to the primary index or listing page first to ensure a clean starting state.

\`\`\`javascript
// Check current location before starting
console.log(\`Current URL: \${page.url()}\`);

// If on a detail page, navigate to the listing first
if (page.url().includes("/item") || page.url().includes("/comments")) {
  await page.goto("https://example.com/");
  await waitForPageLoad(page);
}
\`\`\`

### Verify Targets Before Looping

Before starting multi-step operations (scraping N pages, processing a list of items), output a summary of your targets. Catching navigation or selector errors early prevents wasted effort.

\`\`\`javascript
// Collect and verify targets before processing
const targets = await page.$$eval(".post-link", (els) =>
  els.slice(0, 5).map((e) => ({ text: e.textContent.trim(), href: e.href }))
);

// Log for verification
console.log(\`Found \${targets.length} targets:\`);
console.log(JSON.stringify(targets, null, 2));
logImage(await page.screenshot({ encoding: "base64" }));

// Review the output - are these the correct elements?
// Only proceed to the loop after confirming targets are right
\`\`\`

### Reuse Tabs for Sequential Operations

For tasks that visit multiple URLs sequentially, reuse a single "worker" tab rather than creating a new tab for each URL. This prevents browser memory bloat and keeps the tab bar manageable during long-running tasks.

\`\`\`javascript
// Good: One tab, multiple URLs
const tab = await createTab();
const page = await connectToPage(tab.id);
const results = [];

for (const url of urlsToScrape) {
  await page.goto(url);
  await waitForPageLoad(page);
  const data = await page.evaluate(() => /* extract data */);
  results.push(data);
}

// Avoid: Creating many tabs and leaving them open
for (const url of urlsToScrape) {
  const newTab = await createTab(url);  // Creates 10+ tabs!
  // Browser gets cluttered, memory usage grows
}

// If you must open extra tabs, close them when done
const tempTab = await createTab('https://example.com');
// ...work...
await closeTab(tempTab.id);
\`\`\`

### Prefer Bash for Heavy Data Processing

For text manipulation tasks (word frequencies, regex cleaning, sorting, deduplication), use bash commands instead of in-browser JavaScript. Unix utilities are optimized for text processing and handle large datasets efficiently.

\`\`\`javascript
// Save scraped text to filesystem first
await writeFile("/workspace/raw.txt", scrapedText);

// Process with bash - much faster for large data
const result = await bash(\`
  cat /workspace/raw.txt |
  tr '[:upper:]' '[:lower:]' |
  tr -cs '[:alpha:]' '\\\\n' |
  grep -v '^$' |
  sort | uniq -c | sort -rn |
  head -20
\`);
console.log("Top 20 words:\\n" + result.stdout);

// Bash pipelines are memory-efficient and fast for:
// - Word counting, frequency analysis
// - Text cleaning, normalization
// - Sorting and deduplication
// - Filtering with grep/awk/sed
\`\`\`

## Available Globals

Sixteen helper functions are available in the \`js\` environment, covering browser automation, filesystem, and bash operations. Run \`js --help\` for a quick reference.

### listTabs()

Returns all open browser tabs with their metadata.

\`\`\`javascript
const tabs = await listTabs();
// Returns: [{ id: 123, title: "Example", url: "https://example.com", active: true }, ...]

// Find the active tab
const activeTab = tabs.find((t) => t.active);

// Find a tab by URL
const targetTab = tabs.find((t) => t.url.includes("github.com"));

return tabs;
\`\`\`

### connectToPage(tabId)

Connects to a specific tab and returns a Puppeteer Page object.

**Important:** You cannot connect to or control pages with \`file://\` URLs. Puppeteer only works with \`http://\` and \`https://\` pages. To open files from the virtual filesystem, use the \`open\` command instead (see "Opening Files in Browser" section).

\`\`\`javascript
const tabs = await listTabs();
const page = await connectToPage(tabs[0].id);

// Now use standard Puppeteer methods
await page.goto("https://example.com");
return await page.title();
\`\`\`

### logImage(base64)

Log an image for the model to see. Use this to visually inspect page state.
Prefer viewport screenshots for accuracy. Only use full-page screenshots when the user explicitly asks for the entire page.

**Parameters:**

- \`base64\` (string): Base64-encoded PNG image data from \`page.screenshot({ encoding: 'base64' })\`

**Returns:** void

**Throws:** Error if the input is not valid base64-encoded PNG data

**Example:**

\`\`\`javascript
const page = await connectToPage(tabId);
const screenshot = await page.screenshot({ encoding: "base64" });
logImage(screenshot);
// Console shows: [Image #1 logged]
// The image is attached to this tool call's output
\`\`\`

**Best Practices:**

- Limit to 5 images per \`js\` call to avoid context bloat
- Use for debugging page state and verifying actions completed
- Always send screenshots through \`logImage()\` instead of returning raw base64 in tool output
- Prefer viewport screenshots for page checks; use full-page screenshots only when the user explicitly asks for the entire page
- Use element screenshots when a focused UI region matters more than the full viewport

**Common Pattern - Verify Navigation:**

\`\`\`javascript
const page = await connectToPage(tabId);
await page.goto("https://example.com");
await page.waitForSelector(".main-content");
logImage(await page.screenshot({ encoding: "base64" }));
console.log("Page loaded, check screenshot to verify");
\`\`\`

### createTab(url?)

Create a new browser tab for automation.

**Parameters:**

- \`url\` (string, optional): URL to navigate to. Defaults to \`about:blank\`.

**Returns:** \`{id, title, url, active}\` - Tab information

**Example:**

\`\`\`javascript
// Create a new tab and navigate to a URL
const tab = await createTab("https://example.com");
const page = await connectToPage(tab.id);
// Now you can automate this fresh tab
\`\`\`

**Notes:**

- The tab is created in the background (won't steal focus)
- Use the returned \`id\` with \`connectToPage()\` to get a Puppeteer Page
- Useful for starting automation on a clean page without affecting user's tabs

**Common Pattern - Fresh Tab Automation:**

\`\`\`javascript
// Create a new tab for scraping without affecting user's browsing
const tab = await createTab("https://example.com/data");
const page = await connectToPage(tab.id);
await page.waitForSelector(".data-table");
const data = await page.$$eval(".data-row", (rows) => rows.map((r) => r.textContent));
return data;
\`\`\`

### closeTab(tabId)

Close a browser tab by id.

**Parameters:**

- \`tabId\` (number): The tab id to close

**Example:**

\`\`\`javascript
const tab = await createTab("https://example.com");
// ...do work...
await closeTab(tab.id);
\`\`\`

### waitForPageLoad(page, options?)

Wait for a page to finish loading by checking document.readyState and monitoring network activity via the Performance API. More reliable than Puppeteer's built-in \`waitUntil\` options because it filters out ads, tracking scripts, and stuck requests that shouldn't block the page from being considered "loaded".

**Parameters:**

- \`page\` (Page): The Puppeteer Page object to wait on
- \`options\` (object, optional):
  - \`timeout\` (number): Maximum wait time in ms (default: 10000)
  - \`pollInterval\` (number): How often to check page state in ms (default: 50)
  - \`minimumWait\` (number): Minimum time to wait even if page appears ready in ms (default: 100)
  - \`waitForNetworkIdle\` (boolean): Wait for no pending requests (default: true)

**Returns:** Object with:

- \`success\` (boolean): Whether the page is considered fully loaded
- \`readyState\` (string): Document ready state when finished ('complete', 'interactive', etc.)
- \`pendingRequests\` (number): Number of pending network requests when finished
- \`waitTimeMs\` (number): Actual time spent waiting in ms
- \`timedOut\` (boolean): Whether the timeout was reached

**Example:**

\`\`\`javascript
const page = await connectToPage(tabId);
await page.goto("https://example.com");
const result = await waitForPageLoad(page);

if (result.success) {
  console.log(\`Page loaded in \${result.waitTimeMs}ms\`);
} else {
  console.log(\`Timeout - \${result.pendingRequests} requests still pending\`);
}
\`\`\`

**Common Pattern - Navigate and Wait:**

\`\`\`javascript
const page = await connectToPage(tabId);
await page.goto("https://complex-spa.com");
await waitForPageLoad(page, { timeout: 15000 });

// Now safe to interact with fully loaded page
const data = await page.$$eval(".content", (els) => els.map((e) => e.textContent));
return data;
\`\`\`

**When to use:**

- After \`page.goto()\` when the page has complex async loading
- After clicking navigation links that trigger client-side routing
- Before taking screenshots to ensure all content is visible
- When \`waitUntil: 'networkidle0'\` is too strict (fails on pages with persistent connections)

### getSnapshot(page)

Get an LLM-friendly ARIA snapshot of the page. Returns a YAML-formatted accessibility tree with element references for interaction. Automatically recurses into iframes.

**Parameters:**

- \`page\` (Page): The Puppeteer Page object

**Returns:** string - YAML representation of the page's accessibility tree

**Example:**

\`\`\`javascript
const page = await connectToPage(tabId);
await page.goto("https://news.ycombinator.com");
await waitForPageLoad(page);

const snapshot = await getSnapshot(page);
console.log(snapshot);
\`\`\`

**Output format:**

\`\`\`yaml
- banner:
    - link "Hacker News" [ref=e1] [cursor=pointer]
    - navigation:
        - link "new" [ref=e2] [cursor=pointer]
        - link "past" [ref=e3] [cursor=pointer]
- main:
    - list:
        - listitem:
            - link "Show HN: My Project" [ref=e8] [cursor=pointer]
            - text: "142 points"
            - link "87 comments" [ref=e9] [cursor=pointer]
- contentinfo:
    - textbox [ref=e10]:
        - /placeholder: "Search"
\`\`\`

**Interpreting the snapshot:**

- \`[ref=eN]\` - Element reference for interaction (only on visible, clickable elements)
- \`[cursor=pointer]\` - Element has pointer cursor (clickable)
- \`[checked]\`, \`[disabled]\`, \`[expanded]\` - Element states
- \`[level=N]\` - Heading level (e.g., \`[level=1]\` for h1)
- \`/url:\`, \`/placeholder:\` - Element properties as child items

**Iframe handling:**

\`\`\`yaml
- main:
  - iframe [ref=e5]
  # iframe e5 (https://example.com/widget):
    - button "Submit" [ref=e6] [cursor=pointer]
    - textbox "Email" [ref=e7]
\`\`\`

**When to use:**

- Discovering page structure without knowing the DOM
- Finding elements to interact with by their accessible names
- Understanding the semantic structure of unknown pages
- Debugging why an interaction isn't working

### getElementByRef(page, ref)

Get a Puppeteer ElementHandle for an element by its snapshot reference.

**Parameters:**

- \`page\` (Page): The Puppeteer Page object
- \`ref\` (string): Element reference from snapshot (e.g., "e5")

**Returns:** ElementHandle - Puppeteer element handle for interaction

**Example:**

\`\`\`javascript
const page = await connectToPage(tabId);
const snapshot = await getSnapshot(page);
console.log(snapshot); // Find the ref you need

// Click on element with ref=e2
const element = await getElementByRef(page, "e2");
await element.click();

// Type into a textbox
const searchBox = await getElementByRef(page, "e10");
await searchBox.type("my search query");
\`\`\`

**Common Pattern - Discover and Interact:**

\`\`\`javascript
const page = await connectToPage(tabId);
await page.goto("https://example.com");
await waitForPageLoad(page);

// Step 1: Discover elements
const snapshot = await getSnapshot(page);
console.log(snapshot);
// Output shows: link "Sign In" [ref=e5] [cursor=pointer]

// Step 2: Interact by ref
const signInButton = await getElementByRef(page, "e5");
await signInButton.click();
await waitForPageLoad(page);

// Step 3: Get new snapshot after navigation
const loginSnapshot = await getSnapshot(page);
console.log(loginSnapshot);
\`\`\`

### clearInput(element)

Clear the contents of an input field. Use this before typing when you want to replace existing text rather than append to it.

**Parameters:**

- \`element\` (ElementHandle): The element to clear (from \`getElementByRef\` or \`page.$\`)

**Returns:** void (Promise)

**Example:**

\`\`\`javascript
const page = await connectToPage(tabId);
const snapshot = await getSnapshot(page);
// snapshot shows: textbox "Email" [ref=e5] value="old@email.com"

// Clear before typing new value
const emailInput = await getElementByRef(page, "e5");
await clearInput(emailInput);
await emailInput.type("new@email.com");
\`\`\`

**When to use:**

- Before typing into a field that may have existing text
- When updating form fields with new values
- More reliable than Ctrl+A because it handles input, textarea, and contenteditable elements

### Filesystem Globals

In addition to browser automation, you have access to a filesystem with two areas:

- **\`/workspace\`** - A virtual filesystem (IndexedDB-backed) that persists across browser sessions. Use this for files you create during automation.
- **\`/mnt/<name>\`** - Mounted directories from the user's local computer. The user can mount local folders through Settings, and they appear here as \`/mnt/folder-name\`. These directories give you read/write access to actual files on the user's computer.

#### readFile(path)

Read a file from the virtual filesystem.

\`\`\`javascript
const content = await readFile("/workspace/config.json");
const data = JSON.parse(content);
return data;
\`\`\`

#### writeFile(path, content)

Write content to a file. Parent directories are created automatically.

\`\`\`javascript
await writeFile("/workspace/output.txt", "Hello World");
await writeFile("/workspace/data.json", JSON.stringify(data, null, 2));
\`\`\`

#### listFiles(path)

List directory contents.

\`\`\`javascript
const files = await listFiles("/workspace/src");
// Returns: ['index.ts', 'utils.ts', 'components']
return files.filter((f) => f.endsWith(".ts"));
\`\`\`

#### Deleting Files

There is no \`deleteFile\` or \`removeFile\` tool. Use bash with \`rm\` to remove files:

\`\`\`javascript
await bash("rm /workspace/temp.txt");
await bash("rm -rf /workspace/old-dir"); // Recursive delete
\`\`\`

#### mkdir(path)

Create a directory (recursive by default).

\`\`\`javascript
await mkdir("/workspace/src/components");
\`\`\`

#### exists(path)

Check if a file or directory exists.

\`\`\`javascript
if (await exists("/workspace/config.json")) {
  const config = await readFile("/workspace/config.json");
}
\`\`\`

#### stat(path)

Get file metadata.

\`\`\`javascript
const info = await stat("/workspace/package.json");
// Returns: { type: 'file'|'directory'|'symlink', size: number, mtime: number }
console.log(\`Size: \${info.size} bytes, Type: \${info.type}\`);
\`\`\`

### bash(command, options?)

Execute a bash command in the virtual Linux-like environment.

\`\`\`javascript
// Simple command
const result = await bash("ls -la /workspace");
// Returns: { stdout, stderr, exitCode }

// Check result
if (result.exitCode === 0) {
  console.log(result.stdout);
} else {
  console.error(result.stderr);
}

// Use with custom working directory
const build = await bash("npm run build", { cwd: "/workspace/project" });
\`\`\`

**Combining browser automation with filesystem:**

\`\`\`javascript
// Scrape data from a website and save it
const tabs = await listTabs();
const page = await connectToPage(tabs[0].id);
const data = await page.evaluate(() => {
  return Array.from(document.querySelectorAll(".item")).map((el) => ({
    title: el.querySelector("h2")?.textContent,
    price: el.querySelector(".price")?.textContent,
  }));
});

// Save to filesystem
await writeFile("/workspace/scraped-data.json", JSON.stringify(data, null, 2));
return \`Saved \${data.length} items to /workspace/scraped-data.json\`;
\`\`\`

## ARIA Snapshot Workflow

Use snapshots when you don't know the page structure. This is the recommended approach for unknown pages:

### Step 1: Get Snapshot

\`\`\`javascript
const page = await connectToPage(tabId);
const snapshot = await getSnapshot(page);
console.log(snapshot);
\`\`\`

### Step 2: Find Your Target

Look for the element you need in the YAML output. Elements are organized by their semantic role (button, link, textbox, etc.) and include their accessible name.

### Step 3: Interact by Ref

\`\`\`javascript
const element = await getElementByRef(page, "e5");
await element.click();
\`\`\`

### Step 4: Verify and Repeat

\`\`\`javascript
// After interaction, get new snapshot to see the result
const newSnapshot = await getSnapshot(page);
console.log(newSnapshot);
\`\`\`

### Tips

**Always start with a snapshot:**

- Snapshots are more stable than CSS selectors
- Even familiar sites change their markup—inspect first, then interact
- Use \`getElementByRef()\` with snapshot references for reliable element access

**Handling dynamic content:**

\`\`\`javascript
// Wait for content to load before taking snapshot
await page.goto("https://example.com");
await waitForPageLoad(page);
await page.waitForSelector(".main-content"); // Optional: wait for specific element
const snapshot = await getSnapshot(page);
\`\`\`

**Iframes are included automatically:**
The snapshot recursively includes accessible iframe content, indented under the iframe element with a comment showing the iframe URL.

## Puppeteer API Reference

The Page object returned by \`connectToPage()\` supports the full Puppeteer API.

### Navigation & Waiting

\`\`\`javascript
// Navigate to URL
await page.goto("https://example.com");
await page.goto("https://example.com", { waitUntil: "networkidle0" });

// Navigation
await page.reload();
await page.goBack();
await page.goForward();

// Wait for elements
await page.waitForSelector(".results");
await page.waitForSelector(".modal", { visible: true });
await page.waitForSelector(".spinner", { hidden: true });

// Wait for navigation (after clicking a link)
await Promise.all([page.waitForNavigation(), page.click("a.next-page")]);

// Wait for custom condition
await page.waitForFunction(() => {
  return document.querySelectorAll(".item").length > 10;
});

// Wait for URL change
await page.waitForFunction((pattern) => window.location.href.includes(pattern), {}, "/success");
\`\`\`

### Input & Interaction

\`\`\`javascript
// Click elements
await page.click("button.submit");
await page.click('a[href="/login"]');

// Type text (clears existing content first with triple-click + type)
await page.click('input[name="email"]', { clickCount: 3 });
await page.type('input[name="email"]', "user@example.com");

// Or just type (appends to existing)
await page.type("#search", "query");

// Type with delay between keystrokes
await page.type("#search", "slow typing", { delay: 100 });

// Focus an element
await page.focus('input[name="password"]');

// Hover over element
await page.hover(".dropdown-trigger");

// Select from dropdown
await page.select("select#country", "US");
await page.select("select#colors", "red", "blue"); // Multiple

// Keyboard input
await page.keyboard.press("Enter");
await page.keyboard.press("Tab");
await page.keyboard.down("Shift");
await page.keyboard.press("Tab");
await page.keyboard.up("Shift");

// Key combinations
await page.keyboard.down("Control");
await page.keyboard.press("a");
await page.keyboard.up("Control");

// Mouse actions
await page.mouse.click(100, 200);
await page.mouse.move(100, 200);
await page.mouse.down();
await page.mouse.up();
\`\`\`

### Data Extraction

\`\`\`javascript
// Run function in page context - PLAIN JAVASCRIPT ONLY
const data = await page.evaluate(() => {
  return {
    title: document.title,
    url: window.location.href,
    heading: document.querySelector("h1")?.textContent,
  };
});

// Extract from single element
const buttonText = await page.$eval("button.submit", (el) => el.textContent);
const href = await page.$eval("a.link", (el) => el.getAttribute("href"));

// Extract from multiple elements
const links = await page.$$eval("a", (anchors) => {
  return anchors.map((a) => ({
    text: a.textContent,
    href: a.href,
  }));
});

const prices = await page.$$eval(".price", (els) => els.map((el) => el.textContent));

// Get text content
const text = await page.textContent(".message");

// Get inner HTML
const html = await page.innerHTML(".container");

// Check if element exists
const exists = (await page.$(".modal")) !== null;

// Count elements
const count = await page.$$eval(".item", (els) => els.length);
\`\`\`

### Screenshots & Debugging

Prefer viewport screenshots for accuracy. Use \`page.screenshot({ encoding: "base64" })\` with \`logImage()\` by default, and only use \`fullPage: true\` when the user explicitly asks for the entire page.

\`\`\`javascript
// Take a viewport screenshot and attach it for the model
const screenshot = await page.screenshot({ encoding: "base64" });
logImage(screenshot);

// Screenshot a specific element
const element = await page.$(".chart");
const elementShot = await element.screenshot({ encoding: "base64" });
logImage(elementShot);

// Get page info
const title = await page.title();
const url = page.url();

// Get full page HTML
const html = await page.content();

// Get viewport size
const viewport = page.viewport();

// Check page state
const state = await page.evaluate(() => ({
  readyState: document.readyState,
  bodyLength: document.body.innerHTML.length,
  forms: document.forms.length,
}));

return { title, url, viewport, state };
\`\`\`

## Debugging with Console.log

Console output is captured and returned with each \`js\` command result. Use \`console.log()\` liberally to:

- Inspect intermediate values
- Trace execution flow
- Debug selector matches
- Verify data before returning

\`\`\`javascript
const tabs = await listTabs();
console.log(\`Found \${tabs.length} tabs\`);

const page = await connectToPage(tabs[0].id);
console.log(\`Connected to: \${page.url()}\`);

const items = await page.$$("li.item");
console.log(\`Found \${items.length} items\`);

for (const item of items) {
  const text = await item.evaluate((el) => el.textContent);
  console.log(\`Processing: \${text}\`);
}

return items.length;
\`\`\`

The output will show all your console.log statements in the \`[Console Output]\` section, making it easy to trace what happened during execution.

## Error Recovery

When things go wrong, use these patterns to debug:

Prefer viewport screenshots for page checks. Share them with \`logImage()\` so they go through the normal image pipeline. Only use \`fullPage: true\` when the user explicitly asks for the entire page.

### Take a Screenshot

\`\`\`javascript
const tabs = await listTabs();
const page = await connectToPage(tabs[0].id);

const screenshot = await page.screenshot({ encoding: "base64" });
logImage(screenshot);
return { url: page.url(), title: await page.title() };
\`\`\`

### Check Current State

\`\`\`javascript
const page = await connectToPage(tabId);

return {
  url: page.url(),
  title: await page.title(),
  bodyText: await page.evaluate(() => document.body.innerText.slice(0, 500)),
  forms: await page.$$eval("form", (forms) => forms.length),
  buttons: await page.$$eval("button", (btns) => btns.map((b) => b.textContent)),
};
\`\`\`

### Graceful Error Handling

\`\`\`javascript
const page = await connectToPage(tabId);

try {
  await page.waitForSelector(".results", { timeout: 5000 });
  return await page.$$eval(".results li", (els) => els.map((e) => e.textContent));
} catch (err) {
  // Element didn't appear - check what's on the page instead
  const screenshot = await page.screenshot({ encoding: "base64" });
  logImage(screenshot);
  return {
    error: "Results not found",
    currentUrl: page.url(),
  };
}
\`\`\`

### Recovery Strategies

1. **Wrong page?** Check \`page.url()\` and navigate if needed
2. **Element not found?** Take a screenshot, inspect the DOM, adjust selector
3. **Timing issue?** Add explicit waits: \`waitForSelector\`, \`waitForNavigation\`
4. **Popup or modal?** Check for overlays blocking interaction
5. **Auth required?** Check if redirected to login page

## Common Patterns

### Login Flow

\`\`\`javascript
const page = await connectToPage(tabId);

await page.goto("https://example.com/login");
await page.waitForSelector('input[name="email"]');

await page.type('input[name="email"]', "user@example.com");
await page.type('input[name="password"]', "password123");

await Promise.all([page.waitForNavigation(), page.click('button[type="submit"]')]);

return { success: true, url: page.url() };
\`\`\`

### Form Submission

\`\`\`javascript
const page = await connectToPage(tabId);

// Fill form fields
await page.type("#name", "John Doe");
await page.type("#email", "john@example.com");
await page.select("#country", "US");

// Check a checkbox
await page.click('input[name="agree"]');

// Submit and wait for response
await Promise.all([page.waitForNavigation(), page.click('button[type="submit"]')]);

return await page.url();
\`\`\`

### Extract Table Data

\`\`\`javascript
const page = await connectToPage(tabId);

const tableData = await page.$$eval("table tr", (rows) => {
  return rows.map((row) => {
    const cells = row.querySelectorAll("td, th");
    return Array.from(cells).map((cell) => cell.textContent.trim());
  });
});

return tableData;
\`\`\`

### Wait for Dynamic Content

\`\`\`javascript
const page = await connectToPage(tabId);

// Click to load more
await page.click(".load-more");

// Wait for new items to appear
await page.waitForFunction(() => {
  return document.querySelectorAll(".item").length > 10;
});

// Now extract
const items = await page.$$eval(".item", (els) => els.map((e) => e.textContent));
return items;
\`\`\`

## Bash Environment

You have access to a persistent bash environment with tools for command execution and file operations. The filesystem is stored in IndexedDB and persists across page refreshes.

### Opening Files in Browser

Use the \`open\` command to open and preview files from the virtual filesystem. This is required because **you cannot use Puppeteer to control or connect to \`file://\` URLs**—the Chrome debugger API only works with \`http://\` and \`https://\` pages.

When you need to view a file you've created (HTML, images, etc.), use \`open\` instead of trying to navigate with Puppeteer:

\`\`\`bash
# Write an HTML file with CSS
cat > /workspace/demo/index.html << 'EOF'
<!DOCTYPE html>
<html>
<head><link rel="stylesheet" href="./styles.css"></head>
<body><h1>Hello World</h1></body>
</html>
EOF

cat > /workspace/demo/styles.css << 'EOF'
body { font-family: sans-serif; background: #f0f0f0; }
h1 { color: #333; }
EOF

# Open in browser
open /workspace/demo/index.html
\`\`\`

The viewer automatically resolves local imports from \`/workspace\`:

- \`<link href>\`, \`<script src>\`, \`<img src>\`
- CSS \`@import\` and \`url()\`
- Inline styles with \`url()\`
- \`<video>\`, \`<audio>\`, \`<iframe>\`

External CDN scripts load normally:

\`\`\`html
<script src="https://d3js.org/d3.v7.min.js"><\/script>
\`\`\`

**Limitations:**

- **You cannot use Puppeteer/connectToPage on file:// URLs** - always use \`open\` for local files
- Dynamic imports (\`import()\`, \`fetch("./file.json")\`) won't resolve local files
- ES modules not supported for local files
- All local files must be within \`/workspace/\`

### Viewer Filesystem Access

HTML files opened in the viewer have access to the same filesystem globals as the eval sandbox. This means your HTML can read, write, and browse files in \`/workspace\` and \`/mnt\`.

**Available globals in viewer HTML:**

- \`readFile(path)\` - Read file contents
- \`writeFile(path, content)\` - Write to a file
- \`listFiles(path)\` - List directory contents
- \`mkdir(path)\` - Create a directory
- \`exists(path)\` - Check if path exists
- \`stat(path)\` - Get file metadata
- \`bash(command, options?)\` - Execute bash commands (use \`rm\` for deleting files)

**Example: Interactive file browser**

\`\`\`html
<!DOCTYPE html>
<html>
  <body>
    <h1>File Browser</h1>
    <ul id="files"></ul>
    <script>
      async function browse(path) {
        const entries = await listFiles(path);
        const list = document.getElementById("files");
        list.innerHTML = "";
        for (const entry of entries) {
          const fullPath = path + "/" + entry;
          const info = await stat(fullPath);
          const li = document.createElement("li");
          li.textContent = entry + (info.type === "directory" ? "/" : "");
          if (info.type === "directory") {
            li.style.cursor = "pointer";
            li.onclick = () => browse(fullPath);
          }
          list.appendChild(li);
        }
      }
      browse("/workspace");
    <\/script>
  </body>
</html>
\`\`\`

**Example: Save user input to filesystem**

\`\`\`html
<!DOCTYPE html>
<html>
  <body>
    <textarea id="editor" rows="10" cols="50"></textarea>
    <button onclick="save()">Save</button>
    <script>
      async function save() {
        const content = document.getElementById("editor").value;
        await writeFile("/workspace/notes.txt", content);
        alert("Saved!");
      }
      // Load existing content
      readFile("/workspace/notes.txt")
        .then((content) => (document.getElementById("editor").value = content))
        .catch(() => {}); // File doesn't exist yet
    <\/script>
  </body>
</html>
\`\`\`

This enables creating interactive tools, data visualizations that load from files, and apps that persist user data—all running in the viewer.

### bash Tool

Execute bash commands in a Linux-like environment.

\`\`\`
Working directory: /workspace
\`\`\`

Common operations:

- \`ls -la\` - List files with details
- \`find . -name '*.ts'\` - Find files by pattern
- \`grep -r 'pattern' .\` - Search file contents
- \`cat <file>\` - View file contents
- \`echo "text" > file\` - Write to file
- \`mkdir -p dir\` - Create directory

Example: List files in workspace

\`\`\`
bash: ls -la /workspace
\`\`\`

Example: Create and run a script

\`\`\`
bash: echo '#!/bin/bash\\necho Hello World' > /workspace/hello.sh
bash: chmod +x /workspace/hello.sh
bash: /workspace/hello.sh
\`\`\`

### readFile Tool

Read the contents of a file from the filesystem.

Example:

\`\`\`
readFile: /workspace/data.json
\`\`\`

### writeFile Tool

Write content to a file. Parent directories are created automatically.

Example:

\`\`\`
writeFile:
  path: /workspace/output.txt
  content: |
    This is the file content.
    Multiple lines are supported.
\`\`\`

### Use Cases for Bash

**Storing data between sessions:**

- Save scraped data to JSON files
- Keep configuration or state
- Store logs or reports

**Text processing:**

- Use \`grep\`, \`sed\`, \`awk\` for text manipulation
- Parse and transform data files

**Scripting:**

- Write shell scripts for complex operations
- Chain commands with pipes and redirects

**Combining with browser automation:**

1. Scrape data from a website using \`js\`
2. Save it to a file using bash
3. Process the data with shell commands
4. Use the processed data in further automation

### Robust Content Extraction

To avoid missing information in long articles due to output truncation:

- **Check for Truncation**: If the content extraction \`js\` call returns a "TRUNCATED" message, read the full file from the path provided in the system message (e.g., \`cat /tmp/truncated-output...\`).
- **Filesystem Bypass**: For extremely long pages, use \`writeFile\` inside the \`page.evaluate\` block (or immediately after) to save the full text to \`/workspace/source_text.txt\`. Then, read it using \`readFile\` or \`bash\` to ensure the model has context for the entire document.
- **Sectional Extraction**: If the article has a table of contents or distinct headers, extract and process it section-by-section to maintain high detail in the generated questions.

## Skills

You have access to specialized skills that extend your capabilities. If skills are available, they are listed in the \`<available_skills>\` section at the end of this prompt.

**Using Skills:**

1. Review the skill descriptions to identify which skill is relevant to the current task
2. Use the \`loadSkill\` tool with the skill's name to activate it
3. Once loaded, follow the skill's instructions carefully
4. The skill's working directory is provided - use it for any file operations related to the skill

**When to Load Skills:**

- Load a skill when the task matches the skill's description
- Skills provide domain-specific knowledge and workflows
- Only load skills when you need their specialized capabilities
`
  , decode = e => atob(e)
  , CLIENT_ID$1 = decode("OWQxYzI1MGEtZTYxYi00NGQ5LTg4ZWQtNTk0NGQxOTYyZjVl")
  , API_BASE_URL$7 = "https://www.dobrowser.io"
  , AUTHORIZE_URL$1 = "https://claude.ai/oauth/authorize"
  , TOKEN_PROXY_URL = `${API_BASE_URL$7}/api/redo/proxy/anthropic-oauth`
  , REDIRECT_URI$1 = "https://console.anthropic.com/oauth/code/callback"
  , CALLBACK_PREFIX = "https://platform.claude.com/oauth/code/callback"
  , SCOPES = "org:create_api_key user:profile user:inference user:sessions:claude_code user:mcp_servers user:file_upload";
async function exchangeTokenViaProxy(e) {
    const t = await fetch(TOKEN_PROXY_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(e)
    });
    if (!t.ok) {
        const r = await t.text();
        throw new Error(`Anthropic OAuth token request failed: ${r}`)
    }
    return await t.json()
}
function base64urlEncode$1(e) {
    let t = "";
    for (const r of e)
        t += String.fromCharCode(r);
    return btoa(t).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}
async function generatePKCE$1() {
    const e = new Uint8Array(32);
    crypto.getRandomValues(e);
    const t = base64urlEncode$1(e)
      , r = new TextEncoder().encode(t)
      , n = await crypto.subtle.digest("SHA-256", r)
      , a = base64urlEncode$1(new Uint8Array(n));
    return {
        verifier: t,
        challenge: a
    }
}
const AUTH_TIMEOUT_MS$1 = 300 * 1e3;
function waitForCallbackTab$1(e, t, r) {
    return new Promise( (n, a) => {
        const s = () => {
            chrome.tabs.onUpdated.removeListener(o),
            chrome.tabs.onRemoved.removeListener(l)
        }
          , o = (u, c, p) => {
            if (!p.url?.startsWith(t))
                return;
            s();
            const d = chrome.runtime.getURL("auth-success.html?provider=anthropic");
            chrome.tabs.update(u, {
                url: d
            }).catch( () => {
                chrome.tabs.remove(u).catch( () => {}
                )
            }
            ),
            n(new URL(p.url))
        }
          , l = u => {
            u === e && (s(),
            a(new Error("Auth tab was closed before completing sign-in")))
        }
        ;
        r.addEventListener("abort", () => {
            s(),
            a(r.reason ?? new Error("Auth flow cancelled"))
        }
        ),
        chrome.tabs.onUpdated.addListener(o),
        chrome.tabs.onRemoved.addListener(l)
    }
    )
}
async function loginAnthropic(e, t) {
    const {verifier: r, challenge: n} = await generatePKCE$1()
      , a = new URLSearchParams({
        code: "true",
        client_id: CLIENT_ID$1,
        response_type: "code",
        redirect_uri: REDIRECT_URI$1,
        scope: SCOPES,
        code_challenge: n,
        code_challenge_method: "S256",
        state: r
    })
      , s = `${AUTHORIZE_URL$1}?${a.toString()}`
      , o = await e(s)
      , l = new AbortController
      , u = setTimeout( () => l.abort(new Error("Auth timed out")), AUTH_TIMEOUT_MS$1);
    t?.addEventListener("abort", () => l.abort(t.reason ?? new Error("Auth flow cancelled")));
    let c;
    try {
        c = await waitForCallbackTab$1(o, CALLBACK_PREFIX, l.signal)
    } finally {
        clearTimeout(u)
    }
    const p = c.searchParams.get("code")
      , d = c.searchParams.get("state");
    if (!p)
        throw new Error("No code in callback URL");
    if (!d)
        throw new Error("No state in callback URL");
    const f = await exchangeTokenViaProxy({
        grant_type: "authorization_code",
        code: p,
        state: d,
        redirect_uri: REDIRECT_URI$1,
        code_verifier: r
    });
    return {
        refresh: f.refresh_token,
        access: f.access_token,
        expires: Date.now() + f.expires_in * 1e3 - 300 * 1e3
    }
}
async function refreshAnthropicToken(e) {
    const t = await exchangeTokenViaProxy({
        grant_type: "refresh_token",
        refresh_token: e
    });
    return {
        refresh: t.refresh_token,
        access: t.access_token,
        expires: Date.now() + t.expires_in * 1e3 - 300 * 1e3
    }
}
const STORAGE_KEY$2 = "anthropicOAuthCredentials";
async function storeCredentials$1(e) {
    await chrome.storage.local.set({
        [STORAGE_KEY$2]: e
    })
}
async function loadCredentials$1() {
    return (await chrome.storage.local.get(STORAGE_KEY$2))[STORAGE_KEY$2] ?? null
}
async function clearCredentials$1() {
    await chrome.storage.local.remove(STORAGE_KEY$2)
}
async function getValidAccessToken$1() {
    const e = await loadCredentials$1();
    if (!e)
        return null;
    if (e.expires < Date.now())
        try {
            const t = await refreshAnthropicToken(e.refresh);
            return await storeCredentials$1(t),
            t.access
        } catch {
            return await clearCredentials$1(),
            null
        }
    return e.access
}
const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann"
  , AUTHORIZE_URL = "https://auth.openai.com/oauth/authorize"
  , TOKEN_URL = "https://auth.openai.com/oauth/token"
  , REDIRECT_URI = "http://localhost:1455/auth/callback"
  , SCOPE = "openid profile email offline_access"
  , JWT_CLAIM_PATH = "https://api.openai.com/auth";
function base64urlEncode(e) {
    let t = "";
    for (const r of e)
        t += String.fromCharCode(r);
    return btoa(t).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}
async function generatePKCE() {
    const e = new Uint8Array(32);
    crypto.getRandomValues(e);
    const t = base64urlEncode(e)
      , r = new TextEncoder().encode(t)
      , n = await crypto.subtle.digest("SHA-256", r)
      , a = base64urlEncode(new Uint8Array(n));
    return {
        verifier: t,
        challenge: a
    }
}
function decodeJwt(e) {
    const t = e.split(".");
    if (t.length !== 3)
        throw new Error("Invalid JWT");
    const r = t[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(r))
}
function getAccountId(e) {
    const n = decodeJwt(e)[JWT_CLAIM_PATH]?.chatgpt_account_id;
    if (!n)
        throw new Error("No chatgpt_account_id in token");
    return n
}
const AUTH_TIMEOUT_MS = 300 * 1e3;
function waitForCallbackTab(e, t, r) {
    return new Promise( (n, a) => {
        const s = () => {
            chrome.tabs.onUpdated.removeListener(o),
            chrome.tabs.onRemoved.removeListener(l)
        }
          , o = (u, c, p) => {
            if (!p.url?.startsWith(t))
                return;
            s();
            const d = chrome.runtime.getURL("auth-success.html?provider=openai");
            chrome.tabs.update(u, {
                url: d
            }).catch( () => {
                chrome.tabs.remove(u).catch( () => {}
                )
            }
            ),
            n(new URL(p.url))
        }
          , l = u => {
            u === e && (s(),
            a(new Error("Auth tab was closed before completing sign-in")))
        }
        ;
        r.addEventListener("abort", () => {
            s(),
            a(r.reason ?? new Error("Auth flow cancelled"))
        }
        ),
        chrome.tabs.onUpdated.addListener(o),
        chrome.tabs.onRemoved.addListener(l)
    }
    )
}
async function loginOpenAI(e, t) {
    const {verifier: r, challenge: n} = await generatePKCE()
      , a = base64urlEncode(crypto.getRandomValues(new Uint8Array(16)))
      , s = new URLSearchParams({
        client_id: CLIENT_ID,
        response_type: "code",
        redirect_uri: REDIRECT_URI,
        scope: SCOPE,
        code_challenge: n,
        code_challenge_method: "S256",
        state: a,
        codex_cli_simplified_flow: "true",
        originator: "do-browser"
    })
      , o = `${AUTHORIZE_URL}?${s.toString()}`
      , l = await e(o)
      , u = new AbortController
      , c = setTimeout( () => u.abort(new Error("Auth timed out")), AUTH_TIMEOUT_MS);
    t?.addEventListener("abort", () => u.abort(t.reason ?? new Error("Auth flow cancelled")));
    let p;
    try {
        p = await waitForCallbackTab(l, REDIRECT_URI, u.signal)
    } finally {
        clearTimeout(c)
    }
    const d = p.searchParams.get("code");
    if (!d)
        throw new Error("No code in callback URL");
    const f = await fetch(TOKEN_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            grant_type: "authorization_code",
            client_id: CLIENT_ID,
            code: d,
            redirect_uri: REDIRECT_URI,
            code_verifier: r
        })
    });
    if (!f.ok) {
        const g = await f.text();
        throw new Error(`Token exchange failed: ${g}`)
    }
    const h = await f.json()
      , m = getAccountId(h.access_token);
    return {
        refresh: h.refresh_token,
        access: h.access_token,
        expires: Date.now() + h.expires_in * 1e3 - 300 * 1e3,
        accountId: m
    }
}
async function refreshOpenAIToken(e) {
    const t = await fetch(TOKEN_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            grant_type: "refresh_token",
            client_id: CLIENT_ID,
            refresh_token: e
        })
    });
    if (!t.ok) {
        const a = await t.text();
        throw new Error(`OpenAI token refresh failed: ${a}`)
    }
    const r = await t.json()
      , n = getAccountId(r.access_token);
    return {
        refresh: r.refresh_token,
        access: r.access_token,
        expires: Date.now() + r.expires_in * 1e3 - 300 * 1e3,
        accountId: n
    }
}
const STORAGE_KEY$1 = "openaiOAuthCredentials";
async function storeCredentials(e) {
    await chrome.storage.local.set({
        [STORAGE_KEY$1]: e
    })
}
async function loadCredentials() {
    return (await chrome.storage.local.get(STORAGE_KEY$1))[STORAGE_KEY$1] ?? null
}
async function clearCredentials() {
    await chrome.storage.local.remove(STORAGE_KEY$1)
}
async function getValidAccessToken() {
    const e = await loadCredentials();
    if (!e)
        return null;
    if (e.expires < Date.now())
        try {
            const t = await refreshOpenAIToken(e.refresh);
            return await storeCredentials(t),
            t.access
        } catch {
            return await clearCredentials(),
            null
        }
    return e.access
}
function createFileOps() {
    return {
        read: new Set,
        written: new Set,
        edited: new Set
    }
}
function extractFileOpsFromMessage(e, t) {
    if (e.role === "assistant" && Array.isArray(e.content))
        for (const r of e.content) {
            if (typeof r != "object" || r === null || !("type"in r) || r.type !== "toolCall" || !("arguments"in r) || !("name"in r))
                continue;
            const n = r.arguments;
            if (!n)
                continue;
            const a = typeof n.path == "string" ? n.path : void 0;
            if (a)
                switch (r.name) {
                case "readFile":
                case "read":
                    t.read.add(a);
                    break;
                case "writeFile":
                case "write":
                    t.written.add(a);
                    break;
                case "edit":
                    t.edited.add(a);
                    break
                }
        }
}
function computeFileLists(e) {
    const t = new Set([...e.edited, ...e.written])
      , r = [...e.read].filter(a => !t.has(a)).sort()
      , n = [...t].sort();
    return {
        readFiles: r,
        modifiedFiles: n
    }
}
function formatFileOperations(e, t) {
    const r = [];
    return e.length > 0 && r.push(`<read-files>
${e.join(`
`)}
</read-files>`),
    t.length > 0 && r.push(`<modified-files>
${t.join(`
`)}
</modified-files>`),
    r.length === 0 ? "" : `

${r.join(`

`)}`
}
function serializeConversation(e) {
    const t = [];
    for (const r of e) {
        if (r.role === "user") {
            const n = typeof r.content == "string" ? r.content : r.content.filter(a => a.type === "text").map(a => a.text).join("");
            n && t.push(`[User]: ${n}`);
            continue
        }
        if (r.role === "assistant") {
            const n = []
              , a = []
              , s = [];
            for (const o of r.content)
                if (o.type === "text")
                    n.push(o.text);
                else if (o.type === "thinking")
                    a.push(o.thinking);
                else if (o.type === "toolCall") {
                    const l = o.arguments
                      , u = Object.entries(l).map( ([c,p]) => `${c}=${JSON.stringify(p)}`).join(", ");
                    s.push(`${o.name}(${u})`)
                }
            a.length > 0 && t.push(`[Assistant thinking]: ${a.join(`
`)}`),
            n.length > 0 && t.push(`[Assistant]: ${n.join(`
`)}`),
            s.length > 0 && t.push(`[Assistant tool calls]: ${s.join("; ")}`);
            continue
        }
        if (r.role === "toolResult") {
            const n = r.content.filter(a => a.type === "text").map(a => a.text).join("");
            n && t.push(`[Tool result]: ${n}`)
        }
    }
    return t.join(`

`)
}
const PROXY_API_KEY_PLACEHOLDER = "proxy"
  , SUMMARIZATION_SYSTEM_PROMPT = `You are a context summarization assistant. Your task is to read a conversation between a user and an AI coding assistant, then produce a structured summary following the exact format specified.

Do NOT continue the conversation. Do NOT respond to any questions in the conversation. ONLY output the structured summary.`
  , SUMMARIZATION_PROMPT = `The messages above are a conversation to summarize. Create a structured context checkpoint summary that another LLM will use to continue the work.

Use this EXACT format:

## Goal
[What is the user trying to accomplish? Can be multiple items if the session covers different tasks.]

## Constraints & Preferences
- [Any constraints, preferences, or requirements mentioned by user]
- [Or "(none)" if none were mentioned]

## Progress
### Done
- [x] [Completed tasks/changes]

### In Progress
- [ ] [Current work]

### Blocked
- [Issues preventing progress, if any]

## Key Decisions
- **[Decision]**: [Brief rationale]

## Next Steps
1. [Ordered list of what should happen next]

## Critical Context
- [Any data, examples, or references needed to continue]
- [Or "(none)" if not applicable]

Keep each section concise. Preserve exact file paths, function names, and error messages.`
  , UPDATE_SUMMARIZATION_PROMPT = `The messages above are NEW conversation messages to incorporate into the existing summary provided in <previous-summary> tags.

Update the existing structured summary with new information. RULES:
- PRESERVE all existing information from the previous summary
- ADD new progress, decisions, and context from the new messages
- UPDATE the Progress section: move items from "In Progress" to "Done" when completed
- UPDATE "Next Steps" based on what was accomplished
- PRESERVE exact file paths, function names, and error messages
- If something is no longer relevant, you may remove it

Use this EXACT format:

## Goal
[Preserve existing goals, add new ones if the task expanded]

## Constraints & Preferences
- [Preserve existing, add new ones discovered]

## Progress
### Done
- [x] [Include previously done items AND newly completed items]

### In Progress
- [ ] [Current work - update based on progress]

### Blocked
- [Current blockers - remove if resolved]

## Key Decisions
- **[Decision]**: [Brief rationale] (preserve all previous, add new)

## Next Steps
1. [Update based on current state]

## Critical Context
- [Preserve important context, add new if needed]

Keep each section concise. Preserve exact file paths, function names, and error messages.`
  , TURN_PREFIX_SUMMARIZATION_PROMPT = `This is the PREFIX of a turn that was too large to keep. The SUFFIX (recent work) is retained.

Summarize the prefix to provide context for the retained suffix:

## Original Request
[What did the user ask for in this turn?]

## Early Progress
- [Key decisions and work done in the prefix]

## Context for Suffix
- [Information needed to understand the retained recent work]

Be concise. Focus on what's needed to understand the kept suffix.`;
async function getSessionToken() {
    return await getStoredToken() || void 0
}
async function resolveSummarizationAuth(e, t) {
    let r, n = t.useProxy ? PROXY_API_KEY_PLACEHOLDER : t.geminiApiKey;
    const a = typeof e.baseUrl == "string" && e.baseUrl.includes("/api/redo/proxy/");
    if (t.useProxy) {
        const s = await getSessionToken();
        s && (r = {
            Authorization: `Bearer ${s}`
        })
    }
    if (e.provider === "anthropic") {
        const s = await getValidAccessToken$1();
        if (!s)
            throw new Error("Anthropic OAuth token expired. Please sign in again.");
        n = s;
        const o = await getSessionToken();
        o && (r = {
            ...r,
            "X-Redo-Auth": `Bearer ${o}`
        })
    }
    if (e.provider === "openai-codex") {
        const s = await getValidAccessToken();
        if (!s)
            throw new Error("OpenAI OAuth token expired. Please sign in again.");
        n = s;
        const o = await getSessionToken();
        o && (r = {
            ...r,
            "X-Redo-Auth": `Bearer ${o}`
        })
    }
    return !n && a && (n = PROXY_API_KEY_PLACEHOLDER),
    {
        apiKey: n,
        headers: r
    }
}
function extractTextContent$1(e) {
    return e.filter(t => t.type === "text").map(t => t.text).join(`
`)
}
async function generateSummary(e, t, r, n) {
    const a = Math.floor(.8 * n.reserveTokens)
      , s = convertToLlm(e)
      , o = serializeConversation(s);
    let l = n.previousSummary ? UPDATE_SUMMARIZATION_PROMPT : SUMMARIZATION_PROMPT;
    n.customInstructions && (l = `${l}

Additional focus: ${n.customInstructions}`);
    let u = `<conversation>
${o}
</conversation>

`;
    n.previousSummary && (u += `<previous-summary>
${n.previousSummary}
</previous-summary>

`),
    u += l;
    const {apiKey: c, headers: p} = await resolveSummarizationAuth(t, r)
      , d = await completeSimple(t, {
        systemPrompt: SUMMARIZATION_SYSTEM_PROMPT,
        messages: [{
            role: "user",
            content: [{
                type: "text",
                text: u
            }],
            timestamp: Date.now()
        }]
    }, {
        apiKey: c,
        headers: p,
        signal: n.abortSignal,
        maxTokens: a,
        reasoning: "high"
    });
    if (d.stopReason === "error")
        throw new Error(`Summarization failed: ${d.errorMessage || "Unknown error"}`);
    return extractTextContent$1(d.content)
}
async function generateTurnPrefixSummary(e, t, r, n) {
    const a = convertToLlm(e)
      , o = `<conversation>
${serializeConversation(a)}
</conversation>

${TURN_PREFIX_SUMMARIZATION_PROMPT}`
      , l = Math.floor(.5 * n.reserveTokens)
      , {apiKey: u, headers: c} = await resolveSummarizationAuth(t, r)
      , p = await completeSimple(t, {
        systemPrompt: SUMMARIZATION_SYSTEM_PROMPT,
        messages: [{
            role: "user",
            content: [{
                type: "text",
                text: o
            }],
            timestamp: Date.now()
        }]
    }, {
        apiKey: u,
        headers: c,
        signal: n.abortSignal,
        maxTokens: l
    });
    if (p.stopReason === "error")
        throw new Error(`Turn prefix summarization failed: ${p.errorMessage || "Unknown error"}`);
    return extractTextContent$1(p.content)
}
const TURN_START_ROLES = new Set(["user", "custom", "compactionSummary"])
  , VALID_CUT_ROLES = new Set(["user", "assistant", "custom", "compactionSummary"]);
function getAssistantUsage(e) {
    if (e.role !== "assistant")
        return;
    const t = e;
    if (!(t.stopReason === "aborted" || t.stopReason === "error"))
        return t.usage
}
function getLastAssistantUsageInfo(e) {
    for (let t = e.length - 1; t >= 0; t--) {
        const r = getAssistantUsage(e[t]);
        if (r)
            return {
                usage: r,
                index: t
            }
    }
}
function getLatestCompactionSummaryIndex(e) {
    for (let t = e.length - 1; t >= 0; t--)
        if (isCompactionSummaryMessage(e[t]))
            return t;
    return -1
}
function isTurnStartMessage(e) {
    return TURN_START_ROLES.has(e.role)
}
function findValidCutPoints(e, t, r) {
    const n = [];
    for (let a = t; a < r; a++)
        VALID_CUT_ROLES.has(e[a].role) && n.push(a);
    return n
}
function calculateContextTokens(e) {
    return e.totalTokens || e.input + e.output + e.cacheRead + e.cacheWrite
}
function estimateTokens(e) {
    let t = 0;
    switch (e.role) {
    case "user":
        {
            if (typeof e.content == "string")
                t = e.content.length;
            else
                for (const r of e.content)
                    r.type === "text" && (t += r.text.length),
                    r.type === "image" && (t += 4800);
            return Math.ceil(t / 4)
        }
    case "assistant":
        {
            for (const r of e.content)
                r.type === "text" ? t += r.text.length : r.type === "thinking" ? t += r.thinking.length : r.type === "toolCall" && (t += r.name.length + JSON.stringify(r.arguments).length);
            return Math.ceil(t / 4)
        }
    case "toolResult":
        {
            for (const r of e.content)
                r.type === "text" && (t += r.text.length),
                r.type === "image" && (t += 4800);
            return Math.ceil(t / 4)
        }
    case "custom":
        {
            if (typeof e.content == "string")
                t = e.content.length;
            else
                for (const r of e.content)
                    r.type === "text" && (t += r.text.length),
                    r.type === "image" && (t += 4800);
            return Math.ceil(t / 4)
        }
    case "compactionSummary":
        return Math.ceil(e.summary.length / 4)
    }
    return 0
}
function estimateContextTokens(e) {
    const t = getLastAssistantUsageInfo(e);
    if (!t) {
        let a = 0;
        for (const s of e)
            a += estimateTokens(s);
        return {
            tokens: a,
            usageTokens: 0,
            trailingTokens: a,
            lastUsageIndex: null
        }
    }
    const r = calculateContextTokens(t.usage);
    let n = 0;
    for (let a = t.index + 1; a < e.length; a++)
        n += estimateTokens(e[a]);
    return {
        tokens: r + n,
        usageTokens: r,
        trailingTokens: n,
        lastUsageIndex: t.index
    }
}
function shouldCompact(e, t, r) {
    return !r.enabled || t <= 0 ? !1 : e > t - r.reserveTokens
}
function findTurnStartIndex(e, t, r) {
    for (let n = t; n >= r; n--)
        if (isTurnStartMessage(e[n]))
            return n;
    return -1
}
function findCutPoint(e, t, r, n) {
    const a = findValidCutPoints(e, t, r);
    if (a.length === 0)
        return {
            firstKeptMessageIndex: t,
            turnStartIndex: -1,
            isSplitTurn: !1
        };
    let s = 0
      , o = a[0];
    for (let p = r - 1; p >= t; p--)
        if (s += estimateTokens(e[p]),
        s >= n) {
            for (const d of a)
                if (d >= p) {
                    o = d;
                    break
                }
            break
        }
    const l = e[o]
      , u = isTurnStartMessage(l)
      , c = u ? -1 : findTurnStartIndex(e, o, t);
    return {
        firstKeptMessageIndex: o,
        turnStartIndex: c,
        isSplitTurn: !u && c !== -1
    }
}
function prepareCompaction(e, t) {
    if (e.length === 0 || isCompactionSummaryMessage(e[e.length - 1]))
        return;
    const r = getLatestCompactionSummaryIndex(e)
      , n = r + 1
      , a = e.length;
    if (n >= a)
        return;
    const s = r >= 0 ? r : 0
      , o = estimateContextTokens(e.slice(s)).tokens
      , l = findCutPoint(e, n, a, t.keepRecentTokens)
      , u = l.isSplitTurn ? l.turnStartIndex : l.firstKeptMessageIndex
      , c = e.slice(n, u)
      , p = l.isSplitTurn ? e.slice(l.turnStartIndex, l.firstKeptMessageIndex) : []
      , d = e.slice(l.firstKeptMessageIndex);
    if (c.length === 0 && p.length === 0)
        return;
    const f = r >= 0 && e[r].role === "compactionSummary" ? e[r].summary : void 0
      , h = createFileOps();
    for (const m of c)
        extractFileOpsFromMessage(m, h);
    for (const m of p)
        extractFileOpsFromMessage(m, h);
    return {
        messagesToSummarize: c,
        turnPrefixMessages: p,
        keptRecentMessages: d,
        isSplitTurn: l.isSplitTurn,
        tokensBefore: o,
        previousSummary: f,
        fileOps: h,
        settings: t
    }
}
async function compactPreparedContext(e, t, r, n) {
    const {messagesToSummarize: a, turnPrefixMessages: s, keptRecentMessages: o, isSplitTurn: l, previousSummary: u, fileOps: c, settings: p, tokensBefore: d} = e;
    let f;
    if (l && s.length > 0) {
        const [x,b] = await Promise.all([a.length > 0 ? generateSummary(a, t, r, {
            reserveTokens: p.reserveTokens,
            previousSummary: u,
            abortSignal: n
        }) : Promise.resolve(u ?? "No prior history."), generateTurnPrefixSummary(s, t, r, {
            reserveTokens: p.reserveTokens,
            abortSignal: n
        })]);
        f = `${x}

---

**Turn Context (split turn):**

${b}`
    } else
        f = await generateSummary(a, t, r, {
            reserveTokens: p.reserveTokens,
            previousSummary: u,
            abortSignal: n
        });
    const {readFiles: h, modifiedFiles: m} = computeFileLists(c);
    f += formatFileOperations(h, m);
    const g = [createCompactionSummaryMessage(f, d), ...o];
    return {
        summary: f,
        compactedMessages: g,
        tokensBefore: d,
        details: {
            readFiles: h,
            modifiedFiles: m
        }
    }
}
const DEFAULT_COMPACTION_SETTINGS = {
    enabled: !0,
    reserveTokens: 16384,
    keepRecentTokens: 2e4
};
function canUseDocumentTools({useProxy: e, hasActiveSubscription: t}) {
    return e || !!t
}
const log$8 = logger.scoped("AgentEnvironment")
  , compactionLog$1 = logger.scoped("compaction")
  , titleLog$1 = logger.scoped("title")
  , PROXY_BASE_URL = "https://www.dobrowser.io"
  , OPENAI_OAUTH_DEFAULT_MODEL = "gpt-5.4"
  , OPENAI_OAUTH_BASE_URL = "https://chatgpt.com/backend-api";
function getAnthropicModel(e) {
    const t = getModel("anthropic", e);
    if (t)
        return t;
    throw new Error(`Unknown Anthropic model: ${e}`)
}
function getOpenAIOAuthModel(e) {
    const t = getModel("openai-codex", e);
    if (t)
        return t;
    const r = getModel("openai", e);
    if (r)
        return {
            ...r,
            api: "openai-codex-responses",
            provider: "openai-codex",
            baseUrl: OPENAI_OAUTH_BASE_URL
        };
    throw new Error(`Unknown OpenAI OAuth model: ${e}`)
}
const systemPrompt = systemPromptContent;
function getAgentConfigKey(e) {
    const t = `thread:${e.threadId}`
      , r = canUseDocumentTools({
        useProxy: e.useProxy,
        hasActiveSubscription: e.hasActiveSubscription
    }) ? "docs:on" : "docs:off";
    return e.provider === "anthropic-oauth" ? `anthropic-oauth:${e.anthropicModel ?? "claude-haiku-4-5"}:${r}:${t}` : e.provider === "openai-oauth" ? `openai-oauth:${e.openaiModel ?? OPENAI_OAUTH_DEFAULT_MODEL}:${r}:${t}` : e.useProxy ? `proxy:${e.hostedModel ?? "gemini"}:${r}:${t}` : `gemini:${e.geminiApiKey}:${r}:${t}`
}
let environmentCounter = 0;
class AgentEnvironment {
    instanceId;
    notifier;
    iframe = null;
    cdpHandler = null;
    bashInstance = null;
    fsInstance = null;
    agent = null;
    stepFinishListeners = new Set;
    isInitialized = !1;
    isDestroyed = !1;
    config;
    parentElement;
    compactionCallbacks;
    pendingCompaction = !1;
    compactionAbortController = null;
    modelInstance = null;
    instructionsContent = null;
    skillsService = null;
    availableSkills = [];
    ready;
    constructor(t) {
        this.instanceId = `agent-env-${++environmentCounter}`;
        const r = t.config.threadId ?? this.instanceId;
        this.notifier = createNotifier(r),
        this.config = t.config,
        this.parentElement = t.parentElement,
        this.compactionCallbacks = t.compactionCallbacks,
        this.ready = this.initialize()
    }
    async initialize() {
        if (this.isDestroyed)
            throw new Error("AgentEnvironment has been destroyed");
        log$8.log(" Starting initialization..."),
        this.iframe = this.createSandboxIframe(),
        this.parentElement.appendChild(this.iframe),
        log$8.log(" Iframe created and appended"),
        await this.waitForIframeLoad(),
        log$8.log(" Iframe loaded"),
        this.cdpHandler = new CdpHandler(this.iframe,{
            getBashInstance: () => this.bashInstance,
            getFsInstance: () => this.fsInstance
        }),
        log$8.log(" CdpHandler created"),
        await this.cdpHandler.waitForSandboxReady(),
        log$8.log(" Sandbox ready"),
        log$8.log(" Initializing filesystem (will check mount permissions)..."),
        this.fsInstance = await getUnifiedFsInstance(),
        log$8.log(" Filesystem ready");
        const r = (await __vitePreload( () => import("./unified-fs-CyCorSUy.js").then(a => a.u), __vite__mapDeps([7, 1])).then(a => a.getUnifiedFs())).getMounts();
        if (r.length > 0) {
            log$8.log(" Mount status:");
            for (const a of r)
                log$8.log(`  - /mnt/${a.name}: ${a.status}${a.status === "disconnected" ? " (agent cannot access - needs re-authorization)" : ""}`)
        } else
            log$8.log(" No mounts configured");
        try {
            await this.fsInstance.mkdir("/workspace", {
                recursive: !0
            })
        } catch {}
        this.bashInstance = new Ju({
            fs: this.fsInstance,
            cwd: "/workspace",
            customCommands: [this.createOpenCommand()]
        }),
        log$8.log(" Bash instance created"),
        this.skillsService = new SkillsService(this.fsInstance);
        const n = await this.skillsService.refreshSkills();
        if (this.availableSkills = n.skills,
        log$8.log(`Discovered ${this.availableSkills.length} skills`),
        n.validationErrors.length > 0) {
            const a = n.validationErrors.length;
            log$8.warn(` ${a} skills failed validation`);
            const s = n.validationErrors.map(o => `${o.folderName}: ${o.errors.map(l => l.message).join(", ")}`);
            this.notifier.warning(a === 1 ? "1 skill failed validation" : `${a} skills failed validation`, s)
        }
        this.agent = await this.createAgent(),
        log$8.log(" Agent created"),
        this.isInitialized = !0,
        log$8.log(" Initialization complete")
    }
    createSandboxIframe() {
        const t = document.createElement("iframe");
        return t.src = "/sandbox.html",
        t.style.display = "none",
        t.title = "Eval Sandbox",
        t
    }
    waitForIframeLoad() {
        return new Promise( (t, r) => {
            if (!this.iframe) {
                r(new Error("Iframe not created"));
                return
            }
            const n = () => {
                this.iframe?.removeEventListener("load", n),
                t()
            }
            ;
            this.iframe.addEventListener("load", n)
        }
        )
    }
    createOpenCommand() {
        return Tx("open", async (t, r) => {
            let n = t[0];
            if (!n)
                return {
                    stdout: "",
                    stderr: `Usage: open <file>
`,
                    exitCode: 1
                };
            n.startsWith("file://") && (n = n.slice(7));
            const a = r.fs.resolvePath(r.cwd, n)
              , s = a.startsWith("/workspace/") || a === "/workspace"
              , o = a.startsWith("/mnt/");
            if (!s && !o)
                return {
                    stdout: "",
                    stderr: `Error: Can only open files within /workspace/ or /mnt/
`,
                    exitCode: 1
                };
            if (!await r.fs.exists(a))
                return {
                    stdout: "",
                    stderr: `Error: File not found: ${a}
`,
                    exitCode: 1
                };
            const u = `chrome-extension://${chrome.runtime.id}/viewer.html?file=${encodeURIComponent(a)}`;
            return await chrome.tabs.create({
                url: u
            }),
            {
                stdout: `Opened ${a}
`,
                stderr: "",
                exitCode: 0
            }
        }
        )
    }
    buildInstructions() {
        if (this.skillsService && this.availableSkills.length > 0) {
            const t = this.skillsService.generateSkillsPrompt(this.availableSkills);
            return `${systemPrompt}

${t}`
        }
        return systemPrompt
    }
    createModel() {
        const t = this.config;
        if (t.provider === "anthropic-oauth")
            return {
                model: {
                    ...getAnthropicModel(t.anthropicModel ?? "claude-haiku-4-5"),
                    baseUrl: `${PROXY_BASE_URL}/api/redo/proxy/anthropic/`
                },
                instructions: this.buildInstructions()
            };
        if (t.provider === "openai-oauth") {
            const n = t.openaiModel ?? OPENAI_OAUTH_DEFAULT_MODEL;
            return {
                model: {
                    ...getOpenAIOAuthModel(n),
                    baseUrl: `${PROXY_BASE_URL}/api/redo/proxy/openai/`
                },
                instructions: this.buildInstructions()
            }
        }
        if (!t.useProxy && !t.geminiApiKey)
            throw new Error("Gemini API key is required when not using proxy");
        if (t.useProxy && t.hostedModel && t.hostedModel !== "gemini")
            return {
                model: {
                    ...getModel("openai", t.hostedModel),
                    baseUrl: `${PROXY_BASE_URL}/api/redo/proxy/openai-api/`
                },
                instructions: this.buildInstructions()
            };
        let r = getModel("google", "gemini-3-flash-preview");
        return t.useProxy && (r = {
            ...r,
            baseUrl: `${PROXY_BASE_URL}/api/redo/proxy/google/`
        }),
        {
            model: r,
            instructions: this.buildInstructions()
        }
    }
    buildGetApiKey(t) {
        switch (t.provider) {
        case "anthropic-oauth":
            return async () => {
                const r = await getValidAccessToken$1();
                if (!r)
                    throw new Error("Anthropic OAuth token expired. Please sign in again.");
                return r
            }
            ;
        case "openai-oauth":
            return async () => {
                const r = await getValidAccessToken();
                if (!r)
                    throw new Error("OpenAI OAuth token expired. Please sign in again.");
                return r
            }
            ;
        case "gemini":
            return () => t.geminiApiKey;
        default:
            return () => "proxy"
        }
    }
    async createAgent() {
        const {model: t, instructions: r} = this.createModel();
        this.modelInstance = t,
        this.instructionsContent = r;
        const n = this.compactionCallbacks
          , a = this.config
          , s = canUseDocumentTools({
            useProxy: this.config.useProxy,
            hasActiveSubscription: this.config.hasActiveSubscription
        });
        log$8.log(" Creating bash tools...");
        const o = createBashTools(this.bashInstance, this.fsInstance, {
            execInSandbox: (f, h) => this.execInSandbox(f, h),
            readPdf: s ? async f => readPdfFromBrowser(f) : async () => {
                throw new Error(PDF_PAID_PLAN_MESSAGE)
            }
            ,
            readDoc: s ? async f => readDocFromBrowser(f) : async () => {
                throw new Error(DOC_PAID_PLAN_MESSAGE)
            }
            ,
            readSheet: s ? async f => readSheetFromBrowser(f) : async () => {
                throw new Error(SHEET_PAID_PLAN_MESSAGE)
            }
        });
        log$8.log(" Bash tools created:", o.map(f => f.name));
        const l = this.skillsService ? createLoadSkillTool(this.skillsService, this.fsInstance) : void 0
          , u = this.config.useProxy ? createWebSearchTool(this.fsInstance) : void 0
          , c = [...l ? [l] : [], ...u ? [u] : [], ...o];
        log$8.log(" Creating pi-agent Agent...");
        const p = this.buildGetApiKey(a)
          , d = new Agent({
            convertToLlm,
            transformContext: async (f, h) => this.handleCompaction(f, n, h),
            getApiKey: p
        });
        return d.setModel(t),
        d.sessionId = a.threadId,
        d.setSystemPrompt(r),
        d.setTools(c),
        d.subscribe(f => {
            if (f.type === "turn_end") {
                const h = f.message;
                if (h && "usage"in h) {
                    const m = h.usage;
                    this.emitStepFinish({
                        usage: m
                    })
                }
            }
            f.type === "tool_execution_start" && log$8.log(" Tool execution start:", f.toolName),
            f.type === "tool_execution_end" && log$8.log(" Tool execution end:", f.toolName, {
                isError: f.isError
            })
        }
        ),
        d
    }
    async handleCompaction(t, r, n) {
        if (!this.modelInstance)
            return t;
        const a = DEFAULT_COMPACTION_SETTINGS
          , s = this.modelInstance.contextWindow ?? 0
          , o = estimateContextTokens(t);
        return !this.pendingCompaction && !shouldCompact(o.tokens, s, a) ? t : (this.pendingCompaction = !1,
        this.runCompaction(t, r, n))
    }
    async runCompaction(t, r, n) {
        if (!this.modelInstance)
            return t;
        const a = prepareCompaction(t, DEFAULT_COMPACTION_SETTINGS);
        if (!a)
            return t;
        r?.onCompactionStart(),
        this.compactionAbortController = new AbortController;
        const s = this.compactionAbortController.signal
          , o = () => this.compactionAbortController?.abort();
        n && (n.aborted ? o() : n.addEventListener("abort", o, {
            once: !0
        }));
        try {
            compactionLog$1.log(" Threshold exceeded, starting compaction...");
            const l = await compactPreparedContext(a, this.modelInstance, this.config, s);
            return this.agent && this.agent.replaceMessages(l.compactedMessages),
            await r?.onCompactionApplied(l.compactedMessages, l.summary),
            compactionLog$1.log(" Compaction complete, summary length:", l.summary.length),
            l.compactedMessages
        } catch (l) {
            if ((typeof l == "object" && l !== null && "name"in l && typeof l.name == "string" ? l.name : "") === "AbortError")
                return compactionLog$1.log(" Aborted, continuing without compaction"),
                this.pendingCompaction = !0,
                t;
            throw compactionLog$1.error(" Error during compaction:", l),
            new Error(`Compaction failed: ${l}`)
        } finally {
            n && n.removeEventListener("abort", o),
            this.compactionAbortController = null,
            r?.onCompactionEnd()
        }
    }
    async getActiveTabInfo() {
        const t = this.cdpHandler?.getAttachedTabId();
        if (t != null)
            try {
                const r = await chrome.tabs.get(t);
                return {
                    id: r.id,
                    title: r.title ?? "",
                    url: r.url ?? ""
                }
            } catch {}
        try {
            const [r] = await chrome.tabs.query({
                active: !0,
                currentWindow: !0
            });
            if (r?.id && r.url)
                return {
                    id: r.id,
                    title: r.title ?? "",
                    url: r.url
                }
        } catch {}
        return null
    }
    getAgent() {
        if (!this.isInitialized || !this.agent)
            throw new Error("AgentEnvironment not initialized. Await ready first.");
        return this.agent
    }
    isReadyForUse() {
        return this.isInitialized && !this.isDestroyed && this.agent !== null
    }
    execInSandbox(t, r) {
        return this.cdpHandler ? this.cdpHandler.execInSandbox(t, r) : Promise.resolve({
            output: `[Error]
Sandbox not initialized`,
            hasError: !0,
            images: []
        })
    }
    onStepFinish(t) {
        return this.stepFinishListeners.add(t),
        () => this.stepFinishListeners.delete(t)
    }
    emitStepFinish(t) {
        this.stepFinishListeners.forEach(r => r(t))
    }
    cleanupDebugger() {
        this.cdpHandler?.detachDebugger()
    }
    abortCurrentExecution() {
        log$8.log(" abortCurrentExecution called"),
        this.cdpHandler?.abortExecution()
    }
    cancelCompaction() {
        this.compactionAbortController && (this.compactionAbortController.abort(),
        this.compactionAbortController = null,
        this.pendingCompaction = !0,
        compactionLog$1.log(" Cancelled by user"))
    }
    async compactConversation() {
        const r = this.getAgent().state.messages;
        return await this.runCompaction(r, this.compactionCallbacks) !== r
    }
    getModelConfig() {
        return !this.modelInstance || !this.instructionsContent ? null : {
            model: this.modelInstance,
            instructions: this.instructionsContent
        }
    }
    getConfig() {
        return this.config
    }
    async getProxyAuthHeaders(t="proxy") {
        if (t === "proxy" && !this.config.useProxy)
            return null;
        let r;
        return r = await getStoredToken() || void 0,
        r ? t === "anthropic-oauth" || t === "openai-oauth" ? {
            "X-Redo-Auth": `Bearer ${r}`
        } : {
            Authorization: `Bearer ${r}`
        } : null
    }
    setModelHeaders(t) {
        if (!this.agent)
            return;
        const r = this.agent.state.model
          , n = {
            ...r,
            headers: {
                ...r.headers,
                ...t
            }
        };
        this.agent.setModel(n),
        this.modelInstance = n
    }
    destroy() {
        this.isDestroyed || (this.isDestroyed = !0,
        this.isInitialized = !1,
        log$8.log(" Destroying..."),
        this.notifier.clear(),
        this.stepFinishListeners.clear(),
        this.cdpHandler?.cleanup(),
        this.cdpHandler = null,
        this.iframe && this.iframe.parentElement && this.iframe.parentElement.removeChild(this.iframe),
        this.iframe = null,
        this.bashInstance = null,
        this.agent = null,
        log$8.log(" Destroyed"))
    }
}
async function generateThreadTitle(e, t) {
    titleLog$1.log(" Generating title for message:", t.slice(0, 50));
    let r, n, a;
    if (e.provider === "anthropic-oauth") {
        const l = e.anthropicModel ?? "claude-haiku-4-5";
        r = {
            ...getAnthropicModel(l),
            baseUrl: `${PROXY_BASE_URL}/api/redo/proxy/anthropic/`
        };
        const u = await getValidAccessToken$1();
        if (!u)
            throw new Error("Anthropic OAuth token expired. Please sign in again.");
        n = u;
        let c;
        c = await getStoredToken() || void 0,
        c && (a = {
            "X-Redo-Auth": `Bearer ${c}`
        })
    } else {
        const l = e.useProxy || e.provider === "openai-oauth";
        if (!l && !e.geminiApiKey)
            throw new Error("Gemini API key required when not using proxy");
        if (r = getModel("google", "gemini-3-flash-preview"),
        l) {
            r = {
                ...r,
                baseUrl: `${PROXY_BASE_URL}/api/redo/proxy/google/`
            };
            let c;
            c = await getStoredToken() || void 0,
            c && (a = {
                Authorization: `Bearer ${c}`
            }),
            n = "proxy"
        } else
            n = e.geminiApiKey
    }
    const s = await completeSimple(r, {
        messages: [{
            role: "user",
            content: `Generate a short, descriptive title (3-6 words) for a conversation that starts with this message. Return only the title, no quotes or punctuation:

${t}`,
            timestamp: Date.now()
        }]
    }, {
        apiKey: n,
        headers: a
    });
    let o = "";
    for (const l of s.content)
        l.type === "text" && (o += l.text);
    return titleLog$1.log(" API returned:", o),
    o.trim()
}
const log$7 = logger.scoped("AgentEnvironmentContext")
  , AgentEnvironmentContext = reactExports.createContext(null);
function AgentEnvironmentProvider({config: e, children: t}) {
    const [r,n] = reactExports.useState(null)
      , [a,s] = reactExports.useState(!1)
      , [o,l] = reactExports.useState(null)
      , u = reactExports.useRef(null)
      , c = reactExports.useRef(getAgentConfigKey(e))
      , p = reactExports.useRef(null)
      , d = reactExports.useRef(null)
      , f = reactExports.useRef(null)
      , h = reactExports.useRef(e);
    h.current = e;
    const m = reactExports.useRef(void 0)
      , g = reactExports.useCallback(w => {
        m.current = w
    }
    , [])
      , x = getAgentConfigKey(e);
    c.current = x,
    reactExports.useEffect( () => {
        d.current && p.current && p.current !== x && (log$7.log("Marking in-flight initialization as stale"),
        d.current = null),
        r && f.current && f.current !== x && (log$7.log("Config changed, destroying old environment", f.current, "->", x),
        r.destroy(),
        f.current = null,
        n(null),
        s(!1),
        l(null))
    }
    , [x, r]),
    reactExports.useEffect( () => () => {
        r && (log$7.log("Unmounting, destroying environment"),
        r.destroy())
    }
    , [r]);
    const b = reactExports.useCallback(async () => {
        const w = c.current;
        if (r && a && f.current === w)
            if (!r.isReadyForUse())
                log$7.warn("Cached environment marked ready but unusable; recreating"),
                r.destroy(),
                f.current = null,
                n(null),
                s(!1),
                l(null);
            else
                return r;
        if (r && f.current === w && !r.isReadyForUse() && (log$7.warn("Cached environment unusable for current config; clearing"),
        r.destroy(),
        f.current = null,
        n(null),
        s(!1),
        l(null)),
        d.current && p.current === w) {
            const P = await d.current;
            if (!P.isReadyForUse())
                throw log$7.warn("In-flight initialization resolved with unusable environment; retrying"),
                d.current = null,
                new Error("Environment resolved unusable");
            return P
        }
        r && f.current && f.current !== w && (log$7.log("ensureReady saw stale environment, destroying", f.current, "->", w),
        r.destroy(),
        f.current = null,
        n(null),
        s(!1),
        l(null));
        const R = u.current;
        if (!R)
            throw new Error("AgentEnvironmentContext container not mounted");
        const T = w;
        p.current = T,
        log$7.log("Starting environment initialization with config:", T),
        l(null);
        const C = (async () => {
            const P = new AgentEnvironment({
                config: h.current,
                parentElement: R,
                compactionCallbacks: m.current
            });
            try {
                if (await P.ready,
                c.current !== T) {
                    const W = c.current;
                    throw log$7.log("Config changed during initialization, discarding stale environment", T, "->", W),
                    P.destroy(),
                    p.current = null,
                    new Error("Configuration changed during initialization")
                }
                return n(P),
                s(!0),
                f.current = T,
                p.current = null,
                log$7.log("Environment ready"),
                P
            } catch (W) {
                const ue = W instanceof Error ? W : new Error(String(W));
                throw c.current === T && (log$7.error("Initialization failed:", ue),
                l(ue),
                d.current = null),
                P.destroy(),
                p.current = null,
                ue
            }
        }
        )();
        return d.current = C,
        C
    }
    , [r, a])
      , y = {
        environment: r,
        isReady: a,
        error: o,
        ensureReady: b,
        setCompactionCallbacks: g
    };
    return jsxRuntimeExports.jsxs(AgentEnvironmentContext.Provider, {
        value: y,
        children: [jsxRuntimeExports.jsx("div", {
            ref: u,
            style: {
                display: "none"
            }
        }), t]
    })
}
function useAgentEnvironment() {
    const e = reactExports.useContext(AgentEnvironmentContext);
    if (!e)
        throw new Error("useAgentEnvironment must be used within AgentEnvironmentProvider");
    return e
}
const TEXT_FILE_EXTENSIONS = new Set(["txt", "md", "json", "yaml", "yml", "ts", "tsx", "js", "jsx", "log"])
  , DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  , XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  , CSV_MIME_TYPES = new Set(["text/csv", "application/csv"])
  , MAX_TEXT_ATTACHMENT_SIZE_BYTES = 2 * 1024 * 1024
  , MAX_PDF_ATTACHMENT_SIZE_BYTES = 20 * 1024 * 1024
  , MAX_STRUCTURED_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
function isImageMimeType(e) {
    return e.startsWith("image/")
}
function isImageFile(e) {
    return isImageMimeType(e.type)
}
function getFileExtension(e) {
    const t = e.lastIndexOf(".");
    return t === -1 || t === e.length - 1 ? "" : e.slice(t + 1).toLowerCase()
}
function isDocxFile(e) {
    return e.type === DOCX_MIME_TYPE ? !0 : getFileExtension(e.name) === "docx"
}
function isXlsxFile(e) {
    return e.type === XLSX_MIME_TYPE ? !0 : getFileExtension(e.name) === "xlsx"
}
function isCsvFile(e) {
    return CSV_MIME_TYPES.has(e.type) ? !0 : getFileExtension(e.name) === "csv"
}
function isPlainTextFile(e) {
    return isCsvFile(e) || isDocxFile(e) || isXlsxFile(e) || isPdfFile(e) ? !1 : e.type.startsWith("text/") || e.type === "application/json" ? !0 : TEXT_FILE_EXTENSIONS.has(getFileExtension(e.name))
}
function isPdfFile(e) {
    return e.type === "application/pdf" ? !0 : getFileExtension(e.name) === "pdf"
}
function sanitizeFileName(e) {
    return e.replace(/[^a-zA-Z0-9._-]/g, "_")
}
function formatBytes(e) {
    if (e < 1024)
        return `${e} B`;
    const t = e / 1024;
    return t < 1024 ? `${t.toFixed(1)} KB` : `${(t / 1024).toFixed(1)} MB`
}
async function fileToImageAttachment(e) {
    return isImageFile(e) ? new Promise(t => {
        const r = new FileReader;
        r.onload = () => {
            t({
                kind: "image",
                id: crypto.randomUUID(),
                mimeType: e.type,
                fileName: e.name,
                dataUrl: r.result
            })
        }
        ,
        r.onerror = () => t(null),
        r.readAsDataURL(e)
    }
    ) : null
}
function fileToTextAttachment(e) {
    return isPlainTextFile(e) ? {
        kind: "file",
        id: crypto.randomUUID(),
        mimeType: e.type || "text/plain",
        fileName: e.name,
        size: e.size,
        file: e
    } : null
}
function fileToPdfAttachment(e) {
    return isPdfFile(e) ? {
        kind: "pdf",
        id: crypto.randomUUID(),
        mimeType: e.type || "application/pdf",
        fileName: e.name,
        size: e.size,
        file: e
    } : null
}
function fileToDocxAttachment(e) {
    return isDocxFile(e) ? {
        kind: "docx",
        id: crypto.randomUUID(),
        mimeType: e.type || DOCX_MIME_TYPE,
        fileName: e.name,
        size: e.size,
        file: e
    } : null
}
function fileToSheetAttachment(e) {
    return isXlsxFile(e) ? {
        kind: "xlsx",
        id: crypto.randomUUID(),
        mimeType: e.type || XLSX_MIME_TYPE,
        fileName: e.name,
        size: e.size,
        file: e
    } : isCsvFile(e) ? {
        kind: "csv",
        id: crypto.randomUUID(),
        mimeType: e.type || "text/csv",
        fileName: e.name,
        size: e.size,
        file: e
    } : null
}
function escapeXmlAttribute(e) {
    return e.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}
function unescapeXmlAttribute(e) {
    return e.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
}
function buildFileAttachmentTag(e) {
    return `<attachment path="${escapeXmlAttribute(e.path)}" filename="${escapeXmlAttribute(e.filename)}" mimeType="${escapeXmlAttribute(e.mimeType)}" size="${e.size}" />`
}
function parseFileAttachmentTags(e) {
    const t = []
      , r = /<attachment\s+([^>]*?)\s*\/>/g;
    let n = 0, a;
    for (; (a = r.exec(e)) !== null; ) {
        const [s,o] = a
          , l = a.index
          , u = l + s.length;
        l > n && t.push({
            type: "text",
            text: e.slice(n, l)
        });
        const c = {}
          , p = /([a-zA-Z_:][a-zA-Z0-9_.:-]*)="([^"]*)"/g;
        let d;
        for (; (d = p.exec(o)) !== null; )
            c[d[1]] = unescapeXmlAttribute(d[2]);
        const f = Number(c.size);
        c.path && c.filename && c.mimeType && Number.isFinite(f) ? t.push({
            type: "attachment",
            attachment: {
                path: c.path,
                filename: c.filename,
                mimeType: c.mimeType,
                size: f
            }
        }) : t.push({
            type: "text",
            text: s
        }),
        n = u
    }
    return n < e.length && t.push({
        type: "text",
        text: e.slice(n)
    }),
    t
}
function isUserMessage(e) {
    return e.role === "user"
}
function isAssistantMessage(e) {
    return e.role === "assistant"
}
function isToolResultMessage(e) {
    return e.role === "toolResult"
}
function stableId(e, t) {
    return `${t}_${e.timestamp}`
}
function agentMessagesToUI(e, t, r) {
    const n = new Map;
    for (const s of e)
        isToolResultMessage(s) && n.set(s.toolCallId, s);
    const a = [];
    for (const s of e)
        isCustomMessage(s) && !s.display || (isUserMessage(s) ? a.push(convertUserMessage(s)) : isAssistantMessage(s) && a.push(convertAssistantMessage(s, n, r)));
    return t && isAssistantMessage(t) && a.push(convertAssistantMessage(t, n, r, !0)),
    a
}
function convertUserMessage(e) {
    const t = [];
    if (typeof e.content == "string")
        t.push({
            type: "text",
            text: e.content
        });
    else if (Array.isArray(e.content))
        for (const r of e.content)
            r.type === "text" ? t.push({
                type: "text",
                text: r.text
            }) : r.type === "image" && t.push({
                type: "file",
                url: `data:${r.mimeType};base64,${r.data}`,
                mediaType: r.mimeType
            });
    return {
        id: stableId(e, "user"),
        role: "user",
        parts: t,
        createdAt: new Date(e.timestamp)
    }
}
function convertAssistantMessage(e, t, r, n=!1) {
    const a = []
      , s = e.content.length;
    for (let o = 0; o < s; o++) {
        const l = e.content[o];
        if (l.type === "text")
            a.push({
                type: "text",
                text: l.text
            });
        else if (l.type === "thinking") {
            const u = o === s - 1;
            a.push({
                type: "reasoning",
                text: l.thinking,
                state: n && u ? "streaming" : "done"
            })
        } else if (l.type === "toolCall") {
            const u = t.get(l.id)
              , c = r.has(l.id)
              , p = {
                type: "tool-call",
                toolCallId: l.id,
                toolName: l.name,
                input: l.arguments,
                state: c ? "running" : u ? u.isError ? "error" : "completed" : "pending"
            };
            if (u) {
                const d = []
                  , f = [];
                for (const m of u.content)
                    m.type === "text" ? d.push(m.text) : m.type === "image" && f.push({
                        data: m.data,
                        mimeType: m.mimeType
                    });
                const h = d.join(`
`);
                u.isError ? p.errorText = h || "[Error]" : p.output = h || u.details,
                f.length > 0 && (p.images = f.map(m => ({
                    url: `data:${m.mimeType};base64,${m.data}`,
                    filename: `screenshot-${l.id}.png`
                }))),
                a.push(p)
            } else
                a.push(p)
        }
    }
    return {
        id: stableId(e, n ? "stream" : "asst"),
        role: "assistant",
        parts: a,
        createdAt: new Date(e.timestamp)
    }
}
const millisecondsInWeek = 6048e5
  , millisecondsInDay = 864e5
  , millisecondsInMinute = 6e4
  , minutesInYear = 525600
  , minutesInMonth = 43200
  , minutesInDay = 1440
  , constructFromSymbol = Symbol.for("constructDateFrom");
function constructFrom(e, t) {
    return typeof e == "function" ? e(t) : e && typeof e == "object" && constructFromSymbol in e ? e[constructFromSymbol](t) : e instanceof Date ? new e.constructor(t) : new Date(t)
}
function toDate(e, t) {
    return constructFrom(t || e, e)
}
let defaultOptions = {};
function getDefaultOptions() {
    return defaultOptions
}
function startOfWeek(e, t) {
    const r = getDefaultOptions()
      , n = t?.weekStartsOn ?? t?.locale?.options?.weekStartsOn ?? r.weekStartsOn ?? r.locale?.options?.weekStartsOn ?? 0
      , a = toDate(e, t?.in)
      , s = a.getDay()
      , o = (s < n ? 7 : 0) + s - n;
    return a.setDate(a.getDate() - o),
    a.setHours(0, 0, 0, 0),
    a
}
function startOfISOWeek(e, t) {
    return startOfWeek(e, {
        ...t,
        weekStartsOn: 1
    })
}
function getISOWeekYear(e, t) {
    const r = toDate(e, t?.in)
      , n = r.getFullYear()
      , a = constructFrom(r, 0);
    a.setFullYear(n + 1, 0, 4),
    a.setHours(0, 0, 0, 0);
    const s = startOfISOWeek(a)
      , o = constructFrom(r, 0);
    o.setFullYear(n, 0, 4),
    o.setHours(0, 0, 0, 0);
    const l = startOfISOWeek(o);
    return r.getTime() >= s.getTime() ? n + 1 : r.getTime() >= l.getTime() ? n : n - 1
}
function getTimezoneOffsetInMilliseconds(e) {
    const t = toDate(e)
      , r = new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate(), t.getHours(), t.getMinutes(), t.getSeconds(), t.getMilliseconds()));
    return r.setUTCFullYear(t.getFullYear()),
    +e - +r
}
function normalizeDates(e, ...t) {
    const r = constructFrom.bind(null, e || t.find(n => typeof n == "object"));
    return t.map(r)
}
function startOfDay(e, t) {
    const r = toDate(e, t?.in);
    return r.setHours(0, 0, 0, 0),
    r
}
function differenceInCalendarDays(e, t, r) {
    const [n,a] = normalizeDates(r?.in, e, t)
      , s = startOfDay(n)
      , o = startOfDay(a)
      , l = +s - getTimezoneOffsetInMilliseconds(s)
      , u = +o - getTimezoneOffsetInMilliseconds(o);
    return Math.round((l - u) / millisecondsInDay)
}
function startOfISOWeekYear(e, t) {
    const r = getISOWeekYear(e, t)
      , n = constructFrom(e, 0);
    return n.setFullYear(r, 0, 4),
    n.setHours(0, 0, 0, 0),
    startOfISOWeek(n)
}
function compareAsc(e, t) {
    const r = +toDate(e) - +toDate(t);
    return r < 0 ? -1 : r > 0 ? 1 : r
}
function constructNow(e) {
    return constructFrom(e, Date.now())
}
function isSameDay(e, t, r) {
    const [n,a] = normalizeDates(r?.in, e, t);
    return +startOfDay(n) == +startOfDay(a)
}
function isDate(e) {
    return e instanceof Date || typeof e == "object" && Object.prototype.toString.call(e) === "[object Date]"
}
function isValid$1(e) {
    return !(!isDate(e) && typeof e != "number" || isNaN(+toDate(e)))
}
function differenceInCalendarMonths(e, t, r) {
    const [n,a] = normalizeDates(r?.in, e, t)
      , s = n.getFullYear() - a.getFullYear()
      , o = n.getMonth() - a.getMonth();
    return s * 12 + o
}
function getRoundingMethod(e) {
    return t => {
        const n = (e ? Math[e] : Math.trunc)(t);
        return n === 0 ? 0 : n
    }
}
function differenceInMilliseconds(e, t) {
    return +toDate(e) - +toDate(t)
}
function endOfDay(e, t) {
    const r = toDate(e, t?.in);
    return r.setHours(23, 59, 59, 999),
    r
}
function endOfMonth(e, t) {
    const r = toDate(e, t?.in)
      , n = r.getMonth();
    return r.setFullYear(r.getFullYear(), n + 1, 0),
    r.setHours(23, 59, 59, 999),
    r
}
function isLastDayOfMonth(e, t) {
    const r = toDate(e, t?.in);
    return +endOfDay(r, t) == +endOfMonth(r, t)
}
function differenceInMonths(e, t, r) {
    const [n,a,s] = normalizeDates(r?.in, e, e, t)
      , o = compareAsc(a, s)
      , l = Math.abs(differenceInCalendarMonths(a, s));
    if (l < 1)
        return 0;
    a.getMonth() === 1 && a.getDate() > 27 && a.setDate(30),
    a.setMonth(a.getMonth() - o * l);
    let u = compareAsc(a, s) === -o;
    isLastDayOfMonth(n) && l === 1 && compareAsc(n, s) === 1 && (u = !1);
    const c = o * (l - +u);
    return c === 0 ? 0 : c
}
function differenceInSeconds(e, t, r) {
    const n = differenceInMilliseconds(e, t) / 1e3;
    return getRoundingMethod(r?.roundingMethod)(n)
}
function startOfYear(e, t) {
    const r = toDate(e, t?.in);
    return r.setFullYear(r.getFullYear(), 0, 1),
    r.setHours(0, 0, 0, 0),
    r
}
const formatDistanceLocale = {
    lessThanXSeconds: {
        one: "less than a second",
        other: "less than {{count}} seconds"
    },
    xSeconds: {
        one: "1 second",
        other: "{{count}} seconds"
    },
    halfAMinute: "half a minute",
    lessThanXMinutes: {
        one: "less than a minute",
        other: "less than {{count}} minutes"
    },
    xMinutes: {
        one: "1 minute",
        other: "{{count}} minutes"
    },
    aboutXHours: {
        one: "about 1 hour",
        other: "about {{count}} hours"
    },
    xHours: {
        one: "1 hour",
        other: "{{count}} hours"
    },
    xDays: {
        one: "1 day",
        other: "{{count}} days"
    },
    aboutXWeeks: {
        one: "about 1 week",
        other: "about {{count}} weeks"
    },
    xWeeks: {
        one: "1 week",
        other: "{{count}} weeks"
    },
    aboutXMonths: {
        one: "about 1 month",
        other: "about {{count}} months"
    },
    xMonths: {
        one: "1 month",
        other: "{{count}} months"
    },
    aboutXYears: {
        one: "about 1 year",
        other: "about {{count}} years"
    },
    xYears: {
        one: "1 year",
        other: "{{count}} years"
    },
    overXYears: {
        one: "over 1 year",
        other: "over {{count}} years"
    },
    almostXYears: {
        one: "almost 1 year",
        other: "almost {{count}} years"
    }
}
  , formatDistance$1 = (e, t, r) => {
    let n;
    const a = formatDistanceLocale[e];
    return typeof a == "string" ? n = a : t === 1 ? n = a.one : n = a.other.replace("{{count}}", t.toString()),
    r?.addSuffix ? r.comparison && r.comparison > 0 ? "in " + n : n + " ago" : n
}
;
function buildFormatLongFn(e) {
    return (t={}) => {
        const r = t.width ? String(t.width) : e.defaultWidth;
        return e.formats[r] || e.formats[e.defaultWidth]
    }
}
const dateFormats = {
    full: "EEEE, MMMM do, y",
    long: "MMMM do, y",
    medium: "MMM d, y",
    short: "MM/dd/yyyy"
}
  , timeFormats = {
    full: "h:mm:ss a zzzz",
    long: "h:mm:ss a z",
    medium: "h:mm:ss a",
    short: "h:mm a"
}
  , dateTimeFormats = {
    full: "{{date}} 'at' {{time}}",
    long: "{{date}} 'at' {{time}}",
    medium: "{{date}}, {{time}}",
    short: "{{date}}, {{time}}"
}
  , formatLong = {
    date: buildFormatLongFn({
        formats: dateFormats,
        defaultWidth: "full"
    }),
    time: buildFormatLongFn({
        formats: timeFormats,
        defaultWidth: "full"
    }),
    dateTime: buildFormatLongFn({
        formats: dateTimeFormats,
        defaultWidth: "full"
    })
}
  , formatRelativeLocale = {
    lastWeek: "'last' eeee 'at' p",
    yesterday: "'yesterday at' p",
    today: "'today at' p",
    tomorrow: "'tomorrow at' p",
    nextWeek: "eeee 'at' p",
    other: "P"
}
  , formatRelative = (e, t, r, n) => formatRelativeLocale[e];
function buildLocalizeFn(e) {
    return (t, r) => {
        const n = r?.context ? String(r.context) : "standalone";
        let a;
        if (n === "formatting" && e.formattingValues) {
            const o = e.defaultFormattingWidth || e.defaultWidth
              , l = r?.width ? String(r.width) : o;
            a = e.formattingValues[l] || e.formattingValues[o]
        } else {
            const o = e.defaultWidth
              , l = r?.width ? String(r.width) : e.defaultWidth;
            a = e.values[l] || e.values[o]
        }
        const s = e.argumentCallback ? e.argumentCallback(t) : t;
        return a[s]
    }
}
const eraValues = {
    narrow: ["B", "A"],
    abbreviated: ["BC", "AD"],
    wide: ["Before Christ", "Anno Domini"]
}
  , quarterValues = {
    narrow: ["1", "2", "3", "4"],
    abbreviated: ["Q1", "Q2", "Q3", "Q4"],
    wide: ["1st quarter", "2nd quarter", "3rd quarter", "4th quarter"]
}
  , monthValues = {
    narrow: ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"],
    abbreviated: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    wide: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
}
  , dayValues = {
    narrow: ["S", "M", "T", "W", "T", "F", "S"],
    short: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
    abbreviated: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    wide: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
}
  , dayPeriodValues = {
    narrow: {
        am: "a",
        pm: "p",
        midnight: "mi",
        noon: "n",
        morning: "morning",
        afternoon: "afternoon",
        evening: "evening",
        night: "night"
    },
    abbreviated: {
        am: "AM",
        pm: "PM",
        midnight: "midnight",
        noon: "noon",
        morning: "morning",
        afternoon: "afternoon",
        evening: "evening",
        night: "night"
    },
    wide: {
        am: "a.m.",
        pm: "p.m.",
        midnight: "midnight",
        noon: "noon",
        morning: "morning",
        afternoon: "afternoon",
        evening: "evening",
        night: "night"
    }
}
  , formattingDayPeriodValues = {
    narrow: {
        am: "a",
        pm: "p",
        midnight: "mi",
        noon: "n",
        morning: "in the morning",
        afternoon: "in the afternoon",
        evening: "in the evening",
        night: "at night"
    },
    abbreviated: {
        am: "AM",
        pm: "PM",
        midnight: "midnight",
        noon: "noon",
        morning: "in the morning",
        afternoon: "in the afternoon",
        evening: "in the evening",
        night: "at night"
    },
    wide: {
        am: "a.m.",
        pm: "p.m.",
        midnight: "midnight",
        noon: "noon",
        morning: "in the morning",
        afternoon: "in the afternoon",
        evening: "in the evening",
        night: "at night"
    }
}
  , ordinalNumber = (e, t) => {
    const r = Number(e)
      , n = r % 100;
    if (n > 20 || n < 10)
        switch (n % 10) {
        case 1:
            return r + "st";
        case 2:
            return r + "nd";
        case 3:
            return r + "rd"
        }
    return r + "th"
}
  , localize = {
    ordinalNumber,
    era: buildLocalizeFn({
        values: eraValues,
        defaultWidth: "wide"
    }),
    quarter: buildLocalizeFn({
        values: quarterValues,
        defaultWidth: "wide",
        argumentCallback: e => e - 1
    }),
    month: buildLocalizeFn({
        values: monthValues,
        defaultWidth: "wide"
    }),
    day: buildLocalizeFn({
        values: dayValues,
        defaultWidth: "wide"
    }),
    dayPeriod: buildLocalizeFn({
        values: dayPeriodValues,
        defaultWidth: "wide",
        formattingValues: formattingDayPeriodValues,
        defaultFormattingWidth: "wide"
    })
};
function buildMatchFn(e) {
    return (t, r={}) => {
        const n = r.width
          , a = n && e.matchPatterns[n] || e.matchPatterns[e.defaultMatchWidth]
          , s = t.match(a);
        if (!s)
            return null;
        const o = s[0]
          , l = n && e.parsePatterns[n] || e.parsePatterns[e.defaultParseWidth]
          , u = Array.isArray(l) ? findIndex(l, d => d.test(o)) : findKey(l, d => d.test(o));
        let c;
        c = e.valueCallback ? e.valueCallback(u) : u,
        c = r.valueCallback ? r.valueCallback(c) : c;
        const p = t.slice(o.length);
        return {
            value: c,
            rest: p
        }
    }
}
function findKey(e, t) {
    for (const r in e)
        if (Object.prototype.hasOwnProperty.call(e, r) && t(e[r]))
            return r
}
function findIndex(e, t) {
    for (let r = 0; r < e.length; r++)
        if (t(e[r]))
            return r
}
function buildMatchPatternFn(e) {
    return (t, r={}) => {
        const n = t.match(e.matchPattern);
        if (!n)
            return null;
        const a = n[0]
          , s = t.match(e.parsePattern);
        if (!s)
            return null;
        let o = e.valueCallback ? e.valueCallback(s[0]) : s[0];
        o = r.valueCallback ? r.valueCallback(o) : o;
        const l = t.slice(a.length);
        return {
            value: o,
            rest: l
        }
    }
}
const matchOrdinalNumberPattern = /^(\d+)(th|st|nd|rd)?/i
  , parseOrdinalNumberPattern = /\d+/i
  , matchEraPatterns = {
    narrow: /^(b|a)/i,
    abbreviated: /^(b\.?\s?c\.?|b\.?\s?c\.?\s?e\.?|a\.?\s?d\.?|c\.?\s?e\.?)/i,
    wide: /^(before christ|before common era|anno domini|common era)/i
}
  , parseEraPatterns = {
    any: [/^b/i, /^(a|c)/i]
}
  , matchQuarterPatterns = {
    narrow: /^[1234]/i,
    abbreviated: /^q[1234]/i,
    wide: /^[1234](th|st|nd|rd)? quarter/i
}
  , parseQuarterPatterns = {
    any: [/1/i, /2/i, /3/i, /4/i]
}
  , matchMonthPatterns = {
    narrow: /^[jfmasond]/i,
    abbreviated: /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
    wide: /^(january|february|march|april|may|june|july|august|september|october|november|december)/i
}
  , parseMonthPatterns = {
    narrow: [/^j/i, /^f/i, /^m/i, /^a/i, /^m/i, /^j/i, /^j/i, /^a/i, /^s/i, /^o/i, /^n/i, /^d/i],
    any: [/^ja/i, /^f/i, /^mar/i, /^ap/i, /^may/i, /^jun/i, /^jul/i, /^au/i, /^s/i, /^o/i, /^n/i, /^d/i]
}
  , matchDayPatterns = {
    narrow: /^[smtwf]/i,
    short: /^(su|mo|tu|we|th|fr|sa)/i,
    abbreviated: /^(sun|mon|tue|wed|thu|fri|sat)/i,
    wide: /^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i
}
  , parseDayPatterns = {
    narrow: [/^s/i, /^m/i, /^t/i, /^w/i, /^t/i, /^f/i, /^s/i],
    any: [/^su/i, /^m/i, /^tu/i, /^w/i, /^th/i, /^f/i, /^sa/i]
}
  , matchDayPeriodPatterns = {
    narrow: /^(a|p|mi|n|(in the|at) (morning|afternoon|evening|night))/i,
    any: /^([ap]\.?\s?m\.?|midnight|noon|(in the|at) (morning|afternoon|evening|night))/i
}
  , parseDayPeriodPatterns = {
    any: {
        am: /^a/i,
        pm: /^p/i,
        midnight: /^mi/i,
        noon: /^no/i,
        morning: /morning/i,
        afternoon: /afternoon/i,
        evening: /evening/i,
        night: /night/i
    }
}
  , match = {
    ordinalNumber: buildMatchPatternFn({
        matchPattern: matchOrdinalNumberPattern,
        parsePattern: parseOrdinalNumberPattern,
        valueCallback: e => parseInt(e, 10)
    }),
    era: buildMatchFn({
        matchPatterns: matchEraPatterns,
        defaultMatchWidth: "wide",
        parsePatterns: parseEraPatterns,
        defaultParseWidth: "any"
    }),
    quarter: buildMatchFn({
        matchPatterns: matchQuarterPatterns,
        defaultMatchWidth: "wide",
        parsePatterns: parseQuarterPatterns,
        defaultParseWidth: "any",
        valueCallback: e => e + 1
    }),
    month: buildMatchFn({
        matchPatterns: matchMonthPatterns,
        defaultMatchWidth: "wide",
        parsePatterns: parseMonthPatterns,
        defaultParseWidth: "any"
    }),
    day: buildMatchFn({
        matchPatterns: matchDayPatterns,
        defaultMatchWidth: "wide",
        parsePatterns: parseDayPatterns,
        defaultParseWidth: "any"
    }),
    dayPeriod: buildMatchFn({
        matchPatterns: matchDayPeriodPatterns,
        defaultMatchWidth: "any",
        parsePatterns: parseDayPeriodPatterns,
        defaultParseWidth: "any"
    })
}
  , enUS = {
    code: "en-US",
    formatDistance: formatDistance$1,
    formatLong,
    formatRelative,
    localize,
    match,
    options: {
        weekStartsOn: 0,
        firstWeekContainsDate: 1
    }
};
function getDayOfYear(e, t) {
    const r = toDate(e, t?.in);
    return differenceInCalendarDays(r, startOfYear(r)) + 1
}
function getISOWeek(e, t) {
    const r = toDate(e, t?.in)
      , n = +startOfISOWeek(r) - +startOfISOWeekYear(r);
    return Math.round(n / millisecondsInWeek) + 1
}
function getWeekYear(e, t) {
    const r = toDate(e, t?.in)
      , n = r.getFullYear()
      , a = getDefaultOptions()
      , s = t?.firstWeekContainsDate ?? t?.locale?.options?.firstWeekContainsDate ?? a.firstWeekContainsDate ?? a.locale?.options?.firstWeekContainsDate ?? 1
      , o = constructFrom(t?.in || e, 0);
    o.setFullYear(n + 1, 0, s),
    o.setHours(0, 0, 0, 0);
    const l = startOfWeek(o, t)
      , u = constructFrom(t?.in || e, 0);
    u.setFullYear(n, 0, s),
    u.setHours(0, 0, 0, 0);
    const c = startOfWeek(u, t);
    return +r >= +l ? n + 1 : +r >= +c ? n : n - 1
}
function startOfWeekYear(e, t) {
    const r = getDefaultOptions()
      , n = t?.firstWeekContainsDate ?? t?.locale?.options?.firstWeekContainsDate ?? r.firstWeekContainsDate ?? r.locale?.options?.firstWeekContainsDate ?? 1
      , a = getWeekYear(e, t)
      , s = constructFrom(t?.in || e, 0);
    return s.setFullYear(a, 0, n),
    s.setHours(0, 0, 0, 0),
    startOfWeek(s, t)
}
function getWeek(e, t) {
    const r = toDate(e, t?.in)
      , n = +startOfWeek(r, t) - +startOfWeekYear(r, t);
    return Math.round(n / millisecondsInWeek) + 1
}
function addLeadingZeros(e, t) {
    const r = e < 0 ? "-" : ""
      , n = Math.abs(e).toString().padStart(t, "0");
    return r + n
}
const lightFormatters = {
    y(e, t) {
        const r = e.getFullYear()
          , n = r > 0 ? r : 1 - r;
        return addLeadingZeros(t === "yy" ? n % 100 : n, t.length)
    },
    M(e, t) {
        const r = e.getMonth();
        return t === "M" ? String(r + 1) : addLeadingZeros(r + 1, 2)
    },
    d(e, t) {
        return addLeadingZeros(e.getDate(), t.length)
    },
    a(e, t) {
        const r = e.getHours() / 12 >= 1 ? "pm" : "am";
        switch (t) {
        case "a":
        case "aa":
            return r.toUpperCase();
        case "aaa":
            return r;
        case "aaaaa":
            return r[0];
        case "aaaa":
        default:
            return r === "am" ? "a.m." : "p.m."
        }
    },
    h(e, t) {
        return addLeadingZeros(e.getHours() % 12 || 12, t.length)
    },
    H(e, t) {
        return addLeadingZeros(e.getHours(), t.length)
    },
    m(e, t) {
        return addLeadingZeros(e.getMinutes(), t.length)
    },
    s(e, t) {
        return addLeadingZeros(e.getSeconds(), t.length)
    },
    S(e, t) {
        const r = t.length
          , n = e.getMilliseconds()
          , a = Math.trunc(n * Math.pow(10, r - 3));
        return addLeadingZeros(a, t.length)
    }
}
  , dayPeriodEnum = {
    midnight: "midnight",
    noon: "noon",
    morning: "morning",
    afternoon: "afternoon",
    evening: "evening",
    night: "night"
}
  , formatters = {
    G: function(e, t, r) {
        const n = e.getFullYear() > 0 ? 1 : 0;
        switch (t) {
        case "G":
        case "GG":
        case "GGG":
            return r.era(n, {
                width: "abbreviated"
            });
        case "GGGGG":
            return r.era(n, {
                width: "narrow"
            });
        case "GGGG":
        default:
            return r.era(n, {
                width: "wide"
            })
        }
    },
    y: function(e, t, r) {
        if (t === "yo") {
            const n = e.getFullYear()
              , a = n > 0 ? n : 1 - n;
            return r.ordinalNumber(a, {
                unit: "year"
            })
        }
        return lightFormatters.y(e, t)
    },
    Y: function(e, t, r, n) {
        const a = getWeekYear(e, n)
          , s = a > 0 ? a : 1 - a;
        if (t === "YY") {
            const o = s % 100;
            return addLeadingZeros(o, 2)
        }
        return t === "Yo" ? r.ordinalNumber(s, {
            unit: "year"
        }) : addLeadingZeros(s, t.length)
    },
    R: function(e, t) {
        const r = getISOWeekYear(e);
        return addLeadingZeros(r, t.length)
    },
    u: function(e, t) {
        const r = e.getFullYear();
        return addLeadingZeros(r, t.length)
    },
    Q: function(e, t, r) {
        const n = Math.ceil((e.getMonth() + 1) / 3);
        switch (t) {
        case "Q":
            return String(n);
        case "QQ":
            return addLeadingZeros(n, 2);
        case "Qo":
            return r.ordinalNumber(n, {
                unit: "quarter"
            });
        case "QQQ":
            return r.quarter(n, {
                width: "abbreviated",
                context: "formatting"
            });
        case "QQQQQ":
            return r.quarter(n, {
                width: "narrow",
                context: "formatting"
            });
        case "QQQQ":
        default:
            return r.quarter(n, {
                width: "wide",
                context: "formatting"
            })
        }
    },
    q: function(e, t, r) {
        const n = Math.ceil((e.getMonth() + 1) / 3);
        switch (t) {
        case "q":
            return String(n);
        case "qq":
            return addLeadingZeros(n, 2);
        case "qo":
            return r.ordinalNumber(n, {
                unit: "quarter"
            });
        case "qqq":
            return r.quarter(n, {
                width: "abbreviated",
                context: "standalone"
            });
        case "qqqqq":
            return r.quarter(n, {
                width: "narrow",
                context: "standalone"
            });
        case "qqqq":
        default:
            return r.quarter(n, {
                width: "wide",
                context: "standalone"
            })
        }
    },
    M: function(e, t, r) {
        const n = e.getMonth();
        switch (t) {
        case "M":
        case "MM":
            return lightFormatters.M(e, t);
        case "Mo":
            return r.ordinalNumber(n + 1, {
                unit: "month"
            });
        case "MMM":
            return r.month(n, {
                width: "abbreviated",
                context: "formatting"
            });
        case "MMMMM":
            return r.month(n, {
                width: "narrow",
                context: "formatting"
            });
        case "MMMM":
        default:
            return r.month(n, {
                width: "wide",
                context: "formatting"
            })
        }
    },
    L: function(e, t, r) {
        const n = e.getMonth();
        switch (t) {
        case "L":
            return String(n + 1);
        case "LL":
            return addLeadingZeros(n + 1, 2);
        case "Lo":
            return r.ordinalNumber(n + 1, {
                unit: "month"
            });
        case "LLL":
            return r.month(n, {
                width: "abbreviated",
                context: "standalone"
            });
        case "LLLLL":
            return r.month(n, {
                width: "narrow",
                context: "standalone"
            });
        case "LLLL":
        default:
            return r.month(n, {
                width: "wide",
                context: "standalone"
            })
        }
    },
    w: function(e, t, r, n) {
        const a = getWeek(e, n);
        return t === "wo" ? r.ordinalNumber(a, {
            unit: "week"
        }) : addLeadingZeros(a, t.length)
    },
    I: function(e, t, r) {
        const n = getISOWeek(e);
        return t === "Io" ? r.ordinalNumber(n, {
            unit: "week"
        }) : addLeadingZeros(n, t.length)
    },
    d: function(e, t, r) {
        return t === "do" ? r.ordinalNumber(e.getDate(), {
            unit: "date"
        }) : lightFormatters.d(e, t)
    },
    D: function(e, t, r) {
        const n = getDayOfYear(e);
        return t === "Do" ? r.ordinalNumber(n, {
            unit: "dayOfYear"
        }) : addLeadingZeros(n, t.length)
    },
    E: function(e, t, r) {
        const n = e.getDay();
        switch (t) {
        case "E":
        case "EE":
        case "EEE":
            return r.day(n, {
                width: "abbreviated",
                context: "formatting"
            });
        case "EEEEE":
            return r.day(n, {
                width: "narrow",
                context: "formatting"
            });
        case "EEEEEE":
            return r.day(n, {
                width: "short",
                context: "formatting"
            });
        case "EEEE":
        default:
            return r.day(n, {
                width: "wide",
                context: "formatting"
            })
        }
    },
    e: function(e, t, r, n) {
        const a = e.getDay()
          , s = (a - n.weekStartsOn + 8) % 7 || 7;
        switch (t) {
        case "e":
            return String(s);
        case "ee":
            return addLeadingZeros(s, 2);
        case "eo":
            return r.ordinalNumber(s, {
                unit: "day"
            });
        case "eee":
            return r.day(a, {
                width: "abbreviated",
                context: "formatting"
            });
        case "eeeee":
            return r.day(a, {
                width: "narrow",
                context: "formatting"
            });
        case "eeeeee":
            return r.day(a, {
                width: "short",
                context: "formatting"
            });
        case "eeee":
        default:
            return r.day(a, {
                width: "wide",
                context: "formatting"
            })
        }
    },
    c: function(e, t, r, n) {
        const a = e.getDay()
          , s = (a - n.weekStartsOn + 8) % 7 || 7;
        switch (t) {
        case "c":
            return String(s);
        case "cc":
            return addLeadingZeros(s, t.length);
        case "co":
            return r.ordinalNumber(s, {
                unit: "day"
            });
        case "ccc":
            return r.day(a, {
                width: "abbreviated",
                context: "standalone"
            });
        case "ccccc":
            return r.day(a, {
                width: "narrow",
                context: "standalone"
            });
        case "cccccc":
            return r.day(a, {
                width: "short",
                context: "standalone"
            });
        case "cccc":
        default:
            return r.day(a, {
                width: "wide",
                context: "standalone"
            })
        }
    },
    i: function(e, t, r) {
        const n = e.getDay()
          , a = n === 0 ? 7 : n;
        switch (t) {
        case "i":
            return String(a);
        case "ii":
            return addLeadingZeros(a, t.length);
        case "io":
            return r.ordinalNumber(a, {
                unit: "day"
            });
        case "iii":
            return r.day(n, {
                width: "abbreviated",
                context: "formatting"
            });
        case "iiiii":
            return r.day(n, {
                width: "narrow",
                context: "formatting"
            });
        case "iiiiii":
            return r.day(n, {
                width: "short",
                context: "formatting"
            });
        case "iiii":
        default:
            return r.day(n, {
                width: "wide",
                context: "formatting"
            })
        }
    },
    a: function(e, t, r) {
        const a = e.getHours() / 12 >= 1 ? "pm" : "am";
        switch (t) {
        case "a":
        case "aa":
            return r.dayPeriod(a, {
                width: "abbreviated",
                context: "formatting"
            });
        case "aaa":
            return r.dayPeriod(a, {
                width: "abbreviated",
                context: "formatting"
            }).toLowerCase();
        case "aaaaa":
            return r.dayPeriod(a, {
                width: "narrow",
                context: "formatting"
            });
        case "aaaa":
        default:
            return r.dayPeriod(a, {
                width: "wide",
                context: "formatting"
            })
        }
    },
    b: function(e, t, r) {
        const n = e.getHours();
        let a;
        switch (n === 12 ? a = dayPeriodEnum.noon : n === 0 ? a = dayPeriodEnum.midnight : a = n / 12 >= 1 ? "pm" : "am",
        t) {
        case "b":
        case "bb":
            return r.dayPeriod(a, {
                width: "abbreviated",
                context: "formatting"
            });
        case "bbb":
            return r.dayPeriod(a, {
                width: "abbreviated",
                context: "formatting"
            }).toLowerCase();
        case "bbbbb":
            return r.dayPeriod(a, {
                width: "narrow",
                context: "formatting"
            });
        case "bbbb":
        default:
            return r.dayPeriod(a, {
                width: "wide",
                context: "formatting"
            })
        }
    },
    B: function(e, t, r) {
        const n = e.getHours();
        let a;
        switch (n >= 17 ? a = dayPeriodEnum.evening : n >= 12 ? a = dayPeriodEnum.afternoon : n >= 4 ? a = dayPeriodEnum.morning : a = dayPeriodEnum.night,
        t) {
        case "B":
        case "BB":
        case "BBB":
            return r.dayPeriod(a, {
                width: "abbreviated",
                context: "formatting"
            });
        case "BBBBB":
            return r.dayPeriod(a, {
                width: "narrow",
                context: "formatting"
            });
        case "BBBB":
        default:
            return r.dayPeriod(a, {
                width: "wide",
                context: "formatting"
            })
        }
    },
    h: function(e, t, r) {
        if (t === "ho") {
            let n = e.getHours() % 12;
            return n === 0 && (n = 12),
            r.ordinalNumber(n, {
                unit: "hour"
            })
        }
        return lightFormatters.h(e, t)
    },
    H: function(e, t, r) {
        return t === "Ho" ? r.ordinalNumber(e.getHours(), {
            unit: "hour"
        }) : lightFormatters.H(e, t)
    },
    K: function(e, t, r) {
        const n = e.getHours() % 12;
        return t === "Ko" ? r.ordinalNumber(n, {
            unit: "hour"
        }) : addLeadingZeros(n, t.length)
    },
    k: function(e, t, r) {
        let n = e.getHours();
        return n === 0 && (n = 24),
        t === "ko" ? r.ordinalNumber(n, {
            unit: "hour"
        }) : addLeadingZeros(n, t.length)
    },
    m: function(e, t, r) {
        return t === "mo" ? r.ordinalNumber(e.getMinutes(), {
            unit: "minute"
        }) : lightFormatters.m(e, t)
    },
    s: function(e, t, r) {
        return t === "so" ? r.ordinalNumber(e.getSeconds(), {
            unit: "second"
        }) : lightFormatters.s(e, t)
    },
    S: function(e, t) {
        return lightFormatters.S(e, t)
    },
    X: function(e, t, r) {
        const n = e.getTimezoneOffset();
        if (n === 0)
            return "Z";
        switch (t) {
        case "X":
            return formatTimezoneWithOptionalMinutes(n);
        case "XXXX":
        case "XX":
            return formatTimezone(n);
        case "XXXXX":
        case "XXX":
        default:
            return formatTimezone(n, ":")
        }
    },
    x: function(e, t, r) {
        const n = e.getTimezoneOffset();
        switch (t) {
        case "x":
            return formatTimezoneWithOptionalMinutes(n);
        case "xxxx":
        case "xx":
            return formatTimezone(n);
        case "xxxxx":
        case "xxx":
        default:
            return formatTimezone(n, ":")
        }
    },
    O: function(e, t, r) {
        const n = e.getTimezoneOffset();
        switch (t) {
        case "O":
        case "OO":
        case "OOO":
            return "GMT" + formatTimezoneShort(n, ":");
        case "OOOO":
        default:
            return "GMT" + formatTimezone(n, ":")
        }
    },
    z: function(e, t, r) {
        const n = e.getTimezoneOffset();
        switch (t) {
        case "z":
        case "zz":
        case "zzz":
            return "GMT" + formatTimezoneShort(n, ":");
        case "zzzz":
        default:
            return "GMT" + formatTimezone(n, ":")
        }
    },
    t: function(e, t, r) {
        const n = Math.trunc(+e / 1e3);
        return addLeadingZeros(n, t.length)
    },
    T: function(e, t, r) {
        return addLeadingZeros(+e, t.length)
    }
};
function formatTimezoneShort(e, t="") {
    const r = e > 0 ? "-" : "+"
      , n = Math.abs(e)
      , a = Math.trunc(n / 60)
      , s = n % 60;
    return s === 0 ? r + String(a) : r + String(a) + t + addLeadingZeros(s, 2)
}
function formatTimezoneWithOptionalMinutes(e, t) {
    return e % 60 === 0 ? (e > 0 ? "-" : "+") + addLeadingZeros(Math.abs(e) / 60, 2) : formatTimezone(e, t)
}
function formatTimezone(e, t="") {
    const r = e > 0 ? "-" : "+"
      , n = Math.abs(e)
      , a = addLeadingZeros(Math.trunc(n / 60), 2)
      , s = addLeadingZeros(n % 60, 2);
    return r + a + t + s
}
const dateLongFormatter = (e, t) => {
    switch (e) {
    case "P":
        return t.date({
            width: "short"
        });
    case "PP":
        return t.date({
            width: "medium"
        });
    case "PPP":
        return t.date({
            width: "long"
        });
    case "PPPP":
    default:
        return t.date({
            width: "full"
        })
    }
}
  , timeLongFormatter = (e, t) => {
    switch (e) {
    case "p":
        return t.time({
            width: "short"
        });
    case "pp":
        return t.time({
            width: "medium"
        });
    case "ppp":
        return t.time({
            width: "long"
        });
    case "pppp":
    default:
        return t.time({
            width: "full"
        })
    }
}
  , dateTimeLongFormatter = (e, t) => {
    const r = e.match(/(P+)(p+)?/) || []
      , n = r[1]
      , a = r[2];
    if (!a)
        return dateLongFormatter(e, t);
    let s;
    switch (n) {
    case "P":
        s = t.dateTime({
            width: "short"
        });
        break;
    case "PP":
        s = t.dateTime({
            width: "medium"
        });
        break;
    case "PPP":
        s = t.dateTime({
            width: "long"
        });
        break;
    case "PPPP":
    default:
        s = t.dateTime({
            width: "full"
        });
        break
    }
    return s.replace("{{date}}", dateLongFormatter(n, t)).replace("{{time}}", timeLongFormatter(a, t))
}
  , longFormatters = {
    p: timeLongFormatter,
    P: dateTimeLongFormatter
}
  , dayOfYearTokenRE = /^D+$/
  , weekYearTokenRE = /^Y+$/
  , throwTokens = ["D", "DD", "YY", "YYYY"];
function isProtectedDayOfYearToken(e) {
    return dayOfYearTokenRE.test(e)
}
function isProtectedWeekYearToken(e) {
    return weekYearTokenRE.test(e)
}
function warnOrThrowProtectedError(e, t, r) {
    const n = message(e, t, r);
    if (console.warn(n),
    throwTokens.includes(e))
        throw new RangeError(n)
}
function message(e, t, r) {
    const n = e[0] === "Y" ? "years" : "days of the month";
    return `Use \`${e.toLowerCase()}\` instead of \`${e}\` (in \`${t}\`) for formatting ${n} to the input \`${r}\`; see: https://github.com/date-fns/date-fns/blob/master/docs/unicodeTokens.md`
}
const formattingTokensRegExp = /[yYQqMLwIdDecihHKkms]o|(\w)\1*|''|'(''|[^'])+('|$)|./g
  , longFormattingTokensRegExp = /P+p+|P+|p+|''|'(''|[^'])+('|$)|./g
  , escapedStringRegExp = /^'([^]*?)'?$/
  , doubleQuoteRegExp = /''/g
  , unescapedLatinCharacterRegExp = /[a-zA-Z]/;
function format(e, t, r) {
    const n = getDefaultOptions()
      , a = n.locale ?? enUS
      , s = n.firstWeekContainsDate ?? n.locale?.options?.firstWeekContainsDate ?? 1
      , o = n.weekStartsOn ?? n.locale?.options?.weekStartsOn ?? 0
      , l = toDate(e, r?.in);
    if (!isValid$1(l))
        throw new RangeError("Invalid time value");
    let u = t.match(longFormattingTokensRegExp).map(p => {
        const d = p[0];
        if (d === "p" || d === "P") {
            const f = longFormatters[d];
            return f(p, a.formatLong)
        }
        return p
    }
    ).join("").match(formattingTokensRegExp).map(p => {
        if (p === "''")
            return {
                isToken: !1,
                value: "'"
            };
        const d = p[0];
        if (d === "'")
            return {
                isToken: !1,
                value: cleanEscapedString(p)
            };
        if (formatters[d])
            return {
                isToken: !0,
                value: p
            };
        if (d.match(unescapedLatinCharacterRegExp))
            throw new RangeError("Format string contains an unescaped latin alphabet character `" + d + "`");
        return {
            isToken: !1,
            value: p
        }
    }
    );
    a.localize.preprocessor && (u = a.localize.preprocessor(l, u));
    const c = {
        firstWeekContainsDate: s,
        weekStartsOn: o,
        locale: a
    };
    return u.map(p => {
        if (!p.isToken)
            return p.value;
        const d = p.value;
        (isProtectedWeekYearToken(d) || isProtectedDayOfYearToken(d)) && warnOrThrowProtectedError(d, t, String(e));
        const f = formatters[d[0]];
        return f(l, d, a.localize, c)
    }
    ).join("")
}
function cleanEscapedString(e) {
    const t = e.match(escapedStringRegExp);
    return t ? t[1].replace(doubleQuoteRegExp, "'") : e
}
function formatDistance(e, t, r) {
    const n = getDefaultOptions()
      , a = r?.locale ?? n.locale ?? enUS
      , s = 2520
      , o = compareAsc(e, t);
    if (isNaN(o))
        throw new RangeError("Invalid time value");
    const l = Object.assign({}, r, {
        addSuffix: r?.addSuffix,
        comparison: o
    })
      , [u,c] = normalizeDates(r?.in, ...o > 0 ? [t, e] : [e, t])
      , p = differenceInSeconds(c, u)
      , d = (getTimezoneOffsetInMilliseconds(c) - getTimezoneOffsetInMilliseconds(u)) / 1e3
      , f = Math.round((p - d) / 60);
    let h;
    if (f < 2)
        return r?.includeSeconds ? p < 5 ? a.formatDistance("lessThanXSeconds", 5, l) : p < 10 ? a.formatDistance("lessThanXSeconds", 10, l) : p < 20 ? a.formatDistance("lessThanXSeconds", 20, l) : p < 40 ? a.formatDistance("halfAMinute", 0, l) : p < 60 ? a.formatDistance("lessThanXMinutes", 1, l) : a.formatDistance("xMinutes", 1, l) : f === 0 ? a.formatDistance("lessThanXMinutes", 1, l) : a.formatDistance("xMinutes", f, l);
    if (f < 45)
        return a.formatDistance("xMinutes", f, l);
    if (f < 90)
        return a.formatDistance("aboutXHours", 1, l);
    if (f < minutesInDay) {
        const m = Math.round(f / 60);
        return a.formatDistance("aboutXHours", m, l)
    } else {
        if (f < s)
            return a.formatDistance("xDays", 1, l);
        if (f < minutesInMonth) {
            const m = Math.round(f / minutesInDay);
            return a.formatDistance("xDays", m, l)
        } else if (f < minutesInMonth * 2)
            return h = Math.round(f / minutesInMonth),
            a.formatDistance("aboutXMonths", h, l)
    }
    if (h = differenceInMonths(c, u),
    h < 12) {
        const m = Math.round(f / minutesInMonth);
        return a.formatDistance("xMonths", m, l)
    } else {
        const m = h % 12
          , g = Math.trunc(h / 12);
        return m < 3 ? a.formatDistance("aboutXYears", g, l) : m < 9 ? a.formatDistance("overXYears", g, l) : a.formatDistance("almostXYears", g + 1, l)
    }
}
function formatDistanceStrict(e, t, r) {
    const n = getDefaultOptions()
      , a = r?.locale ?? n.locale ?? enUS
      , s = compareAsc(e, t);
    if (isNaN(s))
        throw new RangeError("Invalid time value");
    const o = Object.assign({}, r, {
        addSuffix: r?.addSuffix,
        comparison: s
    })
      , [l,u] = normalizeDates(r?.in, ...s > 0 ? [t, e] : [e, t])
      , c = getRoundingMethod(r?.roundingMethod ?? "round")
      , p = u.getTime() - l.getTime()
      , d = p / millisecondsInMinute
      , f = getTimezoneOffsetInMilliseconds(u) - getTimezoneOffsetInMilliseconds(l)
      , h = (p - f) / millisecondsInMinute
      , m = r?.unit;
    let g;
    if (m ? g = m : d < 1 ? g = "second" : d < 60 ? g = "minute" : d < minutesInDay ? g = "hour" : h < minutesInMonth ? g = "day" : h < minutesInYear ? g = "month" : g = "year",
    g === "second") {
        const x = c(p / 1e3);
        return a.formatDistance("xSeconds", x, o)
    } else if (g === "minute") {
        const x = c(d);
        return a.formatDistance("xMinutes", x, o)
    } else if (g === "hour") {
        const x = c(d / 60);
        return a.formatDistance("xHours", x, o)
    } else if (g === "day") {
        const x = c(h / minutesInDay);
        return a.formatDistance("xDays", x, o)
    } else if (g === "month") {
        const x = c(h / minutesInMonth);
        return x === 12 && m !== "month" ? a.formatDistance("xYears", 1, o) : a.formatDistance("xMonths", x, o)
    } else {
        const x = c(h / minutesInYear);
        return a.formatDistance("xYears", x, o)
    }
}
function formatDistanceToNow(e, t) {
    return formatDistance(e, constructNow(e), t)
}
function isRecord(e) {
    return typeof e == "object" && e !== null
}
function coerceNumber(e) {
    if (typeof e == "number" && Number.isFinite(e))
        return e;
    if (typeof e == "string" && e.trim() !== "") {
        const t = Number(e);
        return Number.isFinite(t) ? t : null
    }
    return null
}
function parseRateLimitPayload(e) {
    if (!isRecord(e))
        return null;
    const t = typeof e.error == "string" ? e.error : null
      , r = coerceNumber(e.resetAt)
      , n = coerceNumber(e.percentUsed) ?? void 0;
    return !t || r == null || !(/limit|rate/i.test(t) || n != null && n >= 100) ? null : {
        error: t,
        percentUsed: n,
        resetAt: r
    }
}
function tryParseJsonCandidate(e) {
    try {
        return parseRateLimitPayload(JSON.parse(e))
    } catch {
        return null
    }
}
function parseRateLimitFromText(e) {
    const t = tryParseJsonCandidate(e.trim());
    if (t)
        return t;
    const r = e.match(/\{[^{}]+\}/g) ?? [];
    for (const n of r) {
        const a = tryParseJsonCandidate(n);
        if (a)
            return a
    }
    return null
}
function parseRateLimitErrorPayload(e) {
    const t = [e]
      , r = new Set;
    for (; t.length > 0; ) {
        const n = t.shift();
        if (n == null || r.has(n))
            continue;
        r.add(n);
        const a = parseRateLimitPayload(n);
        if (a)
            return a;
        if (typeof n == "string") {
            const s = parseRateLimitFromText(n);
            if (s)
                return s;
            continue
        }
        if (n instanceof Error) {
            const s = parseRateLimitFromText(n.message);
            if (s)
                return s;
            n.cause && t.push(n.cause);
            continue
        }
        if (isRecord(n)) {
            if (typeof n.message == "string") {
                const s = parseRateLimitFromText(n.message);
                if (s)
                    return s
            }
            "cause"in n && t.push(n.cause),
            "data"in n && t.push(n.data),
            "body"in n && t.push(n.body),
            "response"in n && t.push(n.response)
        }
    }
    return null
}
function formatRateLimitResetTime(e, t=new Date) {
    const r = new Date(e);
    if (Number.isNaN(r.getTime()))
        return "soon";
    const n = isSameDay(r, t) ? format(r, "h:mm a") : format(r, "EEE, MMM d 'at' h:mm a")
      , a = formatDistanceStrict(r, t, {
        addSuffix: !0
    });
    return `${n} (${a})`
}
function buildRateLimitInlineErrorMessage(e, t=new Date) {
    const r = parseRateLimitErrorPayload(e);
    return r ? `You've reached your 5-hour usage limit. Your limit resets at ${formatRateLimitResetTime(r.resetAt, t)}.` : null
}
const chatLog = logger.scoped("chat")
  , titleLog = logger.scoped("title")
  , compactionLog = logger.scoped("compaction")
  , PAYMENT_REQUIRED_PATTERN = /(^|\D)402(\D|$)/
  , TRANSIENT_INIT_ERROR_MESSAGES = ["AgentEnvironmentContext container not mounted", "Configuration changed during initialization", "AgentEnvironment has been destroyed", "Environment resolved unusable"]
  , MAX_ENVIRONMENT_INIT_ATTEMPTS = 3;
function sleep(e) {
    return new Promise(t => {
        setTimeout(t, e)
    }
    )
}
function isPaymentRequiredError(e) {
    return PAYMENT_REQUIRED_PATTERN.test(e) || /payment required/i.test(e) || /free messages exhausted/i.test(e) || /subscription required/i.test(e)
}
function isTransientEnvironmentInitError(e) {
    return TRANSIENT_INIT_ERROR_MESSAGES.some(t => e.message.includes(t))
}
function getLatestCompactionSummary(e) {
    for (let t = e.length - 1; t >= 0; t--) {
        const r = e[t];
        if (isCompactionSummaryMessage(r))
            return r.summary
    }
    return null
}
function useRedoChat({threadId: e, onError: t}) {
    const r = useQueryClient()
      , n = useAppStore(ie => ie.geminiApiKey)
      , a = useAppStore(ie => ie.useProxy)
      , s = useAppStore(ie => ie.provider)
      , o = useAppStore(ie => ie.anthropicModel)
      , l = useAppStore(ie => ie.thinkingLevel)
      , {environment: u, isReady: c, ensureReady: p, setCompactionCallbacks: d} = useAgentEnvironment()
      , f = {
        messages: [],
        isStreaming: !1,
        streamMessage: null,
        pendingToolCalls: new Set
    }
      , [h,m] = reactExports.useState(f)
      , [g,x] = reactExports.useState(void 0)
      , [b,y] = reactExports.useState(null)
      , [w,R] = reactExports.useState(null)
      , [T,C] = reactExports.useState(!1)
      , P = useAppStore(ie => ie.openaiModel)
      , W = useAppStore(ie => ie.hostedModel)
      , ue = reactExports.useMemo( () => ({
        geminiApiKey: n,
        useProxy: a,
        provider: s,
        hostedModel: W,
        anthropicModel: o,
        openaiModel: P
    }), [n, a, s, W, o, P])
      , ce = reactExports.useRef(null)
      , ve = reactExports.useCallback( () => {
        const ie = ce.current ?? e;
        return createNotifier(ie ?? "unknown")
    }
    , [e])
      , [I,M] = reactExports.useState("")
      , $ = reactExports.useRef("");
    reactExports.useEffect( () => {
        $.current = I
    }
    , [I]);
    const pt = reactExports.useRef(h.messages);
    reactExports.useEffect( () => {
        pt.current = h.messages
    }
    , [h.messages]);
    const ba = reactExports.useMemo( () => agentMessagesToUI(h.messages, h.streamMessage, h.pendingToolCalls), [h])
      , us = reactExports.useMemo( () => getLatestCompactionSummary(h.messages), [h.messages])
      , Wd = reactExports.useMemo( () => !e || T ? !1 : prepareCompaction(h.messages, DEFAULT_COMPACTION_SETTINGS) != null, [e, T, h.messages])
      , Mr = us != null;
    reactExports.useEffect( () => {
        async function ie() {
            if (!e) {
                m(f),
                R(null),
                y(null);
                return
            }
            try {
                const He = await getThread(e);
                if (ce.current !== e)
                    return;
                if (He) {
                    const mm = He.messages.length === 0 && pt.current.length > 0;
                    if (R(He.tokenUsage ?? null),
                    mm || m({
                        ...f,
                        messages: He.messages
                    }),
                    !mm && u && c)
                        try {
                            u.getAgent().replaceMessages(He.messages)
                        } catch {}
                } else
                    m(f),
                    R(null)
            } catch (He) {
                chatLog.error("Failed to load thread messages:", He),
                ve().error("Failed to load conversation", ["Your previous messages could not be loaded.", "The conversation may appear empty."]),
                m(f),
                R(null)
            }
        }
        ce.current !== e && (ce.current = e,
        m(f),
        R(null),
        y(null),
        ie())
    }
    , [e, u, c]);
    const Kt = reactExports.useCallback(ie => {
        const He = buildRateLimitInlineErrorMessage(ie);
        return He ? (y({
            tone: "error",
            text: He
        }),
        !0) : !1
    }
    , [])
      , lt = reactExports.useMemo( () => ({
        onCompactionApplied: async (ie, He) => {
            ce.current && (m(mm => ({
                ...mm,
                messages: [...ie],
                pendingToolCalls: new Set
            })),
            await updateThread(ce.current, {
                messages: ie
            }),
            compactionLog.log("Compaction persisted to Dexie"))
        }
        ,
        onCompactionStart: () => C(!0),
        onCompactionEnd: () => C(!1)
    }), []);
    reactExports.useEffect( () => (d(lt),
    () => d(void 0)), [lt, d]);
    const Ht = reactExports.useCallback(ie => {
        const He = ce.current;
        !He || ie.length === 0 || updateThread(He, {
            messages: ie
        }).catch(mm => {
            chatLog.error("Failed to save messages:", mm)
        }
        )
    }
    , []);
    reactExports.useEffect( () => {
        if (!u || !c)
            return;
        let ie;
        try {
            ie = u.getAgent()
        } catch {
            return
        }
        return ie.subscribe(mm => {
            const {messages: Oe, isStreaming: R0, streamMessage: gm, pendingToolCalls: $s} = ie.state;
            if (m({
                messages: [...Oe],
                isStreaming: R0,
                streamMessage: gm,
                pendingToolCalls: new Set($s)
            }),
            (mm.type === "turn_end" || mm.type === "agent_end") && Ht([...Oe]),
            mm.type === "agent_end") {
                u?.cleanupDebugger(),
                r.invalidateQueries({
                    queryKey: ["redo-subscription"]
                });
                const go = ie.state.error;
                if (go) {
                    const Yl = new Error(go);
                    x(Yl);
                    const lv = Kt(Yl);
                    useAppStore.getState().provider === "proxy" && isPaymentRequiredError(go) && useAppStore.getState().setShowSubscriptionRequired(!0),
                    lv || ve().error("Chat error", [go])
                }
                if ($.current) {
                    const Yl = $.current;
                    M(""),
                    $.current = "",
                    setTimeout( () => {
                        fs.current(Yl)
                    }
                    , 100)
                }
            }
        }
        )
    }
    , [u, c, Kt]),
    reactExports.useEffect( () => u ? u.onStepFinish(He => {
        const mm = ce.current;
        if (mm && He.usage) {
            const Oe = He.usage.input ?? 0
              , R0 = He.usage.output ?? 0;
            R(gm => ({
                inputTokens: (gm?.inputTokens ?? 0) + Oe,
                outputTokens: (gm?.outputTokens ?? 0) + R0,
                totalTokens: (gm?.totalTokens ?? 0) + Oe + R0
            })),
            addThreadTokenUsage(mm, Oe, R0).catch(gm => {
                chatLog.error("Failed to save token usage:", gm),
                ve().warning("Failed to track token usage")
            }
            )
        }
    }
    ) : void 0, [u]);
    const $e = reactExports.useCallback(ie => {
        M(He => He ? `${He}
${ie}` : ie)
    }
    , [])
      , G = reactExports.useCallback( () => {
        const ie = $.current;
        return M(""),
        $.current = "",
        ie
    }
    , [])
      , he = reactExports.useCallback(ie => {
        chatLog.error("Failed to initialize environment:", ie),
        ve().error("Failed to initialize agent", ["The browser automation environment could not start.", ie.message, "Try refreshing the extension."]),
        t?.(ie)
    }
    , [ve, t])
      , Xe = reactExports.useCallback(async ie => {
        if (useAppStore.getState().activeThreadId !== ie)
            return null;
        let He = null;
        for (let Oe = 0; Oe < MAX_ENVIRONMENT_INIT_ATTEMPTS; Oe++)
            try {
                He = await p();
                break
            } catch (R0) {
                const gm = R0 instanceof Error ? R0 : new Error(String(R0));
                if (!(Oe === MAX_ENVIRONMENT_INIT_ATTEMPTS - 1) && isTransientEnvironmentInitError(gm)) {
                    const Yl = Oe === 0 ? 120 : 300;
                    chatLog.warn(`Transient init failure (attempt ${Oe + 1}/${MAX_ENVIRONMENT_INIT_ATTEMPTS}), retrying in ${Yl}ms: ${gm.message}`),
                    await sleep(Yl);
                    continue
                }
                return he(gm),
                null
            }
        if (!He)
            return he(new Error("Failed to initialize environment")),
            null;
        if (useAppStore.getState().activeThreadId !== ie)
            return null;
        const mm = async Oe => (await Oe.ready,
        {
            env: Oe,
            agent: Oe.getAgent()
        });
        try {
            return await mm(He)
        } catch (Oe) {
            const R0 = Oe instanceof Error ? Oe : new Error(String(Oe));
            if (!(R0.message.includes("AgentEnvironment not initialized") || R0.message.includes("AgentEnvironment has been destroyed")))
                return he(R0),
                null;
            try {
                const $s = await p();
                return await mm($s)
            } catch ($s) {
                const go = $s instanceof Error ? $s : new Error(String($s));
                return he(go),
                null
            }
        }
    }
    , [p, he])
      , jr = reactExports.useCallback(async (ie, He) => {
        if (s === "gemini" && !n) {
            const L = new Error("API key not configured. Please set your Gemini API key in Settings or switch to a different provider.");
            t?.(L);
            return
        }
        if (!e) {
            ve().error("No conversation selected", ["Please start a new conversation."]);
            return
        }
        const mm = e
          , Oe = await Xe(mm);
        if (!Oe)
            return;
        const {env: R0, agent: gm} = Oe
          , $s = pt.current.length === 0;
        if (ce.current = mm,
        $s) {
            titleLog.log("First message detected, generating title...");
            const L = mm;
            generateThreadTitle(ue, ie).then(A => (titleLog.log("Generated title:", A),
            updateThread(L, {
                title: A
            }))).then( () => titleLog.log("Updated thread with new title")).catch(async A => {
                titleLog.error("Failed to generate title:", A),
                await updateThread(L, {
                    title: "New Chat"
                })
            }
            )
        }
        if (x(void 0),
        y(null),
        pt.current.length > 0 && gm.state.messages.length === 0 && gm.replaceMessages(pt.current),
        s !== "gemini")
            try {
                const L = s === "proxy" ? "proxy" : s
                  , A = await R0.getProxyAuthHeaders(L);
                A && R0.setModelHeaders(A)
            } catch (L) {
                chatLog.error("Failed to get proxy auth headers:", L);
                const A = new Error("Not authenticated. Please log in again.");
                x(A),
                t?.(A);
                return
            }
        const go = He?.filter(L => L.kind === "image")
          , Yl = He?.filter(L => L.kind === "file")
          , lv = He?.filter(L => L.kind === "pdf")
          , Ox = He?.filter(L => L.kind === "docx")
          , ev = He?.filter(L => L.kind === "xlsx" || L.kind === "csv")
          , iv = go?.map(L => {
            const A = L.dataUrl.match(/^data:[^;]+;base64,(.+)$/);
            return {
                type: "image",
                data: A ? A[1] : L.dataUrl,
                mimeType: L.mimeType
            }
        }
        )
          , N = []
          , bi = [...Yl ?? [], ...lv ?? [], ...Ox ?? [], ...ev ?? []];
        if (bi.length > 0)
            try {
                const L = await getUnifiedFsInstance()
                  , A = `/tmp/chat-attachments/${mm}`;
                await L.mkdir(A, {
                    recursive: !0
                });
                for (const F of bi) {
                    const Qt = sanitizeFileName(F.fileName)
                      , ps = `${A}/${F.id}`
                      , pr = `${ps}/${Qt}`;
                    await L.mkdir(ps, {
                        recursive: !0
                    });
                    const mo = F.kind === "file" ? await F.file.text() : new Uint8Array(await F.file.arrayBuffer());
                    await L.writeFile(pr, mo),
                    N.push(buildFileAttachmentTag({
                        path: pr,
                        filename: F.fileName,
                        mimeType: F.mimeType,
                        size: F.size
                    }))
                }
            } catch (L) {
                const A = L instanceof Error ? L : new Error(String(L));
                x(A),
                ve().error("Failed to attach file", [A.message]),
                t?.(A);
                return
            }
        const Rx = N.length > 0 ? [ie.trim(), ...N].filter(Boolean).join(`
`) : ie.trim()
          , sv = {
            role: "user",
            content: iv && iv.length > 0 ? [{
                type: "text",
                text: Rx || ""
            }, ...iv] : Rx,
            timestamp: Date.now()
        };
        m(L => ({
            ...L,
            messages: [...L.messages, sv],
            isStreaming: !0
        })),
        gm.setThinkingLevel(l === "none" ? "off" : l);
        const h0 = await R0.getActiveTabInfo();
        let av = null;
        h0 && (av = {
            role: "custom",
            customType: "active-tab-context",
            content: `[Active Tab] id=${h0.id} | ${h0.title} | ${h0.url}`,
            display: !1,
            timestamp: Date.now()
        });
        try {
            const L = [...av ? [av] : [], sv];
            await gm.prompt(L)
        } catch (L) {
            chatLog.error("Agent prompt error:", L);
            const A = L instanceof Error ? L : new Error(String(L));
            x(A),
            m(Qt => ({
                ...Qt,
                isStreaming: !1
            })),
            Kt(A) || ve().error("Chat error", [A.message]),
            t?.(A)
        }
    }
    , [n, s, l, ue, e, t, Xe, ve, Kt])
      , fs = reactExports.useRef(jr);
    reactExports.useEffect( () => {
        fs.current = jr
    }
    , [jr]);
    const bf = reactExports.useCallback( () => {
        if (!(!u || !c)) {
            try {
                u.getAgent().abort()
            } catch {}
            u.abortCurrentExecution();
            try {
                const ie = u.getAgent();
                m({
                    messages: [...ie.state.messages],
                    isStreaming: !1,
                    streamMessage: null,
                    pendingToolCalls: new Set
                })
            } catch {
                m(ie => ({
                    ...ie,
                    isStreaming: !1,
                    streamMessage: null,
                    pendingToolCalls: new Set
                }))
            }
        }
    }
    , [u, c])
      , $0 = reactExports.useCallback(async () => {
        if (!(!ce.current || T || !Wd))
            try {
                const ie = u ?? await p()
                  , He = ie.getAgent();
                pt.current.length > 0 && He.state.messages.length === 0 && He.replaceMessages(pt.current),
                await ie.compactConversation() ? compactionLog.log("Manual compaction complete") : compactionLog.log("Manual compaction skipped: nothing to compact")
            } catch (ie) {
                compactionLog.error("Manual compaction failed:", ie),
                ve().error("Compaction failed", ["Could not summarize the conversation.", "Try again later."]),
                t?.(ie instanceof Error ? ie : new Error("Manual compaction failed"))
            }
    }
    , [Wd, u, p, T, t, ve]);
    return {
        messages: ba,
        isLoading: h.isStreaming,
        error: g,
        inlineSystemMessage: b,
        sendMessage: jr,
        stopGeneration: bf,
        queuedMessage: I,
        queueMessage: $e,
        clearQueue: G,
        isCompacting: T,
        canManualCompaction: Wd,
        hasCompactionSummary: Mr,
        latestCompactionSummary: us,
        triggerManualCompaction: $0,
        tokenUsage: w
    }
}
function useCollapsibleRoot(e) {
    const {open: t, defaultOpen: r, onOpenChange: n, disabled: a} = e
      , s = t !== void 0
      , [o,l] = useControlled({
        controlled: t,
        default: r,
        name: "Collapsible",
        state: "open"
    })
      , {mounted: u, setMounted: c, transitionStatus: p} = useTransitionStatus(o, !0, !0)
      , [d,f] = reactExports.useState(o)
      , [{height: h, width: m},g] = reactExports.useState({
        height: void 0,
        width: void 0
    })
      , x = useBaseUiId()
      , [b,y] = reactExports.useState()
      , w = b ?? x
      , [R,T] = reactExports.useState(!1)
      , [C,P] = reactExports.useState(!1)
      , W = reactExports.useRef(null)
      , ue = reactExports.useRef(null)
      , ce = reactExports.useRef(null)
      , ve = reactExports.useRef(null)
      , I = useAnimationsFinished(ve, !1)
      , M = useStableCallback($ => {
        const pt = !o
          , ba = createChangeEventDetails(triggerPress, $.nativeEvent);
        if (n(pt, ba),
        ba.isCanceled)
            return;
        const us = ve.current;
        ue.current === "css-animation" && us != null && us.style.removeProperty("animation-name"),
        !R && !C && (ue.current != null && ue.current !== "css-animation" && !u && pt && c(!0),
        ue.current === "css-animation" && (!d && pt && f(!0),
        !u && pt && c(!0))),
        l(pt),
        ue.current === "none" && u && !pt && c(!1)
    }
    );
    return useIsoLayoutEffect( () => {
        s && ue.current === "none" && !C && !o && c(!1)
    }
    , [s, C, o, t, c]),
    reactExports.useMemo( () => ({
        abortControllerRef: W,
        animationTypeRef: ue,
        disabled: a,
        handleTrigger: M,
        height: h,
        mounted: u,
        open: o,
        panelId: w,
        panelRef: ve,
        runOnceAnimationsFinish: I,
        setDimensions: g,
        setHiddenUntilFound: T,
        setKeepMounted: P,
        setMounted: c,
        setOpen: l,
        setPanelIdState: y,
        setVisible: f,
        transitionDimensionRef: ce,
        transitionStatus: p,
        visible: d,
        width: m
    }), [W, ue, a, M, h, u, o, w, ve, I, g, T, P, c, l, f, ce, p, d, m])
}
const CollapsibleRootContext = reactExports.createContext(void 0);
function useCollapsibleRootContext() {
    const e = reactExports.useContext(CollapsibleRootContext);
    if (e === void 0)
        throw new Error(formatErrorMessage(15));
    return e
}
let CollapsiblePanelDataAttributes = (function(e) {
    return e.open = "data-open",
    e.closed = "data-closed",
    e[e.startingStyle = TransitionStatusDataAttributes.startingStyle] = "startingStyle",
    e[e.endingStyle = TransitionStatusDataAttributes.endingStyle] = "endingStyle",
    e
}
)({})
  , CollapsibleTriggerDataAttributes = (function(e) {
    return e.panelOpen = "data-panel-open",
    e
}
)({});
const PANEL_OPEN_HOOK = {
    [CollapsiblePanelDataAttributes.open]: ""
}
  , PANEL_CLOSED_HOOK = {
    [CollapsiblePanelDataAttributes.closed]: ""
}
  , triggerOpenStateMapping = {
    open(e) {
        return e ? {
            [CollapsibleTriggerDataAttributes.panelOpen]: ""
        } : null
    }
}
  , collapsibleOpenStateMapping = {
    open(e) {
        return e ? PANEL_OPEN_HOOK : PANEL_CLOSED_HOOK
    }
}
  , collapsibleStateAttributesMapping = {
    ...collapsibleOpenStateMapping,
    ...transitionStatusMapping
}
  , CollapsibleRoot = reactExports.forwardRef(function e(t, r) {
    const {render: n, className: a, defaultOpen: s=!1, disabled: o=!1, onOpenChange: l, open: u, ...c} = t
      , p = useStableCallback(l)
      , d = useCollapsibleRoot({
        open: u,
        defaultOpen: s,
        onOpenChange: p,
        disabled: o
    })
      , f = reactExports.useMemo( () => ({
        open: d.open,
        disabled: d.disabled,
        transitionStatus: d.transitionStatus
    }), [d.open, d.disabled, d.transitionStatus])
      , h = reactExports.useMemo( () => ({
        ...d,
        onOpenChange: p,
        state: f
    }), [d, p, f])
      , m = useRenderElement("div", t, {
        state: f,
        ref: r,
        props: c,
        stateAttributesMapping: collapsibleStateAttributesMapping
    });
    return jsxRuntimeExports.jsx(CollapsibleRootContext.Provider, {
        value: h,
        children: m
    })
})
  , stateAttributesMapping$7 = {
    ...triggerOpenStateMapping,
    ...transitionStatusMapping
}
  , CollapsibleTrigger$1 = reactExports.forwardRef(function e(t, r) {
    const {panelId: n, open: a, handleTrigger: s, state: o, disabled: l} = useCollapsibleRootContext()
      , {className: u, disabled: c=l, id: p, render: d, nativeButton: f=!0, ...h} = t
      , {getButtonProps: m, buttonRef: g} = useButton({
        disabled: c,
        focusableWhenDisabled: !0,
        native: f
    })
      , x = reactExports.useMemo( () => ({
        "aria-controls": a ? n : void 0,
        "aria-expanded": a,
        disabled: c,
        onClick: s
    }), [n, c, a, s]);
    return useRenderElement("button", t, {
        state: o,
        ref: [r, g],
        props: [x, h, m],
        stateAttributesMapping: stateAttributesMapping$7
    })
});
let AccordionRootDataAttributes = (function(e) {
    return e.disabled = "data-disabled",
    e.orientation = "data-orientation",
    e
}
)({});
function useCollapsiblePanel(e) {
    const {abortControllerRef: t, animationTypeRef: r, externalRef: n, height: a, hiddenUntilFound: s, keepMounted: o, id: l, mounted: u, onOpenChange: c, open: p, panelRef: d, runOnceAnimationsFinish: f, setDimensions: h, setMounted: m, setOpen: g, setVisible: x, transitionDimensionRef: b, visible: y, width: w} = e
      , R = reactExports.useRef(!1)
      , T = reactExports.useRef(null)
      , C = reactExports.useRef(p)
      , P = reactExports.useRef(p)
      , W = useAnimationFrame()
      , ue = reactExports.useMemo( () => r.current === "css-animation" ? !y : !p && !u, [p, u, y, r])
      , ce = useStableCallback(I => {
        if (!I)
            return;
        if (r.current == null || b.current == null) {
            const pt = getComputedStyle(I)
              , ba = pt.animationName !== "none" && pt.animationName !== ""
              , us = pt.transitionDuration !== "0s" && pt.transitionDuration !== "";
            ba && us || (pt.animationName === "none" && pt.transitionDuration !== "0s" ? r.current = "css-transition" : pt.animationName !== "none" && pt.transitionDuration === "0s" ? r.current = "css-animation" : r.current = "none"),
            I.getAttribute(AccordionRootDataAttributes.orientation) === "horizontal" || pt.transitionProperty.indexOf("width") > -1 ? b.current = "width" : b.current = "height"
        }
        if (r.current !== "css-transition")
            return;
        (a === void 0 || w === void 0) && (h({
            height: I.scrollHeight,
            width: I.scrollWidth
        }),
        P.current && I.style.setProperty("transition-duration", "0s"));
        let M = -1
          , $ = -1;
        return M = AnimationFrame.request( () => {
            P.current = !1,
            $ = AnimationFrame.request( () => {
                setTimeout( () => {
                    I.style.removeProperty("transition-duration")
                }
                )
            }
            )
        }
        ),
        () => {
            AnimationFrame.cancel(M),
            AnimationFrame.cancel($)
        }
    }
    )
      , ve = useMergedRefs(n, d, ce);
    return useIsoLayoutEffect( () => {
        if (r.current !== "css-transition")
            return;
        const I = d.current;
        if (!I)
            return;
        let M = -1;
        if (t.current != null && (t.current.abort(),
        t.current = null),
        p) {
            const $ = {
                "justify-content": I.style.justifyContent,
                "align-items": I.style.alignItems,
                "align-content": I.style.alignContent,
                "justify-items": I.style.justifyItems
            };
            Object.keys($).forEach(pt => {
                I.style.setProperty(pt, "initial", "important")
            }
            ),
            !P.current && !o && I.setAttribute(CollapsiblePanelDataAttributes.startingStyle, ""),
            h({
                height: I.scrollHeight,
                width: I.scrollWidth
            }),
            M = AnimationFrame.request( () => {
                Object.entries($).forEach( ([pt,ba]) => {
                    ba === "" ? I.style.removeProperty(pt) : I.style.setProperty(pt, ba)
                }
                )
            }
            )
        } else {
            if (I.scrollHeight === 0 && I.scrollWidth === 0)
                return;
            h({
                height: I.scrollHeight,
                width: I.scrollWidth
            });
            const $ = new AbortController;
            t.current = $;
            const pt = $.signal;
            let ba = null;
            const us = CollapsiblePanelDataAttributes.endingStyle;
            return ba = new MutationObserver(Wd => {
                Wd.some(Kt => Kt.type === "attributes" && Kt.attributeName === us) && (ba?.disconnect(),
                ba = null,
                f( () => {
                    h({
                        height: 0,
                        width: 0
                    }),
                    I.style.removeProperty("content-visibility"),
                    m(!1),
                    t.current === $ && (t.current = null)
                }
                , pt))
            }
            ),
            ba.observe(I, {
                attributes: !0,
                attributeFilter: [us]
            }),
            () => {
                ba?.disconnect(),
                W.cancel(),
                t.current === $ && ($.abort(),
                t.current = null)
            }
        }
        return () => {
            AnimationFrame.cancel(M)
        }
    }
    , [t, r, W, s, o, u, p, d, f, h, m]),
    useIsoLayoutEffect( () => {
        if (r.current !== "css-animation")
            return;
        const I = d.current;
        I && (T.current = I.style.animationName || T.current,
        I.style.setProperty("animation-name", "none"),
        h({
            height: I.scrollHeight,
            width: I.scrollWidth
        }),
        !C.current && !R.current && I.style.removeProperty("animation-name"),
        p ? (t.current != null && (t.current.abort(),
        t.current = null),
        m(!0),
        x(!0)) : (t.current = new AbortController,
        f( () => {
            m(!1),
            x(!1),
            t.current = null
        }
        , t.current.signal)))
    }
    , [t, r, p, d, f, h, m, x, y]),
    useOnMount( () => {
        const I = AnimationFrame.request( () => {
            C.current = !1
        }
        );
        return () => AnimationFrame.cancel(I)
    }
    ),
    useIsoLayoutEffect( () => {
        if (!s)
            return;
        const I = d.current;
        if (!I)
            return;
        let M = -1
          , $ = -1;
        return p && R.current && (I.style.transitionDuration = "0s",
        h({
            height: I.scrollHeight,
            width: I.scrollWidth
        }),
        M = AnimationFrame.request( () => {
            R.current = !1,
            $ = AnimationFrame.request( () => {
                setTimeout( () => {
                    I.style.removeProperty("transition-duration")
                }
                )
            }
            )
        }
        )),
        () => {
            AnimationFrame.cancel(M),
            AnimationFrame.cancel($)
        }
    }
    , [s, p, d, h]),
    useIsoLayoutEffect( () => {
        const I = d.current;
        I && s && ue && (I.setAttribute("hidden", "until-found"),
        r.current === "css-transition" && I.setAttribute(CollapsiblePanelDataAttributes.startingStyle, ""))
    }
    , [s, ue, r, d]),
    reactExports.useEffect(function() {
        const M = d.current;
        if (!M)
            return;
        function $(pt) {
            R.current = !0,
            g(!0),
            c(!0, createChangeEventDetails(none, pt))
        }
        return M.addEventListener("beforematch", $),
        () => {
            M.removeEventListener("beforematch", $)
        }
    }, [c, d, g]),
    reactExports.useMemo( () => ({
        props: {
            hidden: ue,
            id: l,
            ref: ve
        }
    }), [ue, l, ve])
}
let CollapsiblePanelCssVars = (function(e) {
    return e.collapsiblePanelHeight = "--collapsible-panel-height",
    e.collapsiblePanelWidth = "--collapsible-panel-width",
    e
}
)({});
const CollapsiblePanel = reactExports.forwardRef(function e(t, r) {
    const {className: n, hiddenUntilFound: a, keepMounted: s, render: o, id: l, ...u} = t
      , {abortControllerRef: c, animationTypeRef: p, height: d, mounted: f, onOpenChange: h, open: m, panelId: g, panelRef: x, runOnceAnimationsFinish: b, setDimensions: y, setHiddenUntilFound: w, setKeepMounted: R, setMounted: T, setPanelIdState: C, setOpen: P, setVisible: W, state: ue, transitionDimensionRef: ce, visible: ve, width: I, transitionStatus: M} = useCollapsibleRootContext()
      , $ = a ?? !1
      , pt = s ?? !1;
    useIsoLayoutEffect( () => {
        if (l)
            return C(l),
            () => {
                C(void 0)
            }
    }
    , [l, C]),
    useIsoLayoutEffect( () => {
        w($)
    }
    , [w, $]),
    useIsoLayoutEffect( () => {
        R(pt)
    }
    , [R, pt]);
    const {props: ba} = useCollapsiblePanel({
        abortControllerRef: c,
        animationTypeRef: p,
        externalRef: r,
        height: d,
        hiddenUntilFound: $,
        id: g,
        keepMounted: pt,
        mounted: f,
        onOpenChange: h,
        open: m,
        panelRef: x,
        runOnceAnimationsFinish: b,
        setDimensions: y,
        setMounted: T,
        setOpen: P,
        setVisible: W,
        transitionDimensionRef: ce,
        visible: ve,
        width: I
    });
    useOpenChangeComplete({
        open: m && M === "idle",
        ref: x,
        onComplete() {
            m && y({
                height: void 0,
                width: void 0
            })
        }
    });
    const us = reactExports.useMemo( () => ({
        ...ue,
        transitionStatus: M
    }), [ue, M])
      , Wd = useRenderElement("div", t, {
        state: us,
        ref: [r, x],
        props: [ba, {
            style: {
                [CollapsiblePanelCssVars.collapsiblePanelHeight]: d === void 0 ? "auto" : `${d}px`,
                [CollapsiblePanelCssVars.collapsiblePanelWidth]: I === void 0 ? "auto" : `${I}px`
            }
        }, u],
        stateAttributesMapping: collapsibleStateAttributesMapping
    });
    return pt || $ || !pt && f ? Wd : null
});
function Collapsible({...e}) {
    return jsxRuntimeExports.jsx(CollapsibleRoot, {
        "data-slot": "collapsible",
        ...e
    })
}
function CollapsibleTrigger({asChild: e, children: t, ...r}) {
    return e && reactExports.isValidElement(t) ? jsxRuntimeExports.jsx(CollapsibleTrigger$1, {
        "data-slot": "collapsible-trigger",
        render: t,
        ...r
    }) : jsxRuntimeExports.jsx(CollapsibleTrigger$1, {
        "data-slot": "collapsible-trigger",
        ...r,
        children: t
    })
}
function CollapsibleContent({...e}) {
    return jsxRuntimeExports.jsx(CollapsiblePanel, {
        "data-slot": "collapsible-content",
        ...e
    })
}
const MAX_RENDERED_TOOL_TEXT_CHARS = 12e3
  , RENDERED_TOOL_TEXT_HEAD_CHARS = 8e3;
function truncate(e, t) {
    return e ? e.length > t ? e.slice(0, t) + "..." : e : ""
}
function truncateForRender(e, t) {
    if (e.length <= MAX_RENDERED_TOOL_TEXT_CHARS)
        return {
            text: e,
            wasTruncated: !1
        };
    const r = e.slice(0, RENDERED_TOOL_TEXT_HEAD_CHARS)
      , n = e.slice(-4e3)
      , a = e.length - r.length - n.length;
    return {
        text: [r, "", `... ${t} truncated (${a} characters omitted) ...`, "", n].join(`
`),
        wasTruncated: !0
    }
}
function formatOutput(e) {
    if (typeof e == "string")
        return e;
    if (typeof e == "object" && e !== null && "output"in e)
        return String(e.output);
    try {
        return JSON.stringify(e, null, 2) ?? String(e)
    } catch {
        return String(e)
    }
}
const TOOL_CONFIG = {
    bash: {
        label: "Ran command",
        activeLabel: "Running command",
        cancelledLabel: "Cancelled",
        errorLabel: "Command failed",
        getMessage: (e, t) => {
            const r = e.description;
            if (r)
                return r;
            const n = truncate(e.command, 60);
            return n ? `${t}: ${n}` : null
        }
        ,
        getExpandedContent: e => e.command ? {
            label: "Command",
            content: e.command
        } : null
    },
    readFile: {
        label: "Read file",
        activeLabel: "Reading file",
        cancelledLabel: "Cancelled",
        errorLabel: "Read failed",
        getDetail: e => truncate(e.path, 60),
        getExpandedContent: e => e.path ? {
            label: "Path",
            content: e.path
        } : null
    },
    writeFile: {
        label: "Wrote file",
        activeLabel: "Writing file",
        cancelledLabel: "Cancelled",
        errorLabel: "Write failed",
        getDetail: e => truncate(e.path, 60),
        getExpandedContent: e => {
            const t = [];
            return e.path && t.push(`Path: ${e.path}`),
            e.content && t.push(`Content:
${e.content}`),
            t.length > 0 ? {
                label: "Details",
                content: t.join(`

`)
            } : null
        }
    },
    loadSkill: {
        label: "Loaded skill",
        activeLabel: "Loading skill",
        cancelledLabel: "Cancelled",
        errorLabel: "Skill load failed",
        getDetail: e => e.name,
        getExpandedContent: e => e.name ? {
            label: "Skill",
            content: e.name
        } : null
    },
    webSearch: {
        label: "Searched the web",
        activeLabel: "Searching the web",
        cancelledLabel: "Search cancelled",
        errorLabel: "Search failed",
        icon: Globe,
        getDetail: e => truncate(e.query, 60),
        getExpandedContent: e => e.query ? {
            label: "Query",
            content: e.query
        } : null
    }
};
function mapState(e) {
    switch (e) {
    case "completed":
        return "completed";
    case "cancelled":
        return "cancelled";
    case "error":
        return "error";
    default:
        return "pending"
    }
}
function getFriendlyMessage(e, t, r) {
    const n = TOOL_CONFIG[e];
    if (!n)
        switch (r) {
        case "completed":
            return "Completed task";
        case "cancelled":
            return "Cancelled";
        case "error":
            return "Task failed";
        default:
            return "Working..."
        }
    let a;
    switch (r) {
    case "completed":
        a = n.label;
        break;
    case "cancelled":
        a = n.cancelledLabel;
        break;
    case "error":
        a = n.errorLabel;
        break;
    default:
        a = n.activeLabel
    }
    if (n.getMessage)
        return n.getMessage(t, a) ?? a;
    const s = n.getDetail?.(t);
    return s ? `${a}: ${s}` : a
}
function getExpandedContent(e, t) {
    return TOOL_CONFIG[e]?.getExpandedContent?.(t) ?? null
}
function ToolCallCard({toolPart: e}) {
    const [t,r] = reactExports.useState(!1)
      , [n,a] = reactExports.useState(!1)
      , [s,o] = reactExports.useState(!1)
      , {state: l, input: u, output: c, errorText: p, toolName: d} = e
      , f = u ?? {}
      , h = mapState(l)
      , g = h === "error" && typeof p == "string" && p.includes("[Aborted]") ? "cancelled" : h
      , x = getFriendlyMessage(d, f, g)
      , b = getExpandedContent(d, f)
      , y = TOOL_CONFIG[d]?.icon
      , w = reactExports.useMemo( () => !t || !b ? null : {
        ...b,
        preview: truncateForRender(b.content, "details")
    }, [t, b])
      , R = reactExports.useMemo( () => {
        if (!t || c === void 0 && p === void 0)
            return null;
        const T = c !== void 0 ? formatOutput(c) : p ?? "";
        return {
            fullText: T,
            preview: truncateForRender(T, "output")
        }
    }
    , [t, c, p]);
    return jsxRuntimeExports.jsxs(Collapsible, {
        open: t,
        onOpenChange: T => {
            r(T),
            T || (a(!1),
            o(!1))
        }
        ,
        children: [jsxRuntimeExports.jsx(CollapsibleTrigger, {
            asChild: !0,
            children: jsxRuntimeExports.jsxs("button", {
                className: cn$1("group flex items-start gap-1.5 text-left", "text-sm text-foreground/70 italic", "hover:text-foreground transition-colors"),
                children: [g === "completed" ? y ? jsxRuntimeExports.jsx(y, {
                    className: "size-3.5 mt-1 text-green-600 dark:text-green-400 flex-shrink-0"
                }) : jsxRuntimeExports.jsx(Check, {
                    className: "size-3.5 mt-1 text-green-600 dark:text-green-400 flex-shrink-0"
                }) : g === "cancelled" ? jsxRuntimeExports.jsx(X$1, {
                    className: "size-3.5 mt-1 text-red-500 dark:text-red-400 flex-shrink-0"
                }) : g === "error" ? jsxRuntimeExports.jsx(CircleAlert, {
                    className: "size-3.5 mt-1 text-amber-500 dark:text-amber-400 flex-shrink-0"
                }) : jsxRuntimeExports.jsx(LoaderCircle, {
                    className: "size-3.5 mt-1 text-foreground/50 animate-spin flex-shrink-0"
                }), jsxRuntimeExports.jsx("span", {
                    children: x
                }), jsxRuntimeExports.jsx(ChevronRight, {
                    className: cn$1("size-3.5 mt-1 flex-shrink-0 transition-all", "opacity-0 group-hover:opacity-100", t && "rotate-90")
                })]
            })
        }), jsxRuntimeExports.jsx(CollapsibleContent, {
            children: t && jsxRuntimeExports.jsxs("div", {
                className: "mt-2 ml-4 space-y-2 text-sm",
                children: [w && jsxRuntimeExports.jsxs("div", {
                    children: [jsxRuntimeExports.jsx("p", {
                        className: "text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1",
                        children: w.label
                    }), jsxRuntimeExports.jsx("pre", {
                        className: "p-2 rounded bg-muted/50 overflow-x-auto font-mono text-xs whitespace-pre-wrap",
                        children: n ? w.content : w.preview.text
                    }), w.preview.wasTruncated && jsxRuntimeExports.jsxs("div", {
                        className: "mt-1 flex items-center gap-2",
                        children: [jsxRuntimeExports.jsx("p", {
                            className: "text-[11px] text-muted-foreground",
                            children: n ? "Showing full details. Large content can impact performance." : "Large tool details are truncated to keep the UI responsive."
                        }), jsxRuntimeExports.jsx(Button, {
                            type: "button",
                            variant: "link",
                            size: "xs",
                            className: "h-auto p-0 text-[11px]",
                            onClick: () => a(T => !T),
                            children: n ? "Show truncated preview" : "Show full details"
                        })]
                    })]
                }), R && jsxRuntimeExports.jsxs("div", {
                    children: [jsxRuntimeExports.jsx("p", {
                        className: "text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1",
                        children: g === "cancelled" ? "Cancelled" : g === "error" ? "Error" : "Result"
                    }), jsxRuntimeExports.jsx("pre", {
                        className: cn$1("p-2 rounded overflow-x-auto font-mono text-xs whitespace-pre-wrap", g === "cancelled" ? "bg-red-500/10" : g === "error" ? "bg-amber-500/10" : "bg-muted/30"),
                        children: s ? R.fullText : R.preview.text
                    }), R.preview.wasTruncated && jsxRuntimeExports.jsxs("div", {
                        className: "mt-1 flex items-center gap-2",
                        children: [jsxRuntimeExports.jsx("p", {
                            className: "text-[11px] text-muted-foreground",
                            children: s ? "Showing full output. Large content can impact performance." : "Large tool output is truncated to keep the UI responsive."
                        }), jsxRuntimeExports.jsx(Button, {
                            type: "button",
                            variant: "link",
                            size: "xs",
                            className: "h-auto p-0 text-[11px]",
                            onClick: () => o(T => !T),
                            children: s ? "Show truncated preview" : "Show full output"
                        })]
                    })]
                }), e.images?.map( (T, C) => jsxRuntimeExports.jsx("img", {
                    src: T.url,
                    alt: T.filename || "Screenshot",
                    className: "max-w-xs rounded-lg border border-border"
                }, C))]
            })
        })]
    })
}
const DOBROWSER_SCHEME = "dobrowser:";
function isAllowedDoBrowserPath(e) {
    return e === "/workspace" || e.startsWith("/workspace/") || e === "/mnt" || e.startsWith("/mnt/")
}
function isDoBrowserHref(e) {
    return typeof e == "string" && e.startsWith(DOBROWSER_SCHEME)
}
function parseDoBrowserHref(e) {
    if (!isDoBrowserHref(e))
        return null;
    const t = e.slice(DOBROWSER_SCHEME.length);
    if (!t.startsWith("/"))
        return null;
    let r;
    try {
        r = decodeURIComponent(t)
    } catch {
        return null
    }
    if (!isAllowedDoBrowserPath(r))
        return null;
    const n = r.split("/").pop() || r;
    return {
        path: r,
        filename: n
    }
}
function stripFrontmatter(e) {
    return e.replace(/^---\n[\s\S]*?\n---\n?/, "")
}
const [sanitizePlugin,sanitizeSchema] = Fe$1.sanitize
  , hrefProtocols = sanitizeSchema.protocols?.href ?? []
  , CHAT_REHYPE_PLUGINS = [Fe$1.raw, [sanitizePlugin, {
    ...sanitizeSchema,
    protocols: {
        ...sanitizeSchema.protocols,
        href: hrefProtocols.includes("dobrowser") ? hrefProtocols : [...hrefProtocols, "dobrowser"]
    }
}], Fe$1.harden];
function isExternalHref(e) {
    return e.startsWith("http:") || e.startsWith("https:") || e.startsWith("mailto:") || e.startsWith("tel:")
}
function extractTextContent(e) {
    return e == null || typeof e == "boolean" ? "" : typeof e == "string" || typeof e == "number" ? String(e) : Array.isArray(e) ? e.map(extractTextContent).join("") : reactExports.isValidElement(e) ? extractTextContent(e.props.children) : ""
}
const MarkdownContent = reactExports.memo(function e({content: t}) {
    const r = stripFrontmatter(t)
      , n = o => {
        const l = chrome.runtime.getURL(`viewer.html?file=${encodeURIComponent(o)}`);
        chrome.tabs.create({
            url: l
        })
    }
      , a = async (o, l) => {
        try {
            const c = await (await getUnifiedFsInstance()).readFileBuffer(o)
              , p = new ArrayBuffer(c.byteLength);
            new Uint8Array(p).set(c);
            const d = new Blob([p])
              , f = URL.createObjectURL(d)
              , h = document.createElement("a");
            h.href = f,
            h.download = l,
            document.body.appendChild(h),
            h.click(),
            document.body.removeChild(h),
            URL.revokeObjectURL(f)
        } catch (u) {
            console.error("Failed to download file link:", u)
        }
    }
      , s = async o => {
        try {
            await navigator.clipboard.writeText(o)
        } catch (l) {
            console.error("Failed to copy code block:", l)
        }
    }
    ;
    return jsxRuntimeExports.jsx(_r$1, {
        className: "min-w-0 break-words",
        linkSafety: {
            enabled: !1
        },
        rehypePlugins: CHAT_REHYPE_PLUGINS,
        remarkPlugins: [remarkGfm],
        urlTransform: (o, l, u) => o.startsWith("dobrowser:") ? o : bo$1(o),
        components: {
            p({children: o}) {
                return jsxRuntimeExports.jsx("p", {
                    className: "mb-2 last:mb-0 text-foreground",
                    children: o
                })
            },
            ul({children: o}) {
                return jsxRuntimeExports.jsx("ul", {
                    className: "list-disc pl-4 mb-2 text-foreground",
                    children: o
                })
            },
            ol({children: o}) {
                return jsxRuntimeExports.jsx("ol", {
                    className: "list-decimal pl-6 mb-2 text-foreground",
                    children: o
                })
            },
            li({children: o}) {
                return jsxRuntimeExports.jsx("li", {
                    className: "mb-0.5 text-foreground",
                    children: o
                })
            },
            blockquote({children: o}) {
                return jsxRuntimeExports.jsx("blockquote", {
                    className: "border-l-2 border-border pl-3 italic text-muted-foreground my-2",
                    children: o
                })
            },
            h1({children: o}) {
                return jsxRuntimeExports.jsx("h1", {
                    className: "text-base font-bold mb-2 text-foreground",
                    children: o
                })
            },
            h2({children: o}) {
                return jsxRuntimeExports.jsx("h2", {
                    className: "text-sm font-bold mb-1.5 text-foreground",
                    children: o
                })
            },
            h3({children: o}) {
                return jsxRuntimeExports.jsx("h3", {
                    className: "text-sm font-semibold mb-1 text-foreground",
                    children: o
                })
            },
            h4({children: o}) {
                return jsxRuntimeExports.jsx("h4", {
                    className: "text-xs font-semibold mb-1 text-foreground",
                    children: o
                })
            },
            h5({children: o}) {
                return jsxRuntimeExports.jsx("h5", {
                    className: "text-xs font-medium mb-1 text-foreground",
                    children: o
                })
            },
            h6({children: o}) {
                return jsxRuntimeExports.jsx("h6", {
                    className: "text-xs font-medium mb-1 uppercase tracking-wide text-muted-foreground",
                    children: o
                })
            },
            code({className: o, children: l, ...u}) {
                const c = extractTextContent(l);
                if (!!/language-(\w+)/.exec(o || "") || c.includes(`
`)) {
                    const f = c.replace(/\n$/, "");
                    return jsxRuntimeExports.jsxs("div", {
                        className: "my-2",
                        children: [jsxRuntimeExports.jsx("div", {
                            className: "mb-1 flex justify-end",
                            children: jsxRuntimeExports.jsx("button", {
                                type: "button",
                                onClick: () => {
                                    s(f)
                                }
                                ,
                                className: "rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
                                children: "Copy"
                            })
                        }), jsxRuntimeExports.jsx("pre", {
                            className: "bg-muted p-2 rounded-md overflow-x-auto",
                            children: jsxRuntimeExports.jsx("code", {
                                className: "text-xs font-mono text-foreground",
                                ...u,
                                children: l
                            })
                        })]
                    })
                }
                return jsxRuntimeExports.jsx("code", {
                    className: "bg-muted text-foreground px-1 py-0.5 rounded text-xs font-mono break-all whitespace-pre-wrap",
                    ...u,
                    children: l
                })
            },
            pre({children: o}) {
                return jsxRuntimeExports.jsx(jsxRuntimeExports.Fragment, {
                    children: o
                })
            },
            table({children: o}) {
                return jsxRuntimeExports.jsx("div", {
                    className: "overflow-x-auto my-2",
                    children: jsxRuntimeExports.jsx("table", {
                        className: "min-w-full border border-border text-xs",
                        children: o
                    })
                })
            },
            thead({children: o}) {
                return jsxRuntimeExports.jsx("thead", {
                    className: "bg-muted",
                    children: o
                })
            },
            th({children: o}) {
                return jsxRuntimeExports.jsx("th", {
                    className: "border border-border px-2 py-1 text-left font-medium text-foreground",
                    children: o
                })
            },
            td({children: o}) {
                return jsxRuntimeExports.jsx("td", {
                    className: "border border-border px-2 py-1 text-foreground",
                    children: o
                })
            },
            a({children: o, href: l, ...u}) {
                const c = typeof l == "string" ? parseDoBrowserHref(l) : null;
                if (c)
                    return jsxRuntimeExports.jsxs("span", {
                        className: "inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2 py-1 align-middle my-0.5",
                        children: [jsxRuntimeExports.jsx(FileText, {
                            className: "size-3.5 text-muted-foreground"
                        }), jsxRuntimeExports.jsx("span", {
                            className: "text-xs text-foreground",
                            children: o || c.filename
                        }), jsxRuntimeExports.jsx("button", {
                            type: "button",
                            onClick: () => n(c.path),
                            className: "inline-flex items-center justify-center size-5 rounded border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors",
                            title: "Open",
                            children: jsxRuntimeExports.jsx(ExternalLink, {
                                className: "size-3"
                            })
                        }), jsxRuntimeExports.jsx("button", {
                            type: "button",
                            onClick: () => {
                                a(c.path, c.filename)
                            }
                            ,
                            className: "inline-flex items-center justify-center size-5 rounded border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors",
                            title: "Download",
                            children: jsxRuntimeExports.jsx(Download, {
                                className: "size-3"
                            })
                        })]
                    });
                const p = typeof l == "string" && isExternalHref(l);
                return jsxRuntimeExports.jsx("a", {
                    href: l,
                    className: "text-primary underline",
                    target: "_blank",
                    rel: "noopener noreferrer",
                    onClick: d => {
                        !p || !l || (d.preventDefault(),
                        window.confirm(`Open external link?
${l}`) && window.open(l, "_blank", "noopener,noreferrer"))
                    }
                    ,
                    ...u,
                    children: o
                })
            },
            hr() {
                return jsxRuntimeExports.jsx("hr", {
                    className: "my-3 border-t border-border"
                })
            },
            strong({children: o}) {
                return jsxRuntimeExports.jsx("strong", {
                    className: "font-semibold",
                    children: o
                })
            },
            em({children: o}) {
                return jsxRuntimeExports.jsx("em", {
                    className: "italic",
                    children: o
                })
            }
        },
        children: r
    })
})
  , BOLD_THOUGHT_RE = /\*\*([^*]+)\*\*/g
  , BOLD_STRIP_RE = /\*\*/g;
function getLastBoldThought(e) {
    const t = e.match(BOLD_THOUGHT_RE);
    return !t || t.length === 0 ? null : t[t.length - 1].replace(BOLD_STRIP_RE, "").trim()
}
function ReasoningBlock({text: e, state: t}) {
    const [r,n] = reactExports.useState(!1)
      , a = t === "streaming"
      , s = getLastBoldThought(e)
      , o = a ? s || "Thinking..." : s || "Reasoned";
    return jsxRuntimeExports.jsxs(Collapsible, {
        open: r,
        onOpenChange: n,
        children: [jsxRuntimeExports.jsx(CollapsibleTrigger, {
            asChild: !0,
            children: jsxRuntimeExports.jsxs("button", {
                className: cn$1("group flex items-start gap-1.5 text-left", "text-sm text-foreground/70 italic", "hover:text-foreground transition-colors"),
                children: [a ? jsxRuntimeExports.jsx(LoaderCircle, {
                    className: "size-3.5 mt-1 text-foreground/50 animate-spin flex-shrink-0"
                }) : jsxRuntimeExports.jsx(Brain, {
                    className: "size-3.5 mt-1 text-foreground/50 flex-shrink-0"
                }), jsxRuntimeExports.jsx("span", {
                    children: o
                }), jsxRuntimeExports.jsx(ChevronRight, {
                    className: cn$1("size-3.5 mt-1 flex-shrink-0 transition-all", "opacity-0 group-hover:opacity-100", r && "rotate-90")
                })]
            })
        }), jsxRuntimeExports.jsx(CollapsibleContent, {
            children: jsxRuntimeExports.jsx("div", {
                className: "mt-2 ml-4 text-sm",
                children: jsxRuntimeExports.jsx("pre", {
                    className: "p-2 rounded bg-muted/50 overflow-x-auto font-mono text-xs whitespace-pre-wrap",
                    children: e || "Processing..."
                })
            })
        })]
    })
}
function MessageContent({message: e}) {
    const t = e.role === "user";
    return jsxRuntimeExports.jsx("div", {
        className: "min-w-0 space-y-2",
        children: e.parts.map( (r, n) => {
            if (r.type === "text" && r.text.trim() && r.text.trim() !== ".") {
                if (t) {
                    const a = parseFileAttachmentTags(r.text);
                    return jsxRuntimeExports.jsx("div", {
                        className: "text-sm leading-relaxed whitespace-pre-wrap break-words",
                        children: a.map( (s, o) => s.type === "text" ? jsxRuntimeExports.jsx("span", {
                            children: s.text
                        }, `text-${o}`) : jsxRuntimeExports.jsxs("span", {
                            className: "inline-flex items-center gap-1.5 rounded-md border border-primary-foreground/25 bg-primary-foreground/15 px-2 py-1 align-middle my-0.5",
                            children: [jsxRuntimeExports.jsx(FileText, {
                                className: "size-3.5 opacity-90"
                            }), jsxRuntimeExports.jsx("span", {
                                className: "text-xs",
                                children: s.attachment.filename
                            }), jsxRuntimeExports.jsx("span", {
                                className: "text-xs opacity-80",
                                children: formatBytes(s.attachment.size)
                            })]
                        }, `attachment-${o}`))
                    }, n)
                }
                return jsxRuntimeExports.jsx("div", {
                    className: "min-w-0 text-sm leading-relaxed",
                    children: jsxRuntimeExports.jsx(MarkdownContent, {
                        content: r.text.trim()
                    })
                }, n)
            }
            return r.type === "file" && r.mediaType?.startsWith("image/") ? jsxRuntimeExports.jsx("img", {
                src: r.url,
                alt: r.filename || "Attached image",
                className: "max-w-full rounded-lg border border-border"
            }, n) : r.type === "reasoning" ? jsxRuntimeExports.jsx(ReasoningBlock, {
                text: r.text,
                state: r.state || "done"
            }, n) : r.type === "tool-call" ? jsxRuntimeExports.jsx(ToolCallCard, {
                toolPart: r
            }, r.toolCallId) : null
        }
        )
    })
}
function Message({message: e}) {
    return e.role === "user" ? jsxRuntimeExports.jsx("div", {
        className: "flex justify-end",
        children: jsxRuntimeExports.jsx("div", {
            className: "max-w-[85%] min-w-0 px-3 py-2 rounded-lg bg-primary text-primary-foreground rounded-tr-sm",
            children: jsxRuntimeExports.jsx(MessageContent, {
                message: e
            })
        })
    }) : jsxRuntimeExports.jsx("div", {
        className: "min-w-0 text-foreground",
        children: jsxRuntimeExports.jsx(MessageContent, {
            message: e
        })
    })
}
function LoadingIndicator() {
    return jsxRuntimeExports.jsx("div", {
        className: "flex justify-start mt-4",
        role: "status",
        "aria-live": "polite",
        "aria-label": "Assistant is working",
        children: jsxRuntimeExports.jsx(BouncingDots, {})
    })
}
function InlineSystemNotice({message: e}) {
    const t = {
        info: "border-border bg-muted/60 text-foreground",
        warning: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        error: "border-destructive/30 bg-destructive/10 text-destructive"
    }[e.tone];
    return jsxRuntimeExports.jsx("div", {
        className: "flex justify-start",
        role: "status",
        "aria-live": "polite",
        children: jsxRuntimeExports.jsx("div", {
            "data-testid": "inline-system-message",
            "data-tone": e.tone,
            className: cn$1("max-w-[95%] rounded-md border px-3 py-2 text-sm leading-relaxed", t),
            children: e.text
        })
    })
}
function BouncingDots() {
    return jsxRuntimeExports.jsxs("div", {
        className: "flex items-center gap-0.5",
        children: [jsxRuntimeExports.jsx("div", {
            className: "size-1.5 rounded-full bg-foreground/40 animate-bounce [animation-duration:900ms]"
        }), jsxRuntimeExports.jsx("div", {
            className: "size-1.5 rounded-full bg-foreground/40 animate-bounce [animation-delay:150ms] [animation-duration:900ms]"
        }), jsxRuntimeExports.jsx("div", {
            className: "size-1.5 rounded-full bg-foreground/40 animate-bounce [animation-delay:300ms] [animation-duration:900ms]"
        })]
    })
}
function CompactionIndicator({isCompacting: e}) {
    return jsxRuntimeExports.jsx("div", {
        className: "flex justify-start mt-4",
        role: "status",
        "aria-live": "polite",
        "aria-label": "Compacting conversation",
        children: jsxRuntimeExports.jsxs("div", {
            className: "inline-flex items-center gap-1.5 text-xs text-muted-foreground",
            children: [e ? jsxRuntimeExports.jsx(LoaderCircle, {
                className: "size-3 animate-spin"
            }) : jsxRuntimeExports.jsx(Minimize2, {
                className: "size-3"
            }), jsxRuntimeExports.jsx("span", {
                children: e ? "Compacting conversation..." : "Compaction runs automatically as context fills up."
            })]
        })
    })
}
const suggestions = ["Create a slideshow", "Summarize a YouTube video", "Send an email"];
function EmptyState$1({onSuggestionClick: e}) {
    return jsxRuntimeExports.jsxs("div", {
        className: "flex flex-col items-center justify-center h-full p-6 text-center",
        children: [jsxRuntimeExports.jsx("h2", {
            className: "text-base font-medium text-foreground mb-4",
            children: "What can I do for you?"
        }), e && jsxRuntimeExports.jsx("div", {
            className: "flex flex-wrap gap-2 justify-center max-w-[280px]",
            children: suggestions.map(t => jsxRuntimeExports.jsx("button", {
                onClick: () => e(t),
                className: "px-3 py-1.5 text-sm bg-muted hover:bg-muted/80 text-foreground rounded-full border border-border transition-colors",
                children: t
            }, t))
        }), jsxRuntimeExports.jsx("p", {
            className: "text-xs text-muted-foreground mt-6",
            children: "AI can make mistakes. Always supervise Do Browser."
        })]
    })
}
function SummaryDivider() {
    return jsxRuntimeExports.jsxs("div", {
        className: "flex items-center gap-2 text-xs text-muted-foreground py-2",
        children: [jsxRuntimeExports.jsx("div", {
            className: "flex-1 border-t border-border"
        }), jsxRuntimeExports.jsx("span", {
            children: "Earlier messages summarized"
        }), jsxRuntimeExports.jsx("div", {
            className: "flex-1 border-t border-border"
        })]
    })
}
function MessageList({messages: e, isLoading: t, inlineSystemMessage: r, isCompacting: n=!1, showCompactionNotice: a=!1, showCompactionDivider: s, onSuggestionClick: o}) {
    const l = reactExports.useRef(null)
      , u = a || n;
    return reactExports.useEffect( () => {
        l.current?.scrollIntoView({
            behavior: "smooth"
        })
    }
    , [e, t, u]),
    e.length === 0 && !t && !u && !r ? jsxRuntimeExports.jsx(EmptyState$1, {
        onSuggestionClick: o
    }) : jsxRuntimeExports.jsx(ScrollArea, {
        className: "flex-1 min-h-0",
        children: jsxRuntimeExports.jsxs("div", {
            className: "p-3 space-y-2",
            children: [s && jsxRuntimeExports.jsx(SummaryDivider, {}), e.map(c => jsxRuntimeExports.jsx("div", {
                children: jsxRuntimeExports.jsx(Message, {
                    message: c
                })
            }, c.id)), r && jsxRuntimeExports.jsx(InlineSystemNotice, {
                message: r
            }), u ? jsxRuntimeExports.jsx(CompactionIndicator, {
                isCompacting: n
            }) : t && jsxRuntimeExports.jsx(LoadingIndicator, {}), jsxRuntimeExports.jsx("div", {
                ref: l
            })]
        })
    })
}
function Textarea({className: e, ...t}) {
    return jsxRuntimeExports.jsx("textarea", {
        "data-slot": "textarea",
        className: cn$1("border-input bg-transparent focus-visible:border-ring focus-visible:ring-ring/30 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 resize-none rounded-md border px-2 py-2 text-sm transition-colors focus-visible:ring-[2px] aria-invalid:ring-[2px] md:text-xs/relaxed placeholder:text-muted-foreground flex field-sizing-content min-h-16 w-full outline-none disabled:cursor-not-allowed disabled:opacity-50", e),
        ...t
    })
}
function AttachedAttachments({attachments: e, onRemove: t}) {
    if (e.length === 0)
        return null;
    const r = e.some(n => n.kind === "image");
    return jsxRuntimeExports.jsx("div", {
        className: "flex flex-wrap gap-2 px-4 py-2 border-b border-border",
        children: e.map(n => jsxRuntimeExports.jsxs("div", {
            className: "relative group",
            children: [n.kind === "image" ? jsxRuntimeExports.jsx("img", {
                src: n.dataUrl,
                alt: n.fileName || "Attached image",
                className: "size-16 object-cover rounded border border-border"
            }) : jsxRuntimeExports.jsxs("div", {
                className: cn$1("flex items-center gap-2 rounded-md border px-2 py-1 pr-6", "border-border bg-muted/40", r ? "h-16" : "h-8"),
                children: [jsxRuntimeExports.jsx(FileText, {
                    className: "size-3.5 text-muted-foreground"
                }), jsxRuntimeExports.jsx("span", {
                    className: "max-w-36 truncate text-xs text-foreground",
                    children: n.fileName
                }), jsxRuntimeExports.jsx("span", {
                    className: "text-xs text-muted-foreground",
                    children: formatBytes(n.size)
                })]
            }), jsxRuntimeExports.jsx("button", {
                onClick: () => t(n.id),
                className: cn$1("absolute -top-1.5 -right-1.5 p-0.5", "bg-muted text-muted-foreground", "hover:bg-red-600 hover:text-white", "rounded-full transition-colors", "opacity-0 group-hover:opacity-100", "focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-red-300"),
                type: "button",
                "aria-label": `Remove ${n.fileName || "attachment"}`,
                children: jsxRuntimeExports.jsx(X$1, {
                    className: "size-3"
                })
            })]
        }, n.id))
    })
}
function OpenAIIcon({className: e, ...t}) {
    return jsxRuntimeExports.jsx("svg", {
        viewBox: "0 0 24 24",
        fill: "currentColor",
        "aria-hidden": "true",
        focusable: "false",
        className: cn$1("shrink-0", e),
        ...t,
        children: jsxRuntimeExports.jsx("path", {
            d: "M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"
        })
    })
}
function ClaudeIcon({className: e, ...t}) {
    return jsxRuntimeExports.jsx("svg", {
        viewBox: "0 0 149 149",
        fill: "none",
        "aria-hidden": "true",
        focusable: "false",
        className: cn$1("shrink-0", e),
        ...t,
        children: jsxRuntimeExports.jsx("path", {
            fill: "#D97757",
            d: "M29.05 98.54L58.19 82.19L58.68 80.77L58.19 79.98H56.77L51.9 79.68L35.25 79.23L20.81 78.63L6.82 77.88L3.3 77.13L0 72.78L0.340004 70.61L3.3 68.62L7.54 68.99L16.91 69.63L30.97 70.6L41.17 71.2L56.28 72.77H58.68L59.02 71.8L58.2 71.2L57.56 70.6L43.01 60.74L27.26 50.32L19.01 44.32L14.55 41.28L12.3 38.43L11.33 32.21L15.38 27.75L20.82 28.12L22.21 28.49L27.72 32.73L39.49 41.84L54.86 53.16L57.11 55.03L58.01 54.39L58.12 53.94L57.11 52.25L48.75 37.14L39.83 21.77L35.86 15.4L34.81 11.58C34.44 10.01 34.17 8.69 34.17 7.08L38.78 0.820007L41.33 0L47.48 0.820007L50.07 3.07001L53.89 11.81L60.08 25.57L69.68 44.28L72.49 49.83L73.99 54.97L74.55 56.54H75.52V55.64L76.31 45.1L77.77 32.16L79.19 15.51L79.68 10.82L82 5.2L86.61 2.16L90.21 3.88L93.17 8.12L92.76 10.86L91 22.3L87.55 40.22L85.3 52.22H86.61L88.11 50.72L94.18 42.66L104.38 29.91L108.88 24.85L114.13 19.26L117.5 16.6H123.87L128.56 23.57L126.46 30.77L119.9 39.09L114.46 46.14L106.66 56.64L101.79 65.04L102.24 65.71L103.4 65.6L121.02 61.85L130.54 60.13L141.9 58.18L147.04 60.58L147.6 63.02L145.58 68.01L133.43 71.01L119.18 73.86L97.96 78.88L97.7 79.07L98 79.44L107.56 80.34L111.65 80.56H121.66L140.3 81.95L145.17 85.17L148.09 89.11L147.6 92.11L140.1 95.93L129.98 93.53L106.36 87.91L98.26 85.89H97.14V86.56L103.89 93.16L116.26 104.33L131.75 118.73L132.54 122.29L130.55 125.1L128.45 124.8L114.84 114.56L109.59 109.95L97.7 99.94H96.91V100.99L99.65 105L114.12 126.75L114.87 133.42L113.82 135.59L110.07 136.9L105.95 136.15L97.48 124.26L88.74 110.87L81.69 98.87L80.83 99.36L76.67 144.17L74.72 146.46L70.22 148.18L66.47 145.33L64.48 140.72L66.47 131.61L68.87 119.72L70.82 110.27L72.58 98.53L73.63 94.63L73.56 94.37L72.7 94.48L63.85 106.63L50.39 124.82L39.74 136.22L37.19 137.23L32.77 134.94L33.18 130.85L35.65 127.21L50.39 108.46L59.28 96.84L65.02 90.13L64.98 89.16H64.64L25.49 114.58L18.52 115.48L15.52 112.67L15.89 108.06L17.31 106.56L29.08 98.46L29.04 98.5L29.05 98.54Z"
        })
    })
}
function GeminiIcon({className: e, ...t}) {
    return jsxRuntimeExports.jsx("svg", {
        viewBox: "0 0 24 24",
        fill: "currentColor",
        "aria-hidden": "true",
        focusable: "false",
        className: cn$1("shrink-0", e),
        ...t,
        children: jsxRuntimeExports.jsx("path", {
            d: "M12 24c0-3.1826-1.2643-6.2348-3.5147-8.4853C6.2348 13.2643 3.1826 12 0 12c3.1826 0 6.2348-1.2643 8.4853-3.5147C10.7357 6.2348 12 3.1826 12 0c0 3.1826 1.2643 6.2348 3.5147 8.4853C17.7652 10.7357 20.8174 12 24 12c-3.1826 0-6.2348 1.2643-8.4853 3.5147C13.2643 17.7652 12 20.8174 12 24Z"
        })
    })
}
const PopoverRootContext = reactExports.createContext(void 0);
function usePopoverRootContext(e) {
    const t = reactExports.useContext(PopoverRootContext);
    if (t === void 0 && !e)
        throw new Error(formatErrorMessage(47));
    return t
}
function createInitialState$1() {
    return {
        ...createInitialPopupStoreState(),
        disabled: !1,
        modal: !1,
        instantType: void 0,
        openMethod: null,
        openChangeReason: null,
        titleElementId: void 0,
        descriptionElementId: void 0,
        stickIfOpen: !0,
        nested: !1,
        openOnHover: !1,
        closeDelay: 0
    }
}
const selectors$2 = {
    ...popupStoreSelectors,
    disabled: createSelector(e => e.disabled),
    instantType: createSelector(e => e.instantType),
    openMethod: createSelector(e => e.openMethod),
    openChangeReason: createSelector(e => e.openChangeReason),
    modal: createSelector(e => e.modal),
    stickIfOpen: createSelector(e => e.stickIfOpen),
    titleElementId: createSelector(e => e.titleElementId),
    descriptionElementId: createSelector(e => e.descriptionElementId),
    openOnHover: createSelector(e => e.openOnHover),
    closeDelay: createSelector(e => e.closeDelay)
};
class PopoverStore extends ReactStore {
    constructor(t) {
        const r = {
            ...createInitialState$1(),
            ...t
        };
        r.open && t?.mounted === void 0 && (r.mounted = !0),
        super(r, {
            popupRef: reactExports.createRef(),
            backdropRef: reactExports.createRef(),
            internalBackdropRef: reactExports.createRef(),
            onOpenChange: void 0,
            onOpenChangeComplete: void 0,
            triggerFocusTargetRef: reactExports.createRef(),
            beforeContentFocusGuardRef: reactExports.createRef(),
            stickIfOpenTimeout: new Timeout,
            triggerElements: new PopupTriggerMap
        }, selectors$2)
    }
    setOpen = (t, r) => {
        const n = r.reason === triggerHover
          , a = r.reason === triggerPress && r.event.detail === 0
          , s = !t && (r.reason === escapeKey || r.reason == null);
        if (r.preventUnmountOnClose = () => {
            this.set("preventUnmountingOnClose", !0)
        }
        ,
        this.context.onOpenChange?.(t, r),
        r.isCanceled)
            return;
        const o = {
            open: t,
            nativeEvent: r.event,
            reason: r.reason,
            nested: this.state.nested,
            triggerElement: r.trigger
        };
        this.state.floatingRootContext.context.events?.emit("openchange", o);
        const u = () => {
            const c = {
                open: t,
                openChangeReason: r.reason
            }
              , p = r.trigger?.id ?? null;
            (p || t) && (c.activeTriggerId = p,
            c.activeTriggerElement = r.trigger ?? null),
            this.update(c)
        }
        ;
        n ? (this.set("stickIfOpen", !0),
        this.context.stickIfOpenTimeout.start(PATIENT_CLICK_THRESHOLD, () => {
            this.set("stickIfOpen", !1)
        }
        ),
        reactDomExports.flushSync(u)) : u(),
        a || s ? this.set("instantType", a ? "click" : "dismiss") : r.reason === focusOut ? this.set("instantType", "focus") : this.set("instantType", void 0)
    }
    ;
    static useStore(t, r) {
        const n = useRefWithInit( () => t ?? new PopoverStore(r)).current;
        return useOnMount(n.disposeEffect),
        n
    }
    disposeEffect = () => this.context.stickIfOpenTimeout.disposeEffect()
}
function PopoverRootComponent({props: e}) {
    const {children: t, open: r, defaultOpen: n=!1, onOpenChange: a, onOpenChangeComplete: s, modal: o=!1, handle: l, triggerId: u, defaultTriggerId: c=null} = e
      , p = PopoverStore.useStore(l?.store, {
        open: r ?? n,
        modal: o,
        activeTriggerId: u !== void 0 ? u : c
    });
    p.useControlledProp("open", r, n),
    p.useControlledProp("activeTriggerId", u, c);
    const d = p.useState("open")
      , f = p.useState("positionerElement")
      , h = p.useState("payload")
      , m = p.useState("openChangeReason");
    p.useContextCallback("onOpenChange", a),
    p.useContextCallback("onOpenChangeComplete", s);
    const {openMethod: g, triggerProps: x, reset: b} = useOpenInteractionType(d);
    useImplicitActiveTrigger(p);
    const {forceUnmount: y} = useOpenStateTransitions(d, p, () => {
        p.update({
            stickIfOpen: !0,
            openChangeReason: null
        }),
        b()
    }
    );
    useScrollLock(d && o === !0 && m !== triggerHover && g !== "touch", f),
    reactExports.useEffect( () => {
        d || p.context.stickIfOpenTimeout.clear()
    }
    , [p, d]);
    const w = reactExports.useCallback(pt => {
        const ba = createChangeEventDetails(pt);
        return ba.preventUnmountOnClose = () => {
            p.set("preventUnmountingOnClose", !0)
        }
        ,
        ba
    }
    , [p])
      , R = reactExports.useCallback( () => {
        p.setOpen(!1, w(imperativeAction))
    }
    , [p, w]);
    reactExports.useImperativeHandle(e.actionsRef, () => ({
        unmount: y,
        close: R
    }), [y, R]);
    const T = useSyncedFloatingRootContext({
        popupStore: p,
        onOpenChange: p.setOpen
    })
      , C = useDismiss(T, {
        outsidePressEvent: {
            mouse: o === "trap-focus" ? "sloppy" : "intentional",
            touch: "sloppy"
        }
    })
      , P = useRole(T)
      , {getReferenceProps: W, getFloatingProps: ue, getTriggerProps: ce} = useInteractions([C, P])
      , ve = reactExports.useMemo( () => W(x), [W, x])
      , I = reactExports.useMemo( () => ce(x), [ce, x])
      , M = reactExports.useMemo( () => ue(), [ue]);
    p.useSyncedValues({
        modal: o,
        openMethod: g,
        activeTriggerProps: ve,
        inactiveTriggerProps: I,
        popupProps: M,
        floatingRootContext: T,
        nested: useFloatingParentNodeId() != null
    });
    const $ = reactExports.useMemo( () => ({
        store: p
    }), [p]);
    return jsxRuntimeExports.jsx(PopoverRootContext.Provider, {
        value: $,
        children: typeof t == "function" ? t({
            payload: h
        }) : t
    })
}
function PopoverRoot(e) {
    return usePopoverRootContext(!0) ? jsxRuntimeExports.jsx(PopoverRootComponent, {
        props: e
    }) : jsxRuntimeExports.jsx(FloatingTree, {
        children: jsxRuntimeExports.jsx(PopoverRootComponent, {
            props: e
        })
    })
}
const OPEN_DELAY = 300
  , PopoverTrigger$1 = reactExports.forwardRef(function e(t, r) {
    const {render: n, className: a, disabled: s=!1, nativeButton: o=!0, handle: l, payload: u, openOnHover: c=!1, delay: p=OPEN_DELAY, closeDelay: d=0, id: f, ...h} = t
      , m = usePopoverRootContext(!0)
      , g = l?.store ?? m?.store;
    if (!g)
        throw new Error(formatErrorMessage(74));
    const x = useBaseUiId(f)
      , b = g.useState("isTriggerActive", x)
      , y = g.useState("floatingRootContext")
      , w = g.useState("isOpenedByTrigger", x)
      , R = reactExports.useRef(null)
      , {registerTrigger: T, isMountedByThisTrigger: C} = useTriggerDataForwarding(x, R, g, {
        payload: u,
        disabled: s,
        openOnHover: c,
        closeDelay: d
    })
      , P = g.useState("openChangeReason")
      , W = g.useState("stickIfOpen")
      , ue = g.useState("openMethod")
      , ce = useHoverReferenceInteraction(y, {
        enabled: y != null && c && (ue !== "touch" || P !== triggerPress),
        mouseOnly: !0,
        move: !1,
        handleClose: safePolygon(),
        restMs: p,
        delay: {
            close: d
        },
        triggerElementRef: R,
        isActiveTrigger: b
    })
      , ve = useClick(y, {
        enabled: y != null,
        stickIfOpen: W
    })
      , I = useInteractions([ve])
      , M = g.useState("triggerProps", C)
      , $ = reactExports.useMemo( () => ({
        disabled: s,
        open: w
    }), [s, w])
      , {getButtonProps: pt, buttonRef: ba} = useButton({
        disabled: s,
        native: o
    })
      , us = reactExports.useMemo( () => ({
        open(Ht) {
            return Ht && P === triggerPress ? pressableTriggerOpenStateMapping.open(Ht) : triggerOpenStateMapping$1.open(Ht)
        }
    }), [P])
      , Wd = useRenderElement("button", t, {
        state: $,
        ref: [ba, r, T, R],
        props: [I.getReferenceProps(), ce, M, {
            [CLICK_TRIGGER_IDENTIFIER]: "",
            id: x
        }, h, pt],
        stateAttributesMapping: us
    })
      , Mr = reactExports.useRef(null)
      , Kt = useStableCallback(Ht => {
        reactDomExports.flushSync( () => {
            g.setOpen(!1, createChangeEventDetails(focusOut, Ht.nativeEvent, Ht.currentTarget))
        }
        ),
        getTabbableBeforeElement(Mr.current)?.focus()
    }
    )
      , lt = useStableCallback(Ht => {
        const $e = g.select("positionerElement");
        if ($e && isOutsideEvent(Ht, $e))
            g.context.beforeContentFocusGuardRef.current?.focus();
        else {
            reactDomExports.flushSync( () => {
                g.setOpen(!1, createChangeEventDetails(focusOut, Ht.nativeEvent, Ht.currentTarget))
            }
            );
            let G = getTabbableAfterElement(R.current);
            for (; G !== null && contains$1($e, G) || G?.hasAttribute("aria-hidden"); ) {
                const he = G;
                if (G = getNextTabbable(G),
                G === he)
                    break
            }
            G?.focus()
        }
    }
    );
    return b ? jsxRuntimeExports.jsxs(reactExports.Fragment, {
        children: [jsxRuntimeExports.jsx(FocusGuard, {
            ref: Mr,
            onFocus: Kt
        }), jsxRuntimeExports.jsx(reactExports.Fragment, {
            children: Wd
        }, x), jsxRuntimeExports.jsx(FocusGuard, {
            ref: g.context.triggerFocusTargetRef,
            onFocus: lt
        })]
    }) : jsxRuntimeExports.jsx(reactExports.Fragment, {
        children: Wd
    }, x)
})
  , PopoverPortalContext = reactExports.createContext(void 0);
function usePopoverPortalContext() {
    const e = reactExports.useContext(PopoverPortalContext);
    if (e === void 0)
        throw new Error(formatErrorMessage(45));
    return e
}
const PopoverPortal = reactExports.forwardRef(function e(t, r) {
    const {keepMounted: n=!1, ...a} = t
      , {store: s} = usePopoverRootContext();
    return s.useState("mounted") || n ? jsxRuntimeExports.jsx(PopoverPortalContext.Provider, {
        value: n,
        children: jsxRuntimeExports.jsx(FloatingPortal, {
            ref: r,
            ...a,
            renderGuards: !1
        })
    }) : null
})
  , PopoverPositionerContext = reactExports.createContext(void 0);
function usePopoverPositionerContext() {
    const e = reactExports.useContext(PopoverPositionerContext);
    if (!e)
        throw new Error(formatErrorMessage(46));
    return e
}
const PopoverPositioner = reactExports.forwardRef(function e(t, r) {
    const {render: n, className: a, anchor: s, positionMethod: o="absolute", side: l="bottom", align: u="center", sideOffset: c=0, alignOffset: p=0, collisionBoundary: d="clipping-ancestors", collisionPadding: f=5, arrowPadding: h=5, sticky: m=!1, disableAnchorTracking: g=!1, collisionAvoidance: x=POPUP_COLLISION_AVOIDANCE, ...b} = t
      , {store: y} = usePopoverRootContext()
      , w = usePopoverPortalContext()
      , R = useFloatingNodeId()
      , T = y.useState("floatingRootContext")
      , C = y.useState("mounted")
      , P = y.useState("open")
      , W = y.useState("openChangeReason")
      , ue = y.useState("activeTriggerElement")
      , ce = y.useState("modal")
      , ve = y.useState("positionerElement")
      , I = y.useState("instantType")
      , M = y.useState("transitionStatus")
      , $ = reactExports.useRef(null)
      , pt = useAnimationsFinished(ve, !1, !1)
      , ba = useAnchorPositioning({
        anchor: s,
        floatingRootContext: T,
        positionMethod: o,
        mounted: C,
        side: l,
        sideOffset: c,
        align: u,
        alignOffset: p,
        arrowPadding: h,
        collisionBoundary: d,
        collisionPadding: f,
        sticky: m,
        disableAnchorTracking: g,
        keepMounted: w,
        nodeId: R,
        collisionAvoidance: x,
        adaptiveOrigin
    })
      , us = reactExports.useMemo( () => {
        const $e = {};
        return P || ($e.pointerEvents = "none"),
        {
            role: "presentation",
            hidden: !C,
            style: {
                ...ba.positionerStyles,
                ...$e
            }
        }
    }
    , [P, C, ba.positionerStyles])
      , Wd = reactExports.useMemo( () => ({
        props: us,
        ...ba
    }), [us, ba])
      , Mr = T?.select("domReferenceElement");
    useIsoLayoutEffect( () => {
        const $e = Mr
          , G = $.current;
        if ($e && ($.current = $e),
        G && $e && $e !== G) {
            y.set("instantType", void 0);
            const he = new AbortController;
            return pt( () => {
                y.set("instantType", "trigger-change")
            }
            , he.signal),
            () => {
                he.abort()
            }
        }
    }
    , [Mr, pt, y]);
    const Kt = reactExports.useMemo( () => ({
        open: P,
        side: Wd.side,
        align: Wd.align,
        anchorHidden: Wd.anchorHidden,
        instant: I
    }), [P, Wd.side, Wd.align, Wd.anchorHidden, I])
      , lt = reactExports.useCallback($e => {
        y.set("positionerElement", $e)
    }
    , [y])
      , Ht = useRenderElement("div", t, {
        state: Kt,
        props: [Wd.props, getDisabledMountTransitionStyles(M), b],
        ref: [r, lt],
        stateAttributesMapping: popupStateMapping
    });
    return jsxRuntimeExports.jsxs(PopoverPositionerContext.Provider, {
        value: Wd,
        children: [C && ce === !0 && W !== triggerHover && jsxRuntimeExports.jsx(InternalBackdrop, {
            ref: y.context.internalBackdropRef,
            inert: inertValue(!P),
            cutout: ue
        }), jsxRuntimeExports.jsx(FloatingNode, {
            id: R,
            children: Ht
        })]
    })
})
  , stateAttributesMapping$6 = {
    ...popupStateMapping,
    ...transitionStatusMapping
}
  , PopoverPopup = reactExports.forwardRef(function e(t, r) {
    const {className: n, render: a, initialFocus: s, finalFocus: o, ...l} = t
      , {store: u} = usePopoverRootContext()
      , c = usePopoverPositionerContext()
      , p = useToolbarRootContext() != null
      , d = useDirection()
      , f = u.useState("open")
      , h = u.useState("openMethod")
      , m = u.useState("instantType")
      , g = u.useState("transitionStatus")
      , x = u.useState("popupProps")
      , b = u.useState("titleElementId")
      , y = u.useState("descriptionElementId")
      , w = u.useState("modal")
      , R = u.useState("mounted")
      , T = u.useState("openChangeReason")
      , C = u.useState("popupElement")
      , P = u.useState("payload")
      , W = u.useState("positionerElement")
      , ue = u.useState("activeTriggerElement")
      , ce = u.useState("floatingRootContext");
    useOpenChangeComplete({
        open: f,
        ref: u.context.popupRef,
        onComplete() {
            f && u.context.onOpenChangeComplete?.(!0)
        }
    });
    const ve = u.useState("disabled")
      , I = u.useState("openOnHover")
      , M = u.useState("closeDelay");
    useHoverFloatingInteraction(ce, {
        enabled: I && !ve,
        closeDelay: M
    });
    function $(Ht) {
        return Ht === "touch" ? u.context.popupRef.current : !0
    }
    const pt = s === void 0 ? $ : s
      , ba = reactExports.useMemo( () => ({
        open: f,
        side: c.side,
        align: c.align,
        instant: m,
        transitionStatus: g
    }), [f, c.side, c.align, m, g])
      , us = reactExports.useCallback(Ht => {
        u.set("popupElement", Ht)
    }
    , [u]);
    function Wd() {
        ce.context.events.emit("measure-layout")
    }
    function Mr(Ht, $e) {
        ce.context.events.emit("measure-layout-complete", {
            previousDimensions: Ht,
            nextDimensions: $e
        })
    }
    const Kt = reactExports.useCallback( () => u.context.triggerElements.size > 1, [u]);
    usePopupAutoResize({
        popupElement: C,
        positionerElement: W,
        mounted: R,
        content: P,
        enabled: Kt,
        onMeasureLayout: Wd,
        onMeasureLayoutComplete: Mr,
        side: c.side,
        direction: d
    });
    const lt = useRenderElement("div", t, {
        state: ba,
        ref: [r, u.context.popupRef, us],
        props: [x, {
            "aria-labelledby": b,
            "aria-describedby": y,
            onKeyDown(Ht) {
                p && COMPOSITE_KEYS.has(Ht.key) && Ht.stopPropagation()
            }
        }, getDisabledMountTransitionStyles(g), l],
        stateAttributesMapping: stateAttributesMapping$6
    });
    return jsxRuntimeExports.jsx(FloatingFocusManager, {
        context: ce,
        openInteractionType: h,
        modal: w === "trap-focus",
        disabled: !R || T === triggerHover,
        initialFocus: pt,
        returnFocus: o,
        restoreFocus: "popup",
        previousFocusableElement: isHTMLElement(ue) ? ue : void 0,
        nextFocusableElement: u.context.triggerFocusTargetRef,
        beforeContentFocusGuardRef: u.context.beforeContentFocusGuardRef,
        children: lt
    })
})
  , PopoverTitle$1 = reactExports.forwardRef(function e(t, r) {
    const {render: n, className: a, ...s} = t
      , {store: o} = usePopoverRootContext()
      , l = useBaseUiId(s.id);
    return useIsoLayoutEffect( () => (o.set("titleElementId", l),
    () => {
        o.set("titleElementId", void 0)
    }
    ), [o, l]),
    useRenderElement("h2", t, {
        ref: r,
        props: [{
            id: l
        }, s]
    })
});
function Popover({...e}) {
    return jsxRuntimeExports.jsx(PopoverRoot, {
        "data-slot": "popover",
        ...e
    })
}
function PopoverTrigger({...e}) {
    return jsxRuntimeExports.jsx(PopoverTrigger$1, {
        "data-slot": "popover-trigger",
        ...e
    })
}
function PopoverContent({className: e, align: t="center", alignOffset: r=0, side: n="bottom", sideOffset: a=4, ...s}) {
    return jsxRuntimeExports.jsx(PopoverPortal, {
        children: jsxRuntimeExports.jsx(PopoverPositioner, {
            align: t,
            alignOffset: r,
            side: n,
            sideOffset: a,
            className: "isolate z-50",
            children: jsxRuntimeExports.jsx(PopoverPopup, {
                "data-slot": "popover-content",
                className: cn$1("bg-popover text-popover-foreground data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 ring-foreground/10 flex flex-col gap-4 rounded-lg p-2.5 text-xs shadow-md ring-1 duration-100 data-[side=inline-start]:slide-in-from-right-2 data-[side=inline-end]:slide-in-from-left-2 z-50 w-72 origin-(--transform-origin) outline-hidden", e),
                ...s
            })
        })
    })
}
function PopoverTitle({className: e, ...t}) {
    return jsxRuntimeExports.jsx(PopoverTitle$1, {
        "data-slot": "popover-title",
        className: cn$1("text-sm font-medium", e),
        ...t
    })
}
async function fetchSubscriptionStatus() {
    return redoClient.subscription.get()
}
function useSubscriptionStatus(e=!0) {
    return useQuery({
        queryKey: ["redo-subscription"],
        queryFn: fetchSubscriptionStatus,
        enabled: e,
        refetchInterval: 6e4,
        staleTime: 3e4
    })
}
const PLAN_TIER_ORDER = {
    standard: 1,
    pro: 2
}
  , HOSTED_MODEL_REQUIRED_PLAN_TIER = {
    "gpt-5.4-mini": "standard",
    "gpt-5.4": "pro"
};
function hasRequiredPlanTier(e, t) {
    return e ? t ? PLAN_TIER_ORDER[t] >= PLAN_TIER_ORDER[e] : !1 : !0
}
function formatPlanTierLabel(e) {
    return e === "standard" ? "Standard" : e === "pro" ? "Max" : null
}
function mergeErrorMap(e, t) {
    return {
        ...e,
        ...t
    }
}
class ContractProcedure {
    "~orpc";
    constructor(t) {
        if (t.route?.successStatus && isORPCErrorStatus(t.route.successStatus))
            throw new Error("[ContractProcedure] Invalid successStatus.");
        if (Object.values(t.errorMap).some(r => r && r.status && !isORPCErrorStatus(r.status)))
            throw new Error("[ContractProcedure] Invalid error status code.");
        this["~orpc"] = t
    }
}
function isContractProcedure(e) {
    return e instanceof ContractProcedure ? !0 : (typeof e == "object" || typeof e == "function") && e !== null && "~orpc"in e && typeof e["~orpc"] == "object" && e["~orpc"] !== null && "errorMap"in e["~orpc"] && "route"in e["~orpc"] && "meta"in e["~orpc"]
}
function mergeMeta(e, t) {
    return {
        ...e,
        ...t
    }
}
function mergeRoute(e, t) {
    return {
        ...e,
        ...t
    }
}
function prefixRoute(e, t) {
    return e.path ? {
        ...e,
        path: `${t}${e.path}`
    } : e
}
function unshiftTagRoute(e, t) {
    return {
        ...e,
        tags: [...t, ...e.tags ?? []]
    }
}
function mergePrefix(e, t) {
    return e ? `${e}${t}` : t
}
function mergeTags(e, t) {
    return e ? [...e, ...t] : t
}
function enhanceRoute(e, t) {
    let r = e;
    return t.prefix && (r = prefixRoute(r, t.prefix)),
    t.tags?.length && (r = unshiftTagRoute(r, t.tags)),
    r
}
function enhanceContractRouter(e, t) {
    if (isContractProcedure(e))
        return new ContractProcedure({
            ...e["~orpc"],
            errorMap: mergeErrorMap(t.errorMap, e["~orpc"].errorMap),
            route: enhanceRoute(e["~orpc"].route, t)
        });
    const r = {};
    for (const n in e)
        r[n] = enhanceContractRouter(e[n], t);
    return r
}
class ContractBuilder extends ContractProcedure {
    constructor(t) {
        super(t),
        this["~orpc"].prefix = t.prefix,
        this["~orpc"].tags = t.tags
    }
    $meta(t) {
        return new ContractBuilder({
            ...this["~orpc"],
            meta: t
        })
    }
    $route(t) {
        return new ContractBuilder({
            ...this["~orpc"],
            route: t
        })
    }
    $input(t) {
        return new ContractBuilder({
            ...this["~orpc"],
            inputSchema: t
        })
    }
    errors(t) {
        return new ContractBuilder({
            ...this["~orpc"],
            errorMap: mergeErrorMap(this["~orpc"].errorMap, t)
        })
    }
    meta(t) {
        return new ContractBuilder({
            ...this["~orpc"],
            meta: mergeMeta(this["~orpc"].meta, t)
        })
    }
    route(t) {
        return new ContractBuilder({
            ...this["~orpc"],
            route: mergeRoute(this["~orpc"].route, t)
        })
    }
    input(t) {
        return new ContractBuilder({
            ...this["~orpc"],
            inputSchema: t
        })
    }
    output(t) {
        return new ContractBuilder({
            ...this["~orpc"],
            outputSchema: t
        })
    }
    prefix(t) {
        return new ContractBuilder({
            ...this["~orpc"],
            prefix: mergePrefix(this["~orpc"].prefix, t)
        })
    }
    tag(...t) {
        return new ContractBuilder({
            ...this["~orpc"],
            tags: mergeTags(this["~orpc"].tags, t)
        })
    }
    router(t) {
        return enhanceContractRouter(t, this["~orpc"])
    }
}
const oc = new ContractBuilder({
    errorMap: {},
    route: {},
    meta: {}
});
var util;
(function(e) {
    e.assertEqual = a => {}
    ;
    function t(a) {}
    e.assertIs = t;
    function r(a) {
        throw new Error
    }
    e.assertNever = r,
    e.arrayToEnum = a => {
        const s = {};
        for (const o of a)
            s[o] = o;
        return s
    }
    ,
    e.getValidEnumValues = a => {
        const s = e.objectKeys(a).filter(l => typeof a[a[l]] != "number")
          , o = {};
        for (const l of s)
            o[l] = a[l];
        return e.objectValues(o)
    }
    ,
    e.objectValues = a => e.objectKeys(a).map(function(s) {
        return a[s]
    }),
    e.objectKeys = typeof Object.keys == "function" ? a => Object.keys(a) : a => {
        const s = [];
        for (const o in a)
            Object.prototype.hasOwnProperty.call(a, o) && s.push(o);
        return s
    }
    ,
    e.find = (a, s) => {
        for (const o of a)
            if (s(o))
                return o
    }
    ,
    e.isInteger = typeof Number.isInteger == "function" ? a => Number.isInteger(a) : a => typeof a == "number" && Number.isFinite(a) && Math.floor(a) === a;
    function n(a, s=" | ") {
        return a.map(o => typeof o == "string" ? `'${o}'` : o).join(s)
    }
    e.joinValues = n,
    e.jsonStringifyReplacer = (a, s) => typeof s == "bigint" ? s.toString() : s
}
)(util || (util = {}));
var objectUtil;
(function(e) {
    e.mergeShapes = (t, r) => ({
        ...t,
        ...r
    })
}
)(objectUtil || (objectUtil = {}));
const ZodParsedType = util.arrayToEnum(["string", "nan", "number", "integer", "float", "boolean", "date", "bigint", "symbol", "function", "undefined", "null", "array", "object", "unknown", "promise", "void", "never", "map", "set"])
  , getParsedType = e => {
    switch (typeof e) {
    case "undefined":
        return ZodParsedType.undefined;
    case "string":
        return ZodParsedType.string;
    case "number":
        return Number.isNaN(e) ? ZodParsedType.nan : ZodParsedType.number;
    case "boolean":
        return ZodParsedType.boolean;
    case "function":
        return ZodParsedType.function;
    case "bigint":
        return ZodParsedType.bigint;
    case "symbol":
        return ZodParsedType.symbol;
    case "object":
        return Array.isArray(e) ? ZodParsedType.array : e === null ? ZodParsedType.null : e.then && typeof e.then == "function" && e.catch && typeof e.catch == "function" ? ZodParsedType.promise : typeof Map < "u" && e instanceof Map ? ZodParsedType.map : typeof Set < "u" && e instanceof Set ? ZodParsedType.set : typeof Date < "u" && e instanceof Date ? ZodParsedType.date : ZodParsedType.object;
    default:
        return ZodParsedType.unknown
    }
}
  , ZodIssueCode = util.arrayToEnum(["invalid_type", "invalid_literal", "custom", "invalid_union", "invalid_union_discriminator", "invalid_enum_value", "unrecognized_keys", "invalid_arguments", "invalid_return_type", "invalid_date", "invalid_string", "too_small", "too_big", "invalid_intersection_types", "not_multiple_of", "not_finite"]);
class ZodError extends Error {
    get errors() {
        return this.issues
    }
    constructor(t) {
        super(),
        this.issues = [],
        this.addIssue = n => {
            this.issues = [...this.issues, n]
        }
        ,
        this.addIssues = (n=[]) => {
            this.issues = [...this.issues, ...n]
        }
        ;
        const r = new.target.prototype;
        Object.setPrototypeOf ? Object.setPrototypeOf(this, r) : this.__proto__ = r,
        this.name = "ZodError",
        this.issues = t
    }
    format(t) {
        const r = t || function(s) {
            return s.message
        }
          , n = {
            _errors: []
        }
          , a = s => {
            for (const o of s.issues)
                if (o.code === "invalid_union")
                    o.unionErrors.map(a);
                else if (o.code === "invalid_return_type")
                    a(o.returnTypeError);
                else if (o.code === "invalid_arguments")
                    a(o.argumentsError);
                else if (o.path.length === 0)
                    n._errors.push(r(o));
                else {
                    let l = n
                      , u = 0;
                    for (; u < o.path.length; ) {
                        const c = o.path[u];
                        u === o.path.length - 1 ? (l[c] = l[c] || {
                            _errors: []
                        },
                        l[c]._errors.push(r(o))) : l[c] = l[c] || {
                            _errors: []
                        },
                        l = l[c],
                        u++
                    }
                }
        }
        ;
        return a(this),
        n
    }
    static assert(t) {
        if (!(t instanceof ZodError))
            throw new Error(`Not a ZodError: ${t}`)
    }
    toString() {
        return this.message
    }
    get message() {
        return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2)
    }
    get isEmpty() {
        return this.issues.length === 0
    }
    flatten(t=r => r.message) {
        const r = {}
          , n = [];
        for (const a of this.issues)
            if (a.path.length > 0) {
                const s = a.path[0];
                r[s] = r[s] || [],
                r[s].push(t(a))
            } else
                n.push(t(a));
        return {
            formErrors: n,
            fieldErrors: r
        }
    }
    get formErrors() {
        return this.flatten()
    }
}
ZodError.create = e => new ZodError(e);
const errorMap = (e, t) => {
    let r;
    switch (e.code) {
    case ZodIssueCode.invalid_type:
        e.received === ZodParsedType.undefined ? r = "Required" : r = `Expected ${e.expected}, received ${e.received}`;
        break;
    case ZodIssueCode.invalid_literal:
        r = `Invalid literal value, expected ${JSON.stringify(e.expected, util.jsonStringifyReplacer)}`;
        break;
    case ZodIssueCode.unrecognized_keys:
        r = `Unrecognized key(s) in object: ${util.joinValues(e.keys, ", ")}`;
        break;
    case ZodIssueCode.invalid_union:
        r = "Invalid input";
        break;
    case ZodIssueCode.invalid_union_discriminator:
        r = `Invalid discriminator value. Expected ${util.joinValues(e.options)}`;
        break;
    case ZodIssueCode.invalid_enum_value:
        r = `Invalid enum value. Expected ${util.joinValues(e.options)}, received '${e.received}'`;
        break;
    case ZodIssueCode.invalid_arguments:
        r = "Invalid function arguments";
        break;
    case ZodIssueCode.invalid_return_type:
        r = "Invalid function return type";
        break;
    case ZodIssueCode.invalid_date:
        r = "Invalid date";
        break;
    case ZodIssueCode.invalid_string:
        typeof e.validation == "object" ? "includes"in e.validation ? (r = `Invalid input: must include "${e.validation.includes}"`,
        typeof e.validation.position == "number" && (r = `${r} at one or more positions greater than or equal to ${e.validation.position}`)) : "startsWith"in e.validation ? r = `Invalid input: must start with "${e.validation.startsWith}"` : "endsWith"in e.validation ? r = `Invalid input: must end with "${e.validation.endsWith}"` : util.assertNever(e.validation) : e.validation !== "regex" ? r = `Invalid ${e.validation}` : r = "Invalid";
        break;
    case ZodIssueCode.too_small:
        e.type === "array" ? r = `Array must contain ${e.exact ? "exactly" : e.inclusive ? "at least" : "more than"} ${e.minimum} element(s)` : e.type === "string" ? r = `String must contain ${e.exact ? "exactly" : e.inclusive ? "at least" : "over"} ${e.minimum} character(s)` : e.type === "number" ? r = `Number must be ${e.exact ? "exactly equal to " : e.inclusive ? "greater than or equal to " : "greater than "}${e.minimum}` : e.type === "bigint" ? r = `Number must be ${e.exact ? "exactly equal to " : e.inclusive ? "greater than or equal to " : "greater than "}${e.minimum}` : e.type === "date" ? r = `Date must be ${e.exact ? "exactly equal to " : e.inclusive ? "greater than or equal to " : "greater than "}${new Date(Number(e.minimum))}` : r = "Invalid input";
        break;
    case ZodIssueCode.too_big:
        e.type === "array" ? r = `Array must contain ${e.exact ? "exactly" : e.inclusive ? "at most" : "less than"} ${e.maximum} element(s)` : e.type === "string" ? r = `String must contain ${e.exact ? "exactly" : e.inclusive ? "at most" : "under"} ${e.maximum} character(s)` : e.type === "number" ? r = `Number must be ${e.exact ? "exactly" : e.inclusive ? "less than or equal to" : "less than"} ${e.maximum}` : e.type === "bigint" ? r = `BigInt must be ${e.exact ? "exactly" : e.inclusive ? "less than or equal to" : "less than"} ${e.maximum}` : e.type === "date" ? r = `Date must be ${e.exact ? "exactly" : e.inclusive ? "smaller than or equal to" : "smaller than"} ${new Date(Number(e.maximum))}` : r = "Invalid input";
        break;
    case ZodIssueCode.custom:
        r = "Invalid input";
        break;
    case ZodIssueCode.invalid_intersection_types:
        r = "Intersection results could not be merged";
        break;
    case ZodIssueCode.not_multiple_of:
        r = `Number must be a multiple of ${e.multipleOf}`;
        break;
    case ZodIssueCode.not_finite:
        r = "Number must be finite";
        break;
    default:
        r = t.defaultError,
        util.assertNever(e)
    }
    return {
        message: r
    }
}
;
let overrideErrorMap = errorMap;
function getErrorMap() {
    return overrideErrorMap
}
const makeIssue = e => {
    const {data: t, path: r, errorMaps: n, issueData: a} = e
      , s = [...r, ...a.path || []]
      , o = {
        ...a,
        path: s
    };
    if (a.message !== void 0)
        return {
            ...a,
            path: s,
            message: a.message
        };
    let l = "";
    const u = n.filter(c => !!c).slice().reverse();
    for (const c of u)
        l = c(o, {
            data: t,
            defaultError: l
        }).message;
    return {
        ...a,
        path: s,
        message: l
    }
}
;
function addIssueToContext(e, t) {
    const r = getErrorMap()
      , n = makeIssue({
        issueData: t,
        data: e.data,
        path: e.path,
        errorMaps: [e.common.contextualErrorMap, e.schemaErrorMap, r, r === errorMap ? void 0 : errorMap].filter(a => !!a)
    });
    e.common.issues.push(n)
}
class ParseStatus {
    constructor() {
        this.value = "valid"
    }
    dirty() {
        this.value === "valid" && (this.value = "dirty")
    }
    abort() {
        this.value !== "aborted" && (this.value = "aborted")
    }
    static mergeArray(t, r) {
        const n = [];
        for (const a of r) {
            if (a.status === "aborted")
                return INVALID;
            a.status === "dirty" && t.dirty(),
            n.push(a.value)
        }
        return {
            status: t.value,
            value: n
        }
    }
    static async mergeObjectAsync(t, r) {
        const n = [];
        for (const a of r) {
            const s = await a.key
              , o = await a.value;
            n.push({
                key: s,
                value: o
            })
        }
        return ParseStatus.mergeObjectSync(t, n)
    }
    static mergeObjectSync(t, r) {
        const n = {};
        for (const a of r) {
            const {key: s, value: o} = a;
            if (s.status === "aborted" || o.status === "aborted")
                return INVALID;
            s.status === "dirty" && t.dirty(),
            o.status === "dirty" && t.dirty(),
            s.value !== "__proto__" && (typeof o.value < "u" || a.alwaysSet) && (n[s.value] = o.value)
        }
        return {
            status: t.value,
            value: n
        }
    }
}
const INVALID = Object.freeze({
    status: "aborted"
})
  , DIRTY = e => ({
    status: "dirty",
    value: e
})
  , OK = e => ({
    status: "valid",
    value: e
})
  , isAborted = e => e.status === "aborted"
  , isDirty = e => e.status === "dirty"
  , isValid = e => e.status === "valid"
  , isAsync = e => typeof Promise < "u" && e instanceof Promise;
var errorUtil;
(function(e) {
    e.errToObj = t => typeof t == "string" ? {
        message: t
    } : t || {},
    e.toString = t => typeof t == "string" ? t : t?.message
}
)(errorUtil || (errorUtil = {}));
class ParseInputLazyPath {
    constructor(t, r, n, a) {
        this._cachedPath = [],
        this.parent = t,
        this.data = r,
        this._path = n,
        this._key = a
    }
    get path() {
        return this._cachedPath.length || (Array.isArray(this._key) ? this._cachedPath.push(...this._path, ...this._key) : this._cachedPath.push(...this._path, this._key)),
        this._cachedPath
    }
}
const handleResult = (e, t) => {
    if (isValid(t))
        return {
            success: !0,
            data: t.value
        };
    if (!e.common.issues.length)
        throw new Error("Validation failed but no issues detected.");
    return {
        success: !1,
        get error() {
            if (this._error)
                return this._error;
            const r = new ZodError(e.common.issues);
            return this._error = r,
            this._error
        }
    }
}
;
function processCreateParams(e) {
    if (!e)
        return {};
    const {errorMap: t, invalid_type_error: r, required_error: n, description: a} = e;
    if (t && (r || n))
        throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
    return t ? {
        errorMap: t,
        description: a
    } : {
        errorMap: (o, l) => {
            const {message: u} = e;
            return o.code === "invalid_enum_value" ? {
                message: u ?? l.defaultError
            } : typeof l.data > "u" ? {
                message: u ?? n ?? l.defaultError
            } : o.code !== "invalid_type" ? {
                message: l.defaultError
            } : {
                message: u ?? r ?? l.defaultError
            }
        }
        ,
        description: a
    }
}
class ZodType {
    get description() {
        return this._def.description
    }
    _getType(t) {
        return getParsedType(t.data)
    }
    _getOrReturnCtx(t, r) {
        return r || {
            common: t.parent.common,
            data: t.data,
            parsedType: getParsedType(t.data),
            schemaErrorMap: this._def.errorMap,
            path: t.path,
            parent: t.parent
        }
    }
    _processInputParams(t) {
        return {
            status: new ParseStatus,
            ctx: {
                common: t.parent.common,
                data: t.data,
                parsedType: getParsedType(t.data),
                schemaErrorMap: this._def.errorMap,
                path: t.path,
                parent: t.parent
            }
        }
    }
    _parseSync(t) {
        const r = this._parse(t);
        if (isAsync(r))
            throw new Error("Synchronous parse encountered promise.");
        return r
    }
    _parseAsync(t) {
        const r = this._parse(t);
        return Promise.resolve(r)
    }
    parse(t, r) {
        const n = this.safeParse(t, r);
        if (n.success)
            return n.data;
        throw n.error
    }
    safeParse(t, r) {
        const n = {
            common: {
                issues: [],
                async: r?.async ?? !1,
                contextualErrorMap: r?.errorMap
            },
            path: r?.path || [],
            schemaErrorMap: this._def.errorMap,
            parent: null,
            data: t,
            parsedType: getParsedType(t)
        }
          , a = this._parseSync({
            data: t,
            path: n.path,
            parent: n
        });
        return handleResult(n, a)
    }
    "~validate"(t) {
        const r = {
            common: {
                issues: [],
                async: !!this["~standard"].async
            },
            path: [],
            schemaErrorMap: this._def.errorMap,
            parent: null,
            data: t,
            parsedType: getParsedType(t)
        };
        if (!this["~standard"].async)
            try {
                const n = this._parseSync({
                    data: t,
                    path: [],
                    parent: r
                });
                return isValid(n) ? {
                    value: n.value
                } : {
                    issues: r.common.issues
                }
            } catch (n) {
                n?.message?.toLowerCase()?.includes("encountered") && (this["~standard"].async = !0),
                r.common = {
                    issues: [],
                    async: !0
                }
            }
        return this._parseAsync({
            data: t,
            path: [],
            parent: r
        }).then(n => isValid(n) ? {
            value: n.value
        } : {
            issues: r.common.issues
        })
    }
    async parseAsync(t, r) {
        const n = await this.safeParseAsync(t, r);
        if (n.success)
            return n.data;
        throw n.error
    }
    async safeParseAsync(t, r) {
        const n = {
            common: {
                issues: [],
                contextualErrorMap: r?.errorMap,
                async: !0
            },
            path: r?.path || [],
            schemaErrorMap: this._def.errorMap,
            parent: null,
            data: t,
            parsedType: getParsedType(t)
        }
          , a = this._parse({
            data: t,
            path: n.path,
            parent: n
        })
          , s = await (isAsync(a) ? a : Promise.resolve(a));
        return handleResult(n, s)
    }
    refine(t, r) {
        const n = a => typeof r == "string" || typeof r > "u" ? {
            message: r
        } : typeof r == "function" ? r(a) : r;
        return this._refinement( (a, s) => {
            const o = t(a)
              , l = () => s.addIssue({
                code: ZodIssueCode.custom,
                ...n(a)
            });
            return typeof Promise < "u" && o instanceof Promise ? o.then(u => u ? !0 : (l(),
            !1)) : o ? !0 : (l(),
            !1)
        }
        )
    }
    refinement(t, r) {
        return this._refinement( (n, a) => t(n) ? !0 : (a.addIssue(typeof r == "function" ? r(n, a) : r),
        !1))
    }
    _refinement(t) {
        return new ZodEffects({
            schema: this,
            typeName: ZodFirstPartyTypeKind.ZodEffects,
            effect: {
                type: "refinement",
                refinement: t
            }
        })
    }
    superRefine(t) {
        return this._refinement(t)
    }
    constructor(t) {
        this.spa = this.safeParseAsync,
        this._def = t,
        this.parse = this.parse.bind(this),
        this.safeParse = this.safeParse.bind(this),
        this.parseAsync = this.parseAsync.bind(this),
        this.safeParseAsync = this.safeParseAsync.bind(this),
        this.spa = this.spa.bind(this),
        this.refine = this.refine.bind(this),
        this.refinement = this.refinement.bind(this),
        this.superRefine = this.superRefine.bind(this),
        this.optional = this.optional.bind(this),
        this.nullable = this.nullable.bind(this),
        this.nullish = this.nullish.bind(this),
        this.array = this.array.bind(this),
        this.promise = this.promise.bind(this),
        this.or = this.or.bind(this),
        this.and = this.and.bind(this),
        this.transform = this.transform.bind(this),
        this.brand = this.brand.bind(this),
        this.default = this.default.bind(this),
        this.catch = this.catch.bind(this),
        this.describe = this.describe.bind(this),
        this.pipe = this.pipe.bind(this),
        this.readonly = this.readonly.bind(this),
        this.isNullable = this.isNullable.bind(this),
        this.isOptional = this.isOptional.bind(this),
        this["~standard"] = {
            version: 1,
            vendor: "zod",
            validate: r => this["~validate"](r)
        }
    }
    optional() {
        return ZodOptional.create(this, this._def)
    }
    nullable() {
        return ZodNullable.create(this, this._def)
    }
    nullish() {
        return this.nullable().optional()
    }
    array() {
        return ZodArray.create(this)
    }
    promise() {
        return ZodPromise.create(this, this._def)
    }
    or(t) {
        return ZodUnion.create([this, t], this._def)
    }
    and(t) {
        return ZodIntersection.create(this, t, this._def)
    }
    transform(t) {
        return new ZodEffects({
            ...processCreateParams(this._def),
            schema: this,
            typeName: ZodFirstPartyTypeKind.ZodEffects,
            effect: {
                type: "transform",
                transform: t
            }
        })
    }
    default(t) {
        const r = typeof t == "function" ? t : () => t;
        return new ZodDefault({
            ...processCreateParams(this._def),
            innerType: this,
            defaultValue: r,
            typeName: ZodFirstPartyTypeKind.ZodDefault
        })
    }
    brand() {
        return new ZodBranded({
            typeName: ZodFirstPartyTypeKind.ZodBranded,
            type: this,
            ...processCreateParams(this._def)
        })
    }
    catch(t) {
        const r = typeof t == "function" ? t : () => t;
        return new ZodCatch({
            ...processCreateParams(this._def),
            innerType: this,
            catchValue: r,
            typeName: ZodFirstPartyTypeKind.ZodCatch
        })
    }
    describe(t) {
        const r = this.constructor;
        return new r({
            ...this._def,
            description: t
        })
    }
    pipe(t) {
        return ZodPipeline.create(this, t)
    }
    readonly() {
        return ZodReadonly.create(this)
    }
    isOptional() {
        return this.safeParse(void 0).success
    }
    isNullable() {
        return this.safeParse(null).success
    }
}
const cuidRegex = /^c[^\s-]{8,}$/i
  , cuid2Regex = /^[0-9a-z]+$/
  , ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i
  , uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i
  , nanoidRegex = /^[a-z0-9_-]{21}$/i
  , jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/
  , durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/
  , emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i
  , _emojiRegex = "^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$";
let emojiRegex;
const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/
  , ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/
  , ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/
  , ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/
  , base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/
  , base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/
  , dateRegexSource = "((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))"
  , dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(e) {
    let t = "[0-5]\\d";
    e.precision ? t = `${t}\\.\\d{${e.precision}}` : e.precision == null && (t = `${t}(\\.\\d+)?`);
    const r = e.precision ? "+" : "?";
    return `([01]\\d|2[0-3]):[0-5]\\d(:${t})${r}`
}
function timeRegex(e) {
    return new RegExp(`^${timeRegexSource(e)}$`)
}
function datetimeRegex(e) {
    let t = `${dateRegexSource}T${timeRegexSource(e)}`;
    const r = [];
    return r.push(e.local ? "Z?" : "Z"),
    e.offset && r.push("([+-]\\d{2}:?\\d{2})"),
    t = `${t}(${r.join("|")})`,
    new RegExp(`^${t}$`)
}
function isValidIP(e, t) {
    return !!((t === "v4" || !t) && ipv4Regex.test(e) || (t === "v6" || !t) && ipv6Regex.test(e))
}
function isValidJWT(e, t) {
    if (!jwtRegex.test(e))
        return !1;
    try {
        const [r] = e.split(".");
        if (!r)
            return !1;
        const n = r.replace(/-/g, "+").replace(/_/g, "/").padEnd(r.length + (4 - r.length % 4) % 4, "=")
          , a = JSON.parse(atob(n));
        return !(typeof a != "object" || a === null || "typ"in a && a?.typ !== "JWT" || !a.alg || t && a.alg !== t)
    } catch {
        return !1
    }
}
function isValidCidr(e, t) {
    return !!((t === "v4" || !t) && ipv4CidrRegex.test(e) || (t === "v6" || !t) && ipv6CidrRegex.test(e))
}
class ZodString extends ZodType {
    _parse(t) {
        if (this._def.coerce && (t.data = String(t.data)),
        this._getType(t) !== ZodParsedType.string) {
            const s = this._getOrReturnCtx(t);
            return addIssueToContext(s, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.string,
                received: s.parsedType
            }),
            INVALID
        }
        const n = new ParseStatus;
        let a;
        for (const s of this._def.checks)
            if (s.kind === "min")
                t.data.length < s.value && (a = this._getOrReturnCtx(t, a),
                addIssueToContext(a, {
                    code: ZodIssueCode.too_small,
                    minimum: s.value,
                    type: "string",
                    inclusive: !0,
                    exact: !1,
                    message: s.message
                }),
                n.dirty());
            else if (s.kind === "max")
                t.data.length > s.value && (a = this._getOrReturnCtx(t, a),
                addIssueToContext(a, {
                    code: ZodIssueCode.too_big,
                    maximum: s.value,
                    type: "string",
                    inclusive: !0,
                    exact: !1,
                    message: s.message
                }),
                n.dirty());
            else if (s.kind === "length") {
                const o = t.data.length > s.value
                  , l = t.data.length < s.value;
                (o || l) && (a = this._getOrReturnCtx(t, a),
                o ? addIssueToContext(a, {
                    code: ZodIssueCode.too_big,
                    maximum: s.value,
                    type: "string",
                    inclusive: !0,
                    exact: !0,
                    message: s.message
                }) : l && addIssueToContext(a, {
                    code: ZodIssueCode.too_small,
                    minimum: s.value,
                    type: "string",
                    inclusive: !0,
                    exact: !0,
                    message: s.message
                }),
                n.dirty())
            } else if (s.kind === "email")
                emailRegex.test(t.data) || (a = this._getOrReturnCtx(t, a),
                addIssueToContext(a, {
                    validation: "email",
                    code: ZodIssueCode.invalid_string,
                    message: s.message
                }),
                n.dirty());
            else if (s.kind === "emoji")
                emojiRegex || (emojiRegex = new RegExp(_emojiRegex,"u")),
                emojiRegex.test(t.data) || (a = this._getOrReturnCtx(t, a),
                addIssueToContext(a, {
                    validation: "emoji",
                    code: ZodIssueCode.invalid_string,
                    message: s.message
                }),
                n.dirty());
            else if (s.kind === "uuid")
                uuidRegex.test(t.data) || (a = this._getOrReturnCtx(t, a),
                addIssueToContext(a, {
                    validation: "uuid",
                    code: ZodIssueCode.invalid_string,
                    message: s.message
                }),
                n.dirty());
            else if (s.kind === "nanoid")
                nanoidRegex.test(t.data) || (a = this._getOrReturnCtx(t, a),
                addIssueToContext(a, {
                    validation: "nanoid",
                    code: ZodIssueCode.invalid_string,
                    message: s.message
                }),
                n.dirty());
            else if (s.kind === "cuid")
                cuidRegex.test(t.data) || (a = this._getOrReturnCtx(t, a),
                addIssueToContext(a, {
                    validation: "cuid",
                    code: ZodIssueCode.invalid_string,
                    message: s.message
                }),
                n.dirty());
            else if (s.kind === "cuid2")
                cuid2Regex.test(t.data) || (a = this._getOrReturnCtx(t, a),
                addIssueToContext(a, {
                    validation: "cuid2",
                    code: ZodIssueCode.invalid_string,
                    message: s.message
                }),
                n.dirty());
            else if (s.kind === "ulid")
                ulidRegex.test(t.data) || (a = this._getOrReturnCtx(t, a),
                addIssueToContext(a, {
                    validation: "ulid",
                    code: ZodIssueCode.invalid_string,
                    message: s.message
                }),
                n.dirty());
            else if (s.kind === "url")
                try {
                    new URL(t.data)
                } catch {
                    a = this._getOrReturnCtx(t, a),
                    addIssueToContext(a, {
                        validation: "url",
                        code: ZodIssueCode.invalid_string,
                        message: s.message
                    }),
                    n.dirty()
                }
            else
                s.kind === "regex" ? (s.regex.lastIndex = 0,
                s.regex.test(t.data) || (a = this._getOrReturnCtx(t, a),
                addIssueToContext(a, {
                    validation: "regex",
                    code: ZodIssueCode.invalid_string,
                    message: s.message
                }),
                n.dirty())) : s.kind === "trim" ? t.data = t.data.trim() : s.kind === "includes" ? t.data.includes(s.value, s.position) || (a = this._getOrReturnCtx(t, a),
                addIssueToContext(a, {
                    code: ZodIssueCode.invalid_string,
                    validation: {
                        includes: s.value,
                        position: s.position
                    },
                    message: s.message
                }),
                n.dirty()) : s.kind === "toLowerCase" ? t.data = t.data.toLowerCase() : s.kind === "toUpperCase" ? t.data = t.data.toUpperCase() : s.kind === "startsWith" ? t.data.startsWith(s.value) || (a = this._getOrReturnCtx(t, a),
                addIssueToContext(a, {
                    code: ZodIssueCode.invalid_string,
                    validation: {
                        startsWith: s.value
                    },
                    message: s.message
                }),
                n.dirty()) : s.kind === "endsWith" ? t.data.endsWith(s.value) || (a = this._getOrReturnCtx(t, a),
                addIssueToContext(a, {
                    code: ZodIssueCode.invalid_string,
                    validation: {
                        endsWith: s.value
                    },
                    message: s.message
                }),
                n.dirty()) : s.kind === "datetime" ? datetimeRegex(s).test(t.data) || (a = this._getOrReturnCtx(t, a),
                addIssueToContext(a, {
                    code: ZodIssueCode.invalid_string,
                    validation: "datetime",
                    message: s.message
                }),
                n.dirty()) : s.kind === "date" ? dateRegex.test(t.data) || (a = this._getOrReturnCtx(t, a),
                addIssueToContext(a, {
                    code: ZodIssueCode.invalid_string,
                    validation: "date",
                    message: s.message
                }),
                n.dirty()) : s.kind === "time" ? timeRegex(s).test(t.data) || (a = this._getOrReturnCtx(t, a),
                addIssueToContext(a, {
                    code: ZodIssueCode.invalid_string,
                    validation: "time",
                    message: s.message
                }),
                n.dirty()) : s.kind === "duration" ? durationRegex.test(t.data) || (a = this._getOrReturnCtx(t, a),
                addIssueToContext(a, {
                    validation: "duration",
                    code: ZodIssueCode.invalid_string,
                    message: s.message
                }),
                n.dirty()) : s.kind === "ip" ? isValidIP(t.data, s.version) || (a = this._getOrReturnCtx(t, a),
                addIssueToContext(a, {
                    validation: "ip",
                    code: ZodIssueCode.invalid_string,
                    message: s.message
                }),
                n.dirty()) : s.kind === "jwt" ? isValidJWT(t.data, s.alg) || (a = this._getOrReturnCtx(t, a),
                addIssueToContext(a, {
                    validation: "jwt",
                    code: ZodIssueCode.invalid_string,
                    message: s.message
                }),
                n.dirty()) : s.kind === "cidr" ? isValidCidr(t.data, s.version) || (a = this._getOrReturnCtx(t, a),
                addIssueToContext(a, {
                    validation: "cidr",
                    code: ZodIssueCode.invalid_string,
                    message: s.message
                }),
                n.dirty()) : s.kind === "base64" ? base64Regex.test(t.data) || (a = this._getOrReturnCtx(t, a),
                addIssueToContext(a, {
                    validation: "base64",
                    code: ZodIssueCode.invalid_string,
                    message: s.message
                }),
                n.dirty()) : s.kind === "base64url" ? base64urlRegex.test(t.data) || (a = this._getOrReturnCtx(t, a),
                addIssueToContext(a, {
                    validation: "base64url",
                    code: ZodIssueCode.invalid_string,
                    message: s.message
                }),
                n.dirty()) : util.assertNever(s);
        return {
            status: n.value,
            value: t.data
        }
    }
    _regex(t, r, n) {
        return this.refinement(a => t.test(a), {
            validation: r,
            code: ZodIssueCode.invalid_string,
            ...errorUtil.errToObj(n)
        })
    }
    _addCheck(t) {
        return new ZodString({
            ...this._def,
            checks: [...this._def.checks, t]
        })
    }
    email(t) {
        return this._addCheck({
            kind: "email",
            ...errorUtil.errToObj(t)
        })
    }
    url(t) {
        return this._addCheck({
            kind: "url",
            ...errorUtil.errToObj(t)
        })
    }
    emoji(t) {
        return this._addCheck({
            kind: "emoji",
            ...errorUtil.errToObj(t)
        })
    }
    uuid(t) {
        return this._addCheck({
            kind: "uuid",
            ...errorUtil.errToObj(t)
        })
    }
    nanoid(t) {
        return this._addCheck({
            kind: "nanoid",
            ...errorUtil.errToObj(t)
        })
    }
    cuid(t) {
        return this._addCheck({
            kind: "cuid",
            ...errorUtil.errToObj(t)
        })
    }
    cuid2(t) {
        return this._addCheck({
            kind: "cuid2",
            ...errorUtil.errToObj(t)
        })
    }
    ulid(t) {
        return this._addCheck({
            kind: "ulid",
            ...errorUtil.errToObj(t)
        })
    }
    base64(t) {
        return this._addCheck({
            kind: "base64",
            ...errorUtil.errToObj(t)
        })
    }
    base64url(t) {
        return this._addCheck({
            kind: "base64url",
            ...errorUtil.errToObj(t)
        })
    }
    jwt(t) {
        return this._addCheck({
            kind: "jwt",
            ...errorUtil.errToObj(t)
        })
    }
    ip(t) {
        return this._addCheck({
            kind: "ip",
            ...errorUtil.errToObj(t)
        })
    }
    cidr(t) {
        return this._addCheck({
            kind: "cidr",
            ...errorUtil.errToObj(t)
        })
    }
    datetime(t) {
        return typeof t == "string" ? this._addCheck({
            kind: "datetime",
            precision: null,
            offset: !1,
            local: !1,
            message: t
        }) : this._addCheck({
            kind: "datetime",
            precision: typeof t?.precision > "u" ? null : t?.precision,
            offset: t?.offset ?? !1,
            local: t?.local ?? !1,
            ...errorUtil.errToObj(t?.message)
        })
    }
    date(t) {
        return this._addCheck({
            kind: "date",
            message: t
        })
    }
    time(t) {
        return typeof t == "string" ? this._addCheck({
            kind: "time",
            precision: null,
            message: t
        }) : this._addCheck({
            kind: "time",
            precision: typeof t?.precision > "u" ? null : t?.precision,
            ...errorUtil.errToObj(t?.message)
        })
    }
    duration(t) {
        return this._addCheck({
            kind: "duration",
            ...errorUtil.errToObj(t)
        })
    }
    regex(t, r) {
        return this._addCheck({
            kind: "regex",
            regex: t,
            ...errorUtil.errToObj(r)
        })
    }
    includes(t, r) {
        return this._addCheck({
            kind: "includes",
            value: t,
            position: r?.position,
            ...errorUtil.errToObj(r?.message)
        })
    }
    startsWith(t, r) {
        return this._addCheck({
            kind: "startsWith",
            value: t,
            ...errorUtil.errToObj(r)
        })
    }
    endsWith(t, r) {
        return this._addCheck({
            kind: "endsWith",
            value: t,
            ...errorUtil.errToObj(r)
        })
    }
    min(t, r) {
        return this._addCheck({
            kind: "min",
            value: t,
            ...errorUtil.errToObj(r)
        })
    }
    max(t, r) {
        return this._addCheck({
            kind: "max",
            value: t,
            ...errorUtil.errToObj(r)
        })
    }
    length(t, r) {
        return this._addCheck({
            kind: "length",
            value: t,
            ...errorUtil.errToObj(r)
        })
    }
    nonempty(t) {
        return this.min(1, errorUtil.errToObj(t))
    }
    trim() {
        return new ZodString({
            ...this._def,
            checks: [...this._def.checks, {
                kind: "trim"
            }]
        })
    }
    toLowerCase() {
        return new ZodString({
            ...this._def,
            checks: [...this._def.checks, {
                kind: "toLowerCase"
            }]
        })
    }
    toUpperCase() {
        return new ZodString({
            ...this._def,
            checks: [...this._def.checks, {
                kind: "toUpperCase"
            }]
        })
    }
    get isDatetime() {
        return !!this._def.checks.find(t => t.kind === "datetime")
    }
    get isDate() {
        return !!this._def.checks.find(t => t.kind === "date")
    }
    get isTime() {
        return !!this._def.checks.find(t => t.kind === "time")
    }
    get isDuration() {
        return !!this._def.checks.find(t => t.kind === "duration")
    }
    get isEmail() {
        return !!this._def.checks.find(t => t.kind === "email")
    }
    get isURL() {
        return !!this._def.checks.find(t => t.kind === "url")
    }
    get isEmoji() {
        return !!this._def.checks.find(t => t.kind === "emoji")
    }
    get isUUID() {
        return !!this._def.checks.find(t => t.kind === "uuid")
    }
    get isNANOID() {
        return !!this._def.checks.find(t => t.kind === "nanoid")
    }
    get isCUID() {
        return !!this._def.checks.find(t => t.kind === "cuid")
    }
    get isCUID2() {
        return !!this._def.checks.find(t => t.kind === "cuid2")
    }
    get isULID() {
        return !!this._def.checks.find(t => t.kind === "ulid")
    }
    get isIP() {
        return !!this._def.checks.find(t => t.kind === "ip")
    }
    get isCIDR() {
        return !!this._def.checks.find(t => t.kind === "cidr")
    }
    get isBase64() {
        return !!this._def.checks.find(t => t.kind === "base64")
    }
    get isBase64url() {
        return !!this._def.checks.find(t => t.kind === "base64url")
    }
    get minLength() {
        let t = null;
        for (const r of this._def.checks)
            r.kind === "min" && (t === null || r.value > t) && (t = r.value);
        return t
    }
    get maxLength() {
        let t = null;
        for (const r of this._def.checks)
            r.kind === "max" && (t === null || r.value < t) && (t = r.value);
        return t
    }
}
ZodString.create = e => new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: e?.coerce ?? !1,
    ...processCreateParams(e)
});
function floatSafeRemainder(e, t) {
    const r = (e.toString().split(".")[1] || "").length
      , n = (t.toString().split(".")[1] || "").length
      , a = r > n ? r : n
      , s = Number.parseInt(e.toFixed(a).replace(".", ""))
      , o = Number.parseInt(t.toFixed(a).replace(".", ""));
    return s % o / 10 ** a
}
class ZodNumber extends ZodType {
    constructor() {
        super(...arguments),
        this.min = this.gte,
        this.max = this.lte,
        this.step = this.multipleOf
    }
    _parse(t) {
        if (this._def.coerce && (t.data = Number(t.data)),
        this._getType(t) !== ZodParsedType.number) {
            const s = this._getOrReturnCtx(t);
            return addIssueToContext(s, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.number,
                received: s.parsedType
            }),
            INVALID
        }
        let n;
        const a = new ParseStatus;
        for (const s of this._def.checks)
            s.kind === "int" ? util.isInteger(t.data) || (n = this._getOrReturnCtx(t, n),
            addIssueToContext(n, {
                code: ZodIssueCode.invalid_type,
                expected: "integer",
                received: "float",
                message: s.message
            }),
            a.dirty()) : s.kind === "min" ? (s.inclusive ? t.data < s.value : t.data <= s.value) && (n = this._getOrReturnCtx(t, n),
            addIssueToContext(n, {
                code: ZodIssueCode.too_small,
                minimum: s.value,
                type: "number",
                inclusive: s.inclusive,
                exact: !1,
                message: s.message
            }),
            a.dirty()) : s.kind === "max" ? (s.inclusive ? t.data > s.value : t.data >= s.value) && (n = this._getOrReturnCtx(t, n),
            addIssueToContext(n, {
                code: ZodIssueCode.too_big,
                maximum: s.value,
                type: "number",
                inclusive: s.inclusive,
                exact: !1,
                message: s.message
            }),
            a.dirty()) : s.kind === "multipleOf" ? floatSafeRemainder(t.data, s.value) !== 0 && (n = this._getOrReturnCtx(t, n),
            addIssueToContext(n, {
                code: ZodIssueCode.not_multiple_of,
                multipleOf: s.value,
                message: s.message
            }),
            a.dirty()) : s.kind === "finite" ? Number.isFinite(t.data) || (n = this._getOrReturnCtx(t, n),
            addIssueToContext(n, {
                code: ZodIssueCode.not_finite,
                message: s.message
            }),
            a.dirty()) : util.assertNever(s);
        return {
            status: a.value,
            value: t.data
        }
    }
    gte(t, r) {
        return this.setLimit("min", t, !0, errorUtil.toString(r))
    }
    gt(t, r) {
        return this.setLimit("min", t, !1, errorUtil.toString(r))
    }
    lte(t, r) {
        return this.setLimit("max", t, !0, errorUtil.toString(r))
    }
    lt(t, r) {
        return this.setLimit("max", t, !1, errorUtil.toString(r))
    }
    setLimit(t, r, n, a) {
        return new ZodNumber({
            ...this._def,
            checks: [...this._def.checks, {
                kind: t,
                value: r,
                inclusive: n,
                message: errorUtil.toString(a)
            }]
        })
    }
    _addCheck(t) {
        return new ZodNumber({
            ...this._def,
            checks: [...this._def.checks, t]
        })
    }
    int(t) {
        return this._addCheck({
            kind: "int",
            message: errorUtil.toString(t)
        })
    }
    positive(t) {
        return this._addCheck({
            kind: "min",
            value: 0,
            inclusive: !1,
            message: errorUtil.toString(t)
        })
    }
    negative(t) {
        return this._addCheck({
            kind: "max",
            value: 0,
            inclusive: !1,
            message: errorUtil.toString(t)
        })
    }
    nonpositive(t) {
        return this._addCheck({
            kind: "max",
            value: 0,
            inclusive: !0,
            message: errorUtil.toString(t)
        })
    }
    nonnegative(t) {
        return this._addCheck({
            kind: "min",
            value: 0,
            inclusive: !0,
            message: errorUtil.toString(t)
        })
    }
    multipleOf(t, r) {
        return this._addCheck({
            kind: "multipleOf",
            value: t,
            message: errorUtil.toString(r)
        })
    }
    finite(t) {
        return this._addCheck({
            kind: "finite",
            message: errorUtil.toString(t)
        })
    }
    safe(t) {
        return this._addCheck({
            kind: "min",
            inclusive: !0,
            value: Number.MIN_SAFE_INTEGER,
            message: errorUtil.toString(t)
        })._addCheck({
            kind: "max",
            inclusive: !0,
            value: Number.MAX_SAFE_INTEGER,
            message: errorUtil.toString(t)
        })
    }
    get minValue() {
        let t = null;
        for (const r of this._def.checks)
            r.kind === "min" && (t === null || r.value > t) && (t = r.value);
        return t
    }
    get maxValue() {
        let t = null;
        for (const r of this._def.checks)
            r.kind === "max" && (t === null || r.value < t) && (t = r.value);
        return t
    }
    get isInt() {
        return !!this._def.checks.find(t => t.kind === "int" || t.kind === "multipleOf" && util.isInteger(t.value))
    }
    get isFinite() {
        let t = null
          , r = null;
        for (const n of this._def.checks) {
            if (n.kind === "finite" || n.kind === "int" || n.kind === "multipleOf")
                return !0;
            n.kind === "min" ? (r === null || n.value > r) && (r = n.value) : n.kind === "max" && (t === null || n.value < t) && (t = n.value)
        }
        return Number.isFinite(r) && Number.isFinite(t)
    }
}
ZodNumber.create = e => new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: e?.coerce || !1,
    ...processCreateParams(e)
});
class ZodBigInt extends ZodType {
    constructor() {
        super(...arguments),
        this.min = this.gte,
        this.max = this.lte
    }
    _parse(t) {
        if (this._def.coerce)
            try {
                t.data = BigInt(t.data)
            } catch {
                return this._getInvalidInput(t)
            }
        if (this._getType(t) !== ZodParsedType.bigint)
            return this._getInvalidInput(t);
        let n;
        const a = new ParseStatus;
        for (const s of this._def.checks)
            s.kind === "min" ? (s.inclusive ? t.data < s.value : t.data <= s.value) && (n = this._getOrReturnCtx(t, n),
            addIssueToContext(n, {
                code: ZodIssueCode.too_small,
                type: "bigint",
                minimum: s.value,
                inclusive: s.inclusive,
                message: s.message
            }),
            a.dirty()) : s.kind === "max" ? (s.inclusive ? t.data > s.value : t.data >= s.value) && (n = this._getOrReturnCtx(t, n),
            addIssueToContext(n, {
                code: ZodIssueCode.too_big,
                type: "bigint",
                maximum: s.value,
                inclusive: s.inclusive,
                message: s.message
            }),
            a.dirty()) : s.kind === "multipleOf" ? t.data % s.value !== BigInt(0) && (n = this._getOrReturnCtx(t, n),
            addIssueToContext(n, {
                code: ZodIssueCode.not_multiple_of,
                multipleOf: s.value,
                message: s.message
            }),
            a.dirty()) : util.assertNever(s);
        return {
            status: a.value,
            value: t.data
        }
    }
    _getInvalidInput(t) {
        const r = this._getOrReturnCtx(t);
        return addIssueToContext(r, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.bigint,
            received: r.parsedType
        }),
        INVALID
    }
    gte(t, r) {
        return this.setLimit("min", t, !0, errorUtil.toString(r))
    }
    gt(t, r) {
        return this.setLimit("min", t, !1, errorUtil.toString(r))
    }
    lte(t, r) {
        return this.setLimit("max", t, !0, errorUtil.toString(r))
    }
    lt(t, r) {
        return this.setLimit("max", t, !1, errorUtil.toString(r))
    }
    setLimit(t, r, n, a) {
        return new ZodBigInt({
            ...this._def,
            checks: [...this._def.checks, {
                kind: t,
                value: r,
                inclusive: n,
                message: errorUtil.toString(a)
            }]
        })
    }
    _addCheck(t) {
        return new ZodBigInt({
            ...this._def,
            checks: [...this._def.checks, t]
        })
    }
    positive(t) {
        return this._addCheck({
            kind: "min",
            value: BigInt(0),
            inclusive: !1,
            message: errorUtil.toString(t)
        })
    }
    negative(t) {
        return this._addCheck({
            kind: "max",
            value: BigInt(0),
            inclusive: !1,
            message: errorUtil.toString(t)
        })
    }
    nonpositive(t) {
        return this._addCheck({
            kind: "max",
            value: BigInt(0),
            inclusive: !0,
            message: errorUtil.toString(t)
        })
    }
    nonnegative(t) {
        return this._addCheck({
            kind: "min",
            value: BigInt(0),
            inclusive: !0,
            message: errorUtil.toString(t)
        })
    }
    multipleOf(t, r) {
        return this._addCheck({
            kind: "multipleOf",
            value: t,
            message: errorUtil.toString(r)
        })
    }
    get minValue() {
        let t = null;
        for (const r of this._def.checks)
            r.kind === "min" && (t === null || r.value > t) && (t = r.value);
        return t
    }
    get maxValue() {
        let t = null;
        for (const r of this._def.checks)
            r.kind === "max" && (t === null || r.value < t) && (t = r.value);
        return t
    }
}
ZodBigInt.create = e => new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: e?.coerce ?? !1,
    ...processCreateParams(e)
});
class ZodBoolean extends ZodType {
    _parse(t) {
        if (this._def.coerce && (t.data = !!t.data),
        this._getType(t) !== ZodParsedType.boolean) {
            const n = this._getOrReturnCtx(t);
            return addIssueToContext(n, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.boolean,
                received: n.parsedType
            }),
            INVALID
        }
        return OK(t.data)
    }
}
ZodBoolean.create = e => new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: e?.coerce || !1,
    ...processCreateParams(e)
});
class ZodDate extends ZodType {
    _parse(t) {
        if (this._def.coerce && (t.data = new Date(t.data)),
        this._getType(t) !== ZodParsedType.date) {
            const s = this._getOrReturnCtx(t);
            return addIssueToContext(s, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.date,
                received: s.parsedType
            }),
            INVALID
        }
        if (Number.isNaN(t.data.getTime())) {
            const s = this._getOrReturnCtx(t);
            return addIssueToContext(s, {
                code: ZodIssueCode.invalid_date
            }),
            INVALID
        }
        const n = new ParseStatus;
        let a;
        for (const s of this._def.checks)
            s.kind === "min" ? t.data.getTime() < s.value && (a = this._getOrReturnCtx(t, a),
            addIssueToContext(a, {
                code: ZodIssueCode.too_small,
                message: s.message,
                inclusive: !0,
                exact: !1,
                minimum: s.value,
                type: "date"
            }),
            n.dirty()) : s.kind === "max" ? t.data.getTime() > s.value && (a = this._getOrReturnCtx(t, a),
            addIssueToContext(a, {
                code: ZodIssueCode.too_big,
                message: s.message,
                inclusive: !0,
                exact: !1,
                maximum: s.value,
                type: "date"
            }),
            n.dirty()) : util.assertNever(s);
        return {
            status: n.value,
            value: new Date(t.data.getTime())
        }
    }
    _addCheck(t) {
        return new ZodDate({
            ...this._def,
            checks: [...this._def.checks, t]
        })
    }
    min(t, r) {
        return this._addCheck({
            kind: "min",
            value: t.getTime(),
            message: errorUtil.toString(r)
        })
    }
    max(t, r) {
        return this._addCheck({
            kind: "max",
            value: t.getTime(),
            message: errorUtil.toString(r)
        })
    }
    get minDate() {
        let t = null;
        for (const r of this._def.checks)
            r.kind === "min" && (t === null || r.value > t) && (t = r.value);
        return t != null ? new Date(t) : null
    }
    get maxDate() {
        let t = null;
        for (const r of this._def.checks)
            r.kind === "max" && (t === null || r.value < t) && (t = r.value);
        return t != null ? new Date(t) : null
    }
}
ZodDate.create = e => new ZodDate({
    checks: [],
    coerce: e?.coerce || !1,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(e)
});
class ZodSymbol extends ZodType {
    _parse(t) {
        if (this._getType(t) !== ZodParsedType.symbol) {
            const n = this._getOrReturnCtx(t);
            return addIssueToContext(n, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.symbol,
                received: n.parsedType
            }),
            INVALID
        }
        return OK(t.data)
    }
}
ZodSymbol.create = e => new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(e)
});
class ZodUndefined extends ZodType {
    _parse(t) {
        if (this._getType(t) !== ZodParsedType.undefined) {
            const n = this._getOrReturnCtx(t);
            return addIssueToContext(n, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.undefined,
                received: n.parsedType
            }),
            INVALID
        }
        return OK(t.data)
    }
}
ZodUndefined.create = e => new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(e)
});
class ZodNull extends ZodType {
    _parse(t) {
        if (this._getType(t) !== ZodParsedType.null) {
            const n = this._getOrReturnCtx(t);
            return addIssueToContext(n, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.null,
                received: n.parsedType
            }),
            INVALID
        }
        return OK(t.data)
    }
}
ZodNull.create = e => new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(e)
});
class ZodAny extends ZodType {
    constructor() {
        super(...arguments),
        this._any = !0
    }
    _parse(t) {
        return OK(t.data)
    }
}
ZodAny.create = e => new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(e)
});
class ZodUnknown extends ZodType {
    constructor() {
        super(...arguments),
        this._unknown = !0
    }
    _parse(t) {
        return OK(t.data)
    }
}
ZodUnknown.create = e => new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(e)
});
class ZodNever extends ZodType {
    _parse(t) {
        const r = this._getOrReturnCtx(t);
        return addIssueToContext(r, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.never,
            received: r.parsedType
        }),
        INVALID
    }
}
ZodNever.create = e => new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(e)
});
class ZodVoid extends ZodType {
    _parse(t) {
        if (this._getType(t) !== ZodParsedType.undefined) {
            const n = this._getOrReturnCtx(t);
            return addIssueToContext(n, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.void,
                received: n.parsedType
            }),
            INVALID
        }
        return OK(t.data)
    }
}
ZodVoid.create = e => new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(e)
});
class ZodArray extends ZodType {
    _parse(t) {
        const {ctx: r, status: n} = this._processInputParams(t)
          , a = this._def;
        if (r.parsedType !== ZodParsedType.array)
            return addIssueToContext(r, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.array,
                received: r.parsedType
            }),
            INVALID;
        if (a.exactLength !== null) {
            const o = r.data.length > a.exactLength.value
              , l = r.data.length < a.exactLength.value;
            (o || l) && (addIssueToContext(r, {
                code: o ? ZodIssueCode.too_big : ZodIssueCode.too_small,
                minimum: l ? a.exactLength.value : void 0,
                maximum: o ? a.exactLength.value : void 0,
                type: "array",
                inclusive: !0,
                exact: !0,
                message: a.exactLength.message
            }),
            n.dirty())
        }
        if (a.minLength !== null && r.data.length < a.minLength.value && (addIssueToContext(r, {
            code: ZodIssueCode.too_small,
            minimum: a.minLength.value,
            type: "array",
            inclusive: !0,
            exact: !1,
            message: a.minLength.message
        }),
        n.dirty()),
        a.maxLength !== null && r.data.length > a.maxLength.value && (addIssueToContext(r, {
            code: ZodIssueCode.too_big,
            maximum: a.maxLength.value,
            type: "array",
            inclusive: !0,
            exact: !1,
            message: a.maxLength.message
        }),
        n.dirty()),
        r.common.async)
            return Promise.all([...r.data].map( (o, l) => a.type._parseAsync(new ParseInputLazyPath(r,o,r.path,l)))).then(o => ParseStatus.mergeArray(n, o));
        const s = [...r.data].map( (o, l) => a.type._parseSync(new ParseInputLazyPath(r,o,r.path,l)));
        return ParseStatus.mergeArray(n, s)
    }
    get element() {
        return this._def.type
    }
    min(t, r) {
        return new ZodArray({
            ...this._def,
            minLength: {
                value: t,
                message: errorUtil.toString(r)
            }
        })
    }
    max(t, r) {
        return new ZodArray({
            ...this._def,
            maxLength: {
                value: t,
                message: errorUtil.toString(r)
            }
        })
    }
    length(t, r) {
        return new ZodArray({
            ...this._def,
            exactLength: {
                value: t,
                message: errorUtil.toString(r)
            }
        })
    }
    nonempty(t) {
        return this.min(1, t)
    }
}
ZodArray.create = (e, t) => new ZodArray({
    type: e,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams(t)
});
function deepPartialify(e) {
    if (e instanceof ZodObject) {
        const t = {};
        for (const r in e.shape) {
            const n = e.shape[r];
            t[r] = ZodOptional.create(deepPartialify(n))
        }
        return new ZodObject({
            ...e._def,
            shape: () => t
        })
    } else
        return e instanceof ZodArray ? new ZodArray({
            ...e._def,
            type: deepPartialify(e.element)
        }) : e instanceof ZodOptional ? ZodOptional.create(deepPartialify(e.unwrap())) : e instanceof ZodNullable ? ZodNullable.create(deepPartialify(e.unwrap())) : e instanceof ZodTuple ? ZodTuple.create(e.items.map(t => deepPartialify(t))) : e
}
class ZodObject extends ZodType {
    constructor() {
        super(...arguments),
        this._cached = null,
        this.nonstrict = this.passthrough,
        this.augment = this.extend
    }
    _getCached() {
        if (this._cached !== null)
            return this._cached;
        const t = this._def.shape()
          , r = util.objectKeys(t);
        return this._cached = {
            shape: t,
            keys: r
        },
        this._cached
    }
    _parse(t) {
        if (this._getType(t) !== ZodParsedType.object) {
            const c = this._getOrReturnCtx(t);
            return addIssueToContext(c, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.object,
                received: c.parsedType
            }),
            INVALID
        }
        const {status: n, ctx: a} = this._processInputParams(t)
          , {shape: s, keys: o} = this._getCached()
          , l = [];
        if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip"))
            for (const c in a.data)
                o.includes(c) || l.push(c);
        const u = [];
        for (const c of o) {
            const p = s[c]
              , d = a.data[c];
            u.push({
                key: {
                    status: "valid",
                    value: c
                },
                value: p._parse(new ParseInputLazyPath(a,d,a.path,c)),
                alwaysSet: c in a.data
            })
        }
        if (this._def.catchall instanceof ZodNever) {
            const c = this._def.unknownKeys;
            if (c === "passthrough")
                for (const p of l)
                    u.push({
                        key: {
                            status: "valid",
                            value: p
                        },
                        value: {
                            status: "valid",
                            value: a.data[p]
                        }
                    });
            else if (c === "strict")
                l.length > 0 && (addIssueToContext(a, {
                    code: ZodIssueCode.unrecognized_keys,
                    keys: l
                }),
                n.dirty());
            else if (c !== "strip")
                throw new Error("Internal ZodObject error: invalid unknownKeys value.")
        } else {
            const c = this._def.catchall;
            for (const p of l) {
                const d = a.data[p];
                u.push({
                    key: {
                        status: "valid",
                        value: p
                    },
                    value: c._parse(new ParseInputLazyPath(a,d,a.path,p)),
                    alwaysSet: p in a.data
                })
            }
        }
        return a.common.async ? Promise.resolve().then(async () => {
            const c = [];
            for (const p of u) {
                const d = await p.key
                  , f = await p.value;
                c.push({
                    key: d,
                    value: f,
                    alwaysSet: p.alwaysSet
                })
            }
            return c
        }
        ).then(c => ParseStatus.mergeObjectSync(n, c)) : ParseStatus.mergeObjectSync(n, u)
    }
    get shape() {
        return this._def.shape()
    }
    strict(t) {
        return errorUtil.errToObj,
        new ZodObject({
            ...this._def,
            unknownKeys: "strict",
            ...t !== void 0 ? {
                errorMap: (r, n) => {
                    const a = this._def.errorMap?.(r, n).message ?? n.defaultError;
                    return r.code === "unrecognized_keys" ? {
                        message: errorUtil.errToObj(t).message ?? a
                    } : {
                        message: a
                    }
                }
            } : {}
        })
    }
    strip() {
        return new ZodObject({
            ...this._def,
            unknownKeys: "strip"
        })
    }
    passthrough() {
        return new ZodObject({
            ...this._def,
            unknownKeys: "passthrough"
        })
    }
    extend(t) {
        return new ZodObject({
            ...this._def,
            shape: () => ({
                ...this._def.shape(),
                ...t
            })
        })
    }
    merge(t) {
        return new ZodObject({
            unknownKeys: t._def.unknownKeys,
            catchall: t._def.catchall,
            shape: () => ({
                ...this._def.shape(),
                ...t._def.shape()
            }),
            typeName: ZodFirstPartyTypeKind.ZodObject
        })
    }
    setKey(t, r) {
        return this.augment({
            [t]: r
        })
    }
    catchall(t) {
        return new ZodObject({
            ...this._def,
            catchall: t
        })
    }
    pick(t) {
        const r = {};
        for (const n of util.objectKeys(t))
            t[n] && this.shape[n] && (r[n] = this.shape[n]);
        return new ZodObject({
            ...this._def,
            shape: () => r
        })
    }
    omit(t) {
        const r = {};
        for (const n of util.objectKeys(this.shape))
            t[n] || (r[n] = this.shape[n]);
        return new ZodObject({
            ...this._def,
            shape: () => r
        })
    }
    deepPartial() {
        return deepPartialify(this)
    }
    partial(t) {
        const r = {};
        for (const n of util.objectKeys(this.shape)) {
            const a = this.shape[n];
            t && !t[n] ? r[n] = a : r[n] = a.optional()
        }
        return new ZodObject({
            ...this._def,
            shape: () => r
        })
    }
    required(t) {
        const r = {};
        for (const n of util.objectKeys(this.shape))
            if (t && !t[n])
                r[n] = this.shape[n];
            else {
                let s = this.shape[n];
                for (; s instanceof ZodOptional; )
                    s = s._def.innerType;
                r[n] = s
            }
        return new ZodObject({
            ...this._def,
            shape: () => r
        })
    }
    keyof() {
        return createZodEnum(util.objectKeys(this.shape))
    }
}
ZodObject.create = (e, t) => new ZodObject({
    shape: () => e,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(t)
});
ZodObject.strictCreate = (e, t) => new ZodObject({
    shape: () => e,
    unknownKeys: "strict",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(t)
});
ZodObject.lazycreate = (e, t) => new ZodObject({
    shape: e,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(t)
});
class ZodUnion extends ZodType {
    _parse(t) {
        const {ctx: r} = this._processInputParams(t)
          , n = this._def.options;
        function a(s) {
            for (const l of s)
                if (l.result.status === "valid")
                    return l.result;
            for (const l of s)
                if (l.result.status === "dirty")
                    return r.common.issues.push(...l.ctx.common.issues),
                    l.result;
            const o = s.map(l => new ZodError(l.ctx.common.issues));
            return addIssueToContext(r, {
                code: ZodIssueCode.invalid_union,
                unionErrors: o
            }),
            INVALID
        }
        if (r.common.async)
            return Promise.all(n.map(async s => {
                const o = {
                    ...r,
                    common: {
                        ...r.common,
                        issues: []
                    },
                    parent: null
                };
                return {
                    result: await s._parseAsync({
                        data: r.data,
                        path: r.path,
                        parent: o
                    }),
                    ctx: o
                }
            }
            )).then(a);
        {
            let s;
            const o = [];
            for (const u of n) {
                const c = {
                    ...r,
                    common: {
                        ...r.common,
                        issues: []
                    },
                    parent: null
                }
                  , p = u._parseSync({
                    data: r.data,
                    path: r.path,
                    parent: c
                });
                if (p.status === "valid")
                    return p;
                p.status === "dirty" && !s && (s = {
                    result: p,
                    ctx: c
                }),
                c.common.issues.length && o.push(c.common.issues)
            }
            if (s)
                return r.common.issues.push(...s.ctx.common.issues),
                s.result;
            const l = o.map(u => new ZodError(u));
            return addIssueToContext(r, {
                code: ZodIssueCode.invalid_union,
                unionErrors: l
            }),
            INVALID
        }
    }
    get options() {
        return this._def.options
    }
}
ZodUnion.create = (e, t) => new ZodUnion({
    options: e,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(t)
});
const getDiscriminator = e => e instanceof ZodLazy ? getDiscriminator(e.schema) : e instanceof ZodEffects ? getDiscriminator(e.innerType()) : e instanceof ZodLiteral ? [e.value] : e instanceof ZodEnum ? e.options : e instanceof ZodNativeEnum ? util.objectValues(e.enum) : e instanceof ZodDefault ? getDiscriminator(e._def.innerType) : e instanceof ZodUndefined ? [void 0] : e instanceof ZodNull ? [null] : e instanceof ZodOptional ? [void 0, ...getDiscriminator(e.unwrap())] : e instanceof ZodNullable ? [null, ...getDiscriminator(e.unwrap())] : e instanceof ZodBranded || e instanceof ZodReadonly ? getDiscriminator(e.unwrap()) : e instanceof ZodCatch ? getDiscriminator(e._def.innerType) : [];
class ZodDiscriminatedUnion extends ZodType {
    _parse(t) {
        const {ctx: r} = this._processInputParams(t);
        if (r.parsedType !== ZodParsedType.object)
            return addIssueToContext(r, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.object,
                received: r.parsedType
            }),
            INVALID;
        const n = this.discriminator
          , a = r.data[n]
          , s = this.optionsMap.get(a);
        return s ? r.common.async ? s._parseAsync({
            data: r.data,
            path: r.path,
            parent: r
        }) : s._parseSync({
            data: r.data,
            path: r.path,
            parent: r
        }) : (addIssueToContext(r, {
            code: ZodIssueCode.invalid_union_discriminator,
            options: Array.from(this.optionsMap.keys()),
            path: [n]
        }),
        INVALID)
    }
    get discriminator() {
        return this._def.discriminator
    }
    get options() {
        return this._def.options
    }
    get optionsMap() {
        return this._def.optionsMap
    }
    static create(t, r, n) {
        const a = new Map;
        for (const s of r) {
            const o = getDiscriminator(s.shape[t]);
            if (!o.length)
                throw new Error(`A discriminator value for key \`${t}\` could not be extracted from all schema options`);
            for (const l of o) {
                if (a.has(l))
                    throw new Error(`Discriminator property ${String(t)} has duplicate value ${String(l)}`);
                a.set(l, s)
            }
        }
        return new ZodDiscriminatedUnion({
            typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
            discriminator: t,
            options: r,
            optionsMap: a,
            ...processCreateParams(n)
        })
    }
}
function mergeValues(e, t) {
    const r = getParsedType(e)
      , n = getParsedType(t);
    if (e === t)
        return {
            valid: !0,
            data: e
        };
    if (r === ZodParsedType.object && n === ZodParsedType.object) {
        const a = util.objectKeys(t)
          , s = util.objectKeys(e).filter(l => a.indexOf(l) !== -1)
          , o = {
            ...e,
            ...t
        };
        for (const l of s) {
            const u = mergeValues(e[l], t[l]);
            if (!u.valid)
                return {
                    valid: !1
                };
            o[l] = u.data
        }
        return {
            valid: !0,
            data: o
        }
    } else if (r === ZodParsedType.array && n === ZodParsedType.array) {
        if (e.length !== t.length)
            return {
                valid: !1
            };
        const a = [];
        for (let s = 0; s < e.length; s++) {
            const o = e[s]
              , l = t[s]
              , u = mergeValues(o, l);
            if (!u.valid)
                return {
                    valid: !1
                };
            a.push(u.data)
        }
        return {
            valid: !0,
            data: a
        }
    } else
        return r === ZodParsedType.date && n === ZodParsedType.date && +e == +t ? {
            valid: !0,
            data: e
        } : {
            valid: !1
        }
}
class ZodIntersection extends ZodType {
    _parse(t) {
        const {status: r, ctx: n} = this._processInputParams(t)
          , a = (s, o) => {
            if (isAborted(s) || isAborted(o))
                return INVALID;
            const l = mergeValues(s.value, o.value);
            return l.valid ? ((isDirty(s) || isDirty(o)) && r.dirty(),
            {
                status: r.value,
                value: l.data
            }) : (addIssueToContext(n, {
                code: ZodIssueCode.invalid_intersection_types
            }),
            INVALID)
        }
        ;
        return n.common.async ? Promise.all([this._def.left._parseAsync({
            data: n.data,
            path: n.path,
            parent: n
        }), this._def.right._parseAsync({
            data: n.data,
            path: n.path,
            parent: n
        })]).then( ([s,o]) => a(s, o)) : a(this._def.left._parseSync({
            data: n.data,
            path: n.path,
            parent: n
        }), this._def.right._parseSync({
            data: n.data,
            path: n.path,
            parent: n
        }))
    }
}
ZodIntersection.create = (e, t, r) => new ZodIntersection({
    left: e,
    right: t,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(r)
});
class ZodTuple extends ZodType {
    _parse(t) {
        const {status: r, ctx: n} = this._processInputParams(t);
        if (n.parsedType !== ZodParsedType.array)
            return addIssueToContext(n, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.array,
                received: n.parsedType
            }),
            INVALID;
        if (n.data.length < this._def.items.length)
            return addIssueToContext(n, {
                code: ZodIssueCode.too_small,
                minimum: this._def.items.length,
                inclusive: !0,
                exact: !1,
                type: "array"
            }),
            INVALID;
        !this._def.rest && n.data.length > this._def.items.length && (addIssueToContext(n, {
            code: ZodIssueCode.too_big,
            maximum: this._def.items.length,
            inclusive: !0,
            exact: !1,
            type: "array"
        }),
        r.dirty());
        const s = [...n.data].map( (o, l) => {
            const u = this._def.items[l] || this._def.rest;
            return u ? u._parse(new ParseInputLazyPath(n,o,n.path,l)) : null
        }
        ).filter(o => !!o);
        return n.common.async ? Promise.all(s).then(o => ParseStatus.mergeArray(r, o)) : ParseStatus.mergeArray(r, s)
    }
    get items() {
        return this._def.items
    }
    rest(t) {
        return new ZodTuple({
            ...this._def,
            rest: t
        })
    }
}
ZodTuple.create = (e, t) => {
    if (!Array.isArray(e))
        throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
    return new ZodTuple({
        items: e,
        typeName: ZodFirstPartyTypeKind.ZodTuple,
        rest: null,
        ...processCreateParams(t)
    })
}
;
class ZodRecord extends ZodType {
    get keySchema() {
        return this._def.keyType
    }
    get valueSchema() {
        return this._def.valueType
    }
    _parse(t) {
        const {status: r, ctx: n} = this._processInputParams(t);
        if (n.parsedType !== ZodParsedType.object)
            return addIssueToContext(n, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.object,
                received: n.parsedType
            }),
            INVALID;
        const a = []
          , s = this._def.keyType
          , o = this._def.valueType;
        for (const l in n.data)
            a.push({
                key: s._parse(new ParseInputLazyPath(n,l,n.path,l)),
                value: o._parse(new ParseInputLazyPath(n,n.data[l],n.path,l)),
                alwaysSet: l in n.data
            });
        return n.common.async ? ParseStatus.mergeObjectAsync(r, a) : ParseStatus.mergeObjectSync(r, a)
    }
    get element() {
        return this._def.valueType
    }
    static create(t, r, n) {
        return r instanceof ZodType ? new ZodRecord({
            keyType: t,
            valueType: r,
            typeName: ZodFirstPartyTypeKind.ZodRecord,
            ...processCreateParams(n)
        }) : new ZodRecord({
            keyType: ZodString.create(),
            valueType: t,
            typeName: ZodFirstPartyTypeKind.ZodRecord,
            ...processCreateParams(r)
        })
    }
}
class ZodMap extends ZodType {
    get keySchema() {
        return this._def.keyType
    }
    get valueSchema() {
        return this._def.valueType
    }
    _parse(t) {
        const {status: r, ctx: n} = this._processInputParams(t);
        if (n.parsedType !== ZodParsedType.map)
            return addIssueToContext(n, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.map,
                received: n.parsedType
            }),
            INVALID;
        const a = this._def.keyType
          , s = this._def.valueType
          , o = [...n.data.entries()].map( ([l,u], c) => ({
            key: a._parse(new ParseInputLazyPath(n,l,n.path,[c, "key"])),
            value: s._parse(new ParseInputLazyPath(n,u,n.path,[c, "value"]))
        }));
        if (n.common.async) {
            const l = new Map;
            return Promise.resolve().then(async () => {
                for (const u of o) {
                    const c = await u.key
                      , p = await u.value;
                    if (c.status === "aborted" || p.status === "aborted")
                        return INVALID;
                    (c.status === "dirty" || p.status === "dirty") && r.dirty(),
                    l.set(c.value, p.value)
                }
                return {
                    status: r.value,
                    value: l
                }
            }
            )
        } else {
            const l = new Map;
            for (const u of o) {
                const c = u.key
                  , p = u.value;
                if (c.status === "aborted" || p.status === "aborted")
                    return INVALID;
                (c.status === "dirty" || p.status === "dirty") && r.dirty(),
                l.set(c.value, p.value)
            }
            return {
                status: r.value,
                value: l
            }
        }
    }
}
ZodMap.create = (e, t, r) => new ZodMap({
    valueType: t,
    keyType: e,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(r)
});
class ZodSet extends ZodType {
    _parse(t) {
        const {status: r, ctx: n} = this._processInputParams(t);
        if (n.parsedType !== ZodParsedType.set)
            return addIssueToContext(n, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.set,
                received: n.parsedType
            }),
            INVALID;
        const a = this._def;
        a.minSize !== null && n.data.size < a.minSize.value && (addIssueToContext(n, {
            code: ZodIssueCode.too_small,
            minimum: a.minSize.value,
            type: "set",
            inclusive: !0,
            exact: !1,
            message: a.minSize.message
        }),
        r.dirty()),
        a.maxSize !== null && n.data.size > a.maxSize.value && (addIssueToContext(n, {
            code: ZodIssueCode.too_big,
            maximum: a.maxSize.value,
            type: "set",
            inclusive: !0,
            exact: !1,
            message: a.maxSize.message
        }),
        r.dirty());
        const s = this._def.valueType;
        function o(u) {
            const c = new Set;
            for (const p of u) {
                if (p.status === "aborted")
                    return INVALID;
                p.status === "dirty" && r.dirty(),
                c.add(p.value)
            }
            return {
                status: r.value,
                value: c
            }
        }
        const l = [...n.data.values()].map( (u, c) => s._parse(new ParseInputLazyPath(n,u,n.path,c)));
        return n.common.async ? Promise.all(l).then(u => o(u)) : o(l)
    }
    min(t, r) {
        return new ZodSet({
            ...this._def,
            minSize: {
                value: t,
                message: errorUtil.toString(r)
            }
        })
    }
    max(t, r) {
        return new ZodSet({
            ...this._def,
            maxSize: {
                value: t,
                message: errorUtil.toString(r)
            }
        })
    }
    size(t, r) {
        return this.min(t, r).max(t, r)
    }
    nonempty(t) {
        return this.min(1, t)
    }
}
ZodSet.create = (e, t) => new ZodSet({
    valueType: e,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(t)
});
class ZodLazy extends ZodType {
    get schema() {
        return this._def.getter()
    }
    _parse(t) {
        const {ctx: r} = this._processInputParams(t);
        return this._def.getter()._parse({
            data: r.data,
            path: r.path,
            parent: r
        })
    }
}
ZodLazy.create = (e, t) => new ZodLazy({
    getter: e,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(t)
});
class ZodLiteral extends ZodType {
    _parse(t) {
        if (t.data !== this._def.value) {
            const r = this._getOrReturnCtx(t);
            return addIssueToContext(r, {
                received: r.data,
                code: ZodIssueCode.invalid_literal,
                expected: this._def.value
            }),
            INVALID
        }
        return {
            status: "valid",
            value: t.data
        }
    }
    get value() {
        return this._def.value
    }
}
ZodLiteral.create = (e, t) => new ZodLiteral({
    value: e,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(t)
});
function createZodEnum(e, t) {
    return new ZodEnum({
        values: e,
        typeName: ZodFirstPartyTypeKind.ZodEnum,
        ...processCreateParams(t)
    })
}
class ZodEnum extends ZodType {
    _parse(t) {
        if (typeof t.data != "string") {
            const r = this._getOrReturnCtx(t)
              , n = this._def.values;
            return addIssueToContext(r, {
                expected: util.joinValues(n),
                received: r.parsedType,
                code: ZodIssueCode.invalid_type
            }),
            INVALID
        }
        if (this._cache || (this._cache = new Set(this._def.values)),
        !this._cache.has(t.data)) {
            const r = this._getOrReturnCtx(t)
              , n = this._def.values;
            return addIssueToContext(r, {
                received: r.data,
                code: ZodIssueCode.invalid_enum_value,
                options: n
            }),
            INVALID
        }
        return OK(t.data)
    }
    get options() {
        return this._def.values
    }
    get enum() {
        const t = {};
        for (const r of this._def.values)
            t[r] = r;
        return t
    }
    get Values() {
        const t = {};
        for (const r of this._def.values)
            t[r] = r;
        return t
    }
    get Enum() {
        const t = {};
        for (const r of this._def.values)
            t[r] = r;
        return t
    }
    extract(t, r=this._def) {
        return ZodEnum.create(t, {
            ...this._def,
            ...r
        })
    }
    exclude(t, r=this._def) {
        return ZodEnum.create(this.options.filter(n => !t.includes(n)), {
            ...this._def,
            ...r
        })
    }
}
ZodEnum.create = createZodEnum;
class ZodNativeEnum extends ZodType {
    _parse(t) {
        const r = util.getValidEnumValues(this._def.values)
          , n = this._getOrReturnCtx(t);
        if (n.parsedType !== ZodParsedType.string && n.parsedType !== ZodParsedType.number) {
            const a = util.objectValues(r);
            return addIssueToContext(n, {
                expected: util.joinValues(a),
                received: n.parsedType,
                code: ZodIssueCode.invalid_type
            }),
            INVALID
        }
        if (this._cache || (this._cache = new Set(util.getValidEnumValues(this._def.values))),
        !this._cache.has(t.data)) {
            const a = util.objectValues(r);
            return addIssueToContext(n, {
                received: n.data,
                code: ZodIssueCode.invalid_enum_value,
                options: a
            }),
            INVALID
        }
        return OK(t.data)
    }
    get enum() {
        return this._def.values
    }
}
ZodNativeEnum.create = (e, t) => new ZodNativeEnum({
    values: e,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(t)
});
class ZodPromise extends ZodType {
    unwrap() {
        return this._def.type
    }
    _parse(t) {
        const {ctx: r} = this._processInputParams(t);
        if (r.parsedType !== ZodParsedType.promise && r.common.async === !1)
            return addIssueToContext(r, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.promise,
                received: r.parsedType
            }),
            INVALID;
        const n = r.parsedType === ZodParsedType.promise ? r.data : Promise.resolve(r.data);
        return OK(n.then(a => this._def.type.parseAsync(a, {
            path: r.path,
            errorMap: r.common.contextualErrorMap
        })))
    }
}
ZodPromise.create = (e, t) => new ZodPromise({
    type: e,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(t)
});
class ZodEffects extends ZodType {
    innerType() {
        return this._def.schema
    }
    sourceType() {
        return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema
    }
    _parse(t) {
        const {status: r, ctx: n} = this._processInputParams(t)
          , a = this._def.effect || null
          , s = {
            addIssue: o => {
                addIssueToContext(n, o),
                o.fatal ? r.abort() : r.dirty()
            }
            ,
            get path() {
                return n.path
            }
        };
        if (s.addIssue = s.addIssue.bind(s),
        a.type === "preprocess") {
            const o = a.transform(n.data, s);
            if (n.common.async)
                return Promise.resolve(o).then(async l => {
                    if (r.value === "aborted")
                        return INVALID;
                    const u = await this._def.schema._parseAsync({
                        data: l,
                        path: n.path,
                        parent: n
                    });
                    return u.status === "aborted" ? INVALID : u.status === "dirty" || r.value === "dirty" ? DIRTY(u.value) : u
                }
                );
            {
                if (r.value === "aborted")
                    return INVALID;
                const l = this._def.schema._parseSync({
                    data: o,
                    path: n.path,
                    parent: n
                });
                return l.status === "aborted" ? INVALID : l.status === "dirty" || r.value === "dirty" ? DIRTY(l.value) : l
            }
        }
        if (a.type === "refinement") {
            const o = l => {
                const u = a.refinement(l, s);
                if (n.common.async)
                    return Promise.resolve(u);
                if (u instanceof Promise)
                    throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
                return l
            }
            ;
            if (n.common.async === !1) {
                const l = this._def.schema._parseSync({
                    data: n.data,
                    path: n.path,
                    parent: n
                });
                return l.status === "aborted" ? INVALID : (l.status === "dirty" && r.dirty(),
                o(l.value),
                {
                    status: r.value,
                    value: l.value
                })
            } else
                return this._def.schema._parseAsync({
                    data: n.data,
                    path: n.path,
                    parent: n
                }).then(l => l.status === "aborted" ? INVALID : (l.status === "dirty" && r.dirty(),
                o(l.value).then( () => ({
                    status: r.value,
                    value: l.value
                }))))
        }
        if (a.type === "transform")
            if (n.common.async === !1) {
                const o = this._def.schema._parseSync({
                    data: n.data,
                    path: n.path,
                    parent: n
                });
                if (!isValid(o))
                    return INVALID;
                const l = a.transform(o.value, s);
                if (l instanceof Promise)
                    throw new Error("Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.");
                return {
                    status: r.value,
                    value: l
                }
            } else
                return this._def.schema._parseAsync({
                    data: n.data,
                    path: n.path,
                    parent: n
                }).then(o => isValid(o) ? Promise.resolve(a.transform(o.value, s)).then(l => ({
                    status: r.value,
                    value: l
                })) : INVALID);
        util.assertNever(a)
    }
}
ZodEffects.create = (e, t, r) => new ZodEffects({
    schema: e,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect: t,
    ...processCreateParams(r)
});
ZodEffects.createWithPreprocess = (e, t, r) => new ZodEffects({
    schema: t,
    effect: {
        type: "preprocess",
        transform: e
    },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams(r)
});
class ZodOptional extends ZodType {
    _parse(t) {
        return this._getType(t) === ZodParsedType.undefined ? OK(void 0) : this._def.innerType._parse(t)
    }
    unwrap() {
        return this._def.innerType
    }
}
ZodOptional.create = (e, t) => new ZodOptional({
    innerType: e,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(t)
});
class ZodNullable extends ZodType {
    _parse(t) {
        return this._getType(t) === ZodParsedType.null ? OK(null) : this._def.innerType._parse(t)
    }
    unwrap() {
        return this._def.innerType
    }
}
ZodNullable.create = (e, t) => new ZodNullable({
    innerType: e,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(t)
});
class ZodDefault extends ZodType {
    _parse(t) {
        const {ctx: r} = this._processInputParams(t);
        let n = r.data;
        return r.parsedType === ZodParsedType.undefined && (n = this._def.defaultValue()),
        this._def.innerType._parse({
            data: n,
            path: r.path,
            parent: r
        })
    }
    removeDefault() {
        return this._def.innerType
    }
}
ZodDefault.create = (e, t) => new ZodDefault({
    innerType: e,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof t.default == "function" ? t.default : () => t.default,
    ...processCreateParams(t)
});
class ZodCatch extends ZodType {
    _parse(t) {
        const {ctx: r} = this._processInputParams(t)
          , n = {
            ...r,
            common: {
                ...r.common,
                issues: []
            }
        }
          , a = this._def.innerType._parse({
            data: n.data,
            path: n.path,
            parent: {
                ...n
            }
        });
        return isAsync(a) ? a.then(s => ({
            status: "valid",
            value: s.status === "valid" ? s.value : this._def.catchValue({
                get error() {
                    return new ZodError(n.common.issues)
                },
                input: n.data
            })
        })) : {
            status: "valid",
            value: a.status === "valid" ? a.value : this._def.catchValue({
                get error() {
                    return new ZodError(n.common.issues)
                },
                input: n.data
            })
        }
    }
    removeCatch() {
        return this._def.innerType
    }
}
ZodCatch.create = (e, t) => new ZodCatch({
    innerType: e,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof t.catch == "function" ? t.catch : () => t.catch,
    ...processCreateParams(t)
});
class ZodNaN extends ZodType {
    _parse(t) {
        if (this._getType(t) !== ZodParsedType.nan) {
            const n = this._getOrReturnCtx(t);
            return addIssueToContext(n, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.nan,
                received: n.parsedType
            }),
            INVALID
        }
        return {
            status: "valid",
            value: t.data
        }
    }
}
ZodNaN.create = e => new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(e)
});
class ZodBranded extends ZodType {
    _parse(t) {
        const {ctx: r} = this._processInputParams(t)
          , n = r.data;
        return this._def.type._parse({
            data: n,
            path: r.path,
            parent: r
        })
    }
    unwrap() {
        return this._def.type
    }
}
class ZodPipeline extends ZodType {
    _parse(t) {
        const {status: r, ctx: n} = this._processInputParams(t);
        if (n.common.async)
            return (async () => {
                const s = await this._def.in._parseAsync({
                    data: n.data,
                    path: n.path,
                    parent: n
                });
                return s.status === "aborted" ? INVALID : s.status === "dirty" ? (r.dirty(),
                DIRTY(s.value)) : this._def.out._parseAsync({
                    data: s.value,
                    path: n.path,
                    parent: n
                })
            }
            )();
        {
            const a = this._def.in._parseSync({
                data: n.data,
                path: n.path,
                parent: n
            });
            return a.status === "aborted" ? INVALID : a.status === "dirty" ? (r.dirty(),
            {
                status: "dirty",
                value: a.value
            }) : this._def.out._parseSync({
                data: a.value,
                path: n.path,
                parent: n
            })
        }
    }
    static create(t, r) {
        return new ZodPipeline({
            in: t,
            out: r,
            typeName: ZodFirstPartyTypeKind.ZodPipeline
        })
    }
}
class ZodReadonly extends ZodType {
    _parse(t) {
        const r = this._def.innerType._parse(t)
          , n = a => (isValid(a) && (a.value = Object.freeze(a.value)),
        a);
        return isAsync(r) ? r.then(a => n(a)) : n(r)
    }
    unwrap() {
        return this._def.innerType
    }
}
ZodReadonly.create = (e, t) => new ZodReadonly({
    innerType: e,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(t)
});
function cleanParams(e, t) {
    const r = typeof e == "function" ? e(t) : typeof e == "string" ? {
        message: e
    } : e;
    return typeof r == "string" ? {
        message: r
    } : r
}
function custom(e, t={}, r) {
    return e ? ZodAny.create().superRefine( (n, a) => {
        const s = e(n);
        if (s instanceof Promise)
            return s.then(o => {
                if (!o) {
                    const l = cleanParams(t, n)
                      , u = l.fatal ?? r ?? !0;
                    a.addIssue({
                        code: "custom",
                        ...l,
                        fatal: u
                    })
                }
            }
            );
        if (!s) {
            const o = cleanParams(t, n)
              , l = o.fatal ?? r ?? !0;
            a.addIssue({
                code: "custom",
                ...o,
                fatal: l
            })
        }
    }
    ) : ZodAny.create()
}
var ZodFirstPartyTypeKind;
(function(e) {
    e.ZodString = "ZodString",
    e.ZodNumber = "ZodNumber",
    e.ZodNaN = "ZodNaN",
    e.ZodBigInt = "ZodBigInt",
    e.ZodBoolean = "ZodBoolean",
    e.ZodDate = "ZodDate",
    e.ZodSymbol = "ZodSymbol",
    e.ZodUndefined = "ZodUndefined",
    e.ZodNull = "ZodNull",
    e.ZodAny = "ZodAny",
    e.ZodUnknown = "ZodUnknown",
    e.ZodNever = "ZodNever",
    e.ZodVoid = "ZodVoid",
    e.ZodArray = "ZodArray",
    e.ZodObject = "ZodObject",
    e.ZodUnion = "ZodUnion",
    e.ZodDiscriminatedUnion = "ZodDiscriminatedUnion",
    e.ZodIntersection = "ZodIntersection",
    e.ZodTuple = "ZodTuple",
    e.ZodRecord = "ZodRecord",
    e.ZodMap = "ZodMap",
    e.ZodSet = "ZodSet",
    e.ZodFunction = "ZodFunction",
    e.ZodLazy = "ZodLazy",
    e.ZodLiteral = "ZodLiteral",
    e.ZodEnum = "ZodEnum",
    e.ZodEffects = "ZodEffects",
    e.ZodNativeEnum = "ZodNativeEnum",
    e.ZodOptional = "ZodOptional",
    e.ZodNullable = "ZodNullable",
    e.ZodDefault = "ZodDefault",
    e.ZodCatch = "ZodCatch",
    e.ZodPromise = "ZodPromise",
    e.ZodBranded = "ZodBranded",
    e.ZodPipeline = "ZodPipeline",
    e.ZodReadonly = "ZodReadonly"
}
)(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
const instanceOfType = (e, t={
    message: `Input not instance of ${e.name}`
}) => custom(r => r instanceof e, t)
  , stringType = ZodString.create
  , numberType = ZodNumber.create
  , booleanType = ZodBoolean.create
  , nullType = ZodNull.create;
ZodAny.create;
const unknownType = ZodUnknown.create;
ZodNever.create;
const arrayType = ZodArray.create
  , objectType = ZodObject.create
  , unionType = ZodUnion.create
  , discriminatedUnionType = ZodDiscriminatedUnion.create;
ZodIntersection.create;
ZodTuple.create;
const recordType = ZodRecord.create
  , literalType = ZodLiteral.create
  , enumType = ZodEnum.create;
ZodPromise.create;
ZodOptional.create;
ZodNullable.create;
const FREE_MESSAGE_LIMIT = 10
  , PlanTierSchema = enumType(["standard", "pro"])
  , UsageStatsSchema = objectType({
    percentUsed: numberType(),
    resetAt: numberType(),
    budgetDollars: numberType(),
    planTier: PlanTierSchema.nullable()
})
  , SubscriptionStatusSchema = objectType({
    hasSubscription: booleanType(),
    subscriptionStatus: stringType().nullable(),
    plan: stringType().nullable(),
    planTier: PlanTierSchema.nullable(),
    endsAt: stringType().nullable(),
    freeMessagesUsed: numberType(),
    freeMessagesLimit: numberType()
})
  , AnnouncementSchema = objectType({
    id: stringType(),
    message: stringType(),
    type: enumType(["info", "warning", "error"]),
    link: objectType({
        text: stringType(),
        url: stringType()
    }).optional(),
    targetExtensionVersions: objectType({
        min: stringType().optional(),
        max: stringType().optional()
    }).optional()
})
  , WebSearchResultSchema = objectType({
    results: arrayType(objectType({
        title: stringType(),
        url: stringType(),
        text: stringType()
    }))
})
  , PdfEvidenceSchema = objectType({
    snippet: stringType(),
    page: numberType().int().positive().optional()
})
  , PdfReadInputSchema = objectType({
    query: stringType().min(1),
    source: discriminatedUnionType("type", [objectType({
        type: literalType("url"),
        url: stringType().url()
    }), objectType({
        type: literalType("file"),
        file: instanceOfType(Blob),
        filename: stringType().min(1)
    })])
})
  , PdfReadOutputSchema = objectType({
    answer: stringType(),
    evidence: arrayType(PdfEvidenceSchema),
    metadata: objectType({
        sourceType: enumType(["url", "file"]),
        byteLength: numberType().int().nonnegative(),
        model: stringType()
    })
})
  , DocReadInputSchema = objectType({
    file: instanceOfType(Blob),
    fileName: stringType().min(1),
    mimeType: stringType().min(1),
    query: stringType().min(1).optional(),
    extractOnly: booleanType().optional()
})
  , DocEvidenceSchema = objectType({
    snippet: stringType(),
    section: stringType().optional()
})
  , DocReadOutputSchema = objectType({
    content: stringType(),
    answer: stringType().optional(),
    evidence: arrayType(DocEvidenceSchema),
    metadata: objectType({
        extractedChars: numberType().int().nonnegative(),
        extraction: literalType("mammoth"),
        model: stringType().optional(),
        truncated: booleanType()
    })
})
  , ParsedSheetCellValueSchema = stringType()
  , SheetWorkbookSheetSchema = objectType({
    name: stringType(),
    rowCount: numberType().int().nonnegative(),
    columnCount: numberType().int().nonnegative(),
    headers: arrayType(stringType())
})
  , SheetReadInputSchema = objectType({
    file: instanceOfType(Blob),
    fileName: stringType().min(1),
    mimeType: stringType().min(1),
    query: stringType().min(1).optional(),
    sheetName: stringType().min(1).optional(),
    rowStart: numberType().int().positive().optional(),
    rowLimit: numberType().int().positive().max(500).optional(),
    previewOnly: booleanType().optional()
})
  , SheetEvidenceSchema = objectType({
    sheet: stringType(),
    rowStart: numberType().int().positive(),
    rowEnd: numberType().int().positive(),
    columns: arrayType(stringType()).optional()
})
  , SheetReadOutputSchema = objectType({
    answer: stringType().optional(),
    evidence: arrayType(SheetEvidenceSchema),
    workbook: objectType({
        sheets: arrayType(SheetWorkbookSheetSchema)
    }),
    preview: objectType({
        sheetName: stringType(),
        rowStart: numberType().int().positive(),
        rowEnd: numberType().int().positive(),
        rows: arrayType(arrayType(ParsedSheetCellValueSchema))
    }),
    metadata: objectType({
        format: enumType(["xlsx", "csv"]),
        parser: enumType(["xlsx", "papaparse"]),
        truncated: booleanType()
    })
})
  , BugReportMetadataSchema = objectType({
    extensionVersion: stringType().optional(),
    platform: stringType().optional(),
    userAgent: stringType().optional(),
    currentUrl: stringType().optional()
})
  , BugReportSubmitInputSchema = objectType({
    title: stringType().min(1).max(200),
    description: stringType().min(1).max(5e3),
    metadata: BugReportMetadataSchema.optional()
})
  , BugReportSubmitOutputSchema = objectType({
    id: stringType(),
    createdAt: stringType()
})
  , VoiceTranscribeInputSchema = objectType({
    file: instanceOfType(Blob)
})
  , VoiceTranscribeOutputSchema = objectType({
    text: stringType()
})
  , QuickCommandTypeaheadPageMetadataSchema = objectType({
    url: stringType().min(1).max(2e3),
    hostname: stringType().min(1).max(255),
    pathname: stringType().min(1).max(2e3),
    title: stringType().max(300).optional(),
    language: stringType().max(32).optional(),
    selectedText: stringType().max(500).optional(),
    focusedElement: objectType({
        tagName: stringType().max(64).optional(),
        type: stringType().max(64).optional(),
        placeholder: stringType().max(200).optional(),
        ariaLabel: stringType().max(200).optional(),
        name: stringType().max(200).optional()
    }).optional()
})
  , QuickCommandTypeaheadInputSchema = objectType({
    query: stringType().trim().max(200),
    page: QuickCommandTypeaheadPageMetadataSchema
})
  , QUICK_COMMAND_SUGGESTION_ICONS = ["sparkles", "globe", "mouse-pointer-click", "keyboard", "type", "file-text", "table", "languages", "brain", "list-checks", "terminal", "arrow-right"]
  , QuickCommandSuggestionIconSchema = enumType(QUICK_COMMAND_SUGGESTION_ICONS)
  , QuickCommandSuggestionSchema = objectType({
    icon: QuickCommandSuggestionIconSchema,
    text: stringType().trim().min(1).max(200)
})
  , QuickCommandTypeaheadOutputSchema = objectType({
    suggestions: arrayType(QuickCommandSuggestionSchema).max(5)
})
  , ReferralStatsSchema = objectType({
    totalInvites: numberType(),
    pendingInvites: numberType(),
    qualifiedInvites: numberType(),
    rewardedInvites: numberType(),
    creditsEarnedCents: numberType()
})
  , ReferralEntrySchema = objectType({
    id: stringType(),
    invitedUserId: stringType(),
    invitedEmail: stringType().nullable(),
    status: stringType(),
    reason: stringType().nullable(),
    createdAt: stringType(),
    qualifiedAt: stringType().nullable(),
    rewardedAt: stringType().nullable(),
    inviterRewardStatus: stringType().nullable(),
    inviteeRewardStatus: stringType().nullable()
})
  , ReferralProgramSchema = objectType({
    code: stringType(),
    inviteLink: stringType(),
    stats: ReferralStatsSchema,
    referrals: arrayType(ReferralEntrySchema)
})
  , LatestReleaseSchema = objectType({
    slug: stringType(),
    title: stringType(),
    version: stringType(),
    date: stringType()
})
  , SheetsScopeSchema = stringType()
  , SheetCellValueSchema = unionType([stringType(), numberType(), booleanType(), nullType()])
  , SheetValuesSchema = arrayType(arrayType(SheetCellValueSchema))
  , SheetMajorDimensionSchema = enumType(["ROWS", "COLUMNS"])
  , SheetValueInputOptionSchema = enumType(["RAW", "USER_ENTERED"])
  , SheetValueRenderOptionSchema = enumType(["FORMATTED_VALUE", "UNFORMATTED_VALUE", "FORMULA"])
  , SheetDateTimeRenderOptionSchema = enumType(["SERIAL_NUMBER", "FORMATTED_STRING"])
  , WorkspaceStatusSchema = objectType({
    sheetsConnected: booleanType(),
    scopes: arrayType(SheetsScopeSchema),
    accountEmail: stringType().nullable()
})
  , WorkspaceSheetInfoSchema = objectType({
    sheetId: numberType().int().nonnegative(),
    title: stringType(),
    index: numberType().int().nonnegative(),
    hidden: booleanType(),
    rowCount: numberType().int().nonnegative().nullable(),
    columnCount: numberType().int().nonnegative().nullable()
})
  , WorkspaceNamedRangeSchema = objectType({
    name: stringType(),
    sheetId: numberType().int().nonnegative().nullable(),
    startRowIndex: numberType().int().nonnegative().nullable(),
    endRowIndex: numberType().int().nonnegative().nullable(),
    startColumnIndex: numberType().int().nonnegative().nullable(),
    endColumnIndex: numberType().int().nonnegative().nullable()
})
  , WorkspaceGetSpreadsheetInputSchema = objectType({
    spreadsheetId: stringType().optional()
})
  , WorkspaceGetSpreadsheetOutputSchema = objectType({
    spreadsheetId: stringType(),
    title: stringType(),
    url: stringType().nullable(),
    sheets: arrayType(WorkspaceSheetInfoSchema),
    namedRanges: arrayType(WorkspaceNamedRangeSchema)
})
  , WorkspaceCreateSpreadsheetInputSchema = objectType({
    title: stringType().min(1),
    locale: stringType().optional(),
    timeZone: stringType().optional(),
    sheetTitle: stringType().optional(),
    rowCount: numberType().int().min(1).max(1e7).optional(),
    columnCount: numberType().int().min(1).max(18278).optional()
})
  , WorkspaceCreateSpreadsheetOutputSchema = objectType({
    spreadsheetId: stringType(),
    title: stringType(),
    url: stringType().nullable(),
    sheets: arrayType(WorkspaceSheetInfoSchema)
})
  , WorkspaceListSheetsInputSchema = objectType({
    spreadsheetId: stringType().optional()
})
  , WorkspaceListSheetsOutputSchema = objectType({
    spreadsheetId: stringType(),
    title: stringType(),
    sheets: arrayType(WorkspaceSheetInfoSchema)
})
  , WorkspaceReadRangeInputSchema = objectType({
    spreadsheetId: stringType().optional(),
    range: stringType().min(1),
    majorDimension: SheetMajorDimensionSchema.optional(),
    valueRenderOption: SheetValueRenderOptionSchema.optional(),
    dateTimeRenderOption: SheetDateTimeRenderOptionSchema.optional()
})
  , WorkspaceReadRangeOutputSchema = objectType({
    spreadsheetId: stringType(),
    range: stringType(),
    majorDimension: SheetMajorDimensionSchema.optional(),
    values: SheetValuesSchema
})
  , WorkspaceBatchReadInputSchema = objectType({
    spreadsheetId: stringType().optional(),
    ranges: arrayType(stringType().min(1)).min(1),
    majorDimension: SheetMajorDimensionSchema.optional(),
    valueRenderOption: SheetValueRenderOptionSchema.optional(),
    dateTimeRenderOption: SheetDateTimeRenderOptionSchema.optional()
})
  , WorkspaceValueRangeSchema = objectType({
    range: stringType(),
    majorDimension: SheetMajorDimensionSchema.optional(),
    values: SheetValuesSchema
})
  , WorkspaceBatchReadOutputSchema = objectType({
    spreadsheetId: stringType(),
    valueRanges: arrayType(WorkspaceValueRangeSchema)
})
  , WorkspaceWriteRangeInputSchema = objectType({
    spreadsheetId: stringType().optional(),
    range: stringType().min(1),
    values: SheetValuesSchema,
    valueInputOption: SheetValueInputOptionSchema.optional()
})
  , WorkspaceWriteRangeOutputSchema = objectType({
    spreadsheetId: stringType(),
    updatedRange: stringType(),
    updatedRows: numberType().int().nonnegative(),
    updatedColumns: numberType().int().nonnegative(),
    updatedCells: numberType().int().nonnegative()
})
  , WorkspaceBatchWriteInputSchema = objectType({
    spreadsheetId: stringType().optional(),
    data: arrayType(objectType({
        range: stringType().min(1),
        values: SheetValuesSchema,
        majorDimension: SheetMajorDimensionSchema.optional()
    })).min(1),
    valueInputOption: SheetValueInputOptionSchema.optional(),
    includeValuesInResponse: booleanType().optional(),
    responseValueRenderOption: SheetValueRenderOptionSchema.optional(),
    responseDateTimeRenderOption: SheetDateTimeRenderOptionSchema.optional()
})
  , WorkspaceBatchWriteResponseSchema = objectType({
    updatedRange: stringType(),
    updatedRows: numberType().int().nonnegative(),
    updatedColumns: numberType().int().nonnegative(),
    updatedCells: numberType().int().nonnegative(),
    updatedData: objectType({
        range: stringType(),
        majorDimension: SheetMajorDimensionSchema.optional(),
        values: SheetValuesSchema
    }).optional()
})
  , WorkspaceBatchWriteOutputSchema = objectType({
    spreadsheetId: stringType(),
    totalUpdatedRows: numberType().int().nonnegative(),
    totalUpdatedColumns: numberType().int().nonnegative(),
    totalUpdatedCells: numberType().int().nonnegative(),
    totalUpdatedSheets: numberType().int().nonnegative(),
    responses: arrayType(WorkspaceBatchWriteResponseSchema)
})
  , WorkspaceAppendRowsInputSchema = objectType({
    spreadsheetId: stringType().optional(),
    range: stringType().min(1),
    values: SheetValuesSchema,
    valueInputOption: SheetValueInputOptionSchema.optional()
})
  , WorkspaceAppendRowsOutputSchema = objectType({
    spreadsheetId: stringType(),
    tableRange: stringType(),
    updatedRange: stringType(),
    updatedRows: numberType().int().nonnegative(),
    updatedCells: numberType().int().nonnegative()
})
  , WorkspaceClearRangeInputSchema = objectType({
    spreadsheetId: stringType().optional(),
    range: stringType().min(1)
})
  , WorkspaceClearRangeOutputSchema = objectType({
    spreadsheetId: stringType(),
    clearedRange: stringType()
})
  , WorkspaceBatchClearInputSchema = objectType({
    spreadsheetId: stringType().optional(),
    ranges: arrayType(stringType().min(1)).min(1)
})
  , WorkspaceBatchClearOutputSchema = objectType({
    spreadsheetId: stringType(),
    clearedRanges: arrayType(stringType())
})
  , WorkspaceBatchUpdateInputSchema = objectType({
    spreadsheetId: stringType().optional(),
    requests: arrayType(recordType(stringType(), unknownType())).min(1)
})
  , WorkspaceBatchUpdateOutputSchema = objectType({
    spreadsheetId: stringType(),
    replyCount: numberType().int().nonnegative()
});
oc.output(UsageStatsSchema),
oc.output(SubscriptionStatusSchema),
oc.output(AnnouncementSchema.nullable()),
oc.output(LatestReleaseSchema.nullable()),
oc.output(ReferralProgramSchema),
oc.input(objectType({
    query: stringType(),
    numResults: numberType().optional()
})).output(WebSearchResultSchema),
oc.input(PdfReadInputSchema).output(PdfReadOutputSchema),
oc.input(DocReadInputSchema).output(DocReadOutputSchema),
oc.input(SheetReadInputSchema).output(SheetReadOutputSchema),
oc.input(BugReportSubmitInputSchema).output(BugReportSubmitOutputSchema),
oc.input(VoiceTranscribeInputSchema).output(VoiceTranscribeOutputSchema),
oc.input(QuickCommandTypeaheadInputSchema).output(QuickCommandTypeaheadOutputSchema),
oc.output(WorkspaceStatusSchema),
oc.input(WorkspaceCreateSpreadsheetInputSchema).output(WorkspaceCreateSpreadsheetOutputSchema),
oc.input(WorkspaceGetSpreadsheetInputSchema).output(WorkspaceGetSpreadsheetOutputSchema),
oc.input(WorkspaceListSheetsInputSchema).output(WorkspaceListSheetsOutputSchema),
oc.input(WorkspaceReadRangeInputSchema).output(WorkspaceReadRangeOutputSchema),
oc.input(WorkspaceBatchReadInputSchema).output(WorkspaceBatchReadOutputSchema),
oc.input(WorkspaceWriteRangeInputSchema).output(WorkspaceWriteRangeOutputSchema),
oc.input(WorkspaceBatchWriteInputSchema).output(WorkspaceBatchWriteOutputSchema),
oc.input(WorkspaceAppendRowsInputSchema).output(WorkspaceAppendRowsOutputSchema),
oc.input(WorkspaceClearRangeInputSchema).output(WorkspaceClearRangeOutputSchema),
oc.input(WorkspaceBatchClearInputSchema).output(WorkspaceBatchClearOutputSchema),
oc.input(WorkspaceBatchUpdateInputSchema).output(WorkspaceBatchUpdateOutputSchema);
const GEMINI_DIRECT_MODEL = {
    shortLabel: "Gemini 3 Flash",
    description: "Powered by your own Gemini API key"
}
  , HOSTED_MODEL_OPTIONS = [{
    id: "gemini",
    label: "Gemini 3.0 Flash",
    shortLabel: "Gemini 3 Flash",
    description: "Fast, capable, included with all plans"
}, {
    id: "gpt-5.4-mini",
    label: "GPT-5.4 Mini",
    shortLabel: "GPT-5.4 Mini",
    description: "Faster and cheaper than GPT-5.4",
    usageNote: "Lower cost",
    requiredPlanTier: HOSTED_MODEL_REQUIRED_PLAN_TIER["gpt-5.4-mini"]
}, {
    id: "gpt-5.4",
    label: "GPT-5.4",
    shortLabel: "GPT-5.4",
    description: "Most capable",
    usageNote: "4x more usage",
    requiredPlanTier: HOSTED_MODEL_REQUIRED_PLAN_TIER["gpt-5.4"]
}]
  , OPENAI_OAUTH_MODEL_OPTIONS = [{
    id: "gpt-5.4",
    label: "GPT-5.4 (most capable)",
    shortLabel: "GPT-5.4",
    description: "Use your ChatGPT subscription for the highest capability"
}, {
    id: "gpt-5.4-mini",
    label: "GPT-5.4 Mini (fast)",
    shortLabel: "GPT-5.4 Mini",
    description: "Fast, lower-cost GPT-5.4 variant"
}]
  , ANTHROPIC_OAUTH_MODEL_OPTIONS = [{
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5 (fastest)",
    shortLabel: "Claude Haiku 4.5",
    description: "Lowest-latency Claude option"
}, {
    id: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6 (balanced)",
    shortLabel: "Claude Sonnet 4.6",
    description: "Balanced speed and reasoning"
}, {
    id: "claude-opus-4-6",
    label: "Claude Opus 4.6 (most capable)",
    shortLabel: "Claude Opus 4.6",
    description: "Highest capability Claude option"
}];
function getOptionShortLabel(e, t, r) {
    return e.find(n => n.id === t)?.shortLabel ?? r
}
function getCurrentModelLabel(e) {
    switch (e.provider) {
    case "proxy":
        return getOptionShortLabel(HOSTED_MODEL_OPTIONS, e.hostedModel, GEMINI_DIRECT_MODEL.shortLabel);
    case "gemini":
        return GEMINI_DIRECT_MODEL.shortLabel;
    case "anthropic-oauth":
        return getOptionShortLabel(ANTHROPIC_OAUTH_MODEL_OPTIONS, e.anthropicModel, e.anthropicModel);
    case "openai-oauth":
        return getOptionShortLabel(OPENAI_OAUTH_MODEL_OPTIONS, e.openaiModel, e.openaiModel)
    }
}
const PROVIDER_ORDER = ["proxy", "openai-oauth", "anthropic-oauth", "gemini"]
  , PROVIDER_META = {
    proxy: {
        label: "Hosted",
        icon: Cloud
    },
    "openai-oauth": {
        label: "ChatGPT",
        icon: OpenAIIcon
    },
    "anthropic-oauth": {
        label: "Claude",
        icon: ClaudeIcon
    },
    gemini: {
        label: "API Key",
        icon: GeminiIcon
    }
};
function ModelSelector() {
    const [e,t] = reactExports.useState(!1)
      , [r,n] = reactExports.useState(null)
      , a = useAppStore(M => M.provider)
      , s = useAppStore(M => M.hostedModel)
      , o = useAppStore(M => M.anthropicModel)
      , l = useAppStore(M => M.openaiModel)
      , u = useAppStore(M => M.geminiApiKey)
      , c = useAppStore(M => M.anthropicOAuthCredentials)
      , p = useAppStore(M => M.openaiOAuthCredentials)
      , d = useAppStore(M => M.navigateToSettings)
      , f = useAppStore(M => M.setProvider)
      , h = useAppStore(M => M.setHostedModel)
      , m = useAppStore(M => M.setAnthropicModel)
      , g = useAppStore(M => M.setOpenaiModel)
      , {data: x} = useSubscriptionStatus(!0)
      , b = x?.planTier
      , y = getCurrentModelLabel({
        provider: a,
        hostedModel: s,
        anthropicModel: o,
        openaiModel: l
    })
      , w = PROVIDER_META[a].icon
      , R = PROVIDER_ORDER.filter(M => {
        switch (M) {
        case "proxy":
            return !0;
        case "openai-oauth":
            return !!p;
        case "anthropic-oauth":
            return !!c;
        case "gemini":
            return u.trim().length > 0
        }
    }
    )
      , T = r ?? a
      , C = M => {
        t(M),
        M && n(null)
    }
      , P = M => {
        t(!1),
        Promise.all([f("proxy"), h(M)])
    }
      , W = M => {
        t(!1),
        Promise.all([f("openai-oauth"), g(M)])
    }
      , ue = M => {
        t(!1),
        Promise.all([f("anthropic-oauth"), m(M)])
    }
      , ce = () => {
        t(!1),
        f("gemini")
    }
      , ve = () => {
        t(!1),
        d()
    }
      , I = R.length <= 1;
    return jsxRuntimeExports.jsxs(Popover, {
        open: e,
        onOpenChange: C,
        children: [jsxRuntimeExports.jsxs(PopoverTrigger, {
            render: jsxRuntimeExports.jsx(Button, {
                type: "button",
                variant: "ghost",
                className: "h-auto max-w-[10.5rem] gap-1.5 rounded-full px-2 py-1.5 text-muted-foreground/70 hover:text-foreground"
            }),
            children: [jsxRuntimeExports.jsx(w, {
                className: "size-3.5 shrink-0"
            }), jsxRuntimeExports.jsx("span", {
                className: "truncate text-[11px] font-medium leading-none",
                children: y
            }), jsxRuntimeExports.jsx(ChevronDown, {
                className: "size-3 shrink-0 opacity-60"
            })]
        }), jsxRuntimeExports.jsxs(PopoverContent, {
            side: "top",
            align: "start",
            sideOffset: 8,
            className: "w-[18rem] max-w-[calc(100vw-1rem)] gap-0 overflow-hidden rounded-2xl p-0",
            children: [jsxRuntimeExports.jsxs("div", {
                className: "flex items-center gap-1 border-b border-border/60 px-2 py-1.5",
                children: [R.map(M => {
                    const $ = PROVIDER_META[M]
                      , pt = $.icon
                      , ba = T === M;
                    return jsxRuntimeExports.jsxs("button", {
                        type: "button",
                        onClick: () => n(M),
                        className: cn$1("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors", "outline-none focus-visible:ring-2 focus-visible:ring-ring/30", ba ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"),
                        children: [jsxRuntimeExports.jsx(pt, {
                            className: "size-3"
                        }), jsxRuntimeExports.jsx("span", {
                            children: $.label
                        })]
                    }, M)
                }
                ), I && jsxRuntimeExports.jsx("button", {
                    type: "button",
                    onClick: ve,
                    "aria-label": "Connect more providers",
                    className: "ml-auto flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:bg-muted/50 hover:text-foreground",
                    children: jsxRuntimeExports.jsx(Plus, {
                        className: "size-3.5"
                    })
                })]
            }), jsxRuntimeExports.jsxs("div", {
                className: "max-h-[16rem] overflow-y-auto px-1.5 py-1.5",
                children: [T === "proxy" && HOSTED_MODEL_OPTIONS.map(M => {
                    const $ = !hasRequiredPlanTier(M.requiredPlanTier, b)
                      , pt = a === "proxy" && s === M.id
                      , ba = formatPlanTierLabel(M.requiredPlanTier);
                    return jsxRuntimeExports.jsx(ModelRow, {
                        label: M.shortLabel,
                        description: $ && ba ? `${ba} plan` : M.description,
                        selected: pt,
                        disabled: $,
                        onClick: () => P(M.id)
                    }, M.id)
                }
                ), T === "openai-oauth" && OPENAI_OAUTH_MODEL_OPTIONS.map(M => jsxRuntimeExports.jsx(ModelRow, {
                    label: M.shortLabel,
                    description: M.description,
                    selected: a === "openai-oauth" && l === M.id,
                    onClick: () => W(M.id)
                }, M.id)), T === "anthropic-oauth" && ANTHROPIC_OAUTH_MODEL_OPTIONS.map(M => jsxRuntimeExports.jsx(ModelRow, {
                    label: M.shortLabel,
                    description: M.description,
                    selected: a === "anthropic-oauth" && o === M.id,
                    onClick: () => ue(M.id)
                }, M.id)), T === "gemini" && jsxRuntimeExports.jsx(ModelRow, {
                    label: GEMINI_DIRECT_MODEL.shortLabel,
                    description: GEMINI_DIRECT_MODEL.description,
                    selected: a === "gemini",
                    onClick: ce
                })]
            }), I && jsxRuntimeExports.jsx("div", {
                className: "border-t border-border/60 px-3 py-2",
                children: jsxRuntimeExports.jsxs("button", {
                    type: "button",
                    onClick: ve,
                    className: "flex w-full items-center gap-1.5 text-[11px] text-muted-foreground/70 transition-colors hover:text-foreground",
                    children: [jsxRuntimeExports.jsx(Settings, {
                        className: "size-3"
                    }), jsxRuntimeExports.jsx("span", {
                        children: "Connect more providers in Settings"
                    })]
                })
            })]
        })]
    })
}
function ModelRow({label: e, description: t, selected: r, disabled: n=!1, onClick: a}) {
    return jsxRuntimeExports.jsxs("button", {
        type: "button",
        disabled: n,
        onClick: a,
        className: cn$1("flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-colors", "outline-none focus-visible:ring-2 focus-visible:ring-ring/30", r ? "bg-primary/[0.08]" : n ? "cursor-not-allowed opacity-50" : "hover:bg-muted/50"),
        children: [jsxRuntimeExports.jsxs("div", {
            className: "min-w-0",
            children: [jsxRuntimeExports.jsx("p", {
                className: cn$1("truncate text-[13px] font-medium", n && "text-muted-foreground"),
                children: e
            }), jsxRuntimeExports.jsx("p", {
                className: "truncate text-[11px] text-muted-foreground",
                children: t
            })]
        }), n ? jsxRuntimeExports.jsx(Lock, {
            className: "size-3 shrink-0 text-muted-foreground/50"
        }) : r ? jsxRuntimeExports.jsx("div", {
            className: "flex size-4 shrink-0 items-center justify-center rounded-full bg-primary",
            children: jsxRuntimeExports.jsx(Check, {
                className: "size-2.5 text-primary-foreground"
            })
        }) : null]
    })
}
const LEVELS = ["none", "low", "medium", "high"]
  , FILLED_COUNT = {
    none: 0,
    low: 1,
    medium: 2,
    high: 3
}
  , LEVEL_LABELS = {
    none: "Off",
    low: "Low",
    medium: "Med",
    high: "High"
}
  , BAR_HEIGHTS = [7, 10, 13];
function ThinkingLevelToggle() {
    const e = useAppStore(s => s.thinkingLevel)
      , t = useAppStore(s => s.setThinkingLevel)
      , r = () => {
        const o = (LEVELS.indexOf(e) + 1) % LEVELS.length;
        t(LEVELS[o])
    }
      , n = FILLED_COUNT[e]
      , a = e !== "none";
    return jsxRuntimeExports.jsxs(Tooltip, {
        children: [jsxRuntimeExports.jsx(TooltipTrigger, {
            asChild: !0,
            children: jsxRuntimeExports.jsxs(Button, {
                type: "button",
                variant: "ghost",
                onClick: r,
                className: cn$1("group/thinking h-auto gap-1 rounded-full px-2 py-1.5", "active:scale-95 transition-all duration-200", a ? "text-muted-foreground hover:text-primary hover:bg-primary/[0.08]" : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/50"),
                children: [jsxRuntimeExports.jsx(Brain, {
                    className: "size-3.5",
                    strokeWidth: a ? 2.25 : 1.75
                }), jsxRuntimeExports.jsx("div", {
                    className: "flex items-end gap-px",
                    children: BAR_HEIGHTS.map( (s, o) => jsxRuntimeExports.jsx("div", {
                        className: cn$1("w-[3px] rounded-full transition-all duration-200", o < n ? "bg-muted-foreground group-hover/thinking:bg-primary" : "bg-muted-foreground/15"),
                        style: {
                            height: s
                        }
                    }, o))
                })]
            })
        }), jsxRuntimeExports.jsxs(TooltipContent, {
            side: "top",
            align: "start",
            children: ["Thinking: ", LEVEL_LABELS[e]]
        })]
    })
}
const DEFAULT_WAVEFORM_BARS = 16
  , DEFAULT_WAVEFORM_VALUES = Array.from({
    length: DEFAULT_WAVEFORM_BARS
}, () => 0)
  , AUDIO_BITS_PER_SECOND = 24e3
  , SMOOTHING_FACTOR = .35
  , MAX_VOICE_RECORDING_DURATION_MS = 300 * 1e3
  , PREFERRED_MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
function clamp(e, t, r) {
    return Math.max(t, Math.min(r, e))
}
function pickRecorderMimeType() {
    for (const e of PREFERRED_MIME_TYPES)
        if (MediaRecorder.isTypeSupported(e))
            return e
}
function buildWaveformBars(e, t) {
    if (e.length === 0 || t <= 0)
        return DEFAULT_WAVEFORM_VALUES;
    const r = Math.max(1, Math.floor(e.length / t))
      , n = [];
    for (let a = 0; a < t; a += 1) {
        const s = a * r
          , o = Math.min(e.length, s + r);
        let l = 0;
        for (let c = s; c < o; c += 1)
            l += e[c] ?? 0;
        const u = o > s ? l / (o - s) : 0;
        n.push(clamp(u / 255, 0, 1))
    }
    return n
}
function useVoiceRecorder() {
    const [e,t] = reactExports.useState(!1)
      , [r,n] = reactExports.useState(!1)
      , [a,s] = reactExports.useState(0)
      , [o,l] = reactExports.useState(DEFAULT_WAVEFORM_VALUES)
      , u = reactExports.useRef(null)
      , c = reactExports.useRef(null)
      , p = reactExports.useRef([])
      , d = reactExports.useRef(0)
      , f = reactExports.useRef(null)
      , h = reactExports.useRef(null)
      , m = reactExports.useRef(null)
      , g = reactExports.useRef(null)
      , x = reactExports.useRef(null)
      , b = reactExports.useRef(DEFAULT_WAVEFORM_VALUES)
      , y = reactExports.useCallback( () => {
        f.current !== null && (window.clearInterval(f.current),
        f.current = null)
    }
    , [])
      , w = reactExports.useCallback( () => {
        x.current !== null && (window.cancelAnimationFrame(x.current),
        x.current = null),
        m.current && (m.current.close().catch( () => {}
        ),
        m.current = null),
        g.current = null
    }
    , [])
      , R = reactExports.useCallback( () => {
        const ue = c.current;
        if (ue)
            for (const ce of ue.getTracks())
                ce.stop();
        c.current = null
    }
    , [])
      , T = reactExports.useCallback( () => {
        y(),
        w(),
        R(),
        u.current = null,
        p.current = [],
        b.current = DEFAULT_WAVEFORM_VALUES,
        t(!1),
        s(0),
        l(DEFAULT_WAVEFORM_VALUES)
    }
    , [y, R, w])
      , C = reactExports.useCallback(async () => {
        const ue = u.current;
        return !ue || ue.state !== "recording" ? null : new Promise(ce => {
            h.current = ce,
            ue.stop()
        }
        )
    }
    , [])
      , P = reactExports.useCallback( () => {
        const ue = u.current;
        ue && ue.state === "recording" ? (h.current = null,
        ue.stop()) : T()
    }
    , [T])
      , W = reactExports.useCallback(async () => {
        if (!(e || r)) {
            if (typeof MediaRecorder > "u" || !navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia != "function")
                throw new Error("Voice recording is not supported in this browser.");
            n(!0);
            try {
                const ue = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: !0,
                        noiseSuppression: !0,
                        channelCount: 1
                    }
                })
                  , ce = pickRecorderMimeType()
                  , ve = new MediaRecorder(ue,{
                    ...ce ? {
                        mimeType: ce
                    } : {},
                    audioBitsPerSecond: AUDIO_BITS_PER_SECOND
                });
                c.current = ue,
                u.current = ve,
                p.current = [],
                d.current = Date.now(),
                ve.ondataavailable = us => {
                    us.data.size > 0 && p.current.push(us.data)
                }
                ,
                ve.onstop = () => {
                    const us = Math.max(0, Date.now() - d.current)
                      , Wd = new Blob(p.current,{
                        type: ve.mimeType || ce || "audio/webm"
                    })
                      , Mr = h.current;
                    h.current = null,
                    T(),
                    Mr && (Wd.size === 0 ? Mr(null) : Mr({
                        blob: Wd,
                        durationMs: us
                    }))
                }
                ,
                ve.onerror = () => {
                    const us = h.current;
                    h.current = null,
                    T(),
                    us?.(null)
                }
                ;
                const I = new AudioContext
                  , M = I.createMediaStreamSource(ue)
                  , $ = I.createAnalyser();
                $.fftSize = 512,
                $.smoothingTimeConstant = .7,
                M.connect($),
                m.current = I,
                g.current = $;
                const pt = new Uint8Array($.frequencyBinCount)
                  , ba = () => {
                    const us = g.current;
                    if (!us)
                        return;
                    us.getByteFrequencyData(pt);
                    const Wd = buildWaveformBars(pt, DEFAULT_WAVEFORM_BARS)
                      , Mr = b.current
                      , Kt = Wd.map( (lt, Ht) => {
                        const $e = Mr[Ht] ?? 0;
                        return $e + (lt - $e) * SMOOTHING_FACTOR
                    }
                    );
                    b.current = Kt,
                    l(Kt),
                    x.current = window.requestAnimationFrame(ba)
                }
                ;
                x.current = window.requestAnimationFrame(ba),
                f.current = window.setInterval( () => {
                    const us = Math.max(0, Date.now() - d.current);
                    s(us)
                }
                , 100),
                ve.start(150),
                t(!0)
            } catch (ue) {
                throw T(),
                ue
            } finally {
                n(!1)
            }
        }
    }
    , [T, e, r]);
    return reactExports.useEffect( () => () => {
        P()
    }
    , [P]),
    {
        isRecording: e,
        isRequestingPermission: r,
        durationMs: a,
        waveformBars: o,
        startRecording: W,
        stopRecording: C,
        cancelRecording: P
    }
}
const MAX_VOICE_UPLOAD_BYTES = 4e6;
function resolveFileExtension(e) {
    return e.includes("webm") ? "webm" : e.includes("mp4") ? "mp4" : e.includes("mpeg") ? "mp3" : e.includes("wav") ? "wav" : e.includes("ogg") ? "ogg" : "webm"
}
function getErrorMessage(e) {
    if (e instanceof ORPCError) {
        if (e.code === "UNAUTHORIZED")
            return "Please sign in again to use voice input.";
        if (e.code === "PAYMENT_REQUIRED")
            return "Voice input requires an active subscription.";
        if (e.code === "TOO_MANY_REQUESTS")
            return "Too many voice transcriptions. Please wait a minute and try again.";
        if (e.code === "PAYLOAD_TOO_LARGE")
            return "Recording is too large. Try a shorter clip.";
        if (e.code === "UNSUPPORTED_MEDIA_TYPE")
            return "Unsupported audio format. Try recording again.";
        if (e.code === "GATEWAY_TIMEOUT")
            return "Transcription timed out. Try a shorter clip."
    }
    return "Voice transcription failed. Please try again."
}
async function transcribeVoice(e) {
    if (e.size === 0)
        throw new Error("Recording is empty. Try again.");
    if (e.size > MAX_VOICE_UPLOAD_BYTES)
        throw new Error("Recording is too large. Try a shorter clip.");
    const t = e.type || "audio/webm"
      , r = resolveFileExtension(t)
      , n = new File([e],`voice-input.${r}`,{
        type: t
    });
    try {
        return await redoClient.voice.transcribe({
            file: n
        })
    } catch (a) {
        throw new Error(getErrorMessage(a))
    }
}
const API_BASE_URL$6 = "https://www.dobrowser.io"
  , ACTIVE_WAVEFORM_BAR_COUNT = 30
  , VOICE_POPUP_WIDTH = 400
  , VOICE_POPUP_HEIGHT = 380
  , DOCUMENT_ATTACHMENT_ERROR = ["Use Hosted mode, or upgrade to a Standard or Max plan before attaching PDFs, DOCX files, or spreadsheets."];
function createVoiceSessionId() {
    return typeof crypto < "u" && typeof crypto.randomUUID == "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}
async function getMicrophonePermissionState() {
    if (!navigator.permissions || typeof navigator.permissions.query != "function")
        return "unknown";
    try {
        return (await navigator.permissions.query({
            name: "microphone"
        })).state
    } catch {
        return "unknown"
    }
}
function formatDuration(e) {
    const t = Math.max(0, Math.floor(e / 1e3))
      , r = Math.floor(t / 60)
      , n = t % 60;
    return `${r}:${n.toString().padStart(2, "0")}`
}
function stretchWaveformBars(e, t) {
    return e.length === 0 ? Array.from({
        length: t
    }, () => 0) : e.length === 1 ? Array.from({
        length: t
    }, () => e[0] ?? 0) : Array.from({
        length: t
    }, (r, n) => {
        const a = n / (t - 1) * (e.length - 1)
          , s = Math.floor(a)
          , o = Math.min(e.length - 1, Math.ceil(a))
          , l = a - s
          , u = e[s] ?? 0
          , c = e[o] ?? u;
        return u + (c - u) * l
    }
    )
}
const MessageInput = reactExports.forwardRef(function e({onSend: t, onStop: r, isLoading: n, disabled: a=!1, queuedMessage: s="", onQueue: o, onClearQueue: l}, u) {
    const [c,p] = reactExports.useState("")
      , [d,f] = reactExports.useState([])
      , [h,m] = reactExports.useState(-1)
      , g = reactExports.useRef(null)
      , x = reactExports.useRef(null)
      , b = useAppStore(h0 => h0.messageHistory)
      , y = useAppStore(h0 => h0.addToMessageHistory)
      , w = useAppStore(h0 => h0.useProxy)
      , R = useAppStore(h0 => h0.activeThreadId)
      , {data: T} = useSubscriptionStatus(!0)
      , C = canUseDocumentTools({
        useProxy: w,
        hasActiveSubscription: T?.hasSubscription
    })
      , [P,W] = reactExports.useState(!1)
      , [ue,ce] = reactExports.useState(!1)
      , [ve,I] = reactExports.useState(!1)
      , M = reactExports.useRef(null)
      , $ = reactExports.useRef(null)
      , pt = createNotifier(R ?? NEW_CHAT_SOURCE_ID)
      , {isRecording: ba, isRequestingPermission: us, durationMs: Wd, waveformBars: Mr, startRecording: Kt, stopRecording: lt} = useVoiceRecorder();
    reactExports.useEffect( () => {
        !a && !n && g.current?.focus()
    }
    , [a, n]);
    const Ht = reactExports.useCallback(h0 => {
        h0.trim() && (y(h0),
        m(-1))
    }
    , [y])
      , $e = reactExports.useCallback( () => {
        if (b.length === 0)
            return;
        const h0 = h === -1 ? b.length - 1 : Math.max(0, h - 1);
        m(h0);
        const av = b[h0];
        av !== void 0 && p(av)
    }
    , [b, h])
      , G = reactExports.useCallback( () => {
        if (h === -1)
            return;
        const h0 = h + 1;
        if (h0 >= b.length)
            m(-1),
            p("");
        else {
            m(h0);
            const av = b[h0];
            av !== void 0 && p(av)
        }
    }
    , [b, h])
      , he = reactExports.useCallback(async h0 => {
        const av = []
          , L = [];
        let A = !1;
        for (const F of h0) {
            const Qt = fileToTextAttachment(F);
            if (Qt) {
                if (F.size > MAX_TEXT_ATTACHMENT_SIZE_BYTES) {
                    pt.error("Attachment too large", [`${F.name} exceeds 2MB and cannot be attached.`]);
                    continue
                }
                av.push(Qt);
                continue
            }
            const ps = fileToPdfAttachment(F);
            if (ps) {
                if (!C) {
                    pt.error("Document attachments unavailable", DOCUMENT_ATTACHMENT_ERROR);
                    continue
                }
                if (F.size > MAX_PDF_ATTACHMENT_SIZE_BYTES) {
                    pt.error("PDF too large", [`${F.name} exceeds 20MB and cannot be attached.`]);
                    continue
                }
                av.push(ps);
                continue
            }
            const pr = fileToDocxAttachment(F);
            if (pr) {
                if (!C) {
                    pt.error("Document attachments unavailable", DOCUMENT_ATTACHMENT_ERROR);
                    continue
                }
                if (F.size > MAX_STRUCTURED_ATTACHMENT_SIZE_BYTES) {
                    pt.error("Document too large", [`${F.name} exceeds 10MB and cannot be attached.`]);
                    continue
                }
                av.push(pr);
                continue
            }
            const mo = fileToSheetAttachment(F);
            if (mo) {
                if (!C) {
                    pt.error("Document attachments unavailable", DOCUMENT_ATTACHMENT_ERROR);
                    continue
                }
                if (F.size > MAX_STRUCTURED_ATTACHMENT_SIZE_BYTES) {
                    pt.error("Spreadsheet too large", [`${F.name} exceeds 10MB and cannot be attached.`]);
                    continue
                }
                av.push(mo);
                continue
            }
            if (F.type.startsWith("image/")) {
                L.push(F);
                continue
            }
            A = !0
        }
        if (L.length > 0) {
            const F = await Promise.all(L.map(fileToImageAttachment));
            av.push(...F.filter(Boolean))
        }
        return A && pt.error("Unsupported attachment type", ["Only images, PDFs, DOCX, XLSX, CSV, and plain text files are supported."]),
        av
    }
    , [C, pt])
      , Xe = reactExports.useCallback(async h0 => {
        if (a || h0.length === 0)
            return;
        const av = await he(h0);
        f(L => [...L, ...av])
    }
    , [he, a]);
    reactExports.useImperativeHandle(u, () => ({
        setInput: h0 => {
            p(h0),
            m(-1),
            g.current?.focus()
        }
        ,
        focus: () => {
            g.current?.focus()
        }
        ,
        addFiles: Xe
    }));
    const jr = async h0 => {
        const av = Array.from(h0.target.files || []);
        await Xe(av),
        h0.target.value = ""
    }
      , fs = async h0 => {
        const av = Array.from(h0.clipboardData.items).filter(A => A.type.startsWith("image/")).map(A => A.getAsFile()).filter(A => A !== null);
        if (av.length === 0)
            return;
        h0.preventDefault();
        const L = await Promise.all(av.map(fileToImageAttachment));
        f(A => [...A, ...L.filter(Boolean)])
    }
      , bf = h0 => {
        f(av => av.filter(L => L.id !== h0))
    }
      , $0 = reactExports.useCallback(h0 => {
        const av = h0.trim();
        return av ? (p(L => {
            if (!L.trim())
                return av;
            const A = L.endsWith(`
`) || L.endsWith(" ") ? "" : `
`;
            return `${L}${A}${av}`
        }
        ),
        m(-1),
        g.current?.focus(),
        !0) : !1
    }
    , [])
      , ie = reactExports.useCallback(async () => {
        try {
            await Kt()
        } catch (h0) {
            const av = h0 instanceof Error ? h0.message : "Could not access your microphone.";
            pt.error("Microphone unavailable", [av])
        }
    }
    , [pt, Kt])
      , He = reactExports.useCallback(async () => {
        const h0 = await lt();
        if (!h0) {
            pt.error("Recording failed", ["Could not capture audio. Please try again."]);
            return
        }
        I(!0);
        try {
            const av = await transcribeVoice(h0.blob);
            $0(av.text) || pt.warning("No speech detected", ["We could not detect speech in that clip. Try speaking a little louder."])
        } catch (av) {
            const L = av instanceof Error ? av.message : "Voice transcription failed.";
            pt.error("Voice transcription failed", [L])
        } finally {
            I(!1)
        }
    }
    , [$0, pt, lt])
      , mm = reactExports.useCallback(async () => {
        const h0 = createVoiceSessionId();
        $.current = h0;
        try {
            const av = await chrome.windows.create({
                url: chrome.runtime.getURL(`voice-popup.html?session=${encodeURIComponent(h0)}`),
                type: "popup",
                width: VOICE_POPUP_WIDTH,
                height: VOICE_POPUP_HEIGHT,
                focused: !0
            });
            if (!av || av.id == null)
                throw new Error("Could not open microphone permission popup.");
            M.current = av.id,
            ce(!0)
        } catch (av) {
            $.current = null;
            const L = av instanceof Error ? av.message : "Could not open microphone permission popup.";
            pt.error("Microphone permission popup unavailable", [L])
        }
    }
    , [pt]);
    reactExports.useEffect( () => {
        const h0 = (av, L, A) => {
            if (isVoicePopupMessage(av) && av.sessionId === $.current) {
                if (av.type === VOICE_POPUP_MESSAGE_TYPES.PERMISSION_GRANTED) {
                    ce(!1),
                    M.current = null,
                    $.current = null,
                    ie();
                    return
                }
                if (av.type === VOICE_POPUP_MESSAGE_TYPES.PERMISSION_DENIED) {
                    ce(!0),
                    pt.error("Microphone permission denied", [av.error || "Please allow microphone access to record voice input."]);
                    return
                }
                av.type === VOICE_POPUP_MESSAGE_TYPES.PERMISSION_CANCELLED && (ce(!1),
                M.current = null,
                $.current = null)
            }
        }
        ;
        return chrome.runtime.onMessage.addListener(h0),
        () => chrome.runtime.onMessage.removeListener(h0)
    }
    , [pt, ie]),
    reactExports.useEffect( () => {
        const h0 = av => {
            M.current === av && (M.current = null,
            $.current = null,
            ce(!1))
        }
        ;
        return chrome.windows.onRemoved.addListener(h0),
        () => chrome.windows.onRemoved.removeListener(h0)
    }
    , []),
    reactExports.useEffect( () => {
        !ba || ve || Wd < MAX_VOICE_RECORDING_DURATION_MS || He()
    }
    , [ba, ve, He, Wd]);
    const Oe = reactExports.useCallback(async () => {
        if (a || n || ve || ue || us)
            return;
        if (!T?.hasSubscription) {
            pt.warning("Subscription required", ["Voice input is available for active subscribers."]);
            return
        }
        if (ba) {
            He();
            return
        }
        if (await getMicrophonePermissionState() === "granted") {
            await ie();
            return
        }
        await mm()
    }
    , [a, n, ba, us, ve, ue, pt, mm, ie, He, T?.hasSubscription])
      , R0 = h0 => {
        if (h0.preventDefault(),
        !(!(c.trim() || d.length > 0) || a || ue || ba || ve))
            if (n && o) {
                if (d.length > 0) {
                    pt.error("Attachments cannot be queued", ["Wait for the current response to finish before sending attachments."]);
                    return
                }
                c.trim() && (o(c.trim()),
                Ht(c.trim()),
                p(""))
            } else
                n || (t(c.trim(), d.length > 0 ? d : void 0),
                Ht(c.trim()),
                p(""),
                f([]))
    }
      , gm = () => {
        const h0 = l?.();
        h0 && (p(h0),
        m(-1))
    }
      , $s = h0 => {
        const {selectionStart: av, selectionEnd: L, value: A} = h0.currentTarget;
        if (h0.key === "ArrowUp" && av === 0 && L === 0) {
            h0.preventDefault(),
            $e();
            return
        }
        if (h0.key === "ArrowDown" && av === A.length && L === A.length) {
            h0.preventDefault(),
            G();
            return
        }
        h0.key === "Enter" && !h0.shiftKey && (h0.preventDefault(),
        R0(h0))
    }
      , lv = (c.trim() || d.length > 0) && !a && !(ue || ba || us || ve) && (!n || !!o)
      , Ox = !!T?.hasSubscription
      , ev = ba
      , iv = reactExports.useMemo( () => stretchWaveformBars(Mr, ACTIVE_WAVEFORM_BAR_COUNT), [Mr])
      , N = a || n || ve || ue || us || !Ox
      , bi = ve ? "Transcribing voice..." : ba ? "Stop recording and transcribe" : ue ? "Approve microphone access in popup" : us ? "Requesting microphone..." : Ox ? "Record voice input" : "Voice input requires an active subscription"
      , Rx = jsxRuntimeExports.jsxs(Tooltip, {
        children: [jsxRuntimeExports.jsx(TooltipTrigger, {
            asChild: !0,
            children: jsxRuntimeExports.jsx(Button, {
                type: "button",
                variant: "ghost",
                size: "icon",
                className: cn$1("size-7 rounded-full transition-colors", ba ? "text-red-500 hover:text-red-600 hover:bg-red-500/10" : ue ? "text-primary hover:text-primary" : "text-muted-foreground/60 hover:text-foreground"),
                onClick: Oe,
                disabled: N,
                "aria-label": "Record voice input",
                children: ue || us ? jsxRuntimeExports.jsx(LoaderCircle, {
                    className: "size-3.5 animate-spin"
                }) : ba ? jsxRuntimeExports.jsx(Square, {
                    className: "size-3 fill-current"
                }) : jsxRuntimeExports.jsx(Mic, {
                    className: "size-3.5"
                })
            })
        }), jsxRuntimeExports.jsx(TooltipContent, {
            children: bi
        })]
    })
      , sv = n ? jsxRuntimeExports.jsxs(Tooltip, {
        children: [jsxRuntimeExports.jsx(TooltipTrigger, {
            asChild: !0,
            children: jsxRuntimeExports.jsx(Button, {
                type: "button",
                onClick: r,
                size: "icon",
                className: "size-7 rounded-full bg-foreground text-background hover:bg-foreground/90",
                "aria-label": "Stop generating",
                children: jsxRuntimeExports.jsx(Square, {
                    className: "size-2.5 fill-current"
                })
            })
        }), jsxRuntimeExports.jsx(TooltipContent, {
            children: "Stop generating"
        })]
    }) : ve ? jsxRuntimeExports.jsxs(Tooltip, {
        children: [jsxRuntimeExports.jsx(TooltipTrigger, {
            asChild: !0,
            children: jsxRuntimeExports.jsx(Button, {
                type: "button",
                disabled: !0,
                size: "icon",
                "aria-label": "Transcribing voice",
                className: "size-7 rounded-full bg-primary text-primary-foreground cursor-default",
                children: jsxRuntimeExports.jsx(LoaderCircle, {
                    className: "size-3.5 animate-spin"
                })
            })
        }), jsxRuntimeExports.jsx(TooltipContent, {
            children: "Transcribing voice..."
        })]
    }) : jsxRuntimeExports.jsxs(Tooltip, {
        children: [jsxRuntimeExports.jsx(TooltipTrigger, {
            asChild: !0,
            children: jsxRuntimeExports.jsx(Button, {
                type: "submit",
                disabled: !lv,
                size: "icon",
                "aria-label": "Send message",
                className: cn$1("size-7 rounded-full transition-all", lv ? "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95" : "bg-muted text-muted-foreground/40 cursor-default"),
                children: jsxRuntimeExports.jsx(ArrowUp, {
                    className: "size-3.5",
                    strokeWidth: 2.5
                })
            })
        }), jsxRuntimeExports.jsx(TooltipContent, {
            children: "Send message"
        })]
    });
    return jsxRuntimeExports.jsx("form", {
        onSubmit: R0,
        className: "sticky bottom-0 p-3 bg-background",
        children: jsxRuntimeExports.jsxs("div", {
            className: "border border-border rounded-2xl overflow-hidden",
            children: [s && jsxRuntimeExports.jsxs("div", {
                className: "flex items-center gap-2 px-4 py-2 bg-muted/50 border-b border-border",
                children: [jsxRuntimeExports.jsx(Clock, {
                    className: "size-4 text-muted-foreground shrink-0"
                }), jsxRuntimeExports.jsx("span", {
                    className: "flex-1 text-sm text-foreground truncate",
                    children: s
                }), jsxRuntimeExports.jsx(Button, {
                    type: "button",
                    variant: "ghost",
                    size: "icon",
                    className: "size-6 shrink-0",
                    onClick: gm,
                    children: jsxRuntimeExports.jsx(X$1, {
                        className: "size-3"
                    })
                })]
            }), !P && w && T && !T.hasSubscription && ( () => {
                const h0 = Math.max((T.freeMessagesLimit ?? FREE_MESSAGE_LIMIT) - (T.freeMessagesUsed ?? 0), 0);
                return jsxRuntimeExports.jsxs("div", {
                    className: "flex items-center gap-2 px-4 py-2 bg-muted/50 border-b border-border",
                    children: [jsxRuntimeExports.jsxs("span", {
                        className: "flex-1 text-sm text-foreground truncate",
                        children: [h0, " message", h0 !== 1 ? "s" : "", " left ·", " ", jsxRuntimeExports.jsx("button", {
                            type: "button",
                            className: "underline underline-offset-2 text-muted-foreground hover:text-foreground transition-colors",
                            onClick: () => window.open(`${API_BASE_URL$6}/settings`, "_blank"),
                            children: "Upgrade for more"
                        })]
                    }), jsxRuntimeExports.jsx(Button, {
                        type: "button",
                        variant: "ghost",
                        size: "icon",
                        className: "size-6 shrink-0",
                        onClick: () => W(!0),
                        children: jsxRuntimeExports.jsx(X$1, {
                            className: "size-3"
                        })
                    })]
                })
            }
            )(), jsxRuntimeExports.jsx(AttachedAttachments, {
                attachments: d,
                onRemove: bf
            }), jsxRuntimeExports.jsxs("div", {
                className: "group flex flex-col",
                children: [jsxRuntimeExports.jsx(Textarea, {
                    ref: g,
                    value: c,
                    onChange: h0 => {
                        p(h0.target.value),
                        m(-1)
                    }
                    ,
                    onKeyDown: $s,
                    onPaste: fs,
                    placeholder: a ? "Configure API key in Settings..." : "Type a message...",
                    disabled: a,
                    rows: 1,
                    className: cn$1("flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0", "min-h-0 max-h-[50vh]", "px-4 pt-3 pb-3", "[&::-webkit-scrollbar]:w-1.5", "[&::-webkit-scrollbar-track]:bg-transparent", "[&::-webkit-scrollbar-thumb]:bg-transparent", "[&::-webkit-scrollbar-thumb]:rounded-full", "group-hover:[&::-webkit-scrollbar-thumb]:bg-border")
                }), jsxRuntimeExports.jsx("input", {
                    ref: x,
                    type: "file",
                    accept: "image/*,application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx,text/csv,.csv,text/*,application/json,.md,.txt,.json,.yaml,.yml,.ts,.tsx,.js,.jsx,.log",
                    multiple: !0,
                    className: "hidden",
                    onChange: jr,
                    "aria-label": "Attach files"
                }), ev ? jsxRuntimeExports.jsx("div", {
                    className: "px-2 pb-1.5 pt-1",
                    children: jsxRuntimeExports.jsxs("div", {
                        className: "flex h-8 items-center gap-2.5 rounded-xl bg-red-500/[0.07] px-2.5",
                        children: [jsxRuntimeExports.jsx("div", {
                            className: "flex h-full flex-1 items-center gap-px py-1.5",
                            "aria-hidden": !0,
                            children: iv.map( (h0, av) => {
                                const L = Math.max(2, Math.round(h0 * 20));
                                return jsxRuntimeExports.jsx("span", {
                                    className: "flex-1 rounded-[1px] bg-red-500/60 transition-[height] duration-150 ease-out",
                                    style: {
                                        height: `${L}px`
                                    }
                                }, av)
                            }
                            )
                        }), jsxRuntimeExports.jsxs("div", {
                            className: "flex shrink-0 items-center gap-1.5",
                            children: [jsxRuntimeExports.jsx("span", {
                                className: "size-2 rounded-full bg-red-500",
                                style: {
                                    animation: "pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                                }
                            }), jsxRuntimeExports.jsx("span", {
                                className: "text-[11px] font-medium text-muted-foreground tabular-nums",
                                children: formatDuration(Wd)
                            })]
                        }), jsxRuntimeExports.jsx("button", {
                            type: "button",
                            className: "flex size-5 shrink-0 items-center justify-center rounded-full bg-red-500 text-white transition-colors hover:bg-red-600 disabled:opacity-50",
                            onClick: Oe,
                            disabled: N,
                            "aria-label": "Stop recording",
                            children: jsxRuntimeExports.jsx(Square, {
                                className: "size-2 fill-current"
                            })
                        })]
                    })
                }) : jsxRuntimeExports.jsxs("div", {
                    className: "flex items-center justify-between bg-background px-2 pb-1.5 pt-1 rounded-b-2xl",
                    children: [jsxRuntimeExports.jsxs("div", {
                        className: "flex items-center gap-0.5",
                        children: [jsxRuntimeExports.jsx(ModelSelector, {}), jsxRuntimeExports.jsx(ThinkingLevelToggle, {})]
                    }), jsxRuntimeExports.jsxs("div", {
                        className: "flex items-center gap-0.5",
                        children: [jsxRuntimeExports.jsxs(Tooltip, {
                            children: [jsxRuntimeExports.jsx(TooltipTrigger, {
                                asChild: !0,
                                children: jsxRuntimeExports.jsx(Button, {
                                    type: "button",
                                    variant: "ghost",
                                    size: "icon",
                                    className: "size-7 rounded-full text-muted-foreground/60 hover:text-foreground",
                                    onClick: () => x.current?.click(),
                                    disabled: a,
                                    "aria-label": "Attach files",
                                    children: jsxRuntimeExports.jsx(Paperclip, {
                                        className: "size-3.5"
                                    })
                                })
                            }), jsxRuntimeExports.jsx(TooltipContent, {
                                children: "Attach files"
                            })]
                        }), Rx, sv]
                    })]
                })]
            })]
        })
    })
});
function NotificationIndicator({sourceId: e}) {
    const t = useNotificationStore(c => c.notifications)
      , r = useNotificationStore(c => c.removeNotification)
      , n = useNotificationStore(c => c.clearBySource)
      , a = useNotificationStore(c => c.clearAll)
      , s = reactExports.useMemo( () => e ? t.filter(c => c.sourceId === e) : t, [t, e])
      , o = s.filter(c => c.type === "error")
      , l = () => {
        e ? n(e) : a()
    }
    ;
    if (s.length === 0)
        return null;
    const u = o.length > 0;
    return jsxRuntimeExports.jsx("div", {
        className: "absolute bottom-full right-0 mb-2 mr-2",
        children: jsxRuntimeExports.jsxs(Popover, {
            children: [jsxRuntimeExports.jsxs(PopoverTrigger, {
                render: jsxRuntimeExports.jsx(Button, {
                    variant: "ghost",
                    size: "icon-lg",
                    className: cn$1("relative rounded-full", u ? "bg-red-100 hover:bg-red-200 dark:bg-red-950 dark:hover:bg-red-900" : "bg-amber-100 hover:bg-amber-200 dark:bg-amber-950 dark:hover:bg-amber-900")
                }),
                children: [u ? jsxRuntimeExports.jsx(CircleAlert, {
                    className: "size-4 text-red-600 dark:text-red-400"
                }) : jsxRuntimeExports.jsx(TriangleAlert, {
                    className: "size-4 text-amber-600 dark:text-amber-400"
                }), s.length > 1 && jsxRuntimeExports.jsx("span", {
                    className: cn$1("absolute -top-1 -right-1 flex items-center justify-center", "min-w-4 h-4 px-1 rounded-full text-[10px] font-medium", u ? "bg-red-600 text-white" : "bg-amber-600 text-white"),
                    children: s.length
                })]
            }), jsxRuntimeExports.jsxs(PopoverContent, {
                side: "top",
                align: "end",
                className: "w-80 max-h-64 overflow-y-auto p-0 gap-0",
                children: [jsxRuntimeExports.jsxs("div", {
                    className: "flex items-center justify-between px-3 py-2 border-b",
                    children: [jsxRuntimeExports.jsx(PopoverTitle, {
                        children: "Notifications"
                    }), jsxRuntimeExports.jsx(Button, {
                        variant: "link",
                        size: "xs",
                        onClick: l,
                        className: "text-muted-foreground hover:text-foreground",
                        children: "Clear all"
                    })]
                }), jsxRuntimeExports.jsx("div", {
                    className: "divide-y",
                    children: s.map(c => jsxRuntimeExports.jsx(NotificationItem, {
                        notification: c,
                        onDismiss: () => r(c.id)
                    }, c.id))
                })]
            })]
        })
    })
}
function NotificationItem({notification: e, onDismiss: t}) {
    const r = e.type === "error";
    return jsxRuntimeExports.jsxs("div", {
        className: "flex items-start gap-2 p-3",
        children: [r ? jsxRuntimeExports.jsx(CircleAlert, {
            className: "size-4 flex-shrink-0 mt-0.5 text-red-600 dark:text-red-400"
        }) : jsxRuntimeExports.jsx(TriangleAlert, {
            className: "size-4 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400"
        }), jsxRuntimeExports.jsxs("div", {
            className: "flex-1 min-w-0",
            children: [jsxRuntimeExports.jsx("p", {
                className: cn$1("text-sm font-medium", r ? "text-red-800 dark:text-red-200" : "text-amber-800 dark:text-amber-200"),
                children: e.title
            }), e.details && e.details.length > 0 && jsxRuntimeExports.jsx("ul", {
                className: "mt-1 space-y-0.5",
                children: e.details.map( (n, a) => jsxRuntimeExports.jsx("li", {
                    className: cn$1("text-xs", r ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300"),
                    children: n
                }, a))
            })]
        }), jsxRuntimeExports.jsx(Button, {
            variant: "ghost",
            size: "icon-xs",
            onClick: t,
            "aria-label": "Dismiss",
            className: "flex-shrink-0",
            children: jsxRuntimeExports.jsx(X$1, {
                className: "text-muted-foreground"
            })
        })]
    })
}
function ChatView() {
    const e = useAppStore(ba => ba.activeThreadId)
      , t = useAppStore(ba => ba.geminiApiKey);
    useAppStore(ba => ba.useProxy);
    const r = useAppStore(ba => ba.provider)
      , n = useAppStore(ba => ba.anthropicOAuthCredentials)
      , a = useAppStore(ba => ba.setCompactionState)
      , s = useAppStore(ba => ba.claimPendingOmniboxCommand)
      , o = useAppStore(ba => ba.addToMessageHistory)
      , {ensureReady: l} = useAgentEnvironment()
      , u = reactExports.useRef(null)
      , [c,p] = reactExports.useState(!1)
      , d = reactExports.useRef(0)
      , {messages: f, isLoading: h, inlineSystemMessage: m, sendMessage: g, stopGeneration: x, queuedMessage: b, queueMessage: y, clearQueue: w, isCompacting: R, hasCompactionSummary: T, canManualCompaction: C, triggerManualCompaction: P} = useRedoChat({
        threadId: e
    })
      , W = useAppStore(ba => ba.openaiOAuthCredentials)
      , ue = canChat({
        provider: r,
        geminiApiKey: t,
        anthropicOAuthCredentials: n,
        openaiOAuthCredentials: W
    })
      , ce = T;
    reactExports.useEffect( () => (a(R, P, ce, C),
    () => a(!1, null, !1, !1)), [R, P, ce, C, a]),
    reactExports.useEffect( () => {
        if (!e || !ue)
            return;
        let ba = !1;
        return (async () => {
            const us = await s(e);
            if (!(!us || ba)) {
                try {
                    await l()
                } catch {}
                ba || useAppStore.getState().activeThreadId === e && (o(us),
                g(us))
            }
        }
        )(),
        () => {
            ba = !0
        }
    }
    , [e, ue, s, o, g, l]);
    const ve = reactExports.useCallback(ba => {
        u.current?.setInput(ba)
    }
    , [])
      , I = reactExports.useCallback(ba => {
        ba.dataTransfer?.types.includes("Files") && (ba.preventDefault(),
        d.current += 1,
        p(!0))
    }
    , [])
      , M = reactExports.useCallback(ba => {
        ba.dataTransfer?.types.includes("Files") && (ba.preventDefault(),
        ba.dataTransfer.dropEffect = "copy")
    }
    , [])
      , $ = reactExports.useCallback(ba => {
        ba.dataTransfer?.types.includes("Files") && (ba.preventDefault(),
        d.current = Math.max(0, d.current - 1),
        d.current === 0 && p(!1))
    }
    , [])
      , pt = reactExports.useCallback(ba => {
        if (!ba.dataTransfer?.types.includes("Files"))
            return;
        ba.preventDefault(),
        d.current = 0,
        p(!1);
        const us = Array.from(ba.dataTransfer.files || []);
        us.length !== 0 && u.current?.addFiles(us)
    }
    , []);
    return jsxRuntimeExports.jsxs("div", {
        className: "relative flex flex-col h-full",
        onDragEnter: I,
        onDragOver: M,
        onDragLeave: $,
        onDrop: pt,
        children: [c && jsxRuntimeExports.jsx("div", {
            className: "pointer-events-none absolute inset-2 z-50 rounded-lg border-2 border-dashed border-primary bg-primary/10"
        }), jsxRuntimeExports.jsx(MessageList, {
            messages: f,
            isLoading: h,
            inlineSystemMessage: m,
            isCompacting: R,
            showCompactionDivider: T,
            onSuggestionClick: ve
        }), jsxRuntimeExports.jsxs("div", {
            className: "relative",
            children: [jsxRuntimeExports.jsx(NotificationIndicator, {
                sourceId: e ?? void 0
            }), jsxRuntimeExports.jsx(MessageInput, {
                ref: u,
                onSend: g,
                onStop: x,
                isLoading: h,
                disabled: !ue,
                queuedMessage: b,
                onQueue: y,
                onClearQueue: w
            })]
        })]
    })
}
const DialogRootContext = reactExports.createContext(void 0);
function useDialogRootContext(e) {
    const t = reactExports.useContext(DialogRootContext);
    if (e === !1 && t === void 0)
        throw new Error(formatErrorMessage(27));
    return t
}
const stateAttributesMapping$5 = {
    ...popupStateMapping,
    ...transitionStatusMapping
}
  , DialogBackdrop = reactExports.forwardRef(function e(t, r) {
    const {render: n, className: a, forceRender: s=!1, ...o} = t
      , {store: l} = useDialogRootContext()
      , u = l.useState("open")
      , c = l.useState("nested")
      , p = l.useState("mounted")
      , d = l.useState("transitionStatus")
      , f = reactExports.useMemo( () => ({
        open: u,
        transitionStatus: d
    }), [u, d]);
    return useRenderElement("div", t, {
        state: f,
        ref: [l.context.backdropRef, r],
        stateAttributesMapping: stateAttributesMapping$5,
        props: [{
            role: "presentation",
            hidden: !p,
            style: {
                userSelect: "none",
                WebkitUserSelect: "none"
            }
        }, o],
        enabled: s || !c
    })
})
  , DialogClose$1 = reactExports.forwardRef(function e(t, r) {
    const {render: n, className: a, disabled: s=!1, nativeButton: o=!0, ...l} = t
      , {store: u} = useDialogRootContext()
      , c = u.useState("open");
    function p(m) {
        c && u.setOpen(!1, createChangeEventDetails(closePress, m.nativeEvent))
    }
    const {getButtonProps: d, buttonRef: f} = useButton({
        disabled: s,
        native: o
    })
      , h = reactExports.useMemo( () => ({
        disabled: s
    }), [s]);
    return useRenderElement("button", t, {
        state: h,
        ref: [r, f],
        props: [{
            onClick: p
        }, l, d]
    })
})
  , DialogDescription$1 = reactExports.forwardRef(function e(t, r) {
    const {render: n, className: a, id: s, ...o} = t
      , {store: l} = useDialogRootContext()
      , u = useBaseUiId(s);
    return l.useSyncedValueWithCleanup("descriptionElementId", u),
    useRenderElement("p", t, {
        ref: r,
        props: [{
            id: u
        }, o]
    })
});
let DialogPopupCssVars = (function(e) {
    return e.nestedDialogs = "--nested-dialogs",
    e
}
)({})
  , DialogPopupDataAttributes = (function(e) {
    return e[e.open = CommonPopupDataAttributes.open] = "open",
    e[e.closed = CommonPopupDataAttributes.closed] = "closed",
    e[e.startingStyle = CommonPopupDataAttributes.startingStyle] = "startingStyle",
    e[e.endingStyle = CommonPopupDataAttributes.endingStyle] = "endingStyle",
    e.nested = "data-nested",
    e.nestedDialogOpen = "data-nested-dialog-open",
    e
}
)({});
const DialogPortalContext = reactExports.createContext(void 0);
function useDialogPortalContext() {
    const e = reactExports.useContext(DialogPortalContext);
    if (e === void 0)
        throw new Error(formatErrorMessage(26));
    return e
}
const stateAttributesMapping$4 = {
    ...popupStateMapping,
    ...transitionStatusMapping,
    nestedDialogOpen(e) {
        return e ? {
            [DialogPopupDataAttributes.nestedDialogOpen]: ""
        } : null
    }
}
  , DialogPopup = reactExports.forwardRef(function e(t, r) {
    const {className: n, finalFocus: a, initialFocus: s, render: o, ...l} = t
      , {store: u} = useDialogRootContext()
      , c = u.useState("descriptionElementId")
      , p = u.useState("disablePointerDismissal")
      , d = u.useState("floatingRootContext")
      , f = u.useState("popupProps")
      , h = u.useState("modal")
      , m = u.useState("mounted")
      , g = u.useState("nested")
      , x = u.useState("nestedOpenDialogCount")
      , b = u.useState("open")
      , y = u.useState("openMethod")
      , w = u.useState("titleElementId")
      , R = u.useState("transitionStatus")
      , T = u.useState("role");
    useDialogPortalContext(),
    useOpenChangeComplete({
        open: b,
        ref: u.context.popupRef,
        onComplete() {
            b && u.context.onOpenChangeComplete?.(!0)
        }
    });
    function C(ve) {
        return ve === "touch" ? u.context.popupRef.current : !0
    }
    const P = s === void 0 ? C : s
      , W = x > 0
      , ue = reactExports.useMemo( () => ({
        open: b,
        nested: g,
        transitionStatus: R,
        nestedDialogOpen: W
    }), [b, g, R, W])
      , ce = useRenderElement("div", t, {
        state: ue,
        props: [f, {
            "aria-labelledby": w ?? void 0,
            "aria-describedby": c ?? void 0,
            role: T,
            tabIndex: -1,
            hidden: !m,
            onKeyDown(ve) {
                COMPOSITE_KEYS.has(ve.key) && ve.stopPropagation()
            },
            style: {
                [DialogPopupCssVars.nestedDialogs]: x
            }
        }, l],
        ref: [r, u.context.popupRef, u.useStateSetter("popupElement")],
        stateAttributesMapping: stateAttributesMapping$4
    });
    return jsxRuntimeExports.jsx(FloatingFocusManager, {
        context: d,
        openInteractionType: y,
        disabled: !m,
        closeOnFocusOut: !p,
        initialFocus: P,
        returnFocus: a,
        modal: h !== !1,
        restoreFocus: "popup",
        children: ce
    })
})
  , DialogPortal$1 = reactExports.forwardRef(function e(t, r) {
    const {keepMounted: n=!1, ...a} = t
      , {store: s} = useDialogRootContext()
      , o = s.useState("mounted")
      , l = s.useState("modal");
    return o || n ? jsxRuntimeExports.jsx(DialogPortalContext.Provider, {
        value: n,
        children: jsxRuntimeExports.jsxs(FloatingPortal, {
            ref: r,
            ...a,
            children: [o && l === !0 && jsxRuntimeExports.jsx(InternalBackdrop, {
                ref: s.context.internalBackdropRef,
                inert: inertValue(!open)
            }), t.children]
        })
    }) : null
});
function useDialogRoot(e) {
    const {store: t, parentContext: r, actionsRef: n} = e
      , a = t.useState("open")
      , s = t.useState("disablePointerDismissal")
      , o = t.useState("modal")
      , l = t.useState("popupElement")
      , {openMethod: u, triggerProps: c, reset: p} = useOpenInteractionType(a);
    useImplicitActiveTrigger(t);
    const {forceUnmount: d} = useOpenStateTransitions(a, t, () => {
        p()
    }
    )
      , f = useStableCallback(ce => {
        const ve = createChangeEventDetails(ce);
        return ve.preventUnmountOnClose = () => {
            t.set("preventUnmountingOnClose", !0)
        }
        ,
        ve
    }
    )
      , h = reactExports.useCallback( () => {
        t.setOpen(!1, f(imperativeAction))
    }
    , [t, f]);
    reactExports.useImperativeHandle(n, () => ({
        unmount: d,
        close: h
    }), [d, h]);
    const m = useSyncedFloatingRootContext({
        popupStore: t,
        onOpenChange: t.setOpen,
        treatPopupAsFloatingElement: !0,
        noEmit: !0
    })
      , [g,x] = reactExports.useState(0)
      , b = g === 0
      , y = useRole(m)
      , w = useDismiss(m, {
        outsidePressEvent() {
            return t.context.internalBackdropRef.current || t.context.backdropRef.current ? "intentional" : {
                mouse: o === "trap-focus" ? "sloppy" : "intentional",
                touch: "sloppy"
            }
        },
        outsidePress(ce) {
            if ("button"in ce && ce.button !== 0 || "touches"in ce && ce.touches.length !== 1)
                return !1;
            const ve = getTarget(ce);
            if (b && !s) {
                const I = ve;
                return o && (t.context.internalBackdropRef.current || t.context.backdropRef.current) ? t.context.internalBackdropRef.current === I || t.context.backdropRef.current === I || contains$1(I, l) && !I?.hasAttribute("data-base-ui-portal") : !0
            }
            return !1
        },
        escapeKey: b
    });
    useScrollLock(a && o === !0, l);
    const {getReferenceProps: R, getFloatingProps: T, getTriggerProps: C} = useInteractions([y, w]);
    t.useContextCallback("onNestedDialogOpen", ce => {
        x(ce + 1)
    }
    ),
    t.useContextCallback("onNestedDialogClose", () => {
        x(0)
    }
    ),
    reactExports.useEffect( () => (r?.onNestedDialogOpen && a && r.onNestedDialogOpen(g),
    r?.onNestedDialogClose && !a && r.onNestedDialogClose(),
    () => {
        r?.onNestedDialogClose && a && r.onNestedDialogClose()
    }
    ), [a, r, g]);
    const P = reactExports.useMemo( () => R(c), [R, c])
      , W = reactExports.useMemo( () => C(c), [C, c])
      , ue = reactExports.useMemo( () => T(), [T]);
    t.useSyncedValues({
        openMethod: u,
        activeTriggerProps: P,
        inactiveTriggerProps: W,
        popupProps: ue,
        floatingRootContext: m,
        nestedOpenDialogCount: g
    })
}
const selectors$1 = {
    ...popupStoreSelectors,
    modal: createSelector(e => e.modal),
    nested: createSelector(e => e.nested),
    nestedOpenDialogCount: createSelector(e => e.nestedOpenDialogCount),
    disablePointerDismissal: createSelector(e => e.disablePointerDismissal),
    openMethod: createSelector(e => e.openMethod),
    descriptionElementId: createSelector(e => e.descriptionElementId),
    titleElementId: createSelector(e => e.titleElementId),
    viewportElement: createSelector(e => e.viewportElement),
    role: createSelector(e => e.role)
};
class DialogStore extends ReactStore {
    constructor(t) {
        super(createInitialState(t), {
            popupRef: reactExports.createRef(),
            backdropRef: reactExports.createRef(),
            internalBackdropRef: reactExports.createRef(),
            triggerElements: new PopupTriggerMap,
            onOpenChange: void 0,
            onOpenChangeComplete: void 0
        }, selectors$1)
    }
    setOpen = (t, r) => {
        if (r.preventUnmountOnClose = () => {
            this.set("preventUnmountingOnClose", !0)
        }
        ,
        !t && r.trigger == null && this.state.activeTriggerId != null && (r.trigger = this.state.activeTriggerElement ?? void 0),
        this.context.onOpenChange?.(t, r),
        r.isCanceled)
            return;
        const n = {
            open: t,
            nativeEvent: r.event,
            reason: r.reason,
            nested: this.state.nested
        };
        this.state.floatingRootContext.context.events?.emit("openchange", n);
        const a = {
            open: t
        }
          , s = r.trigger?.id ?? null;
        (s || t) && (a.activeTriggerId = s,
        a.activeTriggerElement = r.trigger ?? null),
        this.update(a)
    }
}
function createInitialState(e={}) {
    return {
        ...createInitialPopupStoreState(),
        modal: !0,
        disablePointerDismissal: !1,
        popupElement: null,
        viewportElement: null,
        descriptionElementId: void 0,
        titleElementId: void 0,
        openMethod: null,
        nested: !1,
        nestedOpenDialogCount: 0,
        role: "dialog",
        ...e
    }
}
function DialogRoot(e) {
    const {children: t, open: r, defaultOpen: n=!1, onOpenChange: a, onOpenChangeComplete: s, disablePointerDismissal: o=!1, modal: l=!0, actionsRef: u, handle: c, triggerId: p, defaultTriggerId: d=null} = e
      , f = useDialogRootContext(!0)
      , h = !!f
      , m = useRefWithInit( () => c?.store ?? new DialogStore({
        open: r ?? n,
        activeTriggerId: p !== void 0 ? p : d,
        modal: l,
        disablePointerDismissal: o,
        nested: h
    })).current;
    m.useControlledProp("open", r, n),
    m.useControlledProp("activeTriggerId", p, d),
    m.useSyncedValues({
        disablePointerDismissal: o,
        nested: h,
        modal: l
    }),
    m.useContextCallback("onOpenChange", a),
    m.useContextCallback("onOpenChangeComplete", s);
    const g = m.useState("payload");
    useDialogRoot({
        store: m,
        actionsRef: u,
        parentContext: f?.store.context
    });
    const x = reactExports.useMemo( () => ({
        store: m
    }), [m]);
    return jsxRuntimeExports.jsx(DialogRootContext.Provider, {
        value: x,
        children: typeof t == "function" ? t({
            payload: g
        }) : t
    })
}
const DialogTitle$1 = reactExports.forwardRef(function e(t, r) {
    const {render: n, className: a, id: s, ...o} = t
      , {store: l} = useDialogRootContext()
      , u = useBaseUiId(s);
    return l.useSyncedValueWithCleanup("titleElementId", u),
    useRenderElement("h2", t, {
        ref: r,
        props: [{
            id: u
        }, o]
    })
})
  , DialogTrigger$1 = reactExports.forwardRef(function e(t, r) {
    const {render: n, className: a, disabled: s=!1, nativeButton: o=!0, id: l, payload: u, handle: c, ...p} = t
      , d = useDialogRootContext(!0)
      , f = c?.store ?? d?.store;
    if (!f)
        throw new Error(formatErrorMessage(79));
    const h = useBaseUiId(l)
      , m = f.useState("floatingRootContext")
      , g = f.useState("isOpenedByTrigger", h)
      , x = reactExports.useRef(null)
      , {registerTrigger: b, isMountedByThisTrigger: y} = useTriggerDataForwarding(h, x, f, {
        payload: u
    })
      , {getButtonProps: w, buttonRef: R} = useButton({
        disabled: s,
        native: o
    })
      , T = useClick(m, {
        enabled: m != null
    })
      , C = useInteractions([T])
      , P = reactExports.useMemo( () => ({
        disabled: s,
        open: g
    }), [s, g])
      , W = f.useState("triggerProps", y);
    return useRenderElement("button", t, {
        state: P,
        ref: [R, r, b, x],
        props: [C.getReferenceProps(), W, {
            [CLICK_TRIGGER_IDENTIFIER]: "",
            id: h
        }, p, w],
        stateAttributesMapping: triggerOpenStateMapping$1
    })
});
function Dialog({...e}) {
    return jsxRuntimeExports.jsx(DialogRoot, {
        "data-slot": "dialog",
        ...e
    })
}
function DialogTrigger({...e}) {
    return jsxRuntimeExports.jsx(DialogTrigger$1, {
        "data-slot": "dialog-trigger",
        ...e
    })
}
function DialogPortal({...e}) {
    return jsxRuntimeExports.jsx(DialogPortal$1, {
        "data-slot": "dialog-portal",
        ...e
    })
}
function DialogClose({...e}) {
    return jsxRuntimeExports.jsx(DialogClose$1, {
        "data-slot": "dialog-close",
        ...e
    })
}
function DialogOverlay({className: e, ...t}) {
    return jsxRuntimeExports.jsx(DialogBackdrop, {
        "data-slot": "dialog-overlay",
        className: cn$1("data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 bg-black/80 duration-100 supports-backdrop-filter:backdrop-blur-xs fixed inset-0 isolate z-50", e),
        ...t
    })
}
function DialogContent({className: e, children: t, showCloseButton: r=!0, ...n}) {
    return jsxRuntimeExports.jsxs(DialogPortal, {
        children: [jsxRuntimeExports.jsx(DialogOverlay, {}), jsxRuntimeExports.jsxs(DialogPopup, {
            "data-slot": "dialog-content",
            className: cn$1("bg-background data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 ring-foreground/10 grid max-w-[calc(100%-2rem)] gap-4 rounded-xl p-4 text-xs/relaxed ring-1 duration-100 sm:max-w-sm fixed top-1/2 left-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2 outline-none", e),
            ...n,
            children: [t, r && jsxRuntimeExports.jsxs(DialogClose$1, {
                "data-slot": "dialog-close",
                render: jsxRuntimeExports.jsx(Button, {
                    variant: "ghost",
                    className: "absolute top-2 right-2",
                    size: "icon-sm"
                }),
                children: [jsxRuntimeExports.jsx(X$1, {}), jsxRuntimeExports.jsx("span", {
                    className: "sr-only",
                    children: "Close"
                })]
            })]
        })]
    })
}
function DialogHeader({className: e, ...t}) {
    return jsxRuntimeExports.jsx("div", {
        "data-slot": "dialog-header",
        className: cn$1("gap-1 flex flex-col", e),
        ...t
    })
}
function DialogFooter({className: e, showCloseButton: t=!1, children: r, ...n}) {
    return jsxRuntimeExports.jsxs("div", {
        "data-slot": "dialog-footer",
        className: cn$1("gap-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", e),
        ...n,
        children: [r, t && jsxRuntimeExports.jsx(DialogClose$1, {
            render: jsxRuntimeExports.jsx(Button, {
                variant: "outline"
            }),
            children: "Close"
        })]
    })
}
function DialogTitle({className: e, ...t}) {
    return jsxRuntimeExports.jsx(DialogTitle$1, {
        "data-slot": "dialog-title",
        className: cn$1("text-sm font-medium", e),
        ...t
    })
}
function DialogDescription({className: e, ...t}) {
    return jsxRuntimeExports.jsx(DialogDescription$1, {
        "data-slot": "dialog-description",
        className: cn$1("text-muted-foreground *:[a]:hover:text-foreground text-xs/relaxed *:[a]:underline *:[a]:underline-offset-3", e),
        ...t
    })
}
function useBugReport() {
    return useMutation({
        mutationFn: async e => redoClient.bugReport.submit(e)
    })
}
function BugReportForm() {
    const [e,t] = reactExports.useState(!1)
      , [r,n] = reactExports.useState("")
      , [a,s] = reactExports.useState("")
      , [o,l] = reactExports.useState(!1)
      , {mutate: u, isPending: c, error: p, reset: d} = useBugReport();
    function f(m) {
        m.preventDefault();
        const g = {
            extensionVersion: chrome.runtime.getManifest().version,
            userAgent: navigator.userAgent,
            platform: navigator.platform
        };
        u({
            title: r,
            description: a,
            metadata: g
        }, {
            onSuccess: () => {
                n(""),
                s(""),
                l(!0)
            }
        })
    }
    function h(m) {
        t(m),
        m || (n(""),
        s(""),
        l(!1),
        d())
    }
    return jsxRuntimeExports.jsxs(Dialog, {
        open: e,
        onOpenChange: h,
        children: [jsxRuntimeExports.jsx(DialogTrigger, {
            render: jsxRuntimeExports.jsxs("button", {
                className: "flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors",
                children: [jsxRuntimeExports.jsx(Bug, {
                    className: "size-4"
                }), "Report a Bug"]
            })
        }), jsxRuntimeExports.jsx(DialogContent, {
            className: "sm:max-w-md",
            children: o ? jsxRuntimeExports.jsxs("div", {
                className: "flex flex-col items-center gap-3 py-4 text-center",
                children: [jsxRuntimeExports.jsx(CircleCheck, {
                    className: "size-8 text-green-500"
                }), jsxRuntimeExports.jsxs(DialogHeader, {
                    className: "items-center",
                    children: [jsxRuntimeExports.jsx(DialogTitle, {
                        children: "Bug report submitted"
                    }), jsxRuntimeExports.jsx(DialogDescription, {
                        children: "Thank you for your report. We'll look into it."
                    })]
                }), jsxRuntimeExports.jsx(DialogFooter, {
                    className: "flex-row justify-end",
                    children: jsxRuntimeExports.jsx(DialogClose, {
                        render: jsxRuntimeExports.jsx(Button, {
                            variant: "outline"
                        }),
                        children: "Close"
                    })
                })]
            }) : jsxRuntimeExports.jsxs("form", {
                onSubmit: f,
                className: "contents",
                children: [jsxRuntimeExports.jsxs(DialogHeader, {
                    children: [jsxRuntimeExports.jsx(DialogTitle, {
                        children: "Report a Bug"
                    }), jsxRuntimeExports.jsx(DialogDescription, {
                        children: "Describe the issue you encountered and we'll look into it."
                    })]
                }), jsxRuntimeExports.jsxs("div", {
                    className: "space-y-3",
                    children: [jsxRuntimeExports.jsx("input", {
                        type: "text",
                        placeholder: "Title",
                        value: r,
                        onChange: m => n(m.target.value),
                        maxLength: 200,
                        required: !0,
                        className: "w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    }), jsxRuntimeExports.jsx("textarea", {
                        placeholder: "Describe the bug...",
                        value: a,
                        onChange: m => s(m.target.value),
                        maxLength: 5e3,
                        required: !0,
                        rows: 4,
                        className: "w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                    }), p && jsxRuntimeExports.jsx("p", {
                        className: "text-sm text-destructive",
                        children: p.message || "Failed to submit. Please try again."
                    })]
                }), jsxRuntimeExports.jsxs(DialogFooter, {
                    className: "flex-row justify-end",
                    children: [jsxRuntimeExports.jsx(DialogClose, {
                        render: jsxRuntimeExports.jsx(Button, {
                            variant: "outline"
                        }),
                        children: "Cancel"
                    }), jsxRuntimeExports.jsxs(Button, {
                        type: "submit",
                        disabled: c,
                        children: [c && jsxRuntimeExports.jsx(LoaderCircle, {
                            className: "size-3 mr-1 animate-spin"
                        }), "Submit"]
                    })]
                })]
            })
        })]
    })
}
function Card({className: e, size: t="default", ...r}) {
    return jsxRuntimeExports.jsx("div", {
        "data-slot": "card",
        "data-size": t,
        className: cn$1("ring-foreground/10 bg-card text-card-foreground gap-4 overflow-hidden rounded-lg py-4 text-xs/relaxed ring-1 has-[>img:first-child]:pt-0 data-[size=sm]:gap-3 data-[size=sm]:py-3 *:[img:first-child]:rounded-t-lg *:[img:last-child]:rounded-b-lg group/card flex flex-col", e),
        ...r
    })
}
function CardHeader({className: e, ...t}) {
    return jsxRuntimeExports.jsx("div", {
        "data-slot": "card-header",
        className: cn$1("gap-1 rounded-t-lg px-4 group-data-[size=sm]/card:px-3 [.border-b]:pb-4 group-data-[size=sm]/card:[.border-b]:pb-3 group/card-header @container/card-header grid auto-rows-min items-start has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto]", e),
        ...t
    })
}
function CardTitle({className: e, ...t}) {
    return jsxRuntimeExports.jsx("div", {
        "data-slot": "card-title",
        className: cn$1("text-sm font-medium", e),
        ...t
    })
}
function CardDescription({className: e, ...t}) {
    return jsxRuntimeExports.jsx("div", {
        "data-slot": "card-description",
        className: cn$1("text-muted-foreground text-xs/relaxed", e),
        ...t
    })
}
function CardContent({className: e, ...t}) {
    return jsxRuntimeExports.jsx("div", {
        "data-slot": "card-content",
        className: cn$1("px-4 group-data-[size=sm]/card:px-3", e),
        ...t
    })
}
const log$6 = logger.scoped("mount-store");
create( (e, t) => ({
    mounts: [],
    isLoading: !1,
    isLoaded: !1,
    loadMounts: async () => {
        if (!t().isLoading) {
            e({
                isLoading: !0
            }),
            log$6.log("Loading mounts...");
            try {
                const r = await getStoredHandles();
                log$6.log(`Found ${r.length} stored mount(s)`);
                const n = [];
                for (const o of r) {
                    log$6.log(`Checking permission for "${o.name}"...`);
                    const u = await queryPermission(o.handle, o.mode) ? "connected" : "disconnected";
                    log$6.log(`Mount "${o.name}" permission: ${u}`),
                    n.push({
                        name: o.name,
                        mode: o.mode,
                        mountedAt: o.mountedAt,
                        status: u,
                        originalPath: o.handle.name
                    });
                    try {
                        getUnifiedFs().addMount(o.name, o.handle, o.mode, u),
                        log$6.log(`Synced mount "${o.name}" to UnifiedFs`)
                    } catch {
                        log$6.log(`UnifiedFs not initialized yet, skipping sync for "${o.name}"`)
                    }
                }
                const a = n.filter(o => o.status === "connected").length
                  , s = n.filter(o => o.status === "disconnected").length;
                log$6.log(`Load complete: ${a} connected, ${s} disconnected`),
                e({
                    mounts: n,
                    isLoading: !1,
                    isLoaded: !0
                })
            } catch (r) {
                log$6.error("Failed to load mounts:", r),
                e({
                    isLoading: !1,
                    isLoaded: !0
                })
            }
        }
    }
    ,
    addMount: r => {
        e(n => ({
            mounts: [...n.mounts.filter(a => a.name !== r.name), r]
        }))
    }
    ,
    removeMount: async r => {
        try {
            await removeHandle(r);
            try {
                getUnifiedFs().removeMount(r)
            } catch {}
            e(n => ({
                mounts: n.mounts.filter(a => a.name !== r)
            }))
        } catch (n) {
            throw log$6.error("Failed to remove mount:", n),
            n
        }
    }
    ,
    updateMountStatus: (r, n) => {
        log$6.log(`Updating mount "${r}" status to: ${n}`),
        e(a => ({
            mounts: a.mounts.map(s => s.name === r ? {
                ...s,
                status: n
            } : s)
        }));
        try {
            getUnifiedFs().updateMountStatus(r, n),
            log$6.log(`Synced status update to UnifiedFs for "${r}"`)
        } catch {
            log$6.warn(`UnifiedFs not initialized, could not sync status for "${r}"`)
        }
    }
    ,
    refreshMounts: async () => {
        e({
            isLoaded: !1
        }),
        await t().loadMounts()
    }
}));
logger.scoped("debug");
function useOnFirstRender(e) {
    const t = reactExports.useRef(!0);
    t.current && (t.current = !1,
    e())
}
const SelectRootContext = reactExports.createContext(null)
  , SelectFloatingContext = reactExports.createContext(null);
function useSelectRootContext() {
    const e = reactExports.useContext(SelectRootContext);
    if (e === null)
        throw new Error(formatErrorMessage(60));
    return e
}
function useSelectFloatingContext() {
    const e = reactExports.useContext(SelectFloatingContext);
    if (e === null)
        throw new Error(formatErrorMessage(61));
    return e
}
let FieldControlDataAttributes = (function(e) {
    return e.disabled = "data-disabled",
    e.valid = "data-valid",
    e.invalid = "data-invalid",
    e.touched = "data-touched",
    e.dirty = "data-dirty",
    e.filled = "data-filled",
    e.focused = "data-focused",
    e
}
)({});
const DEFAULT_VALIDITY_STATE = {
    badInput: !1,
    customError: !1,
    patternMismatch: !1,
    rangeOverflow: !1,
    rangeUnderflow: !1,
    stepMismatch: !1,
    tooLong: !1,
    tooShort: !1,
    typeMismatch: !1,
    valid: null,
    valueMissing: !1
}
  , fieldValidityMapping = {
    valid(e) {
        return e === null ? null : e ? {
            [FieldControlDataAttributes.valid]: ""
        } : {
            [FieldControlDataAttributes.invalid]: ""
        }
    }
}
  , FieldRootContext = reactExports.createContext({
    invalid: void 0,
    name: void 0,
    validityData: {
        state: DEFAULT_VALIDITY_STATE,
        errors: [],
        error: "",
        value: "",
        initialValue: null
    },
    setValidityData: NOOP,
    disabled: void 0,
    touched: !1,
    setTouched: NOOP,
    dirty: !1,
    setDirty: NOOP,
    filled: !1,
    setFilled: NOOP,
    focused: !1,
    setFocused: NOOP,
    validate: () => null,
    validationMode: "onSubmit",
    validationDebounceTime: 0,
    shouldValidateOnChange: () => !1,
    state: {
        disabled: !1,
        valid: null,
        touched: !1,
        dirty: !1,
        filled: !1,
        focused: !1
    },
    markedDirtyRef: {
        current: !1
    },
    validation: {
        getValidationProps: (e=EMPTY_OBJECT) => e,
        getInputValidationProps: (e=EMPTY_OBJECT) => e,
        inputRef: {
            current: null
        },
        commit: async () => {}
    }
});
function useFieldRootContext(e=!0) {
    const t = reactExports.useContext(FieldRootContext);
    if (t.setValidityData === NOOP && !e)
        throw new Error(formatErrorMessage(28));
    return t
}
const LabelableContext = reactExports.createContext({
    controlId: void 0,
    setControlId: NOOP,
    labelId: void 0,
    setLabelId: NOOP,
    messageIds: [],
    setMessageIds: NOOP,
    getDescriptionProps: e => e
});
function useLabelableContext() {
    return reactExports.useContext(LabelableContext)
}
function useLabelableId(e={}) {
    const {id: t, implicit: r=!1, controlRef: n} = e
      , {controlId: a, setControlId: s} = useLabelableContext()
      , o = useBaseUiId(t);
    return useIsoLayoutEffect( () => {
        if (!(!r && !t || s === NOOP)) {
            if (r) {
                const l = n?.current;
                isElement(l) && l.closest("label") != null ? s(t ?? null) : s(a ?? o)
            } else
                t && s(t);
            return () => {
                t && s(void 0)
            }
        }
    }
    , [t, n, a, s, r, o]),
    a ?? o
}
const defaultItemEquality = (e, t) => Object.is(e, t);
function compareItemEquality(e, t, r) {
    return e == null || t == null ? Object.is(e, t) : r(e, t)
}
function itemIncludes(e, t, r) {
    return !e || e.length === 0 ? !1 : e.some(n => n === void 0 ? !1 : compareItemEquality(n, t, r))
}
function findItemIndex(e, t, r) {
    return !e || e.length === 0 ? -1 : e.findIndex(n => n === void 0 ? !1 : compareItemEquality(n, t, r))
}
function removeItem(e, t, r) {
    return e.filter(n => !compareItemEquality(n, t, r))
}
function serializeValue(e) {
    if (e == null)
        return "";
    if (typeof e == "string")
        return e;
    try {
        return JSON.stringify(e)
    } catch {
        return String(e)
    }
}
function isGroupedItems(e) {
    return e != null && e.length > 0 && typeof e[0] == "object" && e[0] != null && "items"in e[0]
}
function stringifyAsLabel(e, t) {
    if (t && e != null)
        return t(e) ?? "";
    if (e && typeof e == "object") {
        if ("label"in e && e.label != null)
            return String(e.label);
        if ("value"in e)
            return String(e.value)
    }
    return serializeValue(e)
}
function stringifyAsValue(e, t) {
    return t && e != null ? t(e) ?? "" : e && typeof e == "object" && "value"in e && "label"in e ? serializeValue(e.value) : serializeValue(e)
}
function resolveSelectedLabel(e, t, r) {
    if (r && e != null)
        return r(e);
    if (e && typeof e == "object" && "label"in e && e.label != null)
        return e.label;
    if (t && !Array.isArray(t))
        return t[e] ?? stringifyAsLabel(e, r);
    if (Array.isArray(t)) {
        const n = isGroupedItems(t) ? t.flatMap(a => a.items) : t;
        if (e == null) {
            const a = n.find(s => s.value == null);
            return a && a.label != null ? a.label : stringifyAsLabel(e, r)
        }
        if (typeof e != "object") {
            const a = n.find(s => s && s.value === e);
            return a && a.label != null ? a.label : stringifyAsLabel(e, r)
        }
        if ("value"in e) {
            const a = n.find(s => s && s.value === e.value);
            if (a && a.label != null)
                return a.label
        }
    }
    return stringifyAsLabel(e, r)
}
function resolveMultipleLabels(e, t) {
    return !Array.isArray(e) || e.length === 0 ? "" : e.map(r => stringifyAsLabel(r, t)).join(", ")
}
const selectors = {
    id: createSelector(e => e.id),
    modal: createSelector(e => e.modal),
    multiple: createSelector(e => e.multiple),
    items: createSelector(e => e.items),
    itemToStringLabel: createSelector(e => e.itemToStringLabel),
    itemToStringValue: createSelector(e => e.itemToStringValue),
    isItemEqualToValue: createSelector(e => e.isItemEqualToValue),
    value: createSelector(e => e.value),
    open: createSelector(e => e.open),
    mounted: createSelector(e => e.mounted),
    forceMount: createSelector(e => e.forceMount),
    transitionStatus: createSelector(e => e.transitionStatus),
    openMethod: createSelector(e => e.openMethod),
    activeIndex: createSelector(e => e.activeIndex),
    selectedIndex: createSelector(e => e.selectedIndex),
    isActive: createSelector( (e, t) => e.activeIndex === t),
    isSelected: createSelector( (e, t, r) => {
        const n = e.isItemEqualToValue
          , a = e.value;
        return e.multiple ? Array.isArray(a) && a.some(s => compareItemEquality(s, r, n)) : e.selectedIndex === t && e.selectedIndex !== null ? !0 : compareItemEquality(a, r, n)
    }
    ),
    isSelectedByFocus: createSelector( (e, t) => e.selectedIndex === t),
    popupProps: createSelector(e => e.popupProps),
    triggerProps: createSelector(e => e.triggerProps),
    triggerElement: createSelector(e => e.triggerElement),
    positionerElement: createSelector(e => e.positionerElement),
    listElement: createSelector(e => e.listElement),
    scrollUpArrowVisible: createSelector(e => e.scrollUpArrowVisible),
    scrollDownArrowVisible: createSelector(e => e.scrollDownArrowVisible),
    hasScrollArrows: createSelector(e => e.hasScrollArrows),
    serializedValue: createSelector(e => {
        const {multiple: t, value: r, itemToStringValue: n} = e;
        return t && Array.isArray(r) && r.length === 0 ? "" : stringifyAsValue(r, n)
    }
    )
}
  , FormContext = reactExports.createContext({
    formRef: {
        current: {
            fields: new Map
        }
    },
    errors: {},
    clearErrors: NOOP,
    validationMode: "onSubmit",
    submitAttemptedRef: {
        current: !1
    }
});
function useFormContext() {
    return reactExports.useContext(FormContext)
}
function getCombinedFieldValidityData(e, t) {
    return {
        ...e,
        state: {
            ...e.state,
            valid: !t && e.state.valid
        }
    }
}
function useField(e) {
    const {enabled: t=!0, value: r, id: n, name: a, controlRef: s, commit: o} = e
      , {formRef: l} = useFormContext()
      , {invalid: u, markedDirtyRef: c, validityData: p, setValidityData: d} = useFieldRootContext()
      , f = useStableCallback(e.getValue);
    useIsoLayoutEffect( () => {
        if (!t)
            return;
        let h = r;
        h === void 0 && (h = f()),
        p.initialValue === null && h !== null && d(m => ({
            ...m,
            initialValue: h
        }))
    }
    , [t, d, r, p.initialValue, f]),
    useIsoLayoutEffect( () => {
        !t || !n || l.current.fields.set(n, {
            getValue: f,
            name: a,
            controlRef: s,
            validityData: getCombinedFieldValidityData(p, u),
            validate() {
                let h = r;
                h === void 0 && (h = f()),
                c.current = !0,
                reactDomExports.flushSync( () => o(h))
            }
        })
    }
    , [o, s, t, l, f, n, u, c, a, p, r]),
    useIsoLayoutEffect( () => {
        const h = l.current.fields;
        return () => {
            n && h.delete(n)
        }
    }
    , [l, n])
}
function useValueChanged(e, t) {
    const r = reactExports.useRef(e)
      , n = useStableCallback(t);
    useIsoLayoutEffect( () => {
        r.current !== e && n(r.current)
    }
    , [e, n]),
    useIsoLayoutEffect( () => {
        r.current = e
    }
    , [e])
}
function SelectRoot(e) {
    const {id: t, value: r, defaultValue: n=null, onValueChange: a, open: s, defaultOpen: o=!1, onOpenChange: l, name: u, disabled: c=!1, readOnly: p=!1, required: d=!1, modal: f=!0, actionsRef: h, inputRef: m, onOpenChangeComplete: g, items: x, multiple: b=!1, itemToStringLabel: y, itemToStringValue: w, isItemEqualToValue: R=defaultItemEquality, highlightItemOnHover: T=!0, children: C} = e
      , {clearErrors: P} = useFormContext()
      , {setDirty: W, shouldValidateOnChange: ue, validityData: ce, setFilled: ve, name: I, disabled: M, validation: $} = useFieldRootContext()
      , {controlId: pt} = useLabelableContext()
      , ba = useLabelableId({
        id: t
    })
      , us = M || c
      , Wd = I ?? u
      , [Mr,Kt] = useControlled({
        controlled: r,
        default: b ? n ?? EMPTY_ARRAY : n,
        name: "Select",
        state: "value"
    })
      , [lt,Ht] = useControlled({
        controlled: s,
        default: o,
        name: "Select",
        state: "open"
    })
      , $e = reactExports.useRef([])
      , G = reactExports.useRef([])
      , he = reactExports.useRef(null)
      , Xe = reactExports.useRef(null)
      , jr = reactExports.useRef(0)
      , fs = reactExports.useRef(null)
      , bf = reactExports.useRef([])
      , $0 = reactExports.useRef(!1)
      , ie = reactExports.useRef(!1)
      , He = reactExports.useRef(null)
      , mm = reactExports.useRef({
        allowSelectedMouseUp: !1,
        allowUnselectedMouseUp: !1
    })
      , Oe = reactExports.useRef(!1)
      , {mounted: R0, setMounted: gm, transitionStatus: $s} = useTransitionStatus(lt)
      , {openMethod: go, triggerProps: Yl, reset: lv} = useOpenInteractionType(lt)
      , Ox = useRefWithInit( () => new Store({
        id: ba,
        modal: f,
        multiple: b,
        itemToStringLabel: y,
        itemToStringValue: w,
        isItemEqualToValue: R,
        value: Mr,
        open: lt,
        mounted: R0,
        transitionStatus: $s,
        items: x,
        forceMount: !1,
        openMethod: null,
        activeIndex: null,
        selectedIndex: null,
        popupProps: {},
        triggerProps: {},
        triggerElement: null,
        positionerElement: null,
        listElement: null,
        scrollUpArrowVisible: !1,
        scrollDownArrowVisible: !1,
        hasScrollArrows: !1
    })).current
      , ev = useStore$1(Ox, selectors.activeIndex)
      , iv = useStore$1(Ox, selectors.selectedIndex)
      , N = useStore$1(Ox, selectors.triggerElement)
      , bi = useStore$1(Ox, selectors.positionerElement)
      , Rx = reactExports.useMemo( () => b && Array.isArray(Mr) && Mr.length === 0 ? "" : stringifyAsValue(Mr, w), [b, Mr, w])
      , sv = reactExports.useMemo( () => b && Array.isArray(Mr) ? Mr.map(Iv => stringifyAsValue(Iv, w)) : stringifyAsValue(Mr, w), [b, Mr, w])
      , h0 = useValueAsRef(Ox.state.triggerElement);
    useField({
        id: ba,
        commit: $.commit,
        value: Mr,
        controlRef: h0,
        name: Wd,
        getValue: () => sv
    });
    const av = reactExports.useRef(Mr);
    useIsoLayoutEffect( () => {
        Mr !== av.current && Ox.set("forceMount", !0)
    }
    , [Ox, Mr]),
    useIsoLayoutEffect( () => {
        ve(Mr !== null)
    }
    , [Mr, ve]),
    useIsoLayoutEffect(function() {
        if (lt)
            return;
        const Wl = bf.current;
        if (b) {
            const kr = Array.isArray(Mr) ? Mr : [];
            if (kr.length === 0) {
                Ox.set("selectedIndex", null);
                return
            }
            const _x = kr[kr.length - 1]
              , nv = findItemIndex(Wl, _x, R);
            Ox.set("selectedIndex", nv === -1 ? null : nv);
            return
        }
        const ut = findItemIndex(Wl, Mr, R);
        Ox.set("selectedIndex", ut === -1 ? null : ut)
    }, [b, lt, Mr, bf, R, Ox]),
    useValueChanged(Mr, () => {
        P(Wd),
        W(Mr !== ce.initialValue),
        ue() ? $.commit(Mr) : $.commit(Mr, !0)
    }
    );
    const L = useStableCallback( (Iv, Wl) => {
        if (l?.(Iv, Wl),
        !Wl.isCanceled && (Ht(Iv),
        !Iv && Ox.state.activeIndex !== null)) {
            const ut = $e.current[Ox.state.activeIndex];
            queueMicrotask( () => {
                ut?.setAttribute("tabindex", "-1")
            }
            )
        }
    }
    )
      , A = useStableCallback( () => {
        gm(!1),
        Ox.set("activeIndex", null),
        lv(),
        g?.(!1)
    }
    );
    useOpenChangeComplete({
        enabled: !h,
        open: lt,
        ref: he,
        onComplete() {
            lt || A()
        }
    }),
    reactExports.useImperativeHandle(h, () => ({
        unmount: A
    }), [A]);
    const F = useStableCallback( (Iv, Wl) => {
        a?.(Iv, Wl),
        !Wl.isCanceled && Kt(Iv)
    }
    )
      , Qt = useStableCallback( () => {
        const Iv = Ox.state.listElement || he.current;
        if (!Iv)
            return;
        const Wl = Iv.scrollTop
          , ut = Iv.scrollTop + Iv.clientHeight
          , kr = Wl > 1
          , _x = ut < Iv.scrollHeight - 1;
        Ox.state.scrollUpArrowVisible !== kr && Ox.set("scrollUpArrowVisible", kr),
        Ox.state.scrollDownArrowVisible !== _x && Ox.set("scrollDownArrowVisible", _x)
    }
    )
      , ps = useFloatingRootContext({
        open: lt,
        onOpenChange: L,
        elements: {
            reference: N,
            floating: bi
        }
    })
      , pr = useClick(ps, {
        enabled: !p && !us,
        event: "mousedown"
    })
      , mo = useDismiss(ps, {
        bubbles: !1
    })
      , Lt = useListNavigation(ps, {
        enabled: !p && !us,
        listRef: $e,
        activeIndex: ev,
        selectedIndex: iv,
        disabledIndices: EMPTY_ARRAY,
        onNavigate(Iv) {
            Iv === null && !lt || Ox.set("activeIndex", Iv)
        },
        focusItemOnHover: !1
    })
      , rv = useTypeahead(ps, {
        enabled: !p && !us && (lt || !b),
        listRef: G,
        activeIndex: ev,
        selectedIndex: iv,
        onMatch(Iv) {
            lt ? Ox.set("activeIndex", Iv) : F(bf.current[Iv], createChangeEventDetails("none"))
        },
        onTypingChange(Iv) {
            $0.current = Iv
        }
    })
      , {getReferenceProps: Ev, getFloatingProps: re, getItemProps: dv} = useInteractions([pr, mo, Lt, rv])
      , mv = reactExports.useMemo( () => mergeProps$1(Ev(), Yl), [Ev, Yl]);
    useOnFirstRender( () => {
        Ox.update({
            popupProps: re(),
            triggerProps: mv
        })
    }
    ),
    useIsoLayoutEffect( () => {
        Ox.update({
            id: ba,
            modal: f,
            multiple: b,
            value: Mr,
            open: lt,
            mounted: R0,
            transitionStatus: $s,
            popupProps: re(),
            triggerProps: mv,
            items: x,
            itemToStringLabel: y,
            itemToStringValue: w,
            isItemEqualToValue: R,
            openMethod: go
        })
    }
    , [Ox, ba, f, b, Mr, lt, R0, $s, re, mv, x, y, w, R, go]);
    const zm = reactExports.useMemo( () => ({
        store: Ox,
        name: Wd,
        required: d,
        disabled: us,
        readOnly: p,
        multiple: b,
        itemToStringLabel: y,
        itemToStringValue: w,
        highlightItemOnHover: T,
        setValue: F,
        setOpen: L,
        listRef: $e,
        popupRef: he,
        scrollHandlerRef: Xe,
        handleScrollArrowVisibility: Qt,
        scrollArrowsMountedCountRef: jr,
        getItemProps: dv,
        events: ps.context.events,
        valueRef: fs,
        valuesRef: bf,
        labelsRef: G,
        typingRef: $0,
        selectionRef: mm,
        selectedItemTextRef: He,
        validation: $,
        onOpenChangeComplete: g,
        keyboardActiveRef: ie,
        alignItemWithTriggerActiveRef: Oe,
        initialValueRef: av
    }), [Ox, Wd, d, us, p, b, y, w, T, F, L, dv, ps.context.events, $, g, Qt])
      , uv = useMergedRefs(m, $.inputRef)
      , Rv = b && Array.isArray(Mr) && Mr.length > 0
      , Dv = reactExports.useMemo( () => !b || !Array.isArray(Mr) || !Wd ? null : Mr.map(Iv => {
        const Wl = stringifyAsValue(Iv, w);
        return jsxRuntimeExports.jsx("input", {
            type: "hidden",
            name: Wd,
            value: Wl
        }, Wl)
    }
    ), [b, Mr, Wd, w]);
    return jsxRuntimeExports.jsx(SelectRootContext.Provider, {
        value: zm,
        children: jsxRuntimeExports.jsxs(SelectFloatingContext.Provider, {
            value: ps,
            children: [C, jsxRuntimeExports.jsx("input", {
                ...$.getInputValidationProps({
                    onFocus() {
                        Ox.state.triggerElement?.focus()
                    },
                    onChange(Iv) {
                        if (Iv.nativeEvent.defaultPrevented)
                            return;
                        const Wl = Iv.target.value
                          , ut = createChangeEventDetails(none, Iv.nativeEvent);
                        function kr() {
                            if (b)
                                return;
                            const _x = bf.current.find(nv => stringifyAsValue(nv, w).toLowerCase() === Wl.toLowerCase());
                            _x != null && (W(_x !== ce.initialValue),
                            F(_x, ut),
                            ue() && $.commit(_x))
                        }
                        Ox.set("forceMount", !0),
                        queueMicrotask(kr)
                    }
                }),
                id: t || pt || void 0,
                name: b ? void 0 : Wd,
                value: Rx,
                disabled: us,
                required: d && !Rv,
                readOnly: p,
                ref: uv,
                style: visuallyHidden,
                tabIndex: -1,
                "aria-hidden": !0
            }), Dv]
        })
    })
}
const BOUNDARY_OFFSET = 2
  , stateAttributesMapping$3 = {
    ...pressableTriggerOpenStateMapping,
    ...fieldValidityMapping,
    value: () => null
}
  , SelectTrigger$1 = reactExports.forwardRef(function e(t, r) {
    const {render: n, className: a, disabled: s=!1, nativeButton: o=!0, ...l} = t
      , {setTouched: u, setFocused: c, validationMode: p, state: d, disabled: f} = useFieldRootContext()
      , {labelId: h} = useLabelableContext()
      , {store: m, setOpen: g, selectionRef: x, validation: b, readOnly: y, alignItemWithTriggerActiveRef: w, disabled: R, keyboardActiveRef: T} = useSelectRootContext()
      , C = f || R || s
      , P = useStore$1(m, selectors.open)
      , W = useStore$1(m, selectors.value)
      , ue = useStore$1(m, selectors.triggerProps)
      , ce = useStore$1(m, selectors.positionerElement)
      , ve = useStore$1(m, selectors.listElement)
      , I = useStore$1(m, selectors.serializedValue)
      , M = useValueAsRef(ce)
      , $ = reactExports.useRef(null)
      , pt = useTimeout()
      , ba = useTimeout()
      , {getButtonProps: us, buttonRef: Wd} = useButton({
        disabled: C,
        native: o
    })
      , Mr = useStableCallback(Xe => {
        m.set("triggerElement", Xe)
    }
    )
      , Kt = useMergedRefs(r, $, Wd, Mr)
      , lt = useTimeout()
      , Ht = useTimeout();
    reactExports.useEffect( () => {
        if (P)
            return Ht.start(200, () => {
                x.current.allowUnselectedMouseUp = !0,
                lt.start(200, () => {
                    x.current.allowSelectedMouseUp = !0
                }
                )
            }
            ),
            () => {
                lt.clear(),
                Ht.clear()
            }
            ;
        x.current = {
            allowSelectedMouseUp: !1,
            allowUnselectedMouseUp: !1
        },
        ba.clear()
    }
    , [P, x, ba, lt, Ht]);
    const $e = reactExports.useMemo( () => ve?.id ?? getFloatingFocusElement(ce)?.id, [ve, ce])
      , G = mergeProps$1(ue, {
        role: "combobox",
        "aria-expanded": P ? "true" : "false",
        "aria-haspopup": "listbox",
        "aria-controls": P ? $e : void 0,
        "aria-labelledby": h,
        "aria-readonly": y || void 0,
        tabIndex: C ? -1 : 0,
        ref: Kt,
        onFocus(Xe) {
            c(!0),
            P && w.current && g(!1, createChangeEventDetails(focusOut, Xe.nativeEvent)),
            pt.start(0, () => {
                m.set("forceMount", !0)
            }
            )
        },
        onBlur() {
            u(!0),
            c(!1),
            p === "onBlur" && b.commit(W)
        },
        onPointerMove() {
            T.current = !1
        },
        onKeyDown() {
            T.current = !0
        },
        onMouseDown(Xe) {
            if (P)
                return;
            const jr = ownerDocument(Xe.currentTarget);
            function fs(bf) {
                if (!$.current)
                    return;
                const $0 = bf.target;
                if (contains$1($.current, $0) || contains$1(M.current, $0) || $0 === $.current)
                    return;
                const ie = getPseudoElementBounds($.current);
                bf.clientX >= ie.left - BOUNDARY_OFFSET && bf.clientX <= ie.right + BOUNDARY_OFFSET && bf.clientY >= ie.top - BOUNDARY_OFFSET && bf.clientY <= ie.bottom + BOUNDARY_OFFSET || g(!1, createChangeEventDetails(cancelOpen, bf))
            }
            ba.start(0, () => {
                jr.addEventListener("mouseup", fs, {
                    once: !0
                })
            }
            )
        }
    }, b.getValidationProps, l, us);
    G.role = "combobox";
    const he = reactExports.useMemo( () => ({
        ...d,
        open: P,
        disabled: C,
        value: W,
        readOnly: y,
        placeholder: !I
    }), [d, P, C, W, y, I]);
    return useRenderElement("button", t, {
        ref: [r, $],
        state: he,
        stateAttributesMapping: stateAttributesMapping$3,
        props: G
    })
})
  , stateAttributesMapping$2 = {
    value: () => null
}
  , SelectValue$1 = reactExports.forwardRef(function e(t, r) {
    const {className: n, render: a, children: s, ...o} = t
      , {store: l, valueRef: u} = useSelectRootContext()
      , c = useStore$1(l, selectors.value)
      , p = useStore$1(l, selectors.items)
      , d = useStore$1(l, selectors.itemToStringLabel)
      , f = useStore$1(l, selectors.serializedValue)
      , h = reactExports.useMemo( () => ({
        value: c,
        placeholder: !f
    }), [c, f])
      , m = typeof s == "function" ? s(c) : s ?? (Array.isArray(c) ? resolveMultipleLabels(c, d) : resolveSelectedLabel(c, p, d));
    return useRenderElement("span", t, {
        state: h,
        ref: [r, u],
        props: [{
            children: m
        }, o],
        stateAttributesMapping: stateAttributesMapping$2
    })
})
  , SelectIcon = reactExports.forwardRef(function e(t, r) {
    const {className: n, render: a, ...s} = t
      , {store: o} = useSelectRootContext()
      , l = useStore$1(o, selectors.open)
      , u = reactExports.useMemo( () => ({
        open: l
    }), [l]);
    return useRenderElement("span", t, {
        state: u,
        ref: r,
        props: [{
            "aria-hidden": !0,
            children: "▼"
        }, s],
        stateAttributesMapping: triggerOpenStateMapping$1
    })
})
  , SelectPortalContext = reactExports.createContext(void 0)
  , SelectPortal = reactExports.forwardRef(function e(t, r) {
    const {store: n} = useSelectRootContext()
      , a = useStore$1(n, selectors.mounted)
      , s = useStore$1(n, selectors.forceMount);
    return a || s ? jsxRuntimeExports.jsx(SelectPortalContext.Provider, {
        value: !0,
        children: jsxRuntimeExports.jsx(FloatingPortal, {
            ref: r,
            ...t
        })
    }) : null
})
  , SelectPositionerContext = reactExports.createContext(void 0);
function useSelectPositionerContext() {
    const e = reactExports.useContext(SelectPositionerContext);
    if (!e)
        throw new Error(formatErrorMessage(59));
    return e
}
function clearStyles(e, t) {
    e && Object.assign(e.style, t)
}
const LIST_FUNCTIONAL_STYLES = {
    position: "relative",
    maxHeight: "100%",
    overflowX: "hidden",
    overflowY: "auto"
}
  , FIXED = {
    position: "fixed"
}
  , SelectPositioner = reactExports.forwardRef(function e(t, r) {
    const {anchor: n, positionMethod: a="absolute", className: s, render: o, side: l="bottom", align: u="center", sideOffset: c=0, alignOffset: p=0, collisionBoundary: d="clipping-ancestors", collisionPadding: f, arrowPadding: h=5, sticky: m=!1, disableAnchorTracking: g, alignItemWithTrigger: x=!0, collisionAvoidance: b=DROPDOWN_COLLISION_AVOIDANCE, ...y} = t
      , {store: w, listRef: R, labelsRef: T, alignItemWithTriggerActiveRef: C, selectedItemTextRef: P, valuesRef: W, initialValueRef: ue, popupRef: ce, setValue: ve} = useSelectRootContext()
      , I = useSelectFloatingContext()
      , M = useStore$1(w, selectors.open)
      , $ = useStore$1(w, selectors.mounted)
      , pt = useStore$1(w, selectors.modal)
      , ba = useStore$1(w, selectors.value)
      , us = useStore$1(w, selectors.openMethod)
      , Wd = useStore$1(w, selectors.positionerElement)
      , Mr = useStore$1(w, selectors.triggerElement)
      , Kt = useStore$1(w, selectors.isItemEqualToValue)
      , lt = reactExports.useRef(null)
      , Ht = reactExports.useRef(null)
      , [$e,G] = reactExports.useState(x)
      , he = $ && $e && us !== "touch";
    !$ && $e !== x && G(x),
    useIsoLayoutEffect( () => {
        $ || (selectors.scrollUpArrowVisible(w.state) && w.set("scrollUpArrowVisible", !1),
        selectors.scrollDownArrowVisible(w.state) && w.set("scrollDownArrowVisible", !1))
    }
    , [w, $]),
    reactExports.useImperativeHandle(C, () => he),
    useScrollLock((he || pt) && M && us !== "touch", Mr);
    const Xe = useAnchorPositioning({
        anchor: n,
        floatingRootContext: I,
        positionMethod: a,
        mounted: $,
        side: l,
        sideOffset: c,
        align: u,
        alignOffset: p,
        arrowPadding: h,
        collisionBoundary: d,
        collisionPadding: f,
        sticky: m,
        disableAnchorTracking: g ?? he,
        collisionAvoidance: b,
        keepMounted: !0
    })
      , jr = he ? "none" : Xe.side
      , fs = he ? FIXED : Xe.positionerStyles
      , bf = reactExports.useMemo( () => {
        const gm = {};
        return M || (gm.pointerEvents = "none"),
        {
            role: "presentation",
            hidden: !$,
            style: {
                ...fs,
                ...gm
            }
        }
    }
    , [M, $, fs])
      , $0 = reactExports.useMemo( () => ({
        open: M,
        side: jr,
        align: Xe.align,
        anchorHidden: Xe.anchorHidden
    }), [M, jr, Xe.align, Xe.anchorHidden])
      , ie = useStableCallback(gm => {
        w.set("positionerElement", gm)
    }
    )
      , He = useRenderElement("div", t, {
        ref: [r, ie],
        state: $0,
        stateAttributesMapping: popupStateMapping,
        props: [bf, y]
    })
      , mm = reactExports.useRef(0)
      , Oe = useStableCallback(gm => {
        if (gm.size === 0 && mm.current === 0 || W.current.length === 0)
            return;
        const $s = mm.current;
        if (mm.current = gm.size,
        gm.size === $s)
            return;
        const go = createChangeEventDetails(none);
        if ($s !== 0 && !w.state.multiple && ba !== null && findItemIndex(W.current, ba, Kt) === -1) {
            const lv = ue.current
              , ev = lv != null && itemIncludes(W.current, lv, Kt) ? lv : null;
            ve(ev, go),
            ev === null && (w.set("selectedIndex", null),
            P.current = null)
        }
        if ($s !== 0 && w.state.multiple && Array.isArray(ba)) {
            const Yl = ba.filter(lv => itemIncludes(W.current, lv, Kt));
            (Yl.length !== ba.length || Yl.some(lv => !itemIncludes(ba, lv, Kt))) && (ve(Yl, go),
            Yl.length === 0 && (w.set("selectedIndex", null),
            P.current = null))
        }
        if (M && he) {
            w.update({
                scrollUpArrowVisible: !1,
                scrollDownArrowVisible: !1
            });
            const Yl = {
                height: ""
            };
            clearStyles(Wd, Yl),
            clearStyles(ce.current, Yl)
        }
    }
    )
      , R0 = reactExports.useMemo( () => ({
        ...Xe,
        side: jr,
        alignItemWithTriggerActive: he,
        setControlledAlignItemWithTrigger: G,
        scrollUpArrowRef: lt,
        scrollDownArrowRef: Ht
    }), [Xe, jr, he, G]);
    return jsxRuntimeExports.jsx(CompositeList, {
        elementsRef: R,
        labelsRef: T,
        onMapChange: Oe,
        children: jsxRuntimeExports.jsxs(SelectPositionerContext.Provider, {
            value: R0,
            children: [$ && pt && jsxRuntimeExports.jsx(InternalBackdrop, {
                inert: inertValue(!M),
                cutout: Mr
            }), He]
        })
    })
});
function isMouseWithinBounds(e) {
    const t = e.currentTarget.getBoundingClientRect();
    return t.top + 1 <= e.clientY && e.clientY <= t.bottom - 1 && t.left + 1 <= e.clientX && e.clientX <= t.right - 1
}
const stateAttributesMapping$1 = {
    ...popupStateMapping,
    ...transitionStatusMapping
}
  , SelectPopup = reactExports.forwardRef(function e(t, r) {
    const {render: n, className: a, ...s} = t
      , {store: o, popupRef: l, onOpenChangeComplete: u, setOpen: c, valueRef: p, selectedItemTextRef: d, keyboardActiveRef: f, multiple: h, handleScrollArrowVisibility: m, scrollHandlerRef: g} = useSelectRootContext()
      , {side: x, align: b, alignItemWithTriggerActive: y, setControlledAlignItemWithTrigger: w, scrollDownArrowRef: R, scrollUpArrowRef: T} = useSelectPositionerContext()
      , C = useToolbarRootContext() != null
      , P = useSelectFloatingContext()
      , W = useTimeout()
      , ue = useStore$1(o, selectors.id)
      , ce = useStore$1(o, selectors.open)
      , ve = useStore$1(o, selectors.mounted)
      , I = useStore$1(o, selectors.popupProps)
      , M = useStore$1(o, selectors.transitionStatus)
      , $ = useStore$1(o, selectors.triggerElement)
      , pt = useStore$1(o, selectors.positionerElement)
      , ba = useStore$1(o, selectors.listElement)
      , us = reactExports.useRef(0)
      , Wd = reactExports.useRef(!1)
      , Mr = reactExports.useRef(0)
      , Kt = reactExports.useRef(!1)
      , lt = reactExports.useRef({})
      , Ht = useAnimationFrame()
      , $e = useStableCallback(jr => {
        if (!pt || !l.current || !Kt.current)
            return;
        if (Wd.current || !y) {
            m();
            return
        }
        const fs = pt.style.top === "0px"
          , bf = pt.style.bottom === "0px"
          , $0 = pt.getBoundingClientRect().height
          , ie = ownerDocument(pt)
          , He = getComputedStyle(pt)
          , mm = parseFloat(He.marginTop)
          , Oe = parseFloat(He.marginBottom)
          , R0 = ie.documentElement.clientHeight - mm - Oe
          , gm = jr.scrollTop
          , $s = jr.scrollHeight
          , go = jr.clientHeight
          , Yl = $s - go;
        let lv = null
          , Ox = null
          , ev = !1;
        if (fs) {
            const iv = Yl - gm
              , N = $0 + iv
              , bi = Math.min(N, R0);
            lv = bi,
            bi !== R0 ? Ox = Yl : ev = !0
        } else if (bf) {
            const iv = gm - 0
              , N = $0 + iv
              , bi = Math.min(N, R0)
              , Rx = N - R0;
            lv = bi,
            bi !== R0 ? Ox = 0 : (ev = !0,
            gm < Yl && (Ox = gm - (iv - Rx)))
        }
        lv != null && (pt.style.height = `${lv}px`),
        Ox != null && (jr.scrollTop = Ox),
        ev && (Wd.current = !0),
        m()
    }
    );
    reactExports.useImperativeHandle(g, () => $e, [$e]),
    useOpenChangeComplete({
        open: ce,
        ref: l,
        onComplete() {
            ce && u?.(!0)
        }
    });
    const G = reactExports.useMemo( () => ({
        open: ce,
        transitionStatus: M,
        side: x,
        align: b
    }), [ce, M, x, b]);
    useIsoLayoutEffect( () => {
        !pt || !l.current || Object.keys(lt.current).length || (lt.current = {
            top: pt.style.top || "0",
            left: pt.style.left || "0",
            right: pt.style.right,
            height: pt.style.height,
            bottom: pt.style.bottom,
            minHeight: pt.style.minHeight,
            maxHeight: pt.style.maxHeight,
            marginTop: pt.style.marginTop,
            marginBottom: pt.style.marginBottom
        })
    }
    , [l, pt]),
    useIsoLayoutEffect( () => {
        ve || y || (Kt.current = !1,
        Wd.current = !1,
        us.current = 0,
        Mr.current = 0,
        clearStyles(pt, lt.current))
    }
    , [ve, y, pt, l]),
    useIsoLayoutEffect( () => {
        const jr = l.current;
        if (!(!ve || !$ || !pt || !jr)) {
            if (!y) {
                Kt.current = !0,
                Ht.request(m);
                return
            }
            queueMicrotask( () => {
                const fs = getComputedStyle(pt)
                  , bf = getComputedStyle(jr)
                  , $0 = ownerDocument($)
                  , ie = getWindow(pt)
                  , He = $.getBoundingClientRect()
                  , mm = pt.getBoundingClientRect()
                  , Oe = He.left
                  , R0 = He.height
                  , gm = ba || jr
                  , $s = gm.scrollHeight
                  , go = parseFloat(bf.borderBottomWidth)
                  , Yl = parseFloat(fs.marginTop) || 10
                  , lv = parseFloat(fs.marginBottom) || 10
                  , Ox = parseFloat(fs.minHeight) || 100
                  , ev = 5
                  , iv = 5
                  , N = 20
                  , bi = $0.documentElement.clientHeight - Yl - lv
                  , Rx = $0.documentElement.clientWidth
                  , sv = bi - He.bottom + R0
                  , h0 = d.current
                  , av = p.current;
                let L = 0
                  , A = 0;
                if (h0 && av) {
                    const zm = av.getBoundingClientRect()
                      , uv = h0.getBoundingClientRect()
                      , Rv = zm.left - Oe
                      , Dv = uv.left - mm.left
                      , Iv = zm.top - He.top + zm.height / 2
                      , Wl = uv.top - mm.top + uv.height / 2;
                    L = Rv - Dv,
                    A = Wl - Iv
                }
                const F = sv + A + lv + go;
                let Qt = Math.min(bi, F);
                const ps = bi - Yl - lv
                  , pr = F - Qt
                  , mo = Math.max(ev, Oe + L)
                  , Lt = Rx - iv
                  , rv = Math.max(0, mo + mm.width - Lt);
                pt.style.left = `${mo - rv}px`,
                pt.style.height = `${Qt}px`,
                pt.style.maxHeight = "auto",
                pt.style.marginTop = `${Yl}px`,
                pt.style.marginBottom = `${lv}px`,
                jr.style.height = "100%";
                const Ev = gm.scrollHeight - gm.clientHeight
                  , re = pr >= Ev;
                re && (Qt = Math.min(bi, mm.height) - (pr - Ev));
                const dv = He.top < N || He.bottom > bi - N || Qt < Math.min($s, Ox)
                  , mv = (ie.visualViewport?.scale ?? 1) !== 1 && isWebKit;
                if (dv || mv) {
                    Kt.current = !0,
                    clearStyles(pt, lt.current),
                    reactDomExports.flushSync( () => w(!1));
                    return
                }
                if (re) {
                    const zm = Math.max(0, bi - F);
                    pt.style.top = mm.height >= ps ? "0" : `${zm}px`,
                    pt.style.height = `${Qt}px`,
                    gm.scrollTop = gm.scrollHeight - gm.clientHeight,
                    us.current = Math.max(Ox, Qt)
                } else
                    pt.style.bottom = "0",
                    us.current = Math.max(Ox, Qt),
                    gm.scrollTop = pr;
                us.current === bi && (Wd.current = !0),
                m(),
                setTimeout( () => {
                    Kt.current = !0
                }
                )
            }
            )
        }
    }
    , [o, ve, pt, $, p, d, l, m, y, w, Ht, R, T, ba]),
    reactExports.useEffect( () => {
        if (!y || !pt || !ve)
            return;
        const jr = getWindow(pt);
        function fs(bf) {
            c(!1, createChangeEventDetails(windowResize, bf))
        }
        return jr.addEventListener("resize", fs),
        () => {
            jr.removeEventListener("resize", fs)
        }
    }
    , [c, y, pt, ve]);
    const he = {
        ...ba ? {
            role: "presentation",
            "aria-orientation": void 0
        } : {
            role: "listbox",
            "aria-multiselectable": h || void 0,
            id: `${ue}-list`
        },
        onKeyDown(jr) {
            f.current = !0,
            C && COMPOSITE_KEYS.has(jr.key) && jr.stopPropagation()
        },
        onMouseMove() {
            f.current = !1
        },
        onPointerLeave(jr) {
            if (isMouseWithinBounds(jr) || jr.pointerType === "touch")
                return;
            const fs = jr.currentTarget;
            W.start(0, () => {
                o.set("activeIndex", null),
                fs.focus({
                    preventScroll: !0
                })
            }
            )
        },
        onScroll(jr) {
            ba || g.current?.(jr.currentTarget)
        },
        ...y && {
            style: ba ? {
                height: "100%"
            } : LIST_FUNCTIONAL_STYLES
        }
    }
      , Xe = useRenderElement("div", t, {
        ref: [r, l],
        state: G,
        stateAttributesMapping: stateAttributesMapping$1,
        props: [I, he, getDisabledMountTransitionStyles(M), {
            className: !ba && y ? styleDisableScrollbar.className : void 0
        }, s]
    });
    return jsxRuntimeExports.jsxs(reactExports.Fragment, {
        children: [styleDisableScrollbar.element, jsxRuntimeExports.jsx(FloatingFocusManager, {
            context: P,
            modal: !1,
            disabled: !ve,
            restoreFocus: !0,
            children: Xe
        })]
    })
})
  , SelectList = reactExports.forwardRef(function e(t, r) {
    const {className: n, render: a, ...s} = t
      , {store: o, scrollHandlerRef: l} = useSelectRootContext()
      , {alignItemWithTriggerActive: u} = useSelectPositionerContext()
      , c = useStore$1(o, selectors.hasScrollArrows)
      , p = useStore$1(o, selectors.openMethod)
      , d = useStore$1(o, selectors.multiple)
      , h = {
        id: `${useStore$1(o, selectors.id)}-list`,
        role: "listbox",
        "aria-multiselectable": d || void 0,
        onScroll(g) {
            l.current?.(g.currentTarget)
        },
        ...u && {
            style: LIST_FUNCTIONAL_STYLES
        },
        className: c && p !== "touch" ? styleDisableScrollbar.className : void 0
    }
      , m = useStableCallback(g => {
        o.set("listElement", g)
    }
    );
    return useRenderElement("div", t, {
        ref: [r, m],
        props: [h, s]
    })
})
  , SelectItemContext = reactExports.createContext(void 0);
function useSelectItemContext() {
    const e = reactExports.useContext(SelectItemContext);
    if (!e)
        throw new Error(formatErrorMessage(57));
    return e
}
const SelectItem$1 = reactExports.memo(reactExports.forwardRef(function e(t, r) {
    const {render: n, className: a, value: s=null, label: o, disabled: l=!1, nativeButton: u=!1, ...c} = t
      , p = reactExports.useRef(null)
      , d = useCompositeListItem({
        label: o,
        textRef: p,
        indexGuessBehavior: IndexGuessBehavior.GuessFromOrder
    })
      , {store: f, getItemProps: h, setOpen: m, setValue: g, selectionRef: x, typingRef: b, valuesRef: y, keyboardActiveRef: w, multiple: R, highlightItemOnHover: T} = useSelectRootContext()
      , C = useTimeout()
      , P = useStore$1(f, selectors.isActive, d.index)
      , W = useStore$1(f, selectors.isSelected, d.index, s)
      , ue = useStore$1(f, selectors.isSelectedByFocus, d.index)
      , ce = useStore$1(f, selectors.isItemEqualToValue)
      , ve = d.index
      , I = ve !== -1
      , M = reactExports.useRef(null)
      , $ = useValueAsRef(ve);
    useIsoLayoutEffect( () => {
        if (!I)
            return;
        const Xe = y.current;
        return Xe[ve] = s,
        () => {
            delete Xe[ve]
        }
    }
    , [I, ve, s, y]),
    useIsoLayoutEffect( () => {
        if (!I)
            return;
        const Xe = f.state.value;
        let jr = Xe;
        R && Array.isArray(Xe) && Xe.length > 0 && (jr = Xe[Xe.length - 1]),
        jr !== void 0 && compareItemEquality(jr, s, ce) && f.set("selectedIndex", ve)
    }
    , [I, ve, R, ce, f, s]);
    const pt = reactExports.useMemo( () => ({
        disabled: l,
        selected: W,
        highlighted: P
    }), [l, W, P])
      , ba = h({
        active: P,
        selected: W
    });
    ba.onFocus = void 0,
    ba.id = void 0;
    const us = reactExports.useRef(null)
      , Wd = reactExports.useRef("mouse")
      , Mr = reactExports.useRef(!1)
      , {getButtonProps: Kt, buttonRef: lt} = useButton({
        disabled: l,
        focusableWhenDisabled: !0,
        native: u
    });
    function Ht(Xe) {
        const jr = f.state.value;
        if (R) {
            const fs = Array.isArray(jr) ? jr : []
              , bf = W ? removeItem(fs, s, ce) : [...fs, s];
            g(bf, createChangeEventDetails(itemPress, Xe))
        } else
            g(s, createChangeEventDetails(itemPress, Xe)),
            m(!1, createChangeEventDetails(itemPress, Xe))
    }
    const $e = {
        role: "option",
        "aria-selected": W,
        "aria-disabled": l || void 0,
        tabIndex: P ? 0 : -1,
        onFocus() {
            f.set("activeIndex", ve)
        },
        onMouseEnter() {
            !w.current && f.state.selectedIndex === null && f.set("activeIndex", ve)
        },
        onMouseMove() {
            T && f.set("activeIndex", ve)
        },
        onMouseLeave(Xe) {
            !T || w.current || isMouseWithinBounds(Xe) || C.start(0, () => {
                f.state.activeIndex === ve && f.set("activeIndex", null)
            }
            )
        },
        onTouchStart() {
            x.current = {
                allowSelectedMouseUp: !1,
                allowUnselectedMouseUp: !1
            }
        },
        onKeyDown(Xe) {
            us.current = Xe.key,
            f.set("activeIndex", ve)
        },
        onClick(Xe) {
            Mr.current = !1,
            !(Xe.type === "keydown" && us.current === null) && (l || us.current === " " && b.current || Wd.current !== "touch" && !P || (us.current = null,
            Ht(Xe.nativeEvent)))
        },
        onPointerEnter(Xe) {
            Wd.current = Xe.pointerType
        },
        onPointerDown(Xe) {
            Wd.current = Xe.pointerType,
            Mr.current = !0
        },
        onMouseUp(Xe) {
            if (l)
                return;
            if (Mr.current) {
                Mr.current = !1;
                return
            }
            const jr = !x.current.allowSelectedMouseUp && W
              , fs = !x.current.allowUnselectedMouseUp && !W;
            jr || fs || Wd.current !== "touch" && !P || Ht(Xe.nativeEvent)
        }
    }
      , G = useRenderElement("div", t, {
        ref: [lt, r, d.ref, M],
        state: pt,
        props: [ba, $e, c, Kt]
    })
      , he = reactExports.useMemo( () => ({
        selected: W,
        indexRef: $,
        textRef: p,
        selectedByFocus: ue,
        hasRegistered: I
    }), [W, $, p, ue, I]);
    return jsxRuntimeExports.jsx(SelectItemContext.Provider, {
        value: he,
        children: G
    })
}))
  , SelectItemIndicator = reactExports.forwardRef(function e(t, r) {
    const n = t.keepMounted ?? !1
      , {selected: a} = useSelectItemContext();
    return n || a ? jsxRuntimeExports.jsx(Inner, {
        ...t,
        ref: r
    }) : null
})
  , Inner = reactExports.memo(reactExports.forwardRef( (e, t) => {
    const {render: r, className: n, keepMounted: a, ...s} = e
      , {selected: o} = useSelectItemContext()
      , l = reactExports.useRef(null)
      , {transitionStatus: u, setMounted: c} = useTransitionStatus(o)
      , p = reactExports.useMemo( () => ({
        selected: o,
        transitionStatus: u
    }), [o, u])
      , d = useRenderElement("span", e, {
        ref: [t, l],
        state: p,
        props: [{
            "aria-hidden": !0,
            children: "✔️"
        }, s],
        stateAttributesMapping: transitionStatusMapping
    });
    return useOpenChangeComplete({
        open: o,
        ref: l,
        onComplete() {
            o || c(!1)
        }
    }),
    d
}
))
  , SelectItemText = reactExports.memo(reactExports.forwardRef(function e(t, r) {
    const {indexRef: n, textRef: a, selectedByFocus: s, hasRegistered: o} = useSelectItemContext()
      , {selectedItemTextRef: l} = useSelectRootContext()
      , {className: u, render: c, ...p} = t
      , d = reactExports.useCallback(h => {
        if (!h || !o)
            return;
        const m = l.current === null || !l.current.isConnected;
        (s || m && n.current === 0) && (l.current = h)
    }
    , [l, n, s, o]);
    return useRenderElement("div", t, {
        ref: [d, r, a],
        props: p
    })
}))
  , SelectScrollArrow = reactExports.forwardRef(function e(t, r) {
    const {render: n, className: a, direction: s, keepMounted: o=!1, ...l} = t
      , {store: u, popupRef: c, listRef: p, handleScrollArrowVisibility: d, scrollArrowsMountedCountRef: f} = useSelectRootContext()
      , {side: h, scrollDownArrowRef: m, scrollUpArrowRef: g} = useSelectPositionerContext()
      , x = s === "up" ? selectors.scrollUpArrowVisible : selectors.scrollDownArrowVisible
      , b = useStore$1(u, x)
      , y = useStore$1(u, selectors.openMethod)
      , w = b && y !== "touch"
      , R = useTimeout()
      , T = s === "up" ? g : m
      , {transitionStatus: C, setMounted: P} = useTransitionStatus(w);
    useIsoLayoutEffect( () => (f.current += 1,
    u.state.hasScrollArrows || u.set("hasScrollArrows", !0),
    () => {
        f.current = Math.max(0, f.current - 1),
        f.current === 0 && u.state.hasScrollArrows && u.set("hasScrollArrows", !1)
    }
    ), [u, f]),
    useOpenChangeComplete({
        open: w,
        ref: T,
        onComplete() {
            w || P(!1)
        }
    });
    const W = reactExports.useMemo( () => ({
        direction: s,
        visible: w,
        side: h,
        transitionStatus: C
    }), [s, w, h, C])
      , ce = useRenderElement("div", t, {
        ref: [r, T],
        state: W,
        props: [{
            "aria-hidden": !0,
            children: s === "up" ? "▲" : "▼",
            style: {
                position: "absolute"
            },
            onMouseMove(I) {
                if (I.movementX === 0 && I.movementY === 0 || R.isStarted())
                    return;
                u.set("activeIndex", null);
                function M() {
                    const $ = u.state.listElement ?? c.current;
                    if (!$)
                        return;
                    u.set("activeIndex", null),
                    d();
                    const pt = $.scrollTop === 0
                      , ba = Math.round($.scrollTop + $.clientHeight) >= $.scrollHeight;
                    if (p.current.length === 0 && (s === "up" ? u.set("scrollUpArrowVisible", !pt) : u.set("scrollDownArrowVisible", !ba)),
                    s === "up" && pt || s === "down" && ba) {
                        R.clear();
                        return
                    }
                    if ((u.state.listElement || c.current) && p.current && p.current.length > 0) {
                        const Wd = p.current
                          , Mr = T.current?.offsetHeight || 0;
                        if (s === "up") {
                            let Kt = 0;
                            const lt = $.scrollTop + Mr;
                            for (let $e = 0; $e < Wd.length; $e += 1) {
                                const G = Wd[$e];
                                if (G && G.offsetTop >= lt) {
                                    Kt = $e;
                                    break
                                }
                            }
                            const Ht = Math.max(0, Kt - 1);
                            if (Ht < Kt) {
                                const $e = Wd[Ht];
                                $e && ($.scrollTop = Math.max(0, $e.offsetTop - Mr))
                            } else
                                $.scrollTop = 0
                        } else {
                            let Kt = Wd.length - 1;
                            const lt = $.scrollTop + $.clientHeight - Mr;
                            for (let $e = 0; $e < Wd.length; $e += 1) {
                                const G = Wd[$e];
                                if (G && G.offsetTop + G.offsetHeight > lt) {
                                    Kt = Math.max(0, $e - 1);
                                    break
                                }
                            }
                            const Ht = Math.min(Wd.length - 1, Kt + 1);
                            if (Ht > Kt) {
                                const $e = Wd[Ht];
                                $e && ($.scrollTop = $e.offsetTop + $e.offsetHeight - $.clientHeight + Mr)
                            } else
                                $.scrollTop = $.scrollHeight - $.clientHeight
                        }
                    }
                    R.start(40, M)
                }
                R.start(40, M)
            },
            onMouseLeave() {
                R.clear()
            }
        }, l]
    });
    return w || o ? ce : null
})
  , SelectScrollDownArrow = reactExports.forwardRef(function e(t, r) {
    return jsxRuntimeExports.jsx(SelectScrollArrow, {
        ...t,
        ref: r,
        direction: "down"
    })
})
  , SelectScrollUpArrow = reactExports.forwardRef(function e(t, r) {
    return jsxRuntimeExports.jsx(SelectScrollArrow, {
        ...t,
        ref: r,
        direction: "up"
    })
})
  , Select = SelectRoot;
function SelectValue({className: e, ...t}) {
    return jsxRuntimeExports.jsx(SelectValue$1, {
        "data-slot": "select-value",
        className: cn$1("flex flex-1 text-left", e),
        ...t
    })
}
function SelectTrigger({className: e, size: t="default", children: r, ...n}) {
    return jsxRuntimeExports.jsxs(SelectTrigger$1, {
        "data-slot": "select-trigger",
        "data-size": t,
        className: cn$1("border-input data-[placeholder]:text-muted-foreground bg-input/20 dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/30 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 gap-1.5 rounded-md border px-2 py-1.5 text-xs/relaxed transition-colors focus-visible:ring-[2px] aria-invalid:ring-[2px] data-[size=default]:h-7 data-[size=sm]:h-6 *:data-[slot=select-value]:flex *:data-[slot=select-value]:gap-1.5 [&_svg:not([class*='size-'])]:size-3.5 flex w-fit items-center justify-between whitespace-nowrap outline-none disabled:cursor-not-allowed disabled:opacity-50 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center [&_svg]:pointer-events-none [&_svg]:shrink-0", e),
        ...n,
        children: [r, jsxRuntimeExports.jsx(SelectIcon, {
            render: jsxRuntimeExports.jsx(ChevronDown, {
                className: "text-muted-foreground size-3.5 pointer-events-none"
            })
        })]
    })
}
function SelectContent({className: e, children: t, side: r="bottom", sideOffset: n=4, align: a="center", alignOffset: s=0, alignItemWithTrigger: o=!0, ...l}) {
    return jsxRuntimeExports.jsx(SelectPortal, {
        children: jsxRuntimeExports.jsx(SelectPositioner, {
            side: r,
            sideOffset: n,
            align: a,
            alignOffset: s,
            alignItemWithTrigger: o,
            className: "isolate z-50",
            children: jsxRuntimeExports.jsxs(SelectPopup, {
                "data-slot": "select-content",
                className: cn$1("bg-popover text-popover-foreground data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 ring-foreground/10 min-w-32 rounded-lg shadow-md ring-1 duration-100 relative isolate z-50 max-h-(--available-height) w-(--anchor-width) origin-(--transform-origin) overflow-x-hidden overflow-y-auto", e),
                ...l,
                children: [jsxRuntimeExports.jsx(SelectScrollUpButton, {}), jsxRuntimeExports.jsx(SelectList, {
                    children: t
                }), jsxRuntimeExports.jsx(SelectScrollDownButton, {})]
            })
        })
    })
}
function SelectItem({className: e, children: t, ...r}) {
    return jsxRuntimeExports.jsxs(SelectItem$1, {
        "data-slot": "select-item",
        className: cn$1("focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground min-h-7 gap-2 rounded-md px-2 py-1 text-xs/relaxed [&_svg:not([class*='size-'])]:size-3.5 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2 relative flex w-full cursor-default items-center outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0", e),
        ...r,
        children: [jsxRuntimeExports.jsx(SelectItemText, {
            className: "flex flex-1 gap-2 shrink-0 whitespace-nowrap",
            children: t
        }), jsxRuntimeExports.jsx(SelectItemIndicator, {
            render: jsxRuntimeExports.jsx("span", {
                className: "pointer-events-none absolute right-2 flex items-center justify-center"
            }),
            children: jsxRuntimeExports.jsx(Check, {
                className: "pointer-events-none"
            })
        })]
    })
}
function SelectScrollUpButton({className: e, ...t}) {
    return jsxRuntimeExports.jsx(SelectScrollUpArrow, {
        "data-slot": "select-scroll-up-button",
        className: cn$1("bg-popover z-10 flex cursor-default items-center justify-center py-1 [&_svg:not([class*='size-'])]:size-3.5 top-0 w-full", e),
        ...t,
        children: jsxRuntimeExports.jsx(ChevronUp, {})
    })
}
function SelectScrollDownButton({className: e, ...t}) {
    return jsxRuntimeExports.jsx(SelectScrollDownArrow, {
        "data-slot": "select-scroll-down-button",
        className: cn$1("bg-popover z-10 flex cursor-default items-center justify-center py-1 [&_svg:not([class*='size-'])]:size-3.5 bottom-0 w-full", e),
        ...t,
        children: jsxRuntimeExports.jsx(ChevronDown, {})
    })
}
async function fetchUsageStats() {
    return redoClient.usage.get()
}
function useUsageStats(e=!0) {
    return useQuery({
        queryKey: ["redo-usage"],
        queryFn: fetchUsageStats,
        enabled: e,
        refetchInterval: 3e4,
        staleTime: 1e4
    })
}
function UsageStatsDisplay({percentUsed: e, resetAt: t, resetLabel: r="Usage allowance resets every 5 hours"}) {
    const n = Math.min(e, 100)
      , a = formatDistanceToNow(t, {
        addSuffix: !0
    });
    return jsxRuntimeExports.jsxs("div", {
        className: "space-y-1.5",
        children: [jsxRuntimeExports.jsxs("div", {
            className: "flex items-center justify-between",
            children: [jsxRuntimeExports.jsxs("div", {
                className: "flex items-center gap-1.5",
                children: [jsxRuntimeExports.jsx(Activity, {
                    className: "size-3.5 text-muted-foreground"
                }), jsxRuntimeExports.jsx("span", {
                    className: "text-xs font-medium",
                    children: "Usage"
                })]
            }), jsxRuntimeExports.jsxs("span", {
                className: cn$1("text-[10px] font-medium tabular-nums", n >= 90 ? "text-destructive" : n >= 70 ? "text-amber-500 dark:text-amber-400" : "text-muted-foreground"),
                children: [Math.round(e), "% used"]
            })]
        }), jsxRuntimeExports.jsx("div", {
            className: "h-1.5 bg-muted rounded-full overflow-hidden",
            children: jsxRuntimeExports.jsx("div", {
                className: cn$1("h-full rounded-full transition-all duration-500 ease-out", n >= 90 ? "bg-destructive" : n >= 70 ? "bg-amber-500 dark:bg-amber-400" : "bg-primary"),
                style: {
                    width: `${n}%`
                }
            })
        }), jsxRuntimeExports.jsxs("p", {
            className: "text-[10px] text-muted-foreground",
            children: [r, " · Resets ", a]
        })]
    })
}
const API_BASE_URL$5 = "https://www.dobrowser.io";
function ProxyProviderSection() {
    const e = useAppStore(p => p.useProxy)
      , t = useAppStore(p => p.hostedModel)
      , r = useAppStore(p => p.setHostedModel)
      , {data: n, isLoading: a, error: s} = useUsageStats(e)
      , {data: o} = useSubscriptionStatus(e)
      , l = o?.planTier
      , u = l === "standard" ? `${API_BASE_URL$5}/settings?plan=pro_plus` : `${API_BASE_URL$5}/settings?plan=pro`
      , c = l === "standard" ? "Upgrade to Max to unlock GPT-5.4" : "Upgrade to Standard to use GPT-5.4 Mini";
    return jsxRuntimeExports.jsxs("div", {
        className: "space-y-3 pt-3 border-t",
        children: [jsxRuntimeExports.jsxs("div", {
            className: "space-y-2",
            children: [jsxRuntimeExports.jsx("p", {
                className: "text-sm font-medium",
                children: "Hosted Model"
            }), jsxRuntimeExports.jsx("div", {
                className: "space-y-1.5",
                children: HOSTED_MODEL_OPTIONS.map(p => {
                    const d = !hasRequiredPlanTier(p.requiredPlanTier, l)
                      , f = t === p.id
                      , h = formatPlanTierLabel(p.requiredPlanTier)
                      , m = d && h ? `${p.description}, ${h} plan only` : p.description;
                    return jsxRuntimeExports.jsx("button", {
                        type: "button",
                        disabled: d,
                        onClick: () => r(p.id),
                        className: cn$1("w-full text-left rounded-lg px-3 py-2.5 ring-1 ring-inset outline-none", "transition-all duration-150", "focus-visible:ring-2 focus-visible:ring-ring", f ? "ring-primary/50 bg-primary/5" : d ? "ring-border/50 bg-muted/30 cursor-not-allowed" : "ring-border hover:ring-primary/40 hover:bg-muted/40"),
                        children: jsxRuntimeExports.jsxs("div", {
                            className: "flex items-start justify-between gap-3",
                            children: [jsxRuntimeExports.jsxs("div", {
                                className: "space-y-0.5",
                                children: [jsxRuntimeExports.jsx("span", {
                                    className: cn$1("text-xs font-medium", d && "text-muted-foreground"),
                                    children: p.label
                                }), jsxRuntimeExports.jsxs("p", {
                                    className: cn$1("text-[10px]", d ? "text-muted-foreground/60" : "text-muted-foreground"),
                                    children: [m, p.usageNote && !d && ` · ${p.usageNote}`]
                                })]
                            }), d ? jsxRuntimeExports.jsx(Lock, {
                                className: "size-3.5 text-muted-foreground/60"
                            }) : f ? jsxRuntimeExports.jsx("div", {
                                className: "size-4 rounded-full bg-primary flex items-center justify-center",
                                children: jsxRuntimeExports.jsx(Check, {
                                    className: "size-2.5 text-primary-foreground"
                                })
                            }) : jsxRuntimeExports.jsx("div", {
                                className: "size-4 rounded-full ring-1 ring-inset ring-border"
                            })]
                        })
                    }, p.id)
                }
                )
            }), l !== "pro" && jsxRuntimeExports.jsxs("a", {
                href: u,
                target: "_blank",
                rel: "noopener noreferrer",
                className: "flex items-center justify-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors py-0.5",
                children: [c, jsxRuntimeExports.jsx(ArrowUpRight, {
                    className: "size-2.5"
                })]
            })]
        }), a ? jsxRuntimeExports.jsx("div", {
            className: "animate-pulse h-12 bg-muted rounded-lg"
        }) : s ? jsxRuntimeExports.jsx("p", {
            className: "text-xs text-destructive",
            children: "Failed to load usage"
        }) : n ? jsxRuntimeExports.jsx(UsageStatsDisplay, {
            percentUsed: n.percentUsed,
            resetAt: n.resetAt
        }) : null]
    })
}
const FieldControl = reactExports.forwardRef(function e(t, r) {
    const {render: n, className: a, id: s, name: o, value: l, disabled: u=!1, onValueChange: c, defaultValue: p, ...d} = t
      , {state: f, name: h, disabled: m} = useFieldRootContext()
      , g = m || u
      , x = h ?? o
      , b = reactExports.useMemo( () => ({
        ...f,
        disabled: g
    }), [f, g])
      , {setTouched: y, setDirty: w, validityData: R, setFocused: T, setFilled: C, validationMode: P, validation: W} = useFieldRootContext()
      , {labelId: ue} = useLabelableContext()
      , ce = useLabelableId({
        id: s
    });
    useIsoLayoutEffect( () => {
        const ba = l != null;
        W.inputRef.current?.value || ba && l !== "" ? C(!0) : ba && l === "" && C(!1)
    }
    , [W.inputRef, C, l]);
    const [ve,I] = useControlled({
        controlled: l,
        default: p,
        name: "FieldControl",
        state: "value"
    })
      , M = l !== void 0
      , $ = useStableCallback( (ba, us) => {
        c?.(ba, us),
        !us.isCanceled && I(ba)
    }
    );
    return useField({
        id: ce,
        name: x,
        commit: W.commit,
        value: ve,
        getValue: () => W.inputRef.current?.value,
        controlRef: W.inputRef
    }),
    useRenderElement("input", t, {
        ref: r,
        state: b,
        props: [{
            id: ce,
            disabled: g,
            name: x,
            ref: W.inputRef,
            "aria-labelledby": ue,
            ...M ? {
                value: ve
            } : {
                defaultValue: p
            },
            onChange(ba) {
                const us = ba.currentTarget.value;
                $(us, createChangeEventDetails(none, ba.nativeEvent)),
                w(us !== R.initialValue),
                C(us !== "")
            },
            onFocus() {
                T(!0)
            },
            onBlur(ba) {
                y(!0),
                T(!1),
                P === "onBlur" && W.commit(ba.currentTarget.value)
            },
            onKeyDown(ba) {
                ba.currentTarget.tagName === "INPUT" && ba.key === "Enter" && (y(!0),
                W.commit(ba.currentTarget.value))
            }
        }, W.getInputValidationProps(), d],
        stateAttributesMapping: fieldValidityMapping
    })
})
  , Input$1 = reactExports.forwardRef(function e(t, r) {
    return jsxRuntimeExports.jsx(FieldControl, {
        ref: r,
        ...t
    })
});
function Input({className: e, type: t, ...r}) {
    return jsxRuntimeExports.jsx(Input$1, {
        type: t,
        "data-slot": "input",
        className: cn$1("bg-input/20 dark:bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/30 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 h-7 rounded-md border px-2 py-0.5 text-sm transition-colors file:h-6 file:text-xs/relaxed file:font-medium focus-visible:ring-[2px] aria-invalid:ring-[2px] md:text-xs/relaxed file:text-foreground placeholder:text-muted-foreground w-full min-w-0 outline-none file:inline-flex file:border-0 file:bg-transparent disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50", e),
        ...r
    })
}
const log$5 = logger.scoped("GeminiProviderSection");
function GeminiProviderSection() {
    const e = useAppStore(h => h.geminiApiKey)
      , t = useAppStore(h => h.setGeminiApiKey)
      , [r,n] = reactExports.useState(e)
      , [a,s] = reactExports.useState(!1)
      , [o,l] = reactExports.useState(!1)
      , [u,c] = reactExports.useState(!1);
    reactExports.useEffect( () => {
        n(e)
    }
    , [e]);
    const p = async () => {
        if (r !== e) {
            l(!0);
            try {
                await t(r),
                c(!0),
                setTimeout( () => c(!1), 2e3)
            } catch (h) {
                log$5.error("Failed to save Gemini API key:", h)
            } finally {
                l(!1)
            }
        }
    }
      , d = r !== e
      , f = r.length > 0;
    return jsxRuntimeExports.jsxs("div", {
        className: "space-y-3 pt-3 border-t",
        children: [jsxRuntimeExports.jsxs("div", {
            className: "flex items-center gap-2",
            children: [jsxRuntimeExports.jsx(Key, {
                className: "size-4 text-muted-foreground"
            }), jsxRuntimeExports.jsx("p", {
                className: "text-sm font-medium",
                children: "Gemini API Key"
            })]
        }), jsxRuntimeExports.jsxs("div", {
            className: "relative",
            children: [jsxRuntimeExports.jsx(Input, {
                type: a ? "text" : "password",
                value: r,
                onChange: h => n(h.target.value),
                placeholder: "Enter your API key...",
                className: "pr-9 font-mono text-xs"
            }), jsxRuntimeExports.jsxs(Tooltip, {
                children: [jsxRuntimeExports.jsx(TooltipTrigger, {
                    asChild: !0,
                    children: jsxRuntimeExports.jsx(Button, {
                        type: "button",
                        variant: "ghost",
                        size: "icon-xs",
                        onClick: () => s(!a),
                        className: "absolute right-2 top-1/2 -translate-y-1/2",
                        "aria-label": a ? "Hide API key" : "Show API key",
                        children: a ? jsxRuntimeExports.jsx(EyeOff, {}) : jsxRuntimeExports.jsx(Eye, {})
                    })
                }), jsxRuntimeExports.jsxs(TooltipContent, {
                    children: [a ? "Hide" : "Show", " API key"]
                })]
            })]
        }), jsxRuntimeExports.jsx(Button, {
            onClick: p,
            disabled: !d || !f || o,
            className: "w-full gap-1.5",
            variant: u && !d ? "secondary" : "default",
            children: u && !d ? jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
                children: [jsxRuntimeExports.jsx(Check, {
                    className: "size-3.5"
                }), "Saved"]
            }) : o ? jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
                children: [jsxRuntimeExports.jsx(LoaderCircle, {
                    className: "size-3.5 animate-spin"
                }), "Saving..."]
            }) : "Save API Key"
        }), jsxRuntimeExports.jsxs("p", {
            className: "text-[10px] text-muted-foreground text-center",
            children: ["Get your API key from", " ", jsxRuntimeExports.jsxs("a", {
                href: "https://aistudio.google.com/apikey",
                target: "_blank",
                rel: "noopener noreferrer",
                className: "text-primary hover:underline inline-flex items-center gap-0.5",
                children: ["Google AI Studio", jsxRuntimeExports.jsx(ExternalLink, {
                    className: "size-2.5"
                })]
            })]
        }), jsxRuntimeExports.jsx("p", {
            className: "text-[10px] text-muted-foreground text-center",
            children: "Powered by Gemini 3.0 Flash"
        })]
    })
}
const log$4 = logger.scoped("AnthropicProviderSection");
function AnthropicProviderSection() {
    const e = useAppStore(h => h.anthropicModel)
      , t = useAppStore(h => h.setAnthropicModel)
      , r = useAppStore(h => h.anthropicOAuthCredentials)
      , n = useAppStore(h => h.setAnthropicOAuthCredentials)
      , [a,s] = reactExports.useState(!1)
      , [o,l] = reactExports.useState(null)
      , u = reactExports.useRef(null)
      , c = !!r
      , p = async () => {
        s(!0),
        l(null),
        u.current = new AbortController;
        try {
            const h = await loginAnthropic(async m => (await chrome.tabs.create({
                url: m
            })).id, u.current.signal);
            await storeCredentials$1(h),
            await n(h)
        } catch (h) {
            if (u.current?.signal.aborted)
                return;
            log$4.error("Anthropic OAuth failed:", h),
            l(h instanceof Error ? h.message : "Sign in failed")
        } finally {
            u.current = null,
            s(!1)
        }
    }
      , d = () => {
        u.current?.abort(new Error("Sign in cancelled")),
        u.current = null,
        s(!1)
    }
      , f = async () => {
        await clearCredentials$1(),
        await n(null)
    }
    ;
    return jsxRuntimeExports.jsxs("div", {
        className: "space-y-3 pt-3 border-t",
        children: [c ? jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
            children: [jsxRuntimeExports.jsxs("div", {
                className: "flex items-center justify-between",
                children: [jsxRuntimeExports.jsxs("div", {
                    className: "flex items-center gap-2",
                    children: [jsxRuntimeExports.jsx("div", {
                        className: "size-2 rounded-full bg-green-500"
                    }), jsxRuntimeExports.jsx("p", {
                        className: "text-sm font-medium",
                        children: "Connected to Claude"
                    })]
                }), jsxRuntimeExports.jsxs(Button, {
                    variant: "ghost",
                    size: "sm",
                    onClick: f,
                    className: "gap-1.5 text-xs",
                    children: [jsxRuntimeExports.jsx(LogOut, {
                        className: "size-3"
                    }), "Disconnect"]
                })]
            }), jsxRuntimeExports.jsxs("div", {
                className: "space-y-1.5",
                children: [jsxRuntimeExports.jsx("p", {
                    className: "text-xs text-muted-foreground",
                    children: "Model"
                }), jsxRuntimeExports.jsxs(Select, {
                    value: e,
                    onValueChange: h => h && t(h),
                    children: [jsxRuntimeExports.jsx(SelectTrigger, {
                        className: "w-full",
                        children: jsxRuntimeExports.jsx(SelectValue, {
                            children: h => ANTHROPIC_OAUTH_MODEL_OPTIONS.find(m => m.id === h)?.label ?? h
                        })
                    }), jsxRuntimeExports.jsx(SelectContent, {
                        children: ANTHROPIC_OAUTH_MODEL_OPTIONS.map(h => jsxRuntimeExports.jsx(SelectItem, {
                            value: h.id,
                            children: h.label
                        }, h.id))
                    })]
                })]
            })]
        }) : jsxRuntimeExports.jsxs("div", {
            className: "space-y-3",
            children: [a ? jsxRuntimeExports.jsxs("div", {
                className: "flex gap-2",
                children: [jsxRuntimeExports.jsxs(Button, {
                    disabled: !0,
                    className: "flex-1 gap-1.5",
                    children: [jsxRuntimeExports.jsx(LoaderCircle, {
                        className: "size-3.5 animate-spin"
                    }), "Signing in..."]
                }), jsxRuntimeExports.jsx(Button, {
                    variant: "outline",
                    size: "icon",
                    onClick: d,
                    children: jsxRuntimeExports.jsx(X$1, {
                        className: "size-3.5"
                    })
                })]
            }) : jsxRuntimeExports.jsxs(Button, {
                onClick: p,
                className: "w-full gap-1.5",
                children: [jsxRuntimeExports.jsx(LogIn, {
                    className: "size-3.5"
                }), "Sign in with Claude"]
            }), jsxRuntimeExports.jsx("p", {
                className: "text-[10px] text-muted-foreground text-center",
                children: "Requires a Claude Pro or Max subscription"
            })]
        }), o && jsxRuntimeExports.jsx("p", {
            className: "text-[10px] text-destructive text-center",
            children: o
        })]
    })
}
const log$3 = logger.scoped("OpenAIProviderSection");
function OpenAIProviderSection() {
    const e = useAppStore(h => h.openaiModel)
      , t = useAppStore(h => h.setOpenaiModel)
      , r = useAppStore(h => h.openaiOAuthCredentials)
      , n = useAppStore(h => h.setOpenaiOAuthCredentials)
      , [a,s] = reactExports.useState(!1)
      , [o,l] = reactExports.useState(null)
      , u = reactExports.useRef(null)
      , c = !!r
      , p = async () => {
        s(!0),
        l(null),
        u.current = new AbortController;
        try {
            const h = await loginOpenAI(async m => (await chrome.tabs.create({
                url: m
            })).id, u.current.signal);
            await storeCredentials(h),
            await n(h)
        } catch (h) {
            if (u.current?.signal.aborted)
                return;
            log$3.error("OpenAI OAuth failed:", h),
            l(h instanceof Error ? h.message : "Sign in failed")
        } finally {
            u.current = null,
            s(!1)
        }
    }
      , d = () => {
        u.current?.abort(new Error("Sign in cancelled")),
        u.current = null,
        s(!1)
    }
      , f = async () => {
        await clearCredentials(),
        await n(null)
    }
    ;
    return jsxRuntimeExports.jsxs("div", {
        className: "space-y-3 pt-3 border-t",
        children: [c ? jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
            children: [jsxRuntimeExports.jsxs("div", {
                className: "flex items-center justify-between",
                children: [jsxRuntimeExports.jsxs("div", {
                    className: "flex items-center gap-2",
                    children: [jsxRuntimeExports.jsx("div", {
                        className: "size-2 rounded-full bg-green-500"
                    }), jsxRuntimeExports.jsx("p", {
                        className: "text-sm font-medium",
                        children: "Connected to ChatGPT"
                    })]
                }), jsxRuntimeExports.jsxs(Button, {
                    variant: "ghost",
                    size: "sm",
                    onClick: f,
                    className: "gap-1.5 text-xs",
                    children: [jsxRuntimeExports.jsx(LogOut, {
                        className: "size-3"
                    }), "Disconnect"]
                })]
            }), jsxRuntimeExports.jsxs("div", {
                className: "space-y-1.5",
                children: [jsxRuntimeExports.jsx("p", {
                    className: "text-xs text-muted-foreground",
                    children: "Model"
                }), jsxRuntimeExports.jsxs(Select, {
                    value: e,
                    onValueChange: h => h && t(h),
                    children: [jsxRuntimeExports.jsx(SelectTrigger, {
                        className: "w-full",
                        children: jsxRuntimeExports.jsx(SelectValue, {
                            children: h => OPENAI_OAUTH_MODEL_OPTIONS.find(m => m.id === h)?.label ?? h
                        })
                    }), jsxRuntimeExports.jsx(SelectContent, {
                        children: OPENAI_OAUTH_MODEL_OPTIONS.map(h => jsxRuntimeExports.jsx(SelectItem, {
                            value: h.id,
                            children: h.label
                        }, h.id))
                    })]
                })]
            })]
        }) : jsxRuntimeExports.jsxs("div", {
            className: "space-y-3",
            children: [a ? jsxRuntimeExports.jsxs("div", {
                className: "flex gap-2",
                children: [jsxRuntimeExports.jsxs(Button, {
                    disabled: !0,
                    className: "flex-1 gap-1.5",
                    children: [jsxRuntimeExports.jsx(LoaderCircle, {
                        className: "size-3.5 animate-spin"
                    }), "Signing in..."]
                }), jsxRuntimeExports.jsx(Button, {
                    variant: "outline",
                    size: "icon",
                    onClick: d,
                    children: jsxRuntimeExports.jsx(X$1, {
                        className: "size-3.5"
                    })
                })]
            }) : jsxRuntimeExports.jsxs(Button, {
                onClick: p,
                className: "w-full gap-1.5",
                children: [jsxRuntimeExports.jsx(LogIn, {
                    className: "size-3.5"
                }), "Sign in with ChatGPT"]
            }), jsxRuntimeExports.jsx("p", {
                className: "text-[10px] text-muted-foreground text-center",
                children: "Requires a ChatGPT Plus or Pro subscription"
            })]
        }), o && jsxRuntimeExports.jsx("p", {
            className: "text-[10px] text-destructive text-center",
            children: o
        })]
    })
}
const PROVIDER_OPTIONS = [{
    id: "proxy",
    label: "Do Browser (hosted)",
    description: "Gemini 3.0 Flash or GPT-5.4"
}, {
    id: "gemini",
    label: "Gemini API Key",
    description: "Use your own Google API key"
}, {
    id: "anthropic-oauth",
    label: "Claude (sign in)",
    description: "Use your Claude Pro/Max subscription"
}, {
    id: "openai-oauth",
    label: "ChatGPT (sign in)",
    description: "Use your ChatGPT Plus/Pro subscription"
}];
function ApiModeToggle() {
    const e = useAppStore(r => r.provider)
      , t = useAppStore(r => r.setProvider);
    return jsxRuntimeExports.jsxs(Card, {
        children: [jsxRuntimeExports.jsx(CardHeader, {
            children: jsxRuntimeExports.jsxs("div", {
                className: "flex items-center gap-2",
                children: [jsxRuntimeExports.jsx("div", {
                    className: "flex items-center justify-center size-8 rounded-md bg-primary/10",
                    children: jsxRuntimeExports.jsx(Cloud, {
                        className: "size-4 text-primary"
                    })
                }), jsxRuntimeExports.jsxs("div", {
                    children: [jsxRuntimeExports.jsx(CardTitle, {
                        children: "API Configuration"
                    }), jsxRuntimeExports.jsx(CardDescription, {
                        children: "Choose how to connect to AI"
                    })]
                })]
            })
        }), jsxRuntimeExports.jsxs(CardContent, {
            className: "space-y-4",
            children: [jsxRuntimeExports.jsxs("div", {
                className: "space-y-1.5",
                children: [jsxRuntimeExports.jsx("p", {
                    className: "text-sm font-medium",
                    children: "Provider"
                }), jsxRuntimeExports.jsxs(Select, {
                    value: e,
                    onValueChange: r => r && t(r),
                    children: [jsxRuntimeExports.jsx(SelectTrigger, {
                        className: "w-full",
                        children: jsxRuntimeExports.jsx(SelectValue, {
                            children: r => PROVIDER_OPTIONS.find(n => n.id === r)?.label ?? r
                        })
                    }), jsxRuntimeExports.jsx(SelectContent, {
                        children: PROVIDER_OPTIONS.map(r => jsxRuntimeExports.jsx(SelectItem, {
                            value: r.id,
                            children: jsxRuntimeExports.jsxs("div", {
                                children: [jsxRuntimeExports.jsx("p", {
                                    className: "font-medium text-xs",
                                    children: r.label
                                }), jsxRuntimeExports.jsx("p", {
                                    className: "text-[10px] text-muted-foreground",
                                    children: r.description
                                })]
                            })
                        }, r.id))
                    })]
                })]
            }), e === "proxy" && jsxRuntimeExports.jsx(ProxyProviderSection, {}), e === "gemini" && jsxRuntimeExports.jsx(GeminiProviderSection, {}), e === "anthropic-oauth" && jsxRuntimeExports.jsx(AnthropicProviderSection, {}), e === "openai-oauth" && jsxRuntimeExports.jsx(OpenAIProviderSection, {})]
        })]
    })
}
const SwitchRootContext = reactExports.createContext(void 0);
function useSwitchRootContext() {
    const e = reactExports.useContext(SwitchRootContext);
    if (e === void 0)
        throw new Error(formatErrorMessage(63));
    return e
}
let SwitchRootDataAttributes = (function(e) {
    return e.checked = "data-checked",
    e.unchecked = "data-unchecked",
    e.disabled = "data-disabled",
    e.readonly = "data-readonly",
    e.required = "data-required",
    e.valid = "data-valid",
    e.invalid = "data-invalid",
    e.touched = "data-touched",
    e.dirty = "data-dirty",
    e.filled = "data-filled",
    e.focused = "data-focused",
    e
}
)({});
const stateAttributesMapping = {
    ...fieldValidityMapping,
    checked(e) {
        return e ? {
            [SwitchRootDataAttributes.checked]: ""
        } : {
            [SwitchRootDataAttributes.unchecked]: ""
        }
    }
}
  , SwitchRoot = reactExports.forwardRef(function e(t, r) {
    const {checked: n, className: a, defaultChecked: s, id: o, inputRef: l, name: u, nativeButton: c=!1, onCheckedChange: p, readOnly: d=!1, required: f=!1, disabled: h=!1, render: m, uncheckedValue: g, ...x} = t
      , {clearErrors: b} = useFormContext()
      , {state: y, setTouched: w, setDirty: R, validityData: T, setFilled: C, setFocused: P, shouldValidateOnChange: W, validationMode: ue, disabled: ce, name: ve, validation: I} = useFieldRootContext()
      , {labelId: M} = useLabelableContext()
      , $ = ce || h
      , pt = ve ?? u
      , ba = useStableCallback(p)
      , us = reactExports.useRef(null)
      , Wd = useMergedRefs(us, l, I.inputRef)
      , Mr = reactExports.useRef(null)
      , Kt = useBaseUiId()
      , lt = useLabelableId({
        id: o,
        implicit: !1,
        controlRef: Mr
    })
      , [Ht,$e] = useControlled({
        controlled: n,
        default: !!s,
        name: "Switch",
        state: "checked"
    });
    useField({
        id: Kt,
        commit: I.commit,
        value: Ht,
        controlRef: Mr,
        name: pt,
        getValue: () => Ht
    }),
    useIsoLayoutEffect( () => {
        us.current && C(us.current.checked)
    }
    , [us, C]),
    useValueChanged(Ht, () => {
        b(pt),
        R(Ht !== T.initialValue),
        C(Ht),
        W() ? I.commit(Ht) : I.commit(Ht, !0)
    }
    );
    const {getButtonProps: G, buttonRef: he} = useButton({
        disabled: $,
        native: c
    })
      , Xe = {
        id: Kt,
        role: "switch",
        "aria-checked": Ht,
        "aria-readonly": d || void 0,
        "aria-labelledby": M,
        onFocus() {
            $ || P(!0)
        },
        onBlur() {
            const $0 = us.current;
            !$0 || $ || (w(!0),
            P(!1),
            ue === "onBlur" && I.commit($0.checked))
        },
        onClick($0) {
            d || $ || ($0.preventDefault(),
            us?.current?.click())
        }
    }
      , jr = reactExports.useMemo( () => mergeProps$1({
        checked: Ht,
        disabled: $,
        id: lt,
        name: pt,
        required: f,
        style: visuallyHidden,
        tabIndex: -1,
        type: "checkbox",
        "aria-hidden": !0,
        ref: Wd,
        onChange($0) {
            if ($0.nativeEvent.defaultPrevented)
                return;
            const ie = $0.target.checked
              , He = createChangeEventDetails(none, $0.nativeEvent);
            ba?.(ie, He),
            !He.isCanceled && $e(ie)
        },
        onFocus() {
            Mr.current?.focus()
        }
    }, I.getInputValidationProps), [Ht, $, Wd, lt, pt, ba, f, $e, I])
      , fs = reactExports.useMemo( () => ({
        ...y,
        checked: Ht,
        disabled: $,
        readOnly: d,
        required: f
    }), [y, Ht, $, d, f])
      , bf = useRenderElement("span", t, {
        state: fs,
        ref: [r, Mr, he],
        props: [Xe, I.getValidationProps, x, G],
        stateAttributesMapping
    });
    return jsxRuntimeExports.jsxs(SwitchRootContext.Provider, {
        value: fs,
        children: [bf, !Ht && pt && g !== void 0 && jsxRuntimeExports.jsx("input", {
            type: "hidden",
            name: pt,
            value: g
        }), jsxRuntimeExports.jsx("input", {
            ...jr
        })]
    })
})
  , SwitchThumb = reactExports.forwardRef(function e(t, r) {
    const {render: n, className: a, ...s} = t
      , {state: o} = useFieldRootContext()
      , l = useSwitchRootContext()
      , u = {
        ...o,
        ...l
    };
    return useRenderElement("span", t, {
        state: u,
        ref: r,
        stateAttributesMapping,
        props: s
    })
});
function Switch({className: e, ...t}) {
    return jsxRuntimeExports.jsx(SwitchRoot, {
        ...t,
        className: cn$1("peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background", "disabled:cursor-not-allowed disabled:opacity-50", "data-[checked]:bg-primary data-[unchecked]:bg-input", e),
        children: jsxRuntimeExports.jsx(SwitchThumb, {
            className: cn$1("pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform", "data-[checked]:translate-x-4 data-[unchecked]:translate-x-0")
        })
    })
}
function AgentTabsCard() {
    const e = useAppStore(l => l.groupAgentTabs)
      , t = useAppStore(l => l.setGroupAgentTabs)
      , [r,n] = reactExports.useState(!1)
      , [a,s] = reactExports.useState(null)
      , o = async l => {
        if (!r) {
            n(!0),
            s(null);
            try {
                if (l && !await requestTabGroupsPermission()) {
                    s("Chrome permission is required to enable Background Mode.");
                    return
                }
                await t(l)
            } catch (u) {
                s(u instanceof Error ? u.message : "Failed to update Background Mode.")
            } finally {
                n(!1)
            }
        }
    }
    ;
    return jsxRuntimeExports.jsx(Card, {
        children: jsxRuntimeExports.jsx(CardHeader, {
            children: jsxRuntimeExports.jsxs("div", {
                className: "flex items-start gap-2",
                children: [jsxRuntimeExports.jsx("div", {
                    className: "flex items-center justify-center size-8 rounded-md bg-primary/10",
                    children: jsxRuntimeExports.jsx(FolderOpen, {
                        className: "size-4 text-primary"
                    })
                }), jsxRuntimeExports.jsxs("div", {
                    className: "min-w-0 flex-1",
                    children: [jsxRuntimeExports.jsx(CardTitle, {
                        children: "Background Mode"
                    }), jsxRuntimeExports.jsx(CardDescription, {
                        children: "Tabs opened by the agent will run in the background and won't steal focus, so you can keep working."
                    }), a && jsxRuntimeExports.jsx("p", {
                        className: "mt-2 text-[10px] text-destructive",
                        children: a
                    })]
                }), jsxRuntimeExports.jsxs("div", {
                    className: "flex items-center gap-2",
                    children: [r && jsxRuntimeExports.jsx(LoaderCircle, {
                        className: "size-3.5 animate-spin text-muted-foreground"
                    }), jsxRuntimeExports.jsx(Switch, {
                        checked: e,
                        onCheckedChange: o,
                        disabled: r,
                        "aria-label": "Background Mode"
                    })]
                })]
            })
        })
    })
}
async function fetchWorkspaceStatus() {
    return redoClient.workspace.status.get()
}
function useWorkspaceStatus(e=!0) {
    return useQuery({
        queryKey: ["workspace-status"],
        queryFn: fetchWorkspaceStatus,
        enabled: e,
        refetchInterval: 3e4,
        staleTime: 1e4
    })
}
const API_BASE_URL$4 = "https://www.dobrowser.io";
function SheetsAccessCard() {
    const {data: e, isLoading: t, error: r} = useWorkspaceStatus(!0)
      , n = reactExports.useMemo( () => e && e.sheetsConnected ? "Connected" : "Not connected", [e])
      , a = reactExports.useMemo( () => e?.sheetsConnected ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-muted text-muted-foreground", [e])
      , s = l => {
        const u = chrome.runtime.id
          , c = new URLSearchParams({
            extensionId: u,
            source: "settings"
        })
          , p = `${API_BASE_URL$4}/auth/extension-sheets?${c.toString()}`;
        window.open(p, "_blank", "noopener,noreferrer")
    }
      , o = e?.sheetsConnected ? "Select which spreadsheets Do Browser can access." : "Connect Google Sheets and pick files to authorize.";
    return jsxRuntimeExports.jsxs(Card, {
        children: [jsxRuntimeExports.jsx(CardHeader, {
            children: jsxRuntimeExports.jsxs("div", {
                className: "flex items-center gap-2",
                children: [jsxRuntimeExports.jsx("div", {
                    className: "flex items-center justify-center size-8 rounded-md bg-primary/10",
                    children: jsxRuntimeExports.jsx(Table2, {
                        className: "size-4 text-primary"
                    })
                }), jsxRuntimeExports.jsxs("div", {
                    className: "flex-1 min-w-0",
                    children: [jsxRuntimeExports.jsxs("div", {
                        className: "flex items-center justify-between gap-2",
                        children: [jsxRuntimeExports.jsx(CardTitle, {
                            children: "Google Sheets"
                        }), jsxRuntimeExports.jsx("span", {
                            className: `text-xs px-2 py-0.5 rounded-full ${a}`,
                            children: n
                        })]
                    }), jsxRuntimeExports.jsx(CardDescription, {
                        children: o
                    })]
                })]
            })
        }), jsxRuntimeExports.jsxs(CardContent, {
            className: "space-y-3",
            children: [t && jsxRuntimeExports.jsx("div", {
                className: "animate-pulse h-10 bg-muted rounded"
            }), r && jsxRuntimeExports.jsx("p", {
                className: "text-xs text-destructive",
                children: "Failed to load Sheets status"
            }), !t && !r && jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
                children: [!e?.sheetsConnected && jsxRuntimeExports.jsxs(Button, {
                    onClick: () => s(),
                    className: "w-full gap-1.5",
                    children: [jsxRuntimeExports.jsx(ExternalLink, {
                        className: "size-3.5"
                    }), "Connect Sheets"]
                }), e?.sheetsConnected && jsxRuntimeExports.jsxs(Button, {
                    onClick: () => s(),
                    className: "w-full gap-1.5",
                    children: [jsxRuntimeExports.jsx(ExternalLink, {
                        className: "size-3.5"
                    }), "Add / Authorize Sheets"]
                }), jsxRuntimeExports.jsx("p", {
                    className: "text-[10px] text-muted-foreground text-center",
                    children: "Disconnect is not available in-app yet. Revoke access in your Google account permissions."
                })]
            })]
        })]
    })
}
const API_BASE_URL$3 = "https://www.dobrowser.io";
function formatStatus(e) {
    return e ? e.charAt(0).toUpperCase() + e.slice(1).replace("_", " ") : "Inactive"
}
function formatPlanName(e, t) {
    return e === "pro" ? "Max" : e === "standard" ? "Standard" : t === "pro_plus" ? "Max" : t === "pro" ? "Standard" : "Paid"
}
function formatPlanPrice(e, t) {
    return e === "pro" || t === "pro_plus" ? "$100/month" : "$25/month"
}
function SubscriptionPanel() {
    const e = useAppStore(l => l.useProxy)
      , {data: t, isLoading: r, error: n} = useSubscriptionStatus()
      , a = () => {
        window.open(`${API_BASE_URL$3}/settings`, "_blank")
    }
      , s = () => {
        window.open(`${API_BASE_URL$3}/settings#referrals`, "_blank")
    }
      , o = () => {
        window.open(`${API_BASE_URL$3}/settings?plan=pro_plus`, "_blank")
    }
    ;
    return r ? jsxRuntimeExports.jsxs(Card, {
        children: [jsxRuntimeExports.jsx(CardHeader, {
            children: jsxRuntimeExports.jsxs("div", {
                className: "flex items-center gap-2",
                children: [jsxRuntimeExports.jsx("div", {
                    className: "flex items-center justify-center size-8 rounded-md bg-primary/10",
                    children: jsxRuntimeExports.jsx(CreditCard, {
                        className: "size-4 text-primary"
                    })
                }), jsxRuntimeExports.jsxs("div", {
                    children: [jsxRuntimeExports.jsx(CardTitle, {
                        children: "Subscription"
                    }), jsxRuntimeExports.jsx(CardDescription, {
                        children: "Manage your plan"
                    })]
                })]
            })
        }), jsxRuntimeExports.jsx(CardContent, {
            children: jsxRuntimeExports.jsx("div", {
                className: "animate-pulse h-16 bg-muted rounded"
            })
        })]
    }) : n ? jsxRuntimeExports.jsxs(Card, {
        children: [jsxRuntimeExports.jsx(CardHeader, {
            children: jsxRuntimeExports.jsxs("div", {
                className: "flex items-center gap-2",
                children: [jsxRuntimeExports.jsx("div", {
                    className: "flex items-center justify-center size-8 rounded-md bg-primary/10",
                    children: jsxRuntimeExports.jsx(CreditCard, {
                        className: "size-4 text-primary"
                    })
                }), jsxRuntimeExports.jsxs("div", {
                    children: [jsxRuntimeExports.jsx(CardTitle, {
                        children: "Subscription"
                    }), jsxRuntimeExports.jsx(CardDescription, {
                        children: "Manage your plan"
                    })]
                })]
            })
        }), jsxRuntimeExports.jsx(CardContent, {
            children: jsxRuntimeExports.jsx("p", {
                className: "text-xs text-destructive",
                children: "Failed to load subscription status"
            })
        })]
    }) : jsxRuntimeExports.jsxs(Card, {
        children: [jsxRuntimeExports.jsx(CardHeader, {
            children: jsxRuntimeExports.jsxs("div", {
                className: "flex items-center gap-2",
                children: [jsxRuntimeExports.jsx("div", {
                    className: "flex items-center justify-center size-8 rounded-md bg-primary/10",
                    children: jsxRuntimeExports.jsx(CreditCard, {
                        className: "size-4 text-primary"
                    })
                }), jsxRuntimeExports.jsxs("div", {
                    className: "flex-1",
                    children: [jsxRuntimeExports.jsxs("div", {
                        className: "flex items-center justify-between",
                        children: [jsxRuntimeExports.jsx(CardTitle, {
                            children: "Subscription"
                        }), jsxRuntimeExports.jsx("span", {
                            className: `text-xs px-2 py-0.5 rounded-full ${t?.hasSubscription ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-muted text-muted-foreground"}`,
                            children: t?.hasSubscription ? formatStatus(t.subscriptionStatus) : "No subscription"
                        })]
                    }), jsxRuntimeExports.jsx(CardDescription, {
                        children: t?.hasSubscription ? `${formatPlanName(t.planTier, t.plan)} Plan` : "Free Plan"
                    })]
                })]
            })
        }), jsxRuntimeExports.jsxs(CardContent, {
            className: "space-y-3",
            children: [t?.hasSubscription && jsxRuntimeExports.jsxs("p", {
                className: "text-xs text-muted-foreground",
                children: ["Current plan: ", formatPlanName(t.planTier, t.plan), " (", formatPlanPrice(t.planTier, t.plan), ")"]
            }), t?.endsAt && jsxRuntimeExports.jsxs("p", {
                className: "text-xs text-muted-foreground",
                children: ["Current period ends: ", new Date(t.endsAt).toLocaleDateString()]
            }), e && !t?.hasSubscription && jsxRuntimeExports.jsxs("p", {
                className: "text-xs text-muted-foreground",
                children: ["Free messages remaining:", " ", Math.max((t?.freeMessagesLimit ?? 0) - (t?.freeMessagesUsed ?? 0), 0), " of", " ", t?.freeMessagesLimit ?? FREE_MESSAGE_LIMIT]
            }), jsxRuntimeExports.jsxs(Button, {
                onClick: s,
                variant: "outline",
                className: "w-full gap-1.5",
                children: [jsxRuntimeExports.jsx(Users, {
                    className: "size-3.5"
                }), "Refer a friend"]
            }), t?.hasSubscription && t.planTier === "standard" && jsxRuntimeExports.jsxs(Button, {
                onClick: o,
                className: "w-full gap-1.5",
                children: [jsxRuntimeExports.jsx(Sparkles, {
                    className: "size-3.5"
                }), "Upgrade to Max"]
            }), jsxRuntimeExports.jsxs(Button, {
                onClick: a,
                variant: "outline",
                className: "w-full gap-1.5",
                children: [jsxRuntimeExports.jsx(ExternalLink, {
                    className: "size-3.5"
                }), "Manage Subscription"]
            })]
        })]
    })
}
function useUser() {
    const {data: e} = authClient.useSession();
    return e?.user ?? null
}
function SettingsView({logout: e}) {
    const t = useUser();
    return jsxRuntimeExports.jsx(ScrollArea, {
        className: "h-full",
        children: jsxRuntimeExports.jsxs("div", {
            className: "p-3 space-y-3",
            children: [jsxRuntimeExports.jsxs(Card, {
                children: [jsxRuntimeExports.jsx(CardHeader, {
                    children: jsxRuntimeExports.jsxs("div", {
                        className: "flex items-center gap-2",
                        children: [jsxRuntimeExports.jsx("div", {
                            className: "flex items-center justify-center size-8 rounded-md bg-primary/10",
                            children: jsxRuntimeExports.jsx(User, {
                                className: "size-4 text-primary"
                            })
                        }), jsxRuntimeExports.jsxs("div", {
                            className: "flex-1 min-w-0",
                            children: [jsxRuntimeExports.jsx(CardTitle, {
                                children: "Account"
                            }), t?.email && jsxRuntimeExports.jsx(CardDescription, {
                                className: "truncate",
                                children: t.email
                            })]
                        })]
                    })
                }), jsxRuntimeExports.jsx(CardContent, {
                    children: jsxRuntimeExports.jsxs(Button, {
                        onClick: e,
                        variant: "outline",
                        className: "w-full gap-1.5",
                        children: [jsxRuntimeExports.jsx(LogOut, {
                            className: "size-3.5"
                        }), "Sign Out"]
                    })
                })]
            }), jsxRuntimeExports.jsx(SubscriptionPanel, {}), jsxRuntimeExports.jsx(ApiModeToggle, {}), jsxRuntimeExports.jsx(AgentTabsCard, {}), jsxRuntimeExports.jsx(SheetsAccessCard, {}), jsxRuntimeExports.jsxs(Card, {
                children: [jsxRuntimeExports.jsx(CardHeader, {
                    children: jsxRuntimeExports.jsx(CardTitle, {
                        children: "Support"
                    })
                }), jsxRuntimeExports.jsxs(CardContent, {
                    className: "space-y-2",
                    children: [jsxRuntimeExports.jsxs("a", {
                        href: "mailto:sawyer@dobrowser.io",
                        className: "flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors",
                        children: [jsxRuntimeExports.jsx(Mail, {
                            className: "size-4"
                        }), "sawyer@dobrowser.io"]
                    }), jsxRuntimeExports.jsxs("a", {
                        href: "https://dobrowser.io/releases",
                        target: "_blank",
                        rel: "noopener noreferrer",
                        className: "flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors",
                        children: [jsxRuntimeExports.jsx(FileText, {
                            className: "size-4"
                        }), "Release Notes"]
                    }), jsxRuntimeExports.jsx(BugReportForm, {})]
                })]
            }), !1, !1]
        })
    })
}
function getFileIcon(e) {
    switch (e.split(".").pop()?.toLowerCase()) {
    case "js":
    case "ts":
    case "jsx":
    case "tsx":
    case "css":
    case "html":
        return FileCode;
    case "json":
        return FileBraces;
    case "md":
    case "txt":
        return FileText;
    default:
        return File$1
    }
}
function FileTreeItem({node: e, depth: t, isExpanded: r, isSelected: n, isDragOver: a, isRenaming: s, onToggleExpand: o, onSelect: l, onDoubleClick: u, onDragStart: c, onDragOver: p, onDragLeave: d, onDrop: f, onContextMenu: h, onRename: m, onCancelRename: g}) {
    const [x,b] = reactExports.useState(e.name)
      , y = reactExports.useRef(null)
      , w = e.type === "directory"
      , R = w ? r ? FolderOpen : Folder : getFileIcon(e.name);
    reactExports.useEffect( () => {
        if (s && y.current) {
            y.current.focus();
            const ce = e.name.lastIndexOf(".");
            ce > 0 && !w ? y.current.setSelectionRange(0, ce) : y.current.select()
        }
    }
    , [s, e.name, w]);
    const T = ce => {
        if (ce.stopPropagation(),
        ce.key === "Enter") {
            ce.preventDefault();
            const ve = x.trim();
            ve && !ve.includes("/") && m(ve)
        } else
            ce.key === "Escape" && (ce.preventDefault(),
            b(e.name),
            g())
    }
      , C = () => {
        const ce = x.trim();
        ce && ce !== e.name && !ce.includes("/") ? m(ce) : (b(e.name),
        g())
    }
      , P = ce => {
        w && o(),
        l(ce)
    }
      , W = ce => {
        ce.dataTransfer.effectAllowed = "move",
        ce.dataTransfer.setData("text/plain", e.path),
        c(ce)
    }
      , ue = ce => {
        ce.preventDefault(),
        w ? (ce.dataTransfer.dropEffect = "move",
        p(ce)) : ce.dataTransfer.dropEffect = "none"
    }
    ;
    return jsxRuntimeExports.jsxs("div", {
        className: cn$1("flex items-center gap-1 px-2 py-1 cursor-pointer select-none rounded-sm", "hover:bg-accent/50", n && "bg-accent", a && "ring-2 ring-primary ring-inset"),
        style: {
            paddingLeft: `${t * 16 + 8}px`
        },
        draggable: !s,
        onClick: P,
        onDoubleClick: u,
        onDragStart: W,
        onDragOver: ue,
        onDragLeave: d,
        onDrop: f,
        onContextMenu: h,
        "data-path": e.path,
        children: [jsxRuntimeExports.jsx("span", {
            className: cn$1("shrink-0 w-4 h-4 flex items-center justify-center", !w && "invisible"),
            onClick: ce => {
                ce.stopPropagation(),
                w && o()
            }
            ,
            children: jsxRuntimeExports.jsx(ChevronRight, {
                className: cn$1("h-3 w-3 text-muted-foreground transition-transform", r && "rotate-90")
            })
        }), jsxRuntimeExports.jsx(R, {
            className: cn$1("shrink-0 h-4 w-4", w ? "text-amber-500" : "text-muted-foreground")
        }), s ? jsxRuntimeExports.jsx("input", {
            ref: y,
            type: "text",
            value: x,
            onChange: ce => b(ce.target.value),
            onKeyDown: T,
            onBlur: C,
            onClick: ce => ce.stopPropagation(),
            className: cn$1("flex-1 min-w-0 px-1 py-0.5 text-sm bg-background border rounded", "focus:outline-none focus:ring-1 focus:ring-primary")
        }) : jsxRuntimeExports.jsx("span", {
            className: "flex-1 min-w-0 truncate text-sm",
            children: e.name
        })]
    })
}
function FileTree({nodes: e, expandedPaths: t, selectedPaths: r, draggedPath: n, dropTargetPath: a, renamingPath: s, onToggleExpand: o, onSelect: l, onDoubleClick: u, onDragStart: c, onDragOver: p, onDragLeave: d, onDrop: f, onDragEnd: h, onContextMenu: m, onRename: g, onCancelRename: x}) {
    const b = (y, w) => {
        const R = t.has(y.path)
          , T = r.has(y.path)
          , C = a === y.path
          , P = s === y.path
          , W = n === y.path
          , ue = ce => {
            ce.preventDefault(),
            ce.stopPropagation();
            const ve = ce.dataTransfer.getData("text/plain");
            ve && y.type === "directory" && f(ve, y.path),
            h()
        }
        ;
        return jsxRuntimeExports.jsxs("div", {
            className: W ? "opacity-50" : "",
            children: [jsxRuntimeExports.jsx(FileTreeItem, {
                node: y,
                depth: w,
                isExpanded: R,
                isSelected: T,
                isDragOver: C,
                isRenaming: P,
                onToggleExpand: () => o(y.path),
                onSelect: ce => l(y.path, ce),
                onDoubleClick: () => u(y),
                onDragStart: () => c(y.path),
                onDragOver: () => {
                    y.type === "directory" && p(y.path)
                }
                ,
                onDragLeave: d,
                onDrop: ue,
                onContextMenu: ce => m(ce, y),
                onRename: ce => g(y.path, ce),
                onCancelRename: x
            }), y.type === "directory" && R && y.children && jsxRuntimeExports.jsx("div", {
                children: y.children.map(ce => b(ce, w + 1))
            })]
        }, y.path)
    }
    ;
    return jsxRuntimeExports.jsx("div", {
        className: "py-1",
        onDragEnd: h,
        children: e.map(y => b(y, 0))
    })
}
function SearchBar({value: e, onChange: t}) {
    return jsxRuntimeExports.jsxs("div", {
        className: "relative",
        children: [jsxRuntimeExports.jsx(Search, {
            className: "absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
        }), jsxRuntimeExports.jsx(Input, {
            type: "text",
            placeholder: "Search files...",
            value: e,
            onChange: r => t(r.target.value),
            className: "pl-8 pr-8"
        }), e && jsxRuntimeExports.jsx(Button, {
            variant: "ghost",
            size: "icon-sm",
            onClick: () => t(""),
            className: "absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6",
            children: jsxRuntimeExports.jsx(X$1, {
                className: "h-3 w-3"
            })
        })]
    })
}
function FileContextMenu({isOpen: e, position: t, node: r, selectedCount: n, onClose: a, onOpen: s, onEdit: o, onDownload: l, onRename: u, onDelete: c, onNewFile: p, onNewFolder: d}) {
    const f = r?.type === "file"
      , h = n > 1
      , m = r !== null
      , g = reactExports.useRef(null);
    return reactExports.useEffect( () => {
        g.current && e && (g.current.style.left = `${t.x}px`,
        g.current.style.top = `${t.y}px`)
    }
    , [e, t]),
    jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
        children: [jsxRuntimeExports.jsx("div", {
            ref: g,
            className: "fixed w-0 h-0 pointer-events-none",
            style: {
                left: t.x,
                top: t.y
            }
        }), jsxRuntimeExports.jsx(DropdownMenu, {
            open: e,
            onOpenChange: x => !x && a(),
            children: jsxRuntimeExports.jsxs(DropdownMenuContent, {
                align: "start",
                side: "bottom",
                sideOffset: 0,
                alignOffset: 0,
                className: "min-w-[160px]",
                style: {
                    position: "fixed",
                    left: t.x,
                    top: t.y
                },
                children: [m && f && !h && jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
                    children: [jsxRuntimeExports.jsx(DropdownMenuItem, {
                        onClick: s,
                        children: "Open"
                    }), jsxRuntimeExports.jsx(DropdownMenuItem, {
                        onClick: o,
                        children: "Edit"
                    })]
                }), m && !h && jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
                    children: [jsxRuntimeExports.jsx(DropdownMenuItem, {
                        onClick: l,
                        children: f ? "Download" : "Download as Zip"
                    }), jsxRuntimeExports.jsx(DropdownMenuSeparator, {})]
                }), m && !h && jsxRuntimeExports.jsxs(DropdownMenuItem, {
                    onClick: u,
                    children: ["Rename", jsxRuntimeExports.jsx(DropdownMenuShortcut, {
                        children: "F2"
                    })]
                }), m && jsxRuntimeExports.jsxs(DropdownMenuItem, {
                    onClick: c,
                    variant: "destructive",
                    children: [h ? `Delete (${n} items)` : "Delete", jsxRuntimeExports.jsx(DropdownMenuShortcut, {
                        className: "text-destructive/70 group-focus/dropdown-menu-item:text-destructive",
                        children: "Del"
                    })]
                }), m && jsxRuntimeExports.jsx(DropdownMenuSeparator, {}), jsxRuntimeExports.jsx(DropdownMenuItem, {
                    onClick: p,
                    children: "New File"
                }), jsxRuntimeExports.jsx(DropdownMenuItem, {
                    onClick: d,
                    children: "New Folder"
                })]
            })
        })]
    })
}
function AlertDialogRoot(e) {
    const {children: t, open: r, defaultOpen: n=!1, onOpenChange: a, onOpenChangeComplete: s, actionsRef: o, handle: l, triggerId: u, defaultTriggerId: c=null} = e
      , p = useDialogRootContext()
      , d = !!p
      , f = useRefWithInit( () => l?.store ?? new DialogStore({
        open: r ?? n,
        activeTriggerId: u !== void 0 ? u : c,
        modal: !0,
        disablePointerDismissal: !0,
        nested: d,
        role: "alertdialog"
    })).current;
    f.useControlledProp("open", r, n),
    f.useControlledProp("activeTriggerId", u, c),
    f.useSyncedValue("nested", d),
    f.useContextCallback("onOpenChange", a),
    f.useContextCallback("onOpenChangeComplete", s);
    const h = f.useState("payload");
    useDialogRoot({
        store: f,
        actionsRef: o,
        parentContext: p?.store.context
    });
    const m = reactExports.useMemo( () => ({
        store: f
    }), [f]);
    return jsxRuntimeExports.jsx(DialogRootContext.Provider, {
        value: m,
        children: typeof t == "function" ? t({
            payload: h
        }) : t
    })
}
function AlertDialog({...e}) {
    return jsxRuntimeExports.jsx(AlertDialogRoot, {
        "data-slot": "alert-dialog",
        ...e
    })
}
function AlertDialogPortal({...e}) {
    return jsxRuntimeExports.jsx(DialogPortal$1, {
        "data-slot": "alert-dialog-portal",
        ...e
    })
}
function AlertDialogOverlay({className: e, ...t}) {
    return jsxRuntimeExports.jsx(DialogBackdrop, {
        "data-slot": "alert-dialog-overlay",
        className: cn$1("data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 bg-black/80 duration-100 supports-backdrop-filter:backdrop-blur-xs fixed inset-0 isolate z-50", e),
        ...t
    })
}
function AlertDialogContent({className: e, size: t="default", ...r}) {
    return jsxRuntimeExports.jsxs(AlertDialogPortal, {
        children: [jsxRuntimeExports.jsx(AlertDialogOverlay, {}), jsxRuntimeExports.jsx(DialogPopup, {
            "data-slot": "alert-dialog-content",
            "data-size": t,
            className: cn$1("data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 bg-background ring-foreground/10 gap-3 rounded-xl p-4 ring-1 duration-100 data-[size=default]:max-w-xs data-[size=sm]:max-w-64 data-[size=default]:sm:max-w-sm group/alert-dialog-content fixed top-1/2 left-1/2 z-50 grid w-full -translate-x-1/2 -translate-y-1/2 outline-none", e),
            ...r
        })]
    })
}
function AlertDialogHeader({className: e, ...t}) {
    return jsxRuntimeExports.jsx("div", {
        "data-slot": "alert-dialog-header",
        className: cn$1("grid grid-rows-[auto_1fr] place-items-center gap-1 text-center has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr] has-data-[slot=alert-dialog-media]:gap-x-4 sm:group-data-[size=default]/alert-dialog-content:place-items-start sm:group-data-[size=default]/alert-dialog-content:text-left sm:group-data-[size=default]/alert-dialog-content:has-data-[slot=alert-dialog-media]:grid-rows-[auto_1fr]", e),
        ...t
    })
}
function AlertDialogFooter({className: e, ...t}) {
    return jsxRuntimeExports.jsx("div", {
        "data-slot": "alert-dialog-footer",
        className: cn$1("flex flex-col-reverse gap-2 group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2 sm:flex-row sm:justify-end", e),
        ...t
    })
}
function AlertDialogTitle({className: e, ...t}) {
    return jsxRuntimeExports.jsx(DialogTitle$1, {
        "data-slot": "alert-dialog-title",
        className: cn$1("text-sm font-medium sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2", e),
        ...t
    })
}
function AlertDialogDescription({className: e, ...t}) {
    return jsxRuntimeExports.jsx(DialogDescription$1, {
        "data-slot": "alert-dialog-description",
        className: cn$1("text-muted-foreground *:[a]:hover:text-foreground text-xs/relaxed text-balance md:text-pretty *:[a]:underline *:[a]:underline-offset-3", e),
        ...t
    })
}
function AlertDialogAction({className: e, ...t}) {
    return jsxRuntimeExports.jsx(Button, {
        "data-slot": "alert-dialog-action",
        className: cn$1(e),
        ...t
    })
}
function AlertDialogCancel({className: e, variant: t="outline", size: r="default", ...n}) {
    return jsxRuntimeExports.jsx(DialogClose$1, {
        "data-slot": "alert-dialog-cancel",
        className: cn$1(e),
        render: jsxRuntimeExports.jsx(Button, {
            variant: t,
            size: r
        }),
        ...n
    })
}
function DeleteDialog({isOpen: e, itemNames: t, onClose: r, onConfirm: n}) {
    const a = t.length === 1
      , s = a ? `Delete ${t[0]}?` : `Delete ${t.length} items?`;
    return jsxRuntimeExports.jsx(AlertDialog, {
        open: e,
        onOpenChange: o => !o && r(),
        children: jsxRuntimeExports.jsxs(AlertDialogContent, {
            children: [jsxRuntimeExports.jsxs(AlertDialogHeader, {
                children: [jsxRuntimeExports.jsx(AlertDialogTitle, {
                    children: s
                }), jsxRuntimeExports.jsxs(AlertDialogDescription, {
                    children: ["This action cannot be undone.", !a && jsxRuntimeExports.jsxs("ul", {
                        className: "mt-2 max-h-32 overflow-y-auto text-left list-disc pl-4",
                        children: [t.slice(0, 10).map(o => jsxRuntimeExports.jsx("li", {
                            className: "truncate",
                            children: o
                        }, o)), t.length > 10 && jsxRuntimeExports.jsxs("li", {
                            className: "text-muted-foreground",
                            children: ["...and ", t.length - 10, " more"]
                        })]
                    })]
                })]
            }), jsxRuntimeExports.jsxs(AlertDialogFooter, {
                children: [jsxRuntimeExports.jsx(AlertDialogCancel, {
                    onClick: r,
                    children: "Cancel"
                }), jsxRuntimeExports.jsx(AlertDialogAction, {
                    onClick: n,
                    variant: "destructive",
                    children: "Delete"
                })]
            })]
        })
    })
}
const log$2 = logger.scoped("file-explorer")
  , STORAGE_KEY = "redo-file-explorer-expanded-paths";
function loadExpandedPaths() {
    try {
        const e = localStorage.getItem(STORAGE_KEY);
        if (e)
            return new Set(JSON.parse(e))
    } catch (e) {
        log$2.error("Failed to load expanded paths:", e)
    }
    return new Set
}
function saveExpandedPaths(e) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...e]))
    } catch (t) {
        log$2.error("Failed to save expanded paths:", t)
    }
}
function buildTree(e) {
    const t = new Map
      , r = [...e].sort( (o, l) => o.path.localeCompare(l.path));
    for (const o of r) {
        if (o.path === "/")
            continue;
        const l = o.type === "symlink" ? "file" : o.type
          , u = o.path.split("/").pop() || ""
          , c = {
            path: o.path,
            name: u,
            type: l,
            size: o.size,
            mtime: o.mtime,
            children: l === "directory" ? [] : void 0
        };
        t.set(o.path, c)
    }
    const n = [];
    for (const o of t.values()) {
        const l = o.path.substring(0, o.path.lastIndexOf("/")) || "/";
        if (l === "/")
            n.push(o);
        else {
            const u = t.get(l);
            u && u.children && u.children.push(o)
        }
    }
    const a = o => o.sort( (l, u) => l.type !== u.type ? l.type === "directory" ? -1 : 1 : l.name.toLowerCase().localeCompare(u.name.toLowerCase()))
      , s = o => {
        const l = a(o);
        for (const u of l)
            u.children && (u.children = s(u.children));
        return l
    }
    ;
    return s(n)
}
function filterTree(e, t) {
    if (!t.trim())
        return e;
    const r = t.toLowerCase()
      , n = a => {
        const s = a.name.toLowerCase().includes(r);
        if (a.type === "file")
            return s ? a : null;
        const o = a.children?.map(n).filter(l => l !== null);
        return s || o && o.length > 0 ? {
            ...a,
            children: o || []
        } : null
    }
    ;
    return e.map(n).filter(a => a !== null)
}
function getExpandedPathsForFilter(e, t) {
    if (!t.trim())
        return new Set;
    const r = new Set
      , n = t.toLowerCase()
      , a = (s, o) => {
        const l = [...o, s.path];
        let u = !1;
        if (s.children)
            for (const p of s.children)
                a(p, l) && (u = !0);
        return s.name.toLowerCase().includes(n) || u ? (o.forEach(p => r.add(p)),
        !0) : !1
    }
    ;
    for (const s of e)
        a(s, []);
    return r
}
function getVisiblePaths(e, t) {
    const r = []
      , n = a => {
        for (const s of a)
            r.push(s.path),
            s.type === "directory" && t.has(s.path) && s.children && n(s.children)
    }
    ;
    return n(e),
    r
}
function useFileExplorer() {
    const [e,t] = reactExports.useState([])
      , [r,n] = reactExports.useState(loadExpandedPaths)
      , [a,s] = reactExports.useState(new Set)
      , [o,l] = reactExports.useState("")
      , [u,c] = reactExports.useState(!0)
      , [p,d] = reactExports.useState(null)
      , [f,h] = reactExports.useState(null)
      , [m,g] = reactExports.useState(null)
      , [x,b] = reactExports.useState(null)
      , y = reactExports.useRef(null)
      , w = reactExports.useCallback(async () => {
        try {
            c(!0),
            d(null);
            const lt = await (await getUnifiedFsInstance()).getAllEntries()
              , Ht = buildTree(lt);
            t(Ht)
        } catch (Kt) {
            log$2.error("Failed to load files:", Kt),
            d(Kt instanceof Error ? Kt.message : "Failed to load files")
        } finally {
            c(!1)
        }
    }
    , []);
    reactExports.useEffect( () => {
        w();
        let Kt = null;
        const lt = Ht => {
            w()
        }
        ;
        return getUnifiedFsInstance().then(Ht => {
            Kt = Ht,
            Kt.on(lt)
        }
        ),
        () => {
            Kt && Kt.off(lt)
        }
    }
    , [w]),
    reactExports.useEffect( () => {
        saveExpandedPaths(r)
    }
    , [r]);
    const R = filterTree(e, o)
      , T = o ? new Set([...r, ...getExpandedPathsForFilter(e, o)]) : r
      , C = reactExports.useCallback(Kt => {
        n(lt => {
            const Ht = new Set(lt);
            return Ht.has(Kt) ? Ht.delete(Kt) : Ht.add(Kt),
            Ht
        }
        )
    }
    , [])
      , P = reactExports.useCallback(Kt => {
        n(lt => {
            const Ht = new Set(lt);
            return Ht.add(Kt),
            Ht
        }
        )
    }
    , [])
      , W = reactExports.useCallback(Kt => {
        n(lt => {
            const Ht = new Set(lt);
            return Ht.delete(Kt),
            Ht
        }
        )
    }
    , [])
      , ue = reactExports.useCallback(Kt => {
        s(new Set([Kt])),
        y.current = Kt
    }
    , [])
      , ce = reactExports.useCallback(Kt => {
        s(lt => {
            const Ht = new Set(lt);
            return Ht.has(Kt) ? Ht.delete(Kt) : Ht.add(Kt),
            Ht
        }
        ),
        y.current = Kt
    }
    , [])
      , ve = reactExports.useCallback(Kt => {
        const lt = getVisiblePaths(R, T)
          , Ht = y.current || lt[0];
        if (!Ht) {
            ue(Kt);
            return
        }
        const $e = lt.indexOf(Ht)
          , G = lt.indexOf(Kt);
        if ($e === -1 || G === -1) {
            ue(Kt);
            return
        }
        const he = Math.min($e, G)
          , Xe = Math.max($e, G)
          , jr = lt.slice(he, Xe + 1);
        s(new Set(jr))
    }
    , [R, T, ue])
      , I = reactExports.useCallback( () => {
        const Kt = getVisiblePaths(R, T);
        s(new Set(Kt))
    }
    , [R, T])
      , M = reactExports.useCallback( () => {
        s(new Set),
        y.current = null
    }
    , [])
      , $ = reactExports.useCallback(async Kt => {
        try {
            const lt = await getUnifiedFsInstance();
            for (const Ht of Kt)
                await lt.rm(Ht, {
                    recursive: !0
                });
            s(new Set)
        } catch (lt) {
            throw log$2.error("Failed to delete:", lt),
            lt
        }
    }
    , [])
      , pt = reactExports.useCallback(async (Kt, lt) => {
        try {
            const Ht = await getUnifiedFsInstance()
              , $e = Kt.substring(0, Kt.lastIndexOf("/")) || "/"
              , G = $e === "/" ? `/${lt}` : `${$e}/${lt}`;
            if (await Ht.exists(G))
                throw new Error("A file with this name already exists");
            await Ht.mv(Kt, G),
            b(null)
        } catch (Ht) {
            throw log$2.error("Failed to rename:", Ht),
            Ht
        }
    }
    , [])
      , ba = reactExports.useCallback(async (Kt, lt) => {
        try {
            const Ht = await getUnifiedFsInstance()
              , $e = Kt.split("/").pop() || ""
              , G = lt === "/" ? `/${$e}` : `${lt}/${$e}`;
            if (Kt === lt)
                throw new Error("Cannot move a folder into itself");
            if (lt.startsWith(Kt + "/"))
                throw new Error("Cannot move a folder into itself");
            if (await Ht.exists(G))
                throw new Error("A file with this name already exists");
            await Ht.mv(Kt, G)
        } catch (Ht) {
            throw log$2.error("Failed to move:", Ht),
            Ht
        }
    }
    , [])
      , us = reactExports.useCallback(async (Kt, lt) => {
        const Ht = await getUnifiedFsInstance()
          , $e = lt.replace(/\.[^.]+$/, "")
          , G = lt.includes(".") ? lt.slice(lt.lastIndexOf(".")) : ".txt";
        let he = lt
          , Xe = 1
          , jr = Kt === "/" ? `/${he}` : `${Kt}/${he}`;
        for (; await Ht.exists(jr); )
            he = `${$e}-${Xe}${G}`,
            jr = Kt === "/" ? `/${he}` : `${Kt}/${he}`,
            Xe++;
        return await Ht.writeFile(jr, ""),
        jr
    }
    , [])
      , Wd = reactExports.useCallback(async (Kt, lt) => {
        const Ht = await getUnifiedFsInstance();
        let $e = lt
          , G = 1
          , he = Kt === "/" ? `/${$e}` : `${Kt}/${$e}`;
        for (; await Ht.exists(he); )
            $e = `${lt}-${G}`,
            he = Kt === "/" ? `/${$e}` : `${Kt}/${$e}`,
            G++;
        return await Ht.mkdir(he, {
            recursive: !0
        }),
        he
    }
    , [])
      , Mr = reactExports.useCallback(Kt => {
        const lt = Ht => {
            for (const $e of Ht) {
                if ($e.path === Kt)
                    return $e;
                if ($e.children) {
                    const G = lt($e.children);
                    if (G)
                        return G
                }
            }
            return null
        }
        ;
        return lt(e)
    }
    , [e]);
    return {
        files: R,
        allFiles: e,
        expandedPaths: T,
        selectedPaths: a,
        searchQuery: o,
        isLoading: u,
        error: p,
        draggedPath: f,
        dropTargetPath: m,
        renamingPath: x,
        setSearchQuery: l,
        toggleExpanded: C,
        expandPath: P,
        collapsePath: W,
        selectItem: ue,
        toggleItemInSelection: ce,
        selectRange: ve,
        selectAll: I,
        clearSelection: M,
        deleteItems: $,
        renameItem: pt,
        moveItem: ba,
        createFile: us,
        createFolder: Wd,
        setDraggedPath: h,
        setDropTargetPath: g,
        setRenamingPath: b,
        getNodeAtPath: Mr,
        refresh: w
    }
}
var jszip_min = {
    exports: {}
}, hasRequiredJszip_min;
function requireJszip_min() {
    return hasRequiredJszip_min || (hasRequiredJszip_min = 1,
    (function(e, t) {
        (function(r) {
            e.exports = r()
        }
        )(function() {
            return (function r(n, a, s) {
                function o(c, p) {
                    if (!a[c]) {
                        if (!n[c]) {
                            var d = typeof commonjsRequire == "function" && commonjsRequire;
                            if (!p && d)
                                return d(c, !0);
                            if (l)
                                return l(c, !0);
                            var f = new Error("Cannot find module '" + c + "'");
                            throw f.code = "MODULE_NOT_FOUND",
                            f
                        }
                        var h = a[c] = {
                            exports: {}
                        };
                        n[c][0].call(h.exports, function(m) {
                            var g = n[c][1][m];
                            return o(g || m)
                        }, h, h.exports, r, n, a, s)
                    }
                    return a[c].exports
                }
                for (var l = typeof commonjsRequire == "function" && commonjsRequire, u = 0; u < s.length; u++)
                    o(s[u]);
                return o
            }
            )({
                1: [function(r, n, a) {
                    var s = r("./utils")
                      , o = r("./support")
                      , l = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
                    a.encode = function(u) {
                        for (var c, p, d, f, h, m, g, x = [], b = 0, y = u.length, w = y, R = s.getTypeOf(u) !== "string"; b < u.length; )
                            w = y - b,
                            d = R ? (c = u[b++],
                            p = b < y ? u[b++] : 0,
                            b < y ? u[b++] : 0) : (c = u.charCodeAt(b++),
                            p = b < y ? u.charCodeAt(b++) : 0,
                            b < y ? u.charCodeAt(b++) : 0),
                            f = c >> 2,
                            h = (3 & c) << 4 | p >> 4,
                            m = 1 < w ? (15 & p) << 2 | d >> 6 : 64,
                            g = 2 < w ? 63 & d : 64,
                            x.push(l.charAt(f) + l.charAt(h) + l.charAt(m) + l.charAt(g));
                        return x.join("")
                    }
                    ,
                    a.decode = function(u) {
                        var c, p, d, f, h, m, g = 0, x = 0, b = "data:";
                        if (u.substr(0, b.length) === b)
                            throw new Error("Invalid base64 input, it looks like a data url.");
                        var y, w = 3 * (u = u.replace(/[^A-Za-z0-9+/=]/g, "")).length / 4;
                        if (u.charAt(u.length - 1) === l.charAt(64) && w--,
                        u.charAt(u.length - 2) === l.charAt(64) && w--,
                        w % 1 != 0)
                            throw new Error("Invalid base64 input, bad content length.");
                        for (y = o.uint8array ? new Uint8Array(0 | w) : new Array(0 | w); g < u.length; )
                            c = l.indexOf(u.charAt(g++)) << 2 | (f = l.indexOf(u.charAt(g++))) >> 4,
                            p = (15 & f) << 4 | (h = l.indexOf(u.charAt(g++))) >> 2,
                            d = (3 & h) << 6 | (m = l.indexOf(u.charAt(g++))),
                            y[x++] = c,
                            h !== 64 && (y[x++] = p),
                            m !== 64 && (y[x++] = d);
                        return y
                    }
                }
                , {
                    "./support": 30,
                    "./utils": 32
                }],
                2: [function(r, n, a) {
                    var s = r("./external")
                      , o = r("./stream/DataWorker")
                      , l = r("./stream/Crc32Probe")
                      , u = r("./stream/DataLengthProbe");
                    function c(p, d, f, h, m) {
                        this.compressedSize = p,
                        this.uncompressedSize = d,
                        this.crc32 = f,
                        this.compression = h,
                        this.compressedContent = m
                    }
                    c.prototype = {
                        getContentWorker: function() {
                            var p = new o(s.Promise.resolve(this.compressedContent)).pipe(this.compression.uncompressWorker()).pipe(new u("data_length"))
                              , d = this;
                            return p.on("end", function() {
                                if (this.streamInfo.data_length !== d.uncompressedSize)
                                    throw new Error("Bug : uncompressed data size mismatch")
                            }),
                            p
                        },
                        getCompressedWorker: function() {
                            return new o(s.Promise.resolve(this.compressedContent)).withStreamInfo("compressedSize", this.compressedSize).withStreamInfo("uncompressedSize", this.uncompressedSize).withStreamInfo("crc32", this.crc32).withStreamInfo("compression", this.compression)
                        }
                    },
                    c.createWorkerFrom = function(p, d, f) {
                        return p.pipe(new l).pipe(new u("uncompressedSize")).pipe(d.compressWorker(f)).pipe(new u("compressedSize")).withStreamInfo("compression", d)
                    }
                    ,
                    n.exports = c
                }
                , {
                    "./external": 6,
                    "./stream/Crc32Probe": 25,
                    "./stream/DataLengthProbe": 26,
                    "./stream/DataWorker": 27
                }],
                3: [function(r, n, a) {
                    var s = r("./stream/GenericWorker");
                    a.STORE = {
                        magic: "\0\0",
                        compressWorker: function() {
                            return new s("STORE compression")
                        },
                        uncompressWorker: function() {
                            return new s("STORE decompression")
                        }
                    },
                    a.DEFLATE = r("./flate")
                }
                , {
                    "./flate": 7,
                    "./stream/GenericWorker": 28
                }],
                4: [function(r, n, a) {
                    var s = r("./utils")
                      , o = (function() {
                        for (var l, u = [], c = 0; c < 256; c++) {
                            l = c;
                            for (var p = 0; p < 8; p++)
                                l = 1 & l ? 3988292384 ^ l >>> 1 : l >>> 1;
                            u[c] = l
                        }
                        return u
                    }
                    )();
                    n.exports = function(l, u) {
                        return l !== void 0 && l.length ? s.getTypeOf(l) !== "string" ? (function(c, p, d, f) {
                            var h = o
                              , m = f + d;
                            c ^= -1;
                            for (var g = f; g < m; g++)
                                c = c >>> 8 ^ h[255 & (c ^ p[g])];
                            return -1 ^ c
                        }
                        )(0 | u, l, l.length, 0) : (function(c, p, d, f) {
                            var h = o
                              , m = f + d;
                            c ^= -1;
                            for (var g = f; g < m; g++)
                                c = c >>> 8 ^ h[255 & (c ^ p.charCodeAt(g))];
                            return -1 ^ c
                        }
                        )(0 | u, l, l.length, 0) : 0
                    }
                }
                , {
                    "./utils": 32
                }],
                5: [function(r, n, a) {
                    a.base64 = !1,
                    a.binary = !1,
                    a.dir = !1,
                    a.createFolders = !0,
                    a.date = null,
                    a.compression = null,
                    a.compressionOptions = null,
                    a.comment = null,
                    a.unixPermissions = null,
                    a.dosPermissions = null
                }
                , {}],
                6: [function(r, n, a) {
                    var s = null;
                    s = typeof Promise < "u" ? Promise : r("lie"),
                    n.exports = {
                        Promise: s
                    }
                }
                , {
                    lie: 37
                }],
                7: [function(r, n, a) {
                    var s = typeof Uint8Array < "u" && typeof Uint16Array < "u" && typeof Uint32Array < "u"
                      , o = r("pako")
                      , l = r("./utils")
                      , u = r("./stream/GenericWorker")
                      , c = s ? "uint8array" : "array";
                    function p(d, f) {
                        u.call(this, "FlateWorker/" + d),
                        this._pako = null,
                        this._pakoAction = d,
                        this._pakoOptions = f,
                        this.meta = {}
                    }
                    a.magic = "\b\0",
                    l.inherits(p, u),
                    p.prototype.processChunk = function(d) {
                        this.meta = d.meta,
                        this._pako === null && this._createPako(),
                        this._pako.push(l.transformTo(c, d.data), !1)
                    }
                    ,
                    p.prototype.flush = function() {
                        u.prototype.flush.call(this),
                        this._pako === null && this._createPako(),
                        this._pako.push([], !0)
                    }
                    ,
                    p.prototype.cleanUp = function() {
                        u.prototype.cleanUp.call(this),
                        this._pako = null
                    }
                    ,
                    p.prototype._createPako = function() {
                        this._pako = new o[this._pakoAction]({
                            raw: !0,
                            level: this._pakoOptions.level || -1
                        });
                        var d = this;
                        this._pako.onData = function(f) {
                            d.push({
                                data: f,
                                meta: d.meta
                            })
                        }
                    }
                    ,
                    a.compressWorker = function(d) {
                        return new p("Deflate",d)
                    }
                    ,
                    a.uncompressWorker = function() {
                        return new p("Inflate",{})
                    }
                }
                , {
                    "./stream/GenericWorker": 28,
                    "./utils": 32,
                    pako: 38
                }],
                8: [function(r, n, a) {
                    function s(h, m) {
                        var g, x = "";
                        for (g = 0; g < m; g++)
                            x += String.fromCharCode(255 & h),
                            h >>>= 8;
                        return x
                    }
                    function o(h, m, g, x, b, y) {
                        var w, R, T = h.file, C = h.compression, P = y !== c.utf8encode, W = l.transformTo("string", y(T.name)), ue = l.transformTo("string", c.utf8encode(T.name)), ce = T.comment, ve = l.transformTo("string", y(ce)), I = l.transformTo("string", c.utf8encode(ce)), M = ue.length !== T.name.length, $ = I.length !== ce.length, pt = "", ba = "", us = "", Wd = T.dir, Mr = T.date, Kt = {
                            crc32: 0,
                            compressedSize: 0,
                            uncompressedSize: 0
                        };
                        m && !g || (Kt.crc32 = h.crc32,
                        Kt.compressedSize = h.compressedSize,
                        Kt.uncompressedSize = h.uncompressedSize);
                        var lt = 0;
                        m && (lt |= 8),
                        P || !M && !$ || (lt |= 2048);
                        var Ht = 0
                          , $e = 0;
                        Wd && (Ht |= 16),
                        b === "UNIX" ? ($e = 798,
                        Ht |= (function(he, Xe) {
                            var jr = he;
                            return he || (jr = Xe ? 16893 : 33204),
                            (65535 & jr) << 16
                        }
                        )(T.unixPermissions, Wd)) : ($e = 20,
                        Ht |= (function(he) {
                            return 63 & (he || 0)
                        }
                        )(T.dosPermissions)),
                        w = Mr.getUTCHours(),
                        w <<= 6,
                        w |= Mr.getUTCMinutes(),
                        w <<= 5,
                        w |= Mr.getUTCSeconds() / 2,
                        R = Mr.getUTCFullYear() - 1980,
                        R <<= 4,
                        R |= Mr.getUTCMonth() + 1,
                        R <<= 5,
                        R |= Mr.getUTCDate(),
                        M && (ba = s(1, 1) + s(p(W), 4) + ue,
                        pt += "up" + s(ba.length, 2) + ba),
                        $ && (us = s(1, 1) + s(p(ve), 4) + I,
                        pt += "uc" + s(us.length, 2) + us);
                        var G = "";
                        return G += `
\0`,
                        G += s(lt, 2),
                        G += C.magic,
                        G += s(w, 2),
                        G += s(R, 2),
                        G += s(Kt.crc32, 4),
                        G += s(Kt.compressedSize, 4),
                        G += s(Kt.uncompressedSize, 4),
                        G += s(W.length, 2),
                        G += s(pt.length, 2),
                        {
                            fileRecord: d.LOCAL_FILE_HEADER + G + W + pt,
                            dirRecord: d.CENTRAL_FILE_HEADER + s($e, 2) + G + s(ve.length, 2) + "\0\0\0\0" + s(Ht, 4) + s(x, 4) + W + pt + ve
                        }
                    }
                    var l = r("../utils")
                      , u = r("../stream/GenericWorker")
                      , c = r("../utf8")
                      , p = r("../crc32")
                      , d = r("../signature");
                    function f(h, m, g, x) {
                        u.call(this, "ZipFileWorker"),
                        this.bytesWritten = 0,
                        this.zipComment = m,
                        this.zipPlatform = g,
                        this.encodeFileName = x,
                        this.streamFiles = h,
                        this.accumulate = !1,
                        this.contentBuffer = [],
                        this.dirRecords = [],
                        this.currentSourceOffset = 0,
                        this.entriesCount = 0,
                        this.currentFile = null,
                        this._sources = []
                    }
                    l.inherits(f, u),
                    f.prototype.push = function(h) {
                        var m = h.meta.percent || 0
                          , g = this.entriesCount
                          , x = this._sources.length;
                        this.accumulate ? this.contentBuffer.push(h) : (this.bytesWritten += h.data.length,
                        u.prototype.push.call(this, {
                            data: h.data,
                            meta: {
                                currentFile: this.currentFile,
                                percent: g ? (m + 100 * (g - x - 1)) / g : 100
                            }
                        }))
                    }
                    ,
                    f.prototype.openedSource = function(h) {
                        this.currentSourceOffset = this.bytesWritten,
                        this.currentFile = h.file.name;
                        var m = this.streamFiles && !h.file.dir;
                        if (m) {
                            var g = o(h, m, !1, this.currentSourceOffset, this.zipPlatform, this.encodeFileName);
                            this.push({
                                data: g.fileRecord,
                                meta: {
                                    percent: 0
                                }
                            })
                        } else
                            this.accumulate = !0
                    }
                    ,
                    f.prototype.closedSource = function(h) {
                        this.accumulate = !1;
                        var m = this.streamFiles && !h.file.dir
                          , g = o(h, m, !0, this.currentSourceOffset, this.zipPlatform, this.encodeFileName);
                        if (this.dirRecords.push(g.dirRecord),
                        m)
                            this.push({
                                data: (function(x) {
                                    return d.DATA_DESCRIPTOR + s(x.crc32, 4) + s(x.compressedSize, 4) + s(x.uncompressedSize, 4)
                                }
                                )(h),
                                meta: {
                                    percent: 100
                                }
                            });
                        else
                            for (this.push({
                                data: g.fileRecord,
                                meta: {
                                    percent: 0
                                }
                            }); this.contentBuffer.length; )
                                this.push(this.contentBuffer.shift());
                        this.currentFile = null
                    }
                    ,
                    f.prototype.flush = function() {
                        for (var h = this.bytesWritten, m = 0; m < this.dirRecords.length; m++)
                            this.push({
                                data: this.dirRecords[m],
                                meta: {
                                    percent: 100
                                }
                            });
                        var g = this.bytesWritten - h
                          , x = (function(b, y, w, R, T) {
                            var C = l.transformTo("string", T(R));
                            return d.CENTRAL_DIRECTORY_END + "\0\0\0\0" + s(b, 2) + s(b, 2) + s(y, 4) + s(w, 4) + s(C.length, 2) + C
                        }
                        )(this.dirRecords.length, g, h, this.zipComment, this.encodeFileName);
                        this.push({
                            data: x,
                            meta: {
                                percent: 100
                            }
                        })
                    }
                    ,
                    f.prototype.prepareNextSource = function() {
                        this.previous = this._sources.shift(),
                        this.openedSource(this.previous.streamInfo),
                        this.isPaused ? this.previous.pause() : this.previous.resume()
                    }
                    ,
                    f.prototype.registerPrevious = function(h) {
                        this._sources.push(h);
                        var m = this;
                        return h.on("data", function(g) {
                            m.processChunk(g)
                        }),
                        h.on("end", function() {
                            m.closedSource(m.previous.streamInfo),
                            m._sources.length ? m.prepareNextSource() : m.end()
                        }),
                        h.on("error", function(g) {
                            m.error(g)
                        }),
                        this
                    }
                    ,
                    f.prototype.resume = function() {
                        return !!u.prototype.resume.call(this) && (!this.previous && this._sources.length ? (this.prepareNextSource(),
                        !0) : this.previous || this._sources.length || this.generatedError ? void 0 : (this.end(),
                        !0))
                    }
                    ,
                    f.prototype.error = function(h) {
                        var m = this._sources;
                        if (!u.prototype.error.call(this, h))
                            return !1;
                        for (var g = 0; g < m.length; g++)
                            try {
                                m[g].error(h)
                            } catch {}
                        return !0
                    }
                    ,
                    f.prototype.lock = function() {
                        u.prototype.lock.call(this);
                        for (var h = this._sources, m = 0; m < h.length; m++)
                            h[m].lock()
                    }
                    ,
                    n.exports = f
                }
                , {
                    "../crc32": 4,
                    "../signature": 23,
                    "../stream/GenericWorker": 28,
                    "../utf8": 31,
                    "../utils": 32
                }],
                9: [function(r, n, a) {
                    var s = r("../compressions")
                      , o = r("./ZipFileWorker");
                    a.generateWorker = function(l, u, c) {
                        var p = new o(u.streamFiles,c,u.platform,u.encodeFileName)
                          , d = 0;
                        try {
                            l.forEach(function(f, h) {
                                d++;
                                var m = (function(y, w) {
                                    var R = y || w
                                      , T = s[R];
                                    if (!T)
                                        throw new Error(R + " is not a valid compression method !");
                                    return T
                                }
                                )(h.options.compression, u.compression)
                                  , g = h.options.compressionOptions || u.compressionOptions || {}
                                  , x = h.dir
                                  , b = h.date;
                                h._compressWorker(m, g).withStreamInfo("file", {
                                    name: f,
                                    dir: x,
                                    date: b,
                                    comment: h.comment || "",
                                    unixPermissions: h.unixPermissions,
                                    dosPermissions: h.dosPermissions
                                }).pipe(p)
                            }),
                            p.entriesCount = d
                        } catch (f) {
                            p.error(f)
                        }
                        return p
                    }
                }
                , {
                    "../compressions": 3,
                    "./ZipFileWorker": 8
                }],
                10: [function(r, n, a) {
                    function s() {
                        if (!(this instanceof s))
                            return new s;
                        if (arguments.length)
                            throw new Error("The constructor with parameters has been removed in JSZip 3.0, please check the upgrade guide.");
                        this.files = Object.create(null),
                        this.comment = null,
                        this.root = "",
                        this.clone = function() {
                            var o = new s;
                            for (var l in this)
                                typeof this[l] != "function" && (o[l] = this[l]);
                            return o
                        }
                    }
                    (s.prototype = r("./object")).loadAsync = r("./load"),
                    s.support = r("./support"),
                    s.defaults = r("./defaults"),
                    s.version = "3.10.1",
                    s.loadAsync = function(o, l) {
                        return new s().loadAsync(o, l)
                    }
                    ,
                    s.external = r("./external"),
                    n.exports = s
                }
                , {
                    "./defaults": 5,
                    "./external": 6,
                    "./load": 11,
                    "./object": 15,
                    "./support": 30
                }],
                11: [function(r, n, a) {
                    var s = r("./utils")
                      , o = r("./external")
                      , l = r("./utf8")
                      , u = r("./zipEntries")
                      , c = r("./stream/Crc32Probe")
                      , p = r("./nodejsUtils");
                    function d(f) {
                        return new o.Promise(function(h, m) {
                            var g = f.decompressed.getContentWorker().pipe(new c);
                            g.on("error", function(x) {
                                m(x)
                            }).on("end", function() {
                                g.streamInfo.crc32 !== f.decompressed.crc32 ? m(new Error("Corrupted zip : CRC32 mismatch")) : h()
                            }).resume()
                        }
                        )
                    }
                    n.exports = function(f, h) {
                        var m = this;
                        return h = s.extend(h || {}, {
                            base64: !1,
                            checkCRC32: !1,
                            optimizedBinaryString: !1,
                            createFolders: !1,
                            decodeFileName: l.utf8decode
                        }),
                        p.isNode && p.isStream(f) ? o.Promise.reject(new Error("JSZip can't accept a stream when loading a zip file.")) : s.prepareContent("the loaded zip file", f, !0, h.optimizedBinaryString, h.base64).then(function(g) {
                            var x = new u(h);
                            return x.load(g),
                            x
                        }).then(function(g) {
                            var x = [o.Promise.resolve(g)]
                              , b = g.files;
                            if (h.checkCRC32)
                                for (var y = 0; y < b.length; y++)
                                    x.push(d(b[y]));
                            return o.Promise.all(x)
                        }).then(function(g) {
                            for (var x = g.shift(), b = x.files, y = 0; y < b.length; y++) {
                                var w = b[y]
                                  , R = w.fileNameStr
                                  , T = s.resolve(w.fileNameStr);
                                m.file(T, w.decompressed, {
                                    binary: !0,
                                    optimizedBinaryString: !0,
                                    date: w.date,
                                    dir: w.dir,
                                    comment: w.fileCommentStr.length ? w.fileCommentStr : null,
                                    unixPermissions: w.unixPermissions,
                                    dosPermissions: w.dosPermissions,
                                    createFolders: h.createFolders
                                }),
                                w.dir || (m.file(T).unsafeOriginalName = R)
                            }
                            return x.zipComment.length && (m.comment = x.zipComment),
                            m
                        })
                    }
                }
                , {
                    "./external": 6,
                    "./nodejsUtils": 14,
                    "./stream/Crc32Probe": 25,
                    "./utf8": 31,
                    "./utils": 32,
                    "./zipEntries": 33
                }],
                12: [function(r, n, a) {
                    var s = r("../utils")
                      , o = r("../stream/GenericWorker");
                    function l(u, c) {
                        o.call(this, "Nodejs stream input adapter for " + u),
                        this._upstreamEnded = !1,
                        this._bindStream(c)
                    }
                    s.inherits(l, o),
                    l.prototype._bindStream = function(u) {
                        var c = this;
                        (this._stream = u).pause(),
                        u.on("data", function(p) {
                            c.push({
                                data: p,
                                meta: {
                                    percent: 0
                                }
                            })
                        }).on("error", function(p) {
                            c.isPaused ? this.generatedError = p : c.error(p)
                        }).on("end", function() {
                            c.isPaused ? c._upstreamEnded = !0 : c.end()
                        })
                    }
                    ,
                    l.prototype.pause = function() {
                        return !!o.prototype.pause.call(this) && (this._stream.pause(),
                        !0)
                    }
                    ,
                    l.prototype.resume = function() {
                        return !!o.prototype.resume.call(this) && (this._upstreamEnded ? this.end() : this._stream.resume(),
                        !0)
                    }
                    ,
                    n.exports = l
                }
                , {
                    "../stream/GenericWorker": 28,
                    "../utils": 32
                }],
                13: [function(r, n, a) {
                    var s = r("readable-stream").Readable;
                    function o(l, u, c) {
                        s.call(this, u),
                        this._helper = l;
                        var p = this;
                        l.on("data", function(d, f) {
                            p.push(d) || p._helper.pause(),
                            c && c(f)
                        }).on("error", function(d) {
                            p.emit("error", d)
                        }).on("end", function() {
                            p.push(null)
                        })
                    }
                    r("../utils").inherits(o, s),
                    o.prototype._read = function() {
                        this._helper.resume()
                    }
                    ,
                    n.exports = o
                }
                , {
                    "../utils": 32,
                    "readable-stream": 16
                }],
                14: [function(r, n, a) {
                    n.exports = {
                        isNode: typeof Buffer < "u",
                        newBufferFrom: function(s, o) {
                            if (Buffer.from && Buffer.from !== Uint8Array.from)
                                return Buffer.from(s, o);
                            if (typeof s == "number")
                                throw new Error('The "data" argument must not be a number');
                            return new Buffer(s,o)
                        },
                        allocBuffer: function(s) {
                            if (Buffer.alloc)
                                return Buffer.alloc(s);
                            var o = new Buffer(s);
                            return o.fill(0),
                            o
                        },
                        isBuffer: function(s) {
                            return Buffer.isBuffer(s)
                        },
                        isStream: function(s) {
                            return s && typeof s.on == "function" && typeof s.pause == "function" && typeof s.resume == "function"
                        }
                    }
                }
                , {}],
                15: [function(r, n, a) {
                    function s(T, C, P) {
                        var W, ue = l.getTypeOf(C), ce = l.extend(P || {}, p);
                        ce.date = ce.date || new Date,
                        ce.compression !== null && (ce.compression = ce.compression.toUpperCase()),
                        typeof ce.unixPermissions == "string" && (ce.unixPermissions = parseInt(ce.unixPermissions, 8)),
                        ce.unixPermissions && 16384 & ce.unixPermissions && (ce.dir = !0),
                        ce.dosPermissions && 16 & ce.dosPermissions && (ce.dir = !0),
                        ce.dir && (T = b(T)),
                        ce.createFolders && (W = x(T)) && y.call(this, W, !0);
                        var ve = ue === "string" && ce.binary === !1 && ce.base64 === !1;
                        P && P.binary !== void 0 || (ce.binary = !ve),
                        (C instanceof d && C.uncompressedSize === 0 || ce.dir || !C || C.length === 0) && (ce.base64 = !1,
                        ce.binary = !0,
                        C = "",
                        ce.compression = "STORE",
                        ue = "string");
                        var I = null;
                        I = C instanceof d || C instanceof u ? C : m.isNode && m.isStream(C) ? new g(T,C) : l.prepareContent(T, C, ce.binary, ce.optimizedBinaryString, ce.base64);
                        var M = new f(T,I,ce);
                        this.files[T] = M
                    }
                    var o = r("./utf8")
                      , l = r("./utils")
                      , u = r("./stream/GenericWorker")
                      , c = r("./stream/StreamHelper")
                      , p = r("./defaults")
                      , d = r("./compressedObject")
                      , f = r("./zipObject")
                      , h = r("./generate")
                      , m = r("./nodejsUtils")
                      , g = r("./nodejs/NodejsStreamInputAdapter")
                      , x = function(T) {
                        T.slice(-1) === "/" && (T = T.substring(0, T.length - 1));
                        var C = T.lastIndexOf("/");
                        return 0 < C ? T.substring(0, C) : ""
                    }
                      , b = function(T) {
                        return T.slice(-1) !== "/" && (T += "/"),
                        T
                    }
                      , y = function(T, C) {
                        return C = C !== void 0 ? C : p.createFolders,
                        T = b(T),
                        this.files[T] || s.call(this, T, null, {
                            dir: !0,
                            createFolders: C
                        }),
                        this.files[T]
                    };
                    function w(T) {
                        return Object.prototype.toString.call(T) === "[object RegExp]"
                    }
                    var R = {
                        load: function() {
                            throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.")
                        },
                        forEach: function(T) {
                            var C, P, W;
                            for (C in this.files)
                                W = this.files[C],
                                (P = C.slice(this.root.length, C.length)) && C.slice(0, this.root.length) === this.root && T(P, W)
                        },
                        filter: function(T) {
                            var C = [];
                            return this.forEach(function(P, W) {
                                T(P, W) && C.push(W)
                            }),
                            C
                        },
                        file: function(T, C, P) {
                            if (arguments.length !== 1)
                                return T = this.root + T,
                                s.call(this, T, C, P),
                                this;
                            if (w(T)) {
                                var W = T;
                                return this.filter(function(ce, ve) {
                                    return !ve.dir && W.test(ce)
                                })
                            }
                            var ue = this.files[this.root + T];
                            return ue && !ue.dir ? ue : null
                        },
                        folder: function(T) {
                            if (!T)
                                return this;
                            if (w(T))
                                return this.filter(function(ue, ce) {
                                    return ce.dir && T.test(ue)
                                });
                            var C = this.root + T
                              , P = y.call(this, C)
                              , W = this.clone();
                            return W.root = P.name,
                            W
                        },
                        remove: function(T) {
                            T = this.root + T;
                            var C = this.files[T];
                            if (C || (T.slice(-1) !== "/" && (T += "/"),
                            C = this.files[T]),
                            C && !C.dir)
                                delete this.files[T];
                            else
                                for (var P = this.filter(function(ue, ce) {
                                    return ce.name.slice(0, T.length) === T
                                }), W = 0; W < P.length; W++)
                                    delete this.files[P[W].name];
                            return this
                        },
                        generate: function() {
                            throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.")
                        },
                        generateInternalStream: function(T) {
                            var C, P = {};
                            try {
                                if ((P = l.extend(T || {}, {
                                    streamFiles: !1,
                                    compression: "STORE",
                                    compressionOptions: null,
                                    type: "",
                                    platform: "DOS",
                                    comment: null,
                                    mimeType: "application/zip",
                                    encodeFileName: o.utf8encode
                                })).type = P.type.toLowerCase(),
                                P.compression = P.compression.toUpperCase(),
                                P.type === "binarystring" && (P.type = "string"),
                                !P.type)
                                    throw new Error("No output type specified.");
                                l.checkSupport(P.type),
                                P.platform !== "darwin" && P.platform !== "freebsd" && P.platform !== "linux" && P.platform !== "sunos" || (P.platform = "UNIX"),
                                P.platform === "win32" && (P.platform = "DOS");
                                var W = P.comment || this.comment || "";
                                C = h.generateWorker(this, P, W)
                            } catch (ue) {
                                (C = new u("error")).error(ue)
                            }
                            return new c(C,P.type || "string",P.mimeType)
                        },
                        generateAsync: function(T, C) {
                            return this.generateInternalStream(T).accumulate(C)
                        },
                        generateNodeStream: function(T, C) {
                            return (T = T || {}).type || (T.type = "nodebuffer"),
                            this.generateInternalStream(T).toNodejsStream(C)
                        }
                    };
                    n.exports = R
                }
                , {
                    "./compressedObject": 2,
                    "./defaults": 5,
                    "./generate": 9,
                    "./nodejs/NodejsStreamInputAdapter": 12,
                    "./nodejsUtils": 14,
                    "./stream/GenericWorker": 28,
                    "./stream/StreamHelper": 29,
                    "./utf8": 31,
                    "./utils": 32,
                    "./zipObject": 35
                }],
                16: [function(r, n, a) {
                    n.exports = r("stream")
                }
                , {
                    stream: void 0
                }],
                17: [function(r, n, a) {
                    var s = r("./DataReader");
                    function o(l) {
                        s.call(this, l);
                        for (var u = 0; u < this.data.length; u++)
                            l[u] = 255 & l[u]
                    }
                    r("../utils").inherits(o, s),
                    o.prototype.byteAt = function(l) {
                        return this.data[this.zero + l]
                    }
                    ,
                    o.prototype.lastIndexOfSignature = function(l) {
                        for (var u = l.charCodeAt(0), c = l.charCodeAt(1), p = l.charCodeAt(2), d = l.charCodeAt(3), f = this.length - 4; 0 <= f; --f)
                            if (this.data[f] === u && this.data[f + 1] === c && this.data[f + 2] === p && this.data[f + 3] === d)
                                return f - this.zero;
                        return -1
                    }
                    ,
                    o.prototype.readAndCheckSignature = function(l) {
                        var u = l.charCodeAt(0)
                          , c = l.charCodeAt(1)
                          , p = l.charCodeAt(2)
                          , d = l.charCodeAt(3)
                          , f = this.readData(4);
                        return u === f[0] && c === f[1] && p === f[2] && d === f[3]
                    }
                    ,
                    o.prototype.readData = function(l) {
                        if (this.checkOffset(l),
                        l === 0)
                            return [];
                        var u = this.data.slice(this.zero + this.index, this.zero + this.index + l);
                        return this.index += l,
                        u
                    }
                    ,
                    n.exports = o
                }
                , {
                    "../utils": 32,
                    "./DataReader": 18
                }],
                18: [function(r, n, a) {
                    var s = r("../utils");
                    function o(l) {
                        this.data = l,
                        this.length = l.length,
                        this.index = 0,
                        this.zero = 0
                    }
                    o.prototype = {
                        checkOffset: function(l) {
                            this.checkIndex(this.index + l)
                        },
                        checkIndex: function(l) {
                            if (this.length < this.zero + l || l < 0)
                                throw new Error("End of data reached (data length = " + this.length + ", asked index = " + l + "). Corrupted zip ?")
                        },
                        setIndex: function(l) {
                            this.checkIndex(l),
                            this.index = l
                        },
                        skip: function(l) {
                            this.setIndex(this.index + l)
                        },
                        byteAt: function() {},
                        readInt: function(l) {
                            var u, c = 0;
                            for (this.checkOffset(l),
                            u = this.index + l - 1; u >= this.index; u--)
                                c = (c << 8) + this.byteAt(u);
                            return this.index += l,
                            c
                        },
                        readString: function(l) {
                            return s.transformTo("string", this.readData(l))
                        },
                        readData: function() {},
                        lastIndexOfSignature: function() {},
                        readAndCheckSignature: function() {},
                        readDate: function() {
                            var l = this.readInt(4);
                            return new Date(Date.UTC(1980 + (l >> 25 & 127), (l >> 21 & 15) - 1, l >> 16 & 31, l >> 11 & 31, l >> 5 & 63, (31 & l) << 1))
                        }
                    },
                    n.exports = o
                }
                , {
                    "../utils": 32
                }],
                19: [function(r, n, a) {
                    var s = r("./Uint8ArrayReader");
                    function o(l) {
                        s.call(this, l)
                    }
                    r("../utils").inherits(o, s),
                    o.prototype.readData = function(l) {
                        this.checkOffset(l);
                        var u = this.data.slice(this.zero + this.index, this.zero + this.index + l);
                        return this.index += l,
                        u
                    }
                    ,
                    n.exports = o
                }
                , {
                    "../utils": 32,
                    "./Uint8ArrayReader": 21
                }],
                20: [function(r, n, a) {
                    var s = r("./DataReader");
                    function o(l) {
                        s.call(this, l)
                    }
                    r("../utils").inherits(o, s),
                    o.prototype.byteAt = function(l) {
                        return this.data.charCodeAt(this.zero + l)
                    }
                    ,
                    o.prototype.lastIndexOfSignature = function(l) {
                        return this.data.lastIndexOf(l) - this.zero
                    }
                    ,
                    o.prototype.readAndCheckSignature = function(l) {
                        return l === this.readData(4)
                    }
                    ,
                    o.prototype.readData = function(l) {
                        this.checkOffset(l);
                        var u = this.data.slice(this.zero + this.index, this.zero + this.index + l);
                        return this.index += l,
                        u
                    }
                    ,
                    n.exports = o
                }
                , {
                    "../utils": 32,
                    "./DataReader": 18
                }],
                21: [function(r, n, a) {
                    var s = r("./ArrayReader");
                    function o(l) {
                        s.call(this, l)
                    }
                    r("../utils").inherits(o, s),
                    o.prototype.readData = function(l) {
                        if (this.checkOffset(l),
                        l === 0)
                            return new Uint8Array(0);
                        var u = this.data.subarray(this.zero + this.index, this.zero + this.index + l);
                        return this.index += l,
                        u
                    }
                    ,
                    n.exports = o
                }
                , {
                    "../utils": 32,
                    "./ArrayReader": 17
                }],
                22: [function(r, n, a) {
                    var s = r("../utils")
                      , o = r("../support")
                      , l = r("./ArrayReader")
                      , u = r("./StringReader")
                      , c = r("./NodeBufferReader")
                      , p = r("./Uint8ArrayReader");
                    n.exports = function(d) {
                        var f = s.getTypeOf(d);
                        return s.checkSupport(f),
                        f !== "string" || o.uint8array ? f === "nodebuffer" ? new c(d) : o.uint8array ? new p(s.transformTo("uint8array", d)) : new l(s.transformTo("array", d)) : new u(d)
                    }
                }
                , {
                    "../support": 30,
                    "../utils": 32,
                    "./ArrayReader": 17,
                    "./NodeBufferReader": 19,
                    "./StringReader": 20,
                    "./Uint8ArrayReader": 21
                }],
                23: [function(r, n, a) {
                    a.LOCAL_FILE_HEADER = "PK",
                    a.CENTRAL_FILE_HEADER = "PK",
                    a.CENTRAL_DIRECTORY_END = "PK",
                    a.ZIP64_CENTRAL_DIRECTORY_LOCATOR = "PK\x07",
                    a.ZIP64_CENTRAL_DIRECTORY_END = "PK",
                    a.DATA_DESCRIPTOR = "PK\x07\b"
                }
                , {}],
                24: [function(r, n, a) {
                    var s = r("./GenericWorker")
                      , o = r("../utils");
                    function l(u) {
                        s.call(this, "ConvertWorker to " + u),
                        this.destType = u
                    }
                    o.inherits(l, s),
                    l.prototype.processChunk = function(u) {
                        this.push({
                            data: o.transformTo(this.destType, u.data),
                            meta: u.meta
                        })
                    }
                    ,
                    n.exports = l
                }
                , {
                    "../utils": 32,
                    "./GenericWorker": 28
                }],
                25: [function(r, n, a) {
                    var s = r("./GenericWorker")
                      , o = r("../crc32");
                    function l() {
                        s.call(this, "Crc32Probe"),
                        this.withStreamInfo("crc32", 0)
                    }
                    r("../utils").inherits(l, s),
                    l.prototype.processChunk = function(u) {
                        this.streamInfo.crc32 = o(u.data, this.streamInfo.crc32 || 0),
                        this.push(u)
                    }
                    ,
                    n.exports = l
                }
                , {
                    "../crc32": 4,
                    "../utils": 32,
                    "./GenericWorker": 28
                }],
                26: [function(r, n, a) {
                    var s = r("../utils")
                      , o = r("./GenericWorker");
                    function l(u) {
                        o.call(this, "DataLengthProbe for " + u),
                        this.propName = u,
                        this.withStreamInfo(u, 0)
                    }
                    s.inherits(l, o),
                    l.prototype.processChunk = function(u) {
                        if (u) {
                            var c = this.streamInfo[this.propName] || 0;
                            this.streamInfo[this.propName] = c + u.data.length
                        }
                        o.prototype.processChunk.call(this, u)
                    }
                    ,
                    n.exports = l
                }
                , {
                    "../utils": 32,
                    "./GenericWorker": 28
                }],
                27: [function(r, n, a) {
                    var s = r("../utils")
                      , o = r("./GenericWorker");
                    function l(u) {
                        o.call(this, "DataWorker");
                        var c = this;
                        this.dataIsReady = !1,
                        this.index = 0,
                        this.max = 0,
                        this.data = null,
                        this.type = "",
                        this._tickScheduled = !1,
                        u.then(function(p) {
                            c.dataIsReady = !0,
                            c.data = p,
                            c.max = p && p.length || 0,
                            c.type = s.getTypeOf(p),
                            c.isPaused || c._tickAndRepeat()
                        }, function(p) {
                            c.error(p)
                        })
                    }
                    s.inherits(l, o),
                    l.prototype.cleanUp = function() {
                        o.prototype.cleanUp.call(this),
                        this.data = null
                    }
                    ,
                    l.prototype.resume = function() {
                        return !!o.prototype.resume.call(this) && (!this._tickScheduled && this.dataIsReady && (this._tickScheduled = !0,
                        s.delay(this._tickAndRepeat, [], this)),
                        !0)
                    }
                    ,
                    l.prototype._tickAndRepeat = function() {
                        this._tickScheduled = !1,
                        this.isPaused || this.isFinished || (this._tick(),
                        this.isFinished || (s.delay(this._tickAndRepeat, [], this),
                        this._tickScheduled = !0))
                    }
                    ,
                    l.prototype._tick = function() {
                        if (this.isPaused || this.isFinished)
                            return !1;
                        var u = null
                          , c = Math.min(this.max, this.index + 16384);
                        if (this.index >= this.max)
                            return this.end();
                        switch (this.type) {
                        case "string":
                            u = this.data.substring(this.index, c);
                            break;
                        case "uint8array":
                            u = this.data.subarray(this.index, c);
                            break;
                        case "array":
                        case "nodebuffer":
                            u = this.data.slice(this.index, c)
                        }
                        return this.index = c,
                        this.push({
                            data: u,
                            meta: {
                                percent: this.max ? this.index / this.max * 100 : 0
                            }
                        })
                    }
                    ,
                    n.exports = l
                }
                , {
                    "../utils": 32,
                    "./GenericWorker": 28
                }],
                28: [function(r, n, a) {
                    function s(o) {
                        this.name = o || "default",
                        this.streamInfo = {},
                        this.generatedError = null,
                        this.extraStreamInfo = {},
                        this.isPaused = !0,
                        this.isFinished = !1,
                        this.isLocked = !1,
                        this._listeners = {
                            data: [],
                            end: [],
                            error: []
                        },
                        this.previous = null
                    }
                    s.prototype = {
                        push: function(o) {
                            this.emit("data", o)
                        },
                        end: function() {
                            if (this.isFinished)
                                return !1;
                            this.flush();
                            try {
                                this.emit("end"),
                                this.cleanUp(),
                                this.isFinished = !0
                            } catch (o) {
                                this.emit("error", o)
                            }
                            return !0
                        },
                        error: function(o) {
                            return !this.isFinished && (this.isPaused ? this.generatedError = o : (this.isFinished = !0,
                            this.emit("error", o),
                            this.previous && this.previous.error(o),
                            this.cleanUp()),
                            !0)
                        },
                        on: function(o, l) {
                            return this._listeners[o].push(l),
                            this
                        },
                        cleanUp: function() {
                            this.streamInfo = this.generatedError = this.extraStreamInfo = null,
                            this._listeners = []
                        },
                        emit: function(o, l) {
                            if (this._listeners[o])
                                for (var u = 0; u < this._listeners[o].length; u++)
                                    this._listeners[o][u].call(this, l)
                        },
                        pipe: function(o) {
                            return o.registerPrevious(this)
                        },
                        registerPrevious: function(o) {
                            if (this.isLocked)
                                throw new Error("The stream '" + this + "' has already been used.");
                            this.streamInfo = o.streamInfo,
                            this.mergeStreamInfo(),
                            this.previous = o;
                            var l = this;
                            return o.on("data", function(u) {
                                l.processChunk(u)
                            }),
                            o.on("end", function() {
                                l.end()
                            }),
                            o.on("error", function(u) {
                                l.error(u)
                            }),
                            this
                        },
                        pause: function() {
                            return !this.isPaused && !this.isFinished && (this.isPaused = !0,
                            this.previous && this.previous.pause(),
                            !0)
                        },
                        resume: function() {
                            if (!this.isPaused || this.isFinished)
                                return !1;
                            var o = this.isPaused = !1;
                            return this.generatedError && (this.error(this.generatedError),
                            o = !0),
                            this.previous && this.previous.resume(),
                            !o
                        },
                        flush: function() {},
                        processChunk: function(o) {
                            this.push(o)
                        },
                        withStreamInfo: function(o, l) {
                            return this.extraStreamInfo[o] = l,
                            this.mergeStreamInfo(),
                            this
                        },
                        mergeStreamInfo: function() {
                            for (var o in this.extraStreamInfo)
                                Object.prototype.hasOwnProperty.call(this.extraStreamInfo, o) && (this.streamInfo[o] = this.extraStreamInfo[o])
                        },
                        lock: function() {
                            if (this.isLocked)
                                throw new Error("The stream '" + this + "' has already been used.");
                            this.isLocked = !0,
                            this.previous && this.previous.lock()
                        },
                        toString: function() {
                            var o = "Worker " + this.name;
                            return this.previous ? this.previous + " -> " + o : o
                        }
                    },
                    n.exports = s
                }
                , {}],
                29: [function(r, n, a) {
                    var s = r("../utils")
                      , o = r("./ConvertWorker")
                      , l = r("./GenericWorker")
                      , u = r("../base64")
                      , c = r("../support")
                      , p = r("../external")
                      , d = null;
                    if (c.nodestream)
                        try {
                            d = r("../nodejs/NodejsStreamOutputAdapter")
                        } catch {}
                    function f(m, g) {
                        return new p.Promise(function(x, b) {
                            var y = []
                              , w = m._internalType
                              , R = m._outputType
                              , T = m._mimeType;
                            m.on("data", function(C, P) {
                                y.push(C),
                                g && g(P)
                            }).on("error", function(C) {
                                y = [],
                                b(C)
                            }).on("end", function() {
                                try {
                                    var C = (function(P, W, ue) {
                                        switch (P) {
                                        case "blob":
                                            return s.newBlob(s.transformTo("arraybuffer", W), ue);
                                        case "base64":
                                            return u.encode(W);
                                        default:
                                            return s.transformTo(P, W)
                                        }
                                    }
                                    )(R, (function(P, W) {
                                        var ue, ce = 0, ve = null, I = 0;
                                        for (ue = 0; ue < W.length; ue++)
                                            I += W[ue].length;
                                        switch (P) {
                                        case "string":
                                            return W.join("");
                                        case "array":
                                            return Array.prototype.concat.apply([], W);
                                        case "uint8array":
                                            for (ve = new Uint8Array(I),
                                            ue = 0; ue < W.length; ue++)
                                                ve.set(W[ue], ce),
                                                ce += W[ue].length;
                                            return ve;
                                        case "nodebuffer":
                                            return Buffer.concat(W);
                                        default:
                                            throw new Error("concat : unsupported type '" + P + "'")
                                        }
                                    }
                                    )(w, y), T);
                                    x(C)
                                } catch (P) {
                                    b(P)
                                }
                                y = []
                            }).resume()
                        }
                        )
                    }
                    function h(m, g, x) {
                        var b = g;
                        switch (g) {
                        case "blob":
                        case "arraybuffer":
                            b = "uint8array";
                            break;
                        case "base64":
                            b = "string"
                        }
                        try {
                            this._internalType = b,
                            this._outputType = g,
                            this._mimeType = x,
                            s.checkSupport(b),
                            this._worker = m.pipe(new o(b)),
                            m.lock()
                        } catch (y) {
                            this._worker = new l("error"),
                            this._worker.error(y)
                        }
                    }
                    h.prototype = {
                        accumulate: function(m) {
                            return f(this, m)
                        },
                        on: function(m, g) {
                            var x = this;
                            return m === "data" ? this._worker.on(m, function(b) {
                                g.call(x, b.data, b.meta)
                            }) : this._worker.on(m, function() {
                                s.delay(g, arguments, x)
                            }),
                            this
                        },
                        resume: function() {
                            return s.delay(this._worker.resume, [], this._worker),
                            this
                        },
                        pause: function() {
                            return this._worker.pause(),
                            this
                        },
                        toNodejsStream: function(m) {
                            if (s.checkSupport("nodestream"),
                            this._outputType !== "nodebuffer")
                                throw new Error(this._outputType + " is not supported by this method");
                            return new d(this,{
                                objectMode: this._outputType !== "nodebuffer"
                            },m)
                        }
                    },
                    n.exports = h
                }
                , {
                    "../base64": 1,
                    "../external": 6,
                    "../nodejs/NodejsStreamOutputAdapter": 13,
                    "../support": 30,
                    "../utils": 32,
                    "./ConvertWorker": 24,
                    "./GenericWorker": 28
                }],
                30: [function(r, n, a) {
                    if (a.base64 = !0,
                    a.array = !0,
                    a.string = !0,
                    a.arraybuffer = typeof ArrayBuffer < "u" && typeof Uint8Array < "u",
                    a.nodebuffer = typeof Buffer < "u",
                    a.uint8array = typeof Uint8Array < "u",
                    typeof ArrayBuffer > "u")
                        a.blob = !1;
                    else {
                        var s = new ArrayBuffer(0);
                        try {
                            a.blob = new Blob([s],{
                                type: "application/zip"
                            }).size === 0
                        } catch {
                            try {
                                var o = new (self.BlobBuilder || self.WebKitBlobBuilder || self.MozBlobBuilder || self.MSBlobBuilder);
                                o.append(s),
                                a.blob = o.getBlob("application/zip").size === 0
                            } catch {
                                a.blob = !1
                            }
                        }
                    }
                    try {
                        a.nodestream = !!r("readable-stream").Readable
                    } catch {
                        a.nodestream = !1
                    }
                }
                , {
                    "readable-stream": 16
                }],
                31: [function(r, n, a) {
                    for (var s = r("./utils"), o = r("./support"), l = r("./nodejsUtils"), u = r("./stream/GenericWorker"), c = new Array(256), p = 0; p < 256; p++)
                        c[p] = 252 <= p ? 6 : 248 <= p ? 5 : 240 <= p ? 4 : 224 <= p ? 3 : 192 <= p ? 2 : 1;
                    c[254] = c[254] = 1;
                    function d() {
                        u.call(this, "utf-8 decode"),
                        this.leftOver = null
                    }
                    function f() {
                        u.call(this, "utf-8 encode")
                    }
                    a.utf8encode = function(h) {
                        return o.nodebuffer ? l.newBufferFrom(h, "utf-8") : (function(m) {
                            var g, x, b, y, w, R = m.length, T = 0;
                            for (y = 0; y < R; y++)
                                (64512 & (x = m.charCodeAt(y))) == 55296 && y + 1 < R && (64512 & (b = m.charCodeAt(y + 1))) == 56320 && (x = 65536 + (x - 55296 << 10) + (b - 56320),
                                y++),
                                T += x < 128 ? 1 : x < 2048 ? 2 : x < 65536 ? 3 : 4;
                            for (g = o.uint8array ? new Uint8Array(T) : new Array(T),
                            y = w = 0; w < T; y++)
                                (64512 & (x = m.charCodeAt(y))) == 55296 && y + 1 < R && (64512 & (b = m.charCodeAt(y + 1))) == 56320 && (x = 65536 + (x - 55296 << 10) + (b - 56320),
                                y++),
                                x < 128 ? g[w++] = x : (x < 2048 ? g[w++] = 192 | x >>> 6 : (x < 65536 ? g[w++] = 224 | x >>> 12 : (g[w++] = 240 | x >>> 18,
                                g[w++] = 128 | x >>> 12 & 63),
                                g[w++] = 128 | x >>> 6 & 63),
                                g[w++] = 128 | 63 & x);
                            return g
                        }
                        )(h)
                    }
                    ,
                    a.utf8decode = function(h) {
                        return o.nodebuffer ? s.transformTo("nodebuffer", h).toString("utf-8") : (function(m) {
                            var g, x, b, y, w = m.length, R = new Array(2 * w);
                            for (g = x = 0; g < w; )
                                if ((b = m[g++]) < 128)
                                    R[x++] = b;
                                else if (4 < (y = c[b]))
                                    R[x++] = 65533,
                                    g += y - 1;
                                else {
                                    for (b &= y === 2 ? 31 : y === 3 ? 15 : 7; 1 < y && g < w; )
                                        b = b << 6 | 63 & m[g++],
                                        y--;
                                    1 < y ? R[x++] = 65533 : b < 65536 ? R[x++] = b : (b -= 65536,
                                    R[x++] = 55296 | b >> 10 & 1023,
                                    R[x++] = 56320 | 1023 & b)
                                }
                            return R.length !== x && (R.subarray ? R = R.subarray(0, x) : R.length = x),
                            s.applyFromCharCode(R)
                        }
                        )(h = s.transformTo(o.uint8array ? "uint8array" : "array", h))
                    }
                    ,
                    s.inherits(d, u),
                    d.prototype.processChunk = function(h) {
                        var m = s.transformTo(o.uint8array ? "uint8array" : "array", h.data);
                        if (this.leftOver && this.leftOver.length) {
                            if (o.uint8array) {
                                var g = m;
                                (m = new Uint8Array(g.length + this.leftOver.length)).set(this.leftOver, 0),
                                m.set(g, this.leftOver.length)
                            } else
                                m = this.leftOver.concat(m);
                            this.leftOver = null
                        }
                        var x = (function(y, w) {
                            var R;
                            for ((w = w || y.length) > y.length && (w = y.length),
                            R = w - 1; 0 <= R && (192 & y[R]) == 128; )
                                R--;
                            return R < 0 || R === 0 ? w : R + c[y[R]] > w ? R : w
                        }
                        )(m)
                          , b = m;
                        x !== m.length && (o.uint8array ? (b = m.subarray(0, x),
                        this.leftOver = m.subarray(x, m.length)) : (b = m.slice(0, x),
                        this.leftOver = m.slice(x, m.length))),
                        this.push({
                            data: a.utf8decode(b),
                            meta: h.meta
                        })
                    }
                    ,
                    d.prototype.flush = function() {
                        this.leftOver && this.leftOver.length && (this.push({
                            data: a.utf8decode(this.leftOver),
                            meta: {}
                        }),
                        this.leftOver = null)
                    }
                    ,
                    a.Utf8DecodeWorker = d,
                    s.inherits(f, u),
                    f.prototype.processChunk = function(h) {
                        this.push({
                            data: a.utf8encode(h.data),
                            meta: h.meta
                        })
                    }
                    ,
                    a.Utf8EncodeWorker = f
                }
                , {
                    "./nodejsUtils": 14,
                    "./stream/GenericWorker": 28,
                    "./support": 30,
                    "./utils": 32
                }],
                32: [function(r, n, a) {
                    var s = r("./support")
                      , o = r("./base64")
                      , l = r("./nodejsUtils")
                      , u = r("./external");
                    function c(g) {
                        return g
                    }
                    function p(g, x) {
                        for (var b = 0; b < g.length; ++b)
                            x[b] = 255 & g.charCodeAt(b);
                        return x
                    }
                    r("setimmediate"),
                    a.newBlob = function(g, x) {
                        a.checkSupport("blob");
                        try {
                            return new Blob([g],{
                                type: x
                            })
                        } catch {
                            try {
                                var b = new (self.BlobBuilder || self.WebKitBlobBuilder || self.MozBlobBuilder || self.MSBlobBuilder);
                                return b.append(g),
                                b.getBlob(x)
                            } catch {
                                throw new Error("Bug : can't construct the Blob.")
                            }
                        }
                    }
                    ;
                    var d = {
                        stringifyByChunk: function(g, x, b) {
                            var y = []
                              , w = 0
                              , R = g.length;
                            if (R <= b)
                                return String.fromCharCode.apply(null, g);
                            for (; w < R; )
                                x === "array" || x === "nodebuffer" ? y.push(String.fromCharCode.apply(null, g.slice(w, Math.min(w + b, R)))) : y.push(String.fromCharCode.apply(null, g.subarray(w, Math.min(w + b, R)))),
                                w += b;
                            return y.join("")
                        },
                        stringifyByChar: function(g) {
                            for (var x = "", b = 0; b < g.length; b++)
                                x += String.fromCharCode(g[b]);
                            return x
                        },
                        applyCanBeUsed: {
                            uint8array: (function() {
                                try {
                                    return s.uint8array && String.fromCharCode.apply(null, new Uint8Array(1)).length === 1
                                } catch {
                                    return !1
                                }
                            }
                            )(),
                            nodebuffer: (function() {
                                try {
                                    return s.nodebuffer && String.fromCharCode.apply(null, l.allocBuffer(1)).length === 1
                                } catch {
                                    return !1
                                }
                            }
                            )()
                        }
                    };
                    function f(g) {
                        var x = 65536
                          , b = a.getTypeOf(g)
                          , y = !0;
                        if (b === "uint8array" ? y = d.applyCanBeUsed.uint8array : b === "nodebuffer" && (y = d.applyCanBeUsed.nodebuffer),
                        y)
                            for (; 1 < x; )
                                try {
                                    return d.stringifyByChunk(g, b, x)
                                } catch {
                                    x = Math.floor(x / 2)
                                }
                        return d.stringifyByChar(g)
                    }
                    function h(g, x) {
                        for (var b = 0; b < g.length; b++)
                            x[b] = g[b];
                        return x
                    }
                    a.applyFromCharCode = f;
                    var m = {};
                    m.string = {
                        string: c,
                        array: function(g) {
                            return p(g, new Array(g.length))
                        },
                        arraybuffer: function(g) {
                            return m.string.uint8array(g).buffer
                        },
                        uint8array: function(g) {
                            return p(g, new Uint8Array(g.length))
                        },
                        nodebuffer: function(g) {
                            return p(g, l.allocBuffer(g.length))
                        }
                    },
                    m.array = {
                        string: f,
                        array: c,
                        arraybuffer: function(g) {
                            return new Uint8Array(g).buffer
                        },
                        uint8array: function(g) {
                            return new Uint8Array(g)
                        },
                        nodebuffer: function(g) {
                            return l.newBufferFrom(g)
                        }
                    },
                    m.arraybuffer = {
                        string: function(g) {
                            return f(new Uint8Array(g))
                        },
                        array: function(g) {
                            return h(new Uint8Array(g), new Array(g.byteLength))
                        },
                        arraybuffer: c,
                        uint8array: function(g) {
                            return new Uint8Array(g)
                        },
                        nodebuffer: function(g) {
                            return l.newBufferFrom(new Uint8Array(g))
                        }
                    },
                    m.uint8array = {
                        string: f,
                        array: function(g) {
                            return h(g, new Array(g.length))
                        },
                        arraybuffer: function(g) {
                            return g.buffer
                        },
                        uint8array: c,
                        nodebuffer: function(g) {
                            return l.newBufferFrom(g)
                        }
                    },
                    m.nodebuffer = {
                        string: f,
                        array: function(g) {
                            return h(g, new Array(g.length))
                        },
                        arraybuffer: function(g) {
                            return m.nodebuffer.uint8array(g).buffer
                        },
                        uint8array: function(g) {
                            return h(g, new Uint8Array(g.length))
                        },
                        nodebuffer: c
                    },
                    a.transformTo = function(g, x) {
                        if (x = x || "",
                        !g)
                            return x;
                        a.checkSupport(g);
                        var b = a.getTypeOf(x);
                        return m[b][g](x)
                    }
                    ,
                    a.resolve = function(g) {
                        for (var x = g.split("/"), b = [], y = 0; y < x.length; y++) {
                            var w = x[y];
                            w === "." || w === "" && y !== 0 && y !== x.length - 1 || (w === ".." ? b.pop() : b.push(w))
                        }
                        return b.join("/")
                    }
                    ,
                    a.getTypeOf = function(g) {
                        return typeof g == "string" ? "string" : Object.prototype.toString.call(g) === "[object Array]" ? "array" : s.nodebuffer && l.isBuffer(g) ? "nodebuffer" : s.uint8array && g instanceof Uint8Array ? "uint8array" : s.arraybuffer && g instanceof ArrayBuffer ? "arraybuffer" : void 0
                    }
                    ,
                    a.checkSupport = function(g) {
                        if (!s[g.toLowerCase()])
                            throw new Error(g + " is not supported by this platform")
                    }
                    ,
                    a.MAX_VALUE_16BITS = 65535,
                    a.MAX_VALUE_32BITS = -1,
                    a.pretty = function(g) {
                        var x, b, y = "";
                        for (b = 0; b < (g || "").length; b++)
                            y += "\\x" + ((x = g.charCodeAt(b)) < 16 ? "0" : "") + x.toString(16).toUpperCase();
                        return y
                    }
                    ,
                    a.delay = function(g, x, b) {
                        setImmediate(function() {
                            g.apply(b || null, x || [])
                        })
                    }
                    ,
                    a.inherits = function(g, x) {
                        function b() {}
                        b.prototype = x.prototype,
                        g.prototype = new b
                    }
                    ,
                    a.extend = function() {
                        var g, x, b = {};
                        for (g = 0; g < arguments.length; g++)
                            for (x in arguments[g])
                                Object.prototype.hasOwnProperty.call(arguments[g], x) && b[x] === void 0 && (b[x] = arguments[g][x]);
                        return b
                    }
                    ,
                    a.prepareContent = function(g, x, b, y, w) {
                        return u.Promise.resolve(x).then(function(R) {
                            return s.blob && (R instanceof Blob || ["[object File]", "[object Blob]"].indexOf(Object.prototype.toString.call(R)) !== -1) && typeof FileReader < "u" ? new u.Promise(function(T, C) {
                                var P = new FileReader;
                                P.onload = function(W) {
                                    T(W.target.result)
                                }
                                ,
                                P.onerror = function(W) {
                                    C(W.target.error)
                                }
                                ,
                                P.readAsArrayBuffer(R)
                            }
                            ) : R
                        }).then(function(R) {
                            var T = a.getTypeOf(R);
                            return T ? (T === "arraybuffer" ? R = a.transformTo("uint8array", R) : T === "string" && (w ? R = o.decode(R) : b && y !== !0 && (R = (function(C) {
                                return p(C, s.uint8array ? new Uint8Array(C.length) : new Array(C.length))
                            }
                            )(R))),
                            R) : u.Promise.reject(new Error("Can't read the data of '" + g + "'. Is it in a supported JavaScript type (String, Blob, ArrayBuffer, etc) ?"))
                        })
                    }
                }
                , {
                    "./base64": 1,
                    "./external": 6,
                    "./nodejsUtils": 14,
                    "./support": 30,
                    setimmediate: 54
                }],
                33: [function(r, n, a) {
                    var s = r("./reader/readerFor")
                      , o = r("./utils")
                      , l = r("./signature")
                      , u = r("./zipEntry")
                      , c = r("./support");
                    function p(d) {
                        this.files = [],
                        this.loadOptions = d
                    }
                    p.prototype = {
                        checkSignature: function(d) {
                            if (!this.reader.readAndCheckSignature(d)) {
                                this.reader.index -= 4;
                                var f = this.reader.readString(4);
                                throw new Error("Corrupted zip or bug: unexpected signature (" + o.pretty(f) + ", expected " + o.pretty(d) + ")")
                            }
                        },
                        isSignature: function(d, f) {
                            var h = this.reader.index;
                            this.reader.setIndex(d);
                            var m = this.reader.readString(4) === f;
                            return this.reader.setIndex(h),
                            m
                        },
                        readBlockEndOfCentral: function() {
                            this.diskNumber = this.reader.readInt(2),
                            this.diskWithCentralDirStart = this.reader.readInt(2),
                            this.centralDirRecordsOnThisDisk = this.reader.readInt(2),
                            this.centralDirRecords = this.reader.readInt(2),
                            this.centralDirSize = this.reader.readInt(4),
                            this.centralDirOffset = this.reader.readInt(4),
                            this.zipCommentLength = this.reader.readInt(2);
                            var d = this.reader.readData(this.zipCommentLength)
                              , f = c.uint8array ? "uint8array" : "array"
                              , h = o.transformTo(f, d);
                            this.zipComment = this.loadOptions.decodeFileName(h)
                        },
                        readBlockZip64EndOfCentral: function() {
                            this.zip64EndOfCentralSize = this.reader.readInt(8),
                            this.reader.skip(4),
                            this.diskNumber = this.reader.readInt(4),
                            this.diskWithCentralDirStart = this.reader.readInt(4),
                            this.centralDirRecordsOnThisDisk = this.reader.readInt(8),
                            this.centralDirRecords = this.reader.readInt(8),
                            this.centralDirSize = this.reader.readInt(8),
                            this.centralDirOffset = this.reader.readInt(8),
                            this.zip64ExtensibleData = {};
                            for (var d, f, h, m = this.zip64EndOfCentralSize - 44; 0 < m; )
                                d = this.reader.readInt(2),
                                f = this.reader.readInt(4),
                                h = this.reader.readData(f),
                                this.zip64ExtensibleData[d] = {
                                    id: d,
                                    length: f,
                                    value: h
                                }
                        },
                        readBlockZip64EndOfCentralLocator: function() {
                            if (this.diskWithZip64CentralDirStart = this.reader.readInt(4),
                            this.relativeOffsetEndOfZip64CentralDir = this.reader.readInt(8),
                            this.disksCount = this.reader.readInt(4),
                            1 < this.disksCount)
                                throw new Error("Multi-volumes zip are not supported")
                        },
                        readLocalFiles: function() {
                            var d, f;
                            for (d = 0; d < this.files.length; d++)
                                f = this.files[d],
                                this.reader.setIndex(f.localHeaderOffset),
                                this.checkSignature(l.LOCAL_FILE_HEADER),
                                f.readLocalPart(this.reader),
                                f.handleUTF8(),
                                f.processAttributes()
                        },
                        readCentralDir: function() {
                            var d;
                            for (this.reader.setIndex(this.centralDirOffset); this.reader.readAndCheckSignature(l.CENTRAL_FILE_HEADER); )
                                (d = new u({
                                    zip64: this.zip64
                                },this.loadOptions)).readCentralPart(this.reader),
                                this.files.push(d);
                            if (this.centralDirRecords !== this.files.length && this.centralDirRecords !== 0 && this.files.length === 0)
                                throw new Error("Corrupted zip or bug: expected " + this.centralDirRecords + " records in central dir, got " + this.files.length)
                        },
                        readEndOfCentral: function() {
                            var d = this.reader.lastIndexOfSignature(l.CENTRAL_DIRECTORY_END);
                            if (d < 0)
                                throw this.isSignature(0, l.LOCAL_FILE_HEADER) ? new Error("Corrupted zip: can't find end of central directory") : new Error("Can't find end of central directory : is this a zip file ? If it is, see https://stuk.github.io/jszip/documentation/howto/read_zip.html");
                            this.reader.setIndex(d);
                            var f = d;
                            if (this.checkSignature(l.CENTRAL_DIRECTORY_END),
                            this.readBlockEndOfCentral(),
                            this.diskNumber === o.MAX_VALUE_16BITS || this.diskWithCentralDirStart === o.MAX_VALUE_16BITS || this.centralDirRecordsOnThisDisk === o.MAX_VALUE_16BITS || this.centralDirRecords === o.MAX_VALUE_16BITS || this.centralDirSize === o.MAX_VALUE_32BITS || this.centralDirOffset === o.MAX_VALUE_32BITS) {
                                if (this.zip64 = !0,
                                (d = this.reader.lastIndexOfSignature(l.ZIP64_CENTRAL_DIRECTORY_LOCATOR)) < 0)
                                    throw new Error("Corrupted zip: can't find the ZIP64 end of central directory locator");
                                if (this.reader.setIndex(d),
                                this.checkSignature(l.ZIP64_CENTRAL_DIRECTORY_LOCATOR),
                                this.readBlockZip64EndOfCentralLocator(),
                                !this.isSignature(this.relativeOffsetEndOfZip64CentralDir, l.ZIP64_CENTRAL_DIRECTORY_END) && (this.relativeOffsetEndOfZip64CentralDir = this.reader.lastIndexOfSignature(l.ZIP64_CENTRAL_DIRECTORY_END),
                                this.relativeOffsetEndOfZip64CentralDir < 0))
                                    throw new Error("Corrupted zip: can't find the ZIP64 end of central directory");
                                this.reader.setIndex(this.relativeOffsetEndOfZip64CentralDir),
                                this.checkSignature(l.ZIP64_CENTRAL_DIRECTORY_END),
                                this.readBlockZip64EndOfCentral()
                            }
                            var h = this.centralDirOffset + this.centralDirSize;
                            this.zip64 && (h += 20,
                            h += 12 + this.zip64EndOfCentralSize);
                            var m = f - h;
                            if (0 < m)
                                this.isSignature(f, l.CENTRAL_FILE_HEADER) || (this.reader.zero = m);
                            else if (m < 0)
                                throw new Error("Corrupted zip: missing " + Math.abs(m) + " bytes.")
                        },
                        prepareReader: function(d) {
                            this.reader = s(d)
                        },
                        load: function(d) {
                            this.prepareReader(d),
                            this.readEndOfCentral(),
                            this.readCentralDir(),
                            this.readLocalFiles()
                        }
                    },
                    n.exports = p
                }
                , {
                    "./reader/readerFor": 22,
                    "./signature": 23,
                    "./support": 30,
                    "./utils": 32,
                    "./zipEntry": 34
                }],
                34: [function(r, n, a) {
                    var s = r("./reader/readerFor")
                      , o = r("./utils")
                      , l = r("./compressedObject")
                      , u = r("./crc32")
                      , c = r("./utf8")
                      , p = r("./compressions")
                      , d = r("./support");
                    function f(h, m) {
                        this.options = h,
                        this.loadOptions = m
                    }
                    f.prototype = {
                        isEncrypted: function() {
                            return (1 & this.bitFlag) == 1
                        },
                        useUTF8: function() {
                            return (2048 & this.bitFlag) == 2048
                        },
                        readLocalPart: function(h) {
                            var m, g;
                            if (h.skip(22),
                            this.fileNameLength = h.readInt(2),
                            g = h.readInt(2),
                            this.fileName = h.readData(this.fileNameLength),
                            h.skip(g),
                            this.compressedSize === -1 || this.uncompressedSize === -1)
                                throw new Error("Bug or corrupted zip : didn't get enough information from the central directory (compressedSize === -1 || uncompressedSize === -1)");
                            if ((m = (function(x) {
                                for (var b in p)
                                    if (Object.prototype.hasOwnProperty.call(p, b) && p[b].magic === x)
                                        return p[b];
                                return null
                            }
                            )(this.compressionMethod)) === null)
                                throw new Error("Corrupted zip : compression " + o.pretty(this.compressionMethod) + " unknown (inner file : " + o.transformTo("string", this.fileName) + ")");
                            this.decompressed = new l(this.compressedSize,this.uncompressedSize,this.crc32,m,h.readData(this.compressedSize))
                        },
                        readCentralPart: function(h) {
                            this.versionMadeBy = h.readInt(2),
                            h.skip(2),
                            this.bitFlag = h.readInt(2),
                            this.compressionMethod = h.readString(2),
                            this.date = h.readDate(),
                            this.crc32 = h.readInt(4),
                            this.compressedSize = h.readInt(4),
                            this.uncompressedSize = h.readInt(4);
                            var m = h.readInt(2);
                            if (this.extraFieldsLength = h.readInt(2),
                            this.fileCommentLength = h.readInt(2),
                            this.diskNumberStart = h.readInt(2),
                            this.internalFileAttributes = h.readInt(2),
                            this.externalFileAttributes = h.readInt(4),
                            this.localHeaderOffset = h.readInt(4),
                            this.isEncrypted())
                                throw new Error("Encrypted zip are not supported");
                            h.skip(m),
                            this.readExtraFields(h),
                            this.parseZIP64ExtraField(h),
                            this.fileComment = h.readData(this.fileCommentLength)
                        },
                        processAttributes: function() {
                            this.unixPermissions = null,
                            this.dosPermissions = null;
                            var h = this.versionMadeBy >> 8;
                            this.dir = !!(16 & this.externalFileAttributes),
                            h == 0 && (this.dosPermissions = 63 & this.externalFileAttributes),
                            h == 3 && (this.unixPermissions = this.externalFileAttributes >> 16 & 65535),
                            this.dir || this.fileNameStr.slice(-1) !== "/" || (this.dir = !0)
                        },
                        parseZIP64ExtraField: function() {
                            if (this.extraFields[1]) {
                                var h = s(this.extraFields[1].value);
                                this.uncompressedSize === o.MAX_VALUE_32BITS && (this.uncompressedSize = h.readInt(8)),
                                this.compressedSize === o.MAX_VALUE_32BITS && (this.compressedSize = h.readInt(8)),
                                this.localHeaderOffset === o.MAX_VALUE_32BITS && (this.localHeaderOffset = h.readInt(8)),
                                this.diskNumberStart === o.MAX_VALUE_32BITS && (this.diskNumberStart = h.readInt(4))
                            }
                        },
                        readExtraFields: function(h) {
                            var m, g, x, b = h.index + this.extraFieldsLength;
                            for (this.extraFields || (this.extraFields = {}); h.index + 4 < b; )
                                m = h.readInt(2),
                                g = h.readInt(2),
                                x = h.readData(g),
                                this.extraFields[m] = {
                                    id: m,
                                    length: g,
                                    value: x
                                };
                            h.setIndex(b)
                        },
                        handleUTF8: function() {
                            var h = d.uint8array ? "uint8array" : "array";
                            if (this.useUTF8())
                                this.fileNameStr = c.utf8decode(this.fileName),
                                this.fileCommentStr = c.utf8decode(this.fileComment);
                            else {
                                var m = this.findExtraFieldUnicodePath();
                                if (m !== null)
                                    this.fileNameStr = m;
                                else {
                                    var g = o.transformTo(h, this.fileName);
                                    this.fileNameStr = this.loadOptions.decodeFileName(g)
                                }
                                var x = this.findExtraFieldUnicodeComment();
                                if (x !== null)
                                    this.fileCommentStr = x;
                                else {
                                    var b = o.transformTo(h, this.fileComment);
                                    this.fileCommentStr = this.loadOptions.decodeFileName(b)
                                }
                            }
                        },
                        findExtraFieldUnicodePath: function() {
                            var h = this.extraFields[28789];
                            if (h) {
                                var m = s(h.value);
                                return m.readInt(1) !== 1 || u(this.fileName) !== m.readInt(4) ? null : c.utf8decode(m.readData(h.length - 5))
                            }
                            return null
                        },
                        findExtraFieldUnicodeComment: function() {
                            var h = this.extraFields[25461];
                            if (h) {
                                var m = s(h.value);
                                return m.readInt(1) !== 1 || u(this.fileComment) !== m.readInt(4) ? null : c.utf8decode(m.readData(h.length - 5))
                            }
                            return null
                        }
                    },
                    n.exports = f
                }
                , {
                    "./compressedObject": 2,
                    "./compressions": 3,
                    "./crc32": 4,
                    "./reader/readerFor": 22,
                    "./support": 30,
                    "./utf8": 31,
                    "./utils": 32
                }],
                35: [function(r, n, a) {
                    function s(m, g, x) {
                        this.name = m,
                        this.dir = x.dir,
                        this.date = x.date,
                        this.comment = x.comment,
                        this.unixPermissions = x.unixPermissions,
                        this.dosPermissions = x.dosPermissions,
                        this._data = g,
                        this._dataBinary = x.binary,
                        this.options = {
                            compression: x.compression,
                            compressionOptions: x.compressionOptions
                        }
                    }
                    var o = r("./stream/StreamHelper")
                      , l = r("./stream/DataWorker")
                      , u = r("./utf8")
                      , c = r("./compressedObject")
                      , p = r("./stream/GenericWorker");
                    s.prototype = {
                        internalStream: function(m) {
                            var g = null
                              , x = "string";
                            try {
                                if (!m)
                                    throw new Error("No output type specified.");
                                var b = (x = m.toLowerCase()) === "string" || x === "text";
                                x !== "binarystring" && x !== "text" || (x = "string"),
                                g = this._decompressWorker();
                                var y = !this._dataBinary;
                                y && !b && (g = g.pipe(new u.Utf8EncodeWorker)),
                                !y && b && (g = g.pipe(new u.Utf8DecodeWorker))
                            } catch (w) {
                                (g = new p("error")).error(w)
                            }
                            return new o(g,x,"")
                        },
                        async: function(m, g) {
                            return this.internalStream(m).accumulate(g)
                        },
                        nodeStream: function(m, g) {
                            return this.internalStream(m || "nodebuffer").toNodejsStream(g)
                        },
                        _compressWorker: function(m, g) {
                            if (this._data instanceof c && this._data.compression.magic === m.magic)
                                return this._data.getCompressedWorker();
                            var x = this._decompressWorker();
                            return this._dataBinary || (x = x.pipe(new u.Utf8EncodeWorker)),
                            c.createWorkerFrom(x, m, g)
                        },
                        _decompressWorker: function() {
                            return this._data instanceof c ? this._data.getContentWorker() : this._data instanceof p ? this._data : new l(this._data)
                        }
                    };
                    for (var d = ["asText", "asBinary", "asNodeBuffer", "asUint8Array", "asArrayBuffer"], f = function() {
                        throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.")
                    }, h = 0; h < d.length; h++)
                        s.prototype[d[h]] = f;
                    n.exports = s
                }
                , {
                    "./compressedObject": 2,
                    "./stream/DataWorker": 27,
                    "./stream/GenericWorker": 28,
                    "./stream/StreamHelper": 29,
                    "./utf8": 31
                }],
                36: [function(r, n, a) {
                    (function(s) {
                        var o, l, u = s.MutationObserver || s.WebKitMutationObserver;
                        if (u) {
                            var c = 0
                              , p = new u(m)
                              , d = s.document.createTextNode("");
                            p.observe(d, {
                                characterData: !0
                            }),
                            o = function() {
                                d.data = c = ++c % 2
                            }
                        } else if (s.setImmediate || s.MessageChannel === void 0)
                            o = "document"in s && "onreadystatechange"in s.document.createElement("script") ? function() {
                                var g = s.document.createElement("script");
                                g.onreadystatechange = function() {
                                    m(),
                                    g.onreadystatechange = null,
                                    g.parentNode.removeChild(g),
                                    g = null
                                }
                                ,
                                s.document.documentElement.appendChild(g)
                            }
                            : function() {
                                setTimeout(m, 0)
                            }
                            ;
                        else {
                            var f = new s.MessageChannel;
                            f.port1.onmessage = m,
                            o = function() {
                                f.port2.postMessage(0)
                            }
                        }
                        var h = [];
                        function m() {
                            var g, x;
                            l = !0;
                            for (var b = h.length; b; ) {
                                for (x = h,
                                h = [],
                                g = -1; ++g < b; )
                                    x[g]();
                                b = h.length
                            }
                            l = !1
                        }
                        n.exports = function(g) {
                            h.push(g) !== 1 || l || o()
                        }
                    }
                    ).call(this, typeof commonjsGlobal < "u" ? commonjsGlobal : typeof self < "u" ? self : typeof window < "u" ? window : {})
                }
                , {}],
                37: [function(r, n, a) {
                    var s = r("immediate");
                    function o() {}
                    var l = {}
                      , u = ["REJECTED"]
                      , c = ["FULFILLED"]
                      , p = ["PENDING"];
                    function d(b) {
                        if (typeof b != "function")
                            throw new TypeError("resolver must be a function");
                        this.state = p,
                        this.queue = [],
                        this.outcome = void 0,
                        b !== o && g(this, b)
                    }
                    function f(b, y, w) {
                        this.promise = b,
                        typeof y == "function" && (this.onFulfilled = y,
                        this.callFulfilled = this.otherCallFulfilled),
                        typeof w == "function" && (this.onRejected = w,
                        this.callRejected = this.otherCallRejected)
                    }
                    function h(b, y, w) {
                        s(function() {
                            var R;
                            try {
                                R = y(w)
                            } catch (T) {
                                return l.reject(b, T)
                            }
                            R === b ? l.reject(b, new TypeError("Cannot resolve promise with itself")) : l.resolve(b, R)
                        })
                    }
                    function m(b) {
                        var y = b && b.then;
                        if (b && (typeof b == "object" || typeof b == "function") && typeof y == "function")
                            return function() {
                                y.apply(b, arguments)
                            }
                    }
                    function g(b, y) {
                        var w = !1;
                        function R(P) {
                            w || (w = !0,
                            l.reject(b, P))
                        }
                        function T(P) {
                            w || (w = !0,
                            l.resolve(b, P))
                        }
                        var C = x(function() {
                            y(T, R)
                        });
                        C.status === "error" && R(C.value)
                    }
                    function x(b, y) {
                        var w = {};
                        try {
                            w.value = b(y),
                            w.status = "success"
                        } catch (R) {
                            w.status = "error",
                            w.value = R
                        }
                        return w
                    }
                    (n.exports = d).prototype.finally = function(b) {
                        if (typeof b != "function")
                            return this;
                        var y = this.constructor;
                        return this.then(function(w) {
                            return y.resolve(b()).then(function() {
                                return w
                            })
                        }, function(w) {
                            return y.resolve(b()).then(function() {
                                throw w
                            })
                        })
                    }
                    ,
                    d.prototype.catch = function(b) {
                        return this.then(null, b)
                    }
                    ,
                    d.prototype.then = function(b, y) {
                        if (typeof b != "function" && this.state === c || typeof y != "function" && this.state === u)
                            return this;
                        var w = new this.constructor(o);
                        return this.state !== p ? h(w, this.state === c ? b : y, this.outcome) : this.queue.push(new f(w,b,y)),
                        w
                    }
                    ,
                    f.prototype.callFulfilled = function(b) {
                        l.resolve(this.promise, b)
                    }
                    ,
                    f.prototype.otherCallFulfilled = function(b) {
                        h(this.promise, this.onFulfilled, b)
                    }
                    ,
                    f.prototype.callRejected = function(b) {
                        l.reject(this.promise, b)
                    }
                    ,
                    f.prototype.otherCallRejected = function(b) {
                        h(this.promise, this.onRejected, b)
                    }
                    ,
                    l.resolve = function(b, y) {
                        var w = x(m, y);
                        if (w.status === "error")
                            return l.reject(b, w.value);
                        var R = w.value;
                        if (R)
                            g(b, R);
                        else {
                            b.state = c,
                            b.outcome = y;
                            for (var T = -1, C = b.queue.length; ++T < C; )
                                b.queue[T].callFulfilled(y)
                        }
                        return b
                    }
                    ,
                    l.reject = function(b, y) {
                        b.state = u,
                        b.outcome = y;
                        for (var w = -1, R = b.queue.length; ++w < R; )
                            b.queue[w].callRejected(y);
                        return b
                    }
                    ,
                    d.resolve = function(b) {
                        return b instanceof this ? b : l.resolve(new this(o), b)
                    }
                    ,
                    d.reject = function(b) {
                        var y = new this(o);
                        return l.reject(y, b)
                    }
                    ,
                    d.all = function(b) {
                        var y = this;
                        if (Object.prototype.toString.call(b) !== "[object Array]")
                            return this.reject(new TypeError("must be an array"));
                        var w = b.length
                          , R = !1;
                        if (!w)
                            return this.resolve([]);
                        for (var T = new Array(w), C = 0, P = -1, W = new this(o); ++P < w; )
                            ue(b[P], P);
                        return W;
                        function ue(ce, ve) {
                            y.resolve(ce).then(function(I) {
                                T[ve] = I,
                                ++C !== w || R || (R = !0,
                                l.resolve(W, T))
                            }, function(I) {
                                R || (R = !0,
                                l.reject(W, I))
                            })
                        }
                    }
                    ,
                    d.race = function(b) {
                        var y = this;
                        if (Object.prototype.toString.call(b) !== "[object Array]")
                            return this.reject(new TypeError("must be an array"));
                        var w = b.length
                          , R = !1;
                        if (!w)
                            return this.resolve([]);
                        for (var T = -1, C = new this(o); ++T < w; )
                            P = b[T],
                            y.resolve(P).then(function(W) {
                                R || (R = !0,
                                l.resolve(C, W))
                            }, function(W) {
                                R || (R = !0,
                                l.reject(C, W))
                            });
                        var P;
                        return C
                    }
                }
                , {
                    immediate: 36
                }],
                38: [function(r, n, a) {
                    var s = {};
                    (0,
                    r("./lib/utils/common").assign)(s, r("./lib/deflate"), r("./lib/inflate"), r("./lib/zlib/constants")),
                    n.exports = s
                }
                , {
                    "./lib/deflate": 39,
                    "./lib/inflate": 40,
                    "./lib/utils/common": 41,
                    "./lib/zlib/constants": 44
                }],
                39: [function(r, n, a) {
                    var s = r("./zlib/deflate")
                      , o = r("./utils/common")
                      , l = r("./utils/strings")
                      , u = r("./zlib/messages")
                      , c = r("./zlib/zstream")
                      , p = Object.prototype.toString
                      , d = 0
                      , f = -1
                      , h = 0
                      , m = 8;
                    function g(b) {
                        if (!(this instanceof g))
                            return new g(b);
                        this.options = o.assign({
                            level: f,
                            method: m,
                            chunkSize: 16384,
                            windowBits: 15,
                            memLevel: 8,
                            strategy: h,
                            to: ""
                        }, b || {});
                        var y = this.options;
                        y.raw && 0 < y.windowBits ? y.windowBits = -y.windowBits : y.gzip && 0 < y.windowBits && y.windowBits < 16 && (y.windowBits += 16),
                        this.err = 0,
                        this.msg = "",
                        this.ended = !1,
                        this.chunks = [],
                        this.strm = new c,
                        this.strm.avail_out = 0;
                        var w = s.deflateInit2(this.strm, y.level, y.method, y.windowBits, y.memLevel, y.strategy);
                        if (w !== d)
                            throw new Error(u[w]);
                        if (y.header && s.deflateSetHeader(this.strm, y.header),
                        y.dictionary) {
                            var R;
                            if (R = typeof y.dictionary == "string" ? l.string2buf(y.dictionary) : p.call(y.dictionary) === "[object ArrayBuffer]" ? new Uint8Array(y.dictionary) : y.dictionary,
                            (w = s.deflateSetDictionary(this.strm, R)) !== d)
                                throw new Error(u[w]);
                            this._dict_set = !0
                        }
                    }
                    function x(b, y) {
                        var w = new g(y);
                        if (w.push(b, !0),
                        w.err)
                            throw w.msg || u[w.err];
                        return w.result
                    }
                    g.prototype.push = function(b, y) {
                        var w, R, T = this.strm, C = this.options.chunkSize;
                        if (this.ended)
                            return !1;
                        R = y === ~~y ? y : y === !0 ? 4 : 0,
                        typeof b == "string" ? T.input = l.string2buf(b) : p.call(b) === "[object ArrayBuffer]" ? T.input = new Uint8Array(b) : T.input = b,
                        T.next_in = 0,
                        T.avail_in = T.input.length;
                        do {
                            if (T.avail_out === 0 && (T.output = new o.Buf8(C),
                            T.next_out = 0,
                            T.avail_out = C),
                            (w = s.deflate(T, R)) !== 1 && w !== d)
                                return this.onEnd(w),
                                !(this.ended = !0);
                            T.avail_out !== 0 && (T.avail_in !== 0 || R !== 4 && R !== 2) || (this.options.to === "string" ? this.onData(l.buf2binstring(o.shrinkBuf(T.output, T.next_out))) : this.onData(o.shrinkBuf(T.output, T.next_out)))
                        } while ((0 < T.avail_in || T.avail_out === 0) && w !== 1);
                        return R === 4 ? (w = s.deflateEnd(this.strm),
                        this.onEnd(w),
                        this.ended = !0,
                        w === d) : R !== 2 || (this.onEnd(d),
                        !(T.avail_out = 0))
                    }
                    ,
                    g.prototype.onData = function(b) {
                        this.chunks.push(b)
                    }
                    ,
                    g.prototype.onEnd = function(b) {
                        b === d && (this.options.to === "string" ? this.result = this.chunks.join("") : this.result = o.flattenChunks(this.chunks)),
                        this.chunks = [],
                        this.err = b,
                        this.msg = this.strm.msg
                    }
                    ,
                    a.Deflate = g,
                    a.deflate = x,
                    a.deflateRaw = function(b, y) {
                        return (y = y || {}).raw = !0,
                        x(b, y)
                    }
                    ,
                    a.gzip = function(b, y) {
                        return (y = y || {}).gzip = !0,
                        x(b, y)
                    }
                }
                , {
                    "./utils/common": 41,
                    "./utils/strings": 42,
                    "./zlib/deflate": 46,
                    "./zlib/messages": 51,
                    "./zlib/zstream": 53
                }],
                40: [function(r, n, a) {
                    var s = r("./zlib/inflate")
                      , o = r("./utils/common")
                      , l = r("./utils/strings")
                      , u = r("./zlib/constants")
                      , c = r("./zlib/messages")
                      , p = r("./zlib/zstream")
                      , d = r("./zlib/gzheader")
                      , f = Object.prototype.toString;
                    function h(g) {
                        if (!(this instanceof h))
                            return new h(g);
                        this.options = o.assign({
                            chunkSize: 16384,
                            windowBits: 0,
                            to: ""
                        }, g || {});
                        var x = this.options;
                        x.raw && 0 <= x.windowBits && x.windowBits < 16 && (x.windowBits = -x.windowBits,
                        x.windowBits === 0 && (x.windowBits = -15)),
                        !(0 <= x.windowBits && x.windowBits < 16) || g && g.windowBits || (x.windowBits += 32),
                        15 < x.windowBits && x.windowBits < 48 && (15 & x.windowBits) == 0 && (x.windowBits |= 15),
                        this.err = 0,
                        this.msg = "",
                        this.ended = !1,
                        this.chunks = [],
                        this.strm = new p,
                        this.strm.avail_out = 0;
                        var b = s.inflateInit2(this.strm, x.windowBits);
                        if (b !== u.Z_OK)
                            throw new Error(c[b]);
                        this.header = new d,
                        s.inflateGetHeader(this.strm, this.header)
                    }
                    function m(g, x) {
                        var b = new h(x);
                        if (b.push(g, !0),
                        b.err)
                            throw b.msg || c[b.err];
                        return b.result
                    }
                    h.prototype.push = function(g, x) {
                        var b, y, w, R, T, C, P = this.strm, W = this.options.chunkSize, ue = this.options.dictionary, ce = !1;
                        if (this.ended)
                            return !1;
                        y = x === ~~x ? x : x === !0 ? u.Z_FINISH : u.Z_NO_FLUSH,
                        typeof g == "string" ? P.input = l.binstring2buf(g) : f.call(g) === "[object ArrayBuffer]" ? P.input = new Uint8Array(g) : P.input = g,
                        P.next_in = 0,
                        P.avail_in = P.input.length;
                        do {
                            if (P.avail_out === 0 && (P.output = new o.Buf8(W),
                            P.next_out = 0,
                            P.avail_out = W),
                            (b = s.inflate(P, u.Z_NO_FLUSH)) === u.Z_NEED_DICT && ue && (C = typeof ue == "string" ? l.string2buf(ue) : f.call(ue) === "[object ArrayBuffer]" ? new Uint8Array(ue) : ue,
                            b = s.inflateSetDictionary(this.strm, C)),
                            b === u.Z_BUF_ERROR && ce === !0 && (b = u.Z_OK,
                            ce = !1),
                            b !== u.Z_STREAM_END && b !== u.Z_OK)
                                return this.onEnd(b),
                                !(this.ended = !0);
                            P.next_out && (P.avail_out !== 0 && b !== u.Z_STREAM_END && (P.avail_in !== 0 || y !== u.Z_FINISH && y !== u.Z_SYNC_FLUSH) || (this.options.to === "string" ? (w = l.utf8border(P.output, P.next_out),
                            R = P.next_out - w,
                            T = l.buf2string(P.output, w),
                            P.next_out = R,
                            P.avail_out = W - R,
                            R && o.arraySet(P.output, P.output, w, R, 0),
                            this.onData(T)) : this.onData(o.shrinkBuf(P.output, P.next_out)))),
                            P.avail_in === 0 && P.avail_out === 0 && (ce = !0)
                        } while ((0 < P.avail_in || P.avail_out === 0) && b !== u.Z_STREAM_END);
                        return b === u.Z_STREAM_END && (y = u.Z_FINISH),
                        y === u.Z_FINISH ? (b = s.inflateEnd(this.strm),
                        this.onEnd(b),
                        this.ended = !0,
                        b === u.Z_OK) : y !== u.Z_SYNC_FLUSH || (this.onEnd(u.Z_OK),
                        !(P.avail_out = 0))
                    }
                    ,
                    h.prototype.onData = function(g) {
                        this.chunks.push(g)
                    }
                    ,
                    h.prototype.onEnd = function(g) {
                        g === u.Z_OK && (this.options.to === "string" ? this.result = this.chunks.join("") : this.result = o.flattenChunks(this.chunks)),
                        this.chunks = [],
                        this.err = g,
                        this.msg = this.strm.msg
                    }
                    ,
                    a.Inflate = h,
                    a.inflate = m,
                    a.inflateRaw = function(g, x) {
                        return (x = x || {}).raw = !0,
                        m(g, x)
                    }
                    ,
                    a.ungzip = m
                }
                , {
                    "./utils/common": 41,
                    "./utils/strings": 42,
                    "./zlib/constants": 44,
                    "./zlib/gzheader": 47,
                    "./zlib/inflate": 49,
                    "./zlib/messages": 51,
                    "./zlib/zstream": 53
                }],
                41: [function(r, n, a) {
                    var s = typeof Uint8Array < "u" && typeof Uint16Array < "u" && typeof Int32Array < "u";
                    a.assign = function(u) {
                        for (var c = Array.prototype.slice.call(arguments, 1); c.length; ) {
                            var p = c.shift();
                            if (p) {
                                if (typeof p != "object")
                                    throw new TypeError(p + "must be non-object");
                                for (var d in p)
                                    p.hasOwnProperty(d) && (u[d] = p[d])
                            }
                        }
                        return u
                    }
                    ,
                    a.shrinkBuf = function(u, c) {
                        return u.length === c ? u : u.subarray ? u.subarray(0, c) : (u.length = c,
                        u)
                    }
                    ;
                    var o = {
                        arraySet: function(u, c, p, d, f) {
                            if (c.subarray && u.subarray)
                                u.set(c.subarray(p, p + d), f);
                            else
                                for (var h = 0; h < d; h++)
                                    u[f + h] = c[p + h]
                        },
                        flattenChunks: function(u) {
                            var c, p, d, f, h, m;
                            for (c = d = 0,
                            p = u.length; c < p; c++)
                                d += u[c].length;
                            for (m = new Uint8Array(d),
                            c = f = 0,
                            p = u.length; c < p; c++)
                                h = u[c],
                                m.set(h, f),
                                f += h.length;
                            return m
                        }
                    }
                      , l = {
                        arraySet: function(u, c, p, d, f) {
                            for (var h = 0; h < d; h++)
                                u[f + h] = c[p + h]
                        },
                        flattenChunks: function(u) {
                            return [].concat.apply([], u)
                        }
                    };
                    a.setTyped = function(u) {
                        u ? (a.Buf8 = Uint8Array,
                        a.Buf16 = Uint16Array,
                        a.Buf32 = Int32Array,
                        a.assign(a, o)) : (a.Buf8 = Array,
                        a.Buf16 = Array,
                        a.Buf32 = Array,
                        a.assign(a, l))
                    }
                    ,
                    a.setTyped(s)
                }
                , {}],
                42: [function(r, n, a) {
                    var s = r("./common")
                      , o = !0
                      , l = !0;
                    try {
                        String.fromCharCode.apply(null, [0])
                    } catch {
                        o = !1
                    }
                    try {
                        String.fromCharCode.apply(null, new Uint8Array(1))
                    } catch {
                        l = !1
                    }
                    for (var u = new s.Buf8(256), c = 0; c < 256; c++)
                        u[c] = 252 <= c ? 6 : 248 <= c ? 5 : 240 <= c ? 4 : 224 <= c ? 3 : 192 <= c ? 2 : 1;
                    function p(d, f) {
                        if (f < 65537 && (d.subarray && l || !d.subarray && o))
                            return String.fromCharCode.apply(null, s.shrinkBuf(d, f));
                        for (var h = "", m = 0; m < f; m++)
                            h += String.fromCharCode(d[m]);
                        return h
                    }
                    u[254] = u[254] = 1,
                    a.string2buf = function(d) {
                        var f, h, m, g, x, b = d.length, y = 0;
                        for (g = 0; g < b; g++)
                            (64512 & (h = d.charCodeAt(g))) == 55296 && g + 1 < b && (64512 & (m = d.charCodeAt(g + 1))) == 56320 && (h = 65536 + (h - 55296 << 10) + (m - 56320),
                            g++),
                            y += h < 128 ? 1 : h < 2048 ? 2 : h < 65536 ? 3 : 4;
                        for (f = new s.Buf8(y),
                        g = x = 0; x < y; g++)
                            (64512 & (h = d.charCodeAt(g))) == 55296 && g + 1 < b && (64512 & (m = d.charCodeAt(g + 1))) == 56320 && (h = 65536 + (h - 55296 << 10) + (m - 56320),
                            g++),
                            h < 128 ? f[x++] = h : (h < 2048 ? f[x++] = 192 | h >>> 6 : (h < 65536 ? f[x++] = 224 | h >>> 12 : (f[x++] = 240 | h >>> 18,
                            f[x++] = 128 | h >>> 12 & 63),
                            f[x++] = 128 | h >>> 6 & 63),
                            f[x++] = 128 | 63 & h);
                        return f
                    }
                    ,
                    a.buf2binstring = function(d) {
                        return p(d, d.length)
                    }
                    ,
                    a.binstring2buf = function(d) {
                        for (var f = new s.Buf8(d.length), h = 0, m = f.length; h < m; h++)
                            f[h] = d.charCodeAt(h);
                        return f
                    }
                    ,
                    a.buf2string = function(d, f) {
                        var h, m, g, x, b = f || d.length, y = new Array(2 * b);
                        for (h = m = 0; h < b; )
                            if ((g = d[h++]) < 128)
                                y[m++] = g;
                            else if (4 < (x = u[g]))
                                y[m++] = 65533,
                                h += x - 1;
                            else {
                                for (g &= x === 2 ? 31 : x === 3 ? 15 : 7; 1 < x && h < b; )
                                    g = g << 6 | 63 & d[h++],
                                    x--;
                                1 < x ? y[m++] = 65533 : g < 65536 ? y[m++] = g : (g -= 65536,
                                y[m++] = 55296 | g >> 10 & 1023,
                                y[m++] = 56320 | 1023 & g)
                            }
                        return p(y, m)
                    }
                    ,
                    a.utf8border = function(d, f) {
                        var h;
                        for ((f = f || d.length) > d.length && (f = d.length),
                        h = f - 1; 0 <= h && (192 & d[h]) == 128; )
                            h--;
                        return h < 0 || h === 0 ? f : h + u[d[h]] > f ? h : f
                    }
                }
                , {
                    "./common": 41
                }],
                43: [function(r, n, a) {
                    n.exports = function(s, o, l, u) {
                        for (var c = 65535 & s | 0, p = s >>> 16 & 65535 | 0, d = 0; l !== 0; ) {
                            for (l -= d = 2e3 < l ? 2e3 : l; p = p + (c = c + o[u++] | 0) | 0,
                            --d; )
                                ;
                            c %= 65521,
                            p %= 65521
                        }
                        return c | p << 16 | 0
                    }
                }
                , {}],
                44: [function(r, n, a) {
                    n.exports = {
                        Z_NO_FLUSH: 0,
                        Z_PARTIAL_FLUSH: 1,
                        Z_SYNC_FLUSH: 2,
                        Z_FULL_FLUSH: 3,
                        Z_FINISH: 4,
                        Z_BLOCK: 5,
                        Z_TREES: 6,
                        Z_OK: 0,
                        Z_STREAM_END: 1,
                        Z_NEED_DICT: 2,
                        Z_ERRNO: -1,
                        Z_STREAM_ERROR: -2,
                        Z_DATA_ERROR: -3,
                        Z_BUF_ERROR: -5,
                        Z_NO_COMPRESSION: 0,
                        Z_BEST_SPEED: 1,
                        Z_BEST_COMPRESSION: 9,
                        Z_DEFAULT_COMPRESSION: -1,
                        Z_FILTERED: 1,
                        Z_HUFFMAN_ONLY: 2,
                        Z_RLE: 3,
                        Z_FIXED: 4,
                        Z_DEFAULT_STRATEGY: 0,
                        Z_BINARY: 0,
                        Z_TEXT: 1,
                        Z_UNKNOWN: 2,
                        Z_DEFLATED: 8
                    }
                }
                , {}],
                45: [function(r, n, a) {
                    var s = (function() {
                        for (var o, l = [], u = 0; u < 256; u++) {
                            o = u;
                            for (var c = 0; c < 8; c++)
                                o = 1 & o ? 3988292384 ^ o >>> 1 : o >>> 1;
                            l[u] = o
                        }
                        return l
                    }
                    )();
                    n.exports = function(o, l, u, c) {
                        var p = s
                          , d = c + u;
                        o ^= -1;
                        for (var f = c; f < d; f++)
                            o = o >>> 8 ^ p[255 & (o ^ l[f])];
                        return -1 ^ o
                    }
                }
                , {}],
                46: [function(r, n, a) {
                    var s, o = r("../utils/common"), l = r("./trees"), u = r("./adler32"), c = r("./crc32"), p = r("./messages"), d = 0, f = 4, h = 0, m = -2, g = -1, x = 4, b = 2, y = 8, w = 9, R = 286, T = 30, C = 19, P = 2 * R + 1, W = 15, ue = 3, ce = 258, ve = ce + ue + 1, I = 42, M = 113, $ = 1, pt = 2, ba = 3, us = 4;
                    function Wd(Oe, R0) {
                        return Oe.msg = p[R0],
                        R0
                    }
                    function Mr(Oe) {
                        return (Oe << 1) - (4 < Oe ? 9 : 0)
                    }
                    function Kt(Oe) {
                        for (var R0 = Oe.length; 0 <= --R0; )
                            Oe[R0] = 0
                    }
                    function lt(Oe) {
                        var R0 = Oe.state
                          , gm = R0.pending;
                        gm > Oe.avail_out && (gm = Oe.avail_out),
                        gm !== 0 && (o.arraySet(Oe.output, R0.pending_buf, R0.pending_out, gm, Oe.next_out),
                        Oe.next_out += gm,
                        R0.pending_out += gm,
                        Oe.total_out += gm,
                        Oe.avail_out -= gm,
                        R0.pending -= gm,
                        R0.pending === 0 && (R0.pending_out = 0))
                    }
                    function Ht(Oe, R0) {
                        l._tr_flush_block(Oe, 0 <= Oe.block_start ? Oe.block_start : -1, Oe.strstart - Oe.block_start, R0),
                        Oe.block_start = Oe.strstart,
                        lt(Oe.strm)
                    }
                    function $e(Oe, R0) {
                        Oe.pending_buf[Oe.pending++] = R0
                    }
                    function G(Oe, R0) {
                        Oe.pending_buf[Oe.pending++] = R0 >>> 8 & 255,
                        Oe.pending_buf[Oe.pending++] = 255 & R0
                    }
                    function he(Oe, R0) {
                        var gm, $s, go = Oe.max_chain_length, Yl = Oe.strstart, lv = Oe.prev_length, Ox = Oe.nice_match, ev = Oe.strstart > Oe.w_size - ve ? Oe.strstart - (Oe.w_size - ve) : 0, iv = Oe.window, N = Oe.w_mask, bi = Oe.prev, Rx = Oe.strstart + ce, sv = iv[Yl + lv - 1], h0 = iv[Yl + lv];
                        Oe.prev_length >= Oe.good_match && (go >>= 2),
                        Ox > Oe.lookahead && (Ox = Oe.lookahead);
                        do
                            if (iv[(gm = R0) + lv] === h0 && iv[gm + lv - 1] === sv && iv[gm] === iv[Yl] && iv[++gm] === iv[Yl + 1]) {
                                Yl += 2,
                                gm++;
                                do
                                    ;
                                while (iv[++Yl] === iv[++gm] && iv[++Yl] === iv[++gm] && iv[++Yl] === iv[++gm] && iv[++Yl] === iv[++gm] && iv[++Yl] === iv[++gm] && iv[++Yl] === iv[++gm] && iv[++Yl] === iv[++gm] && iv[++Yl] === iv[++gm] && Yl < Rx);
                                if ($s = ce - (Rx - Yl),
                                Yl = Rx - ce,
                                lv < $s) {
                                    if (Oe.match_start = R0,
                                    Ox <= (lv = $s))
                                        break;
                                    sv = iv[Yl + lv - 1],
                                    h0 = iv[Yl + lv]
                                }
                            }
                        while ((R0 = bi[R0 & N]) > ev && --go != 0);
                        return lv <= Oe.lookahead ? lv : Oe.lookahead
                    }
                    function Xe(Oe) {
                        var R0, gm, $s, go, Yl, lv, Ox, ev, iv, N, bi = Oe.w_size;
                        do {
                            if (go = Oe.window_size - Oe.lookahead - Oe.strstart,
                            Oe.strstart >= bi + (bi - ve)) {
                                for (o.arraySet(Oe.window, Oe.window, bi, bi, 0),
                                Oe.match_start -= bi,
                                Oe.strstart -= bi,
                                Oe.block_start -= bi,
                                R0 = gm = Oe.hash_size; $s = Oe.head[--R0],
                                Oe.head[R0] = bi <= $s ? $s - bi : 0,
                                --gm; )
                                    ;
                                for (R0 = gm = bi; $s = Oe.prev[--R0],
                                Oe.prev[R0] = bi <= $s ? $s - bi : 0,
                                --gm; )
                                    ;
                                go += bi
                            }
                            if (Oe.strm.avail_in === 0)
                                break;
                            if (lv = Oe.strm,
                            Ox = Oe.window,
                            ev = Oe.strstart + Oe.lookahead,
                            iv = go,
                            N = void 0,
                            N = lv.avail_in,
                            iv < N && (N = iv),
                            gm = N === 0 ? 0 : (lv.avail_in -= N,
                            o.arraySet(Ox, lv.input, lv.next_in, N, ev),
                            lv.state.wrap === 1 ? lv.adler = u(lv.adler, Ox, N, ev) : lv.state.wrap === 2 && (lv.adler = c(lv.adler, Ox, N, ev)),
                            lv.next_in += N,
                            lv.total_in += N,
                            N),
                            Oe.lookahead += gm,
                            Oe.lookahead + Oe.insert >= ue)
                                for (Yl = Oe.strstart - Oe.insert,
                                Oe.ins_h = Oe.window[Yl],
                                Oe.ins_h = (Oe.ins_h << Oe.hash_shift ^ Oe.window[Yl + 1]) & Oe.hash_mask; Oe.insert && (Oe.ins_h = (Oe.ins_h << Oe.hash_shift ^ Oe.window[Yl + ue - 1]) & Oe.hash_mask,
                                Oe.prev[Yl & Oe.w_mask] = Oe.head[Oe.ins_h],
                                Oe.head[Oe.ins_h] = Yl,
                                Yl++,
                                Oe.insert--,
                                !(Oe.lookahead + Oe.insert < ue)); )
                                    ;
                        } while (Oe.lookahead < ve && Oe.strm.avail_in !== 0)
                    }
                    function jr(Oe, R0) {
                        for (var gm, $s; ; ) {
                            if (Oe.lookahead < ve) {
                                if (Xe(Oe),
                                Oe.lookahead < ve && R0 === d)
                                    return $;
                                if (Oe.lookahead === 0)
                                    break
                            }
                            if (gm = 0,
                            Oe.lookahead >= ue && (Oe.ins_h = (Oe.ins_h << Oe.hash_shift ^ Oe.window[Oe.strstart + ue - 1]) & Oe.hash_mask,
                            gm = Oe.prev[Oe.strstart & Oe.w_mask] = Oe.head[Oe.ins_h],
                            Oe.head[Oe.ins_h] = Oe.strstart),
                            gm !== 0 && Oe.strstart - gm <= Oe.w_size - ve && (Oe.match_length = he(Oe, gm)),
                            Oe.match_length >= ue)
                                if ($s = l._tr_tally(Oe, Oe.strstart - Oe.match_start, Oe.match_length - ue),
                                Oe.lookahead -= Oe.match_length,
                                Oe.match_length <= Oe.max_lazy_match && Oe.lookahead >= ue) {
                                    for (Oe.match_length--; Oe.strstart++,
                                    Oe.ins_h = (Oe.ins_h << Oe.hash_shift ^ Oe.window[Oe.strstart + ue - 1]) & Oe.hash_mask,
                                    gm = Oe.prev[Oe.strstart & Oe.w_mask] = Oe.head[Oe.ins_h],
                                    Oe.head[Oe.ins_h] = Oe.strstart,
                                    --Oe.match_length != 0; )
                                        ;
                                    Oe.strstart++
                                } else
                                    Oe.strstart += Oe.match_length,
                                    Oe.match_length = 0,
                                    Oe.ins_h = Oe.window[Oe.strstart],
                                    Oe.ins_h = (Oe.ins_h << Oe.hash_shift ^ Oe.window[Oe.strstart + 1]) & Oe.hash_mask;
                            else
                                $s = l._tr_tally(Oe, 0, Oe.window[Oe.strstart]),
                                Oe.lookahead--,
                                Oe.strstart++;
                            if ($s && (Ht(Oe, !1),
                            Oe.strm.avail_out === 0))
                                return $
                        }
                        return Oe.insert = Oe.strstart < ue - 1 ? Oe.strstart : ue - 1,
                        R0 === f ? (Ht(Oe, !0),
                        Oe.strm.avail_out === 0 ? ba : us) : Oe.last_lit && (Ht(Oe, !1),
                        Oe.strm.avail_out === 0) ? $ : pt
                    }
                    function fs(Oe, R0) {
                        for (var gm, $s, go; ; ) {
                            if (Oe.lookahead < ve) {
                                if (Xe(Oe),
                                Oe.lookahead < ve && R0 === d)
                                    return $;
                                if (Oe.lookahead === 0)
                                    break
                            }
                            if (gm = 0,
                            Oe.lookahead >= ue && (Oe.ins_h = (Oe.ins_h << Oe.hash_shift ^ Oe.window[Oe.strstart + ue - 1]) & Oe.hash_mask,
                            gm = Oe.prev[Oe.strstart & Oe.w_mask] = Oe.head[Oe.ins_h],
                            Oe.head[Oe.ins_h] = Oe.strstart),
                            Oe.prev_length = Oe.match_length,
                            Oe.prev_match = Oe.match_start,
                            Oe.match_length = ue - 1,
                            gm !== 0 && Oe.prev_length < Oe.max_lazy_match && Oe.strstart - gm <= Oe.w_size - ve && (Oe.match_length = he(Oe, gm),
                            Oe.match_length <= 5 && (Oe.strategy === 1 || Oe.match_length === ue && 4096 < Oe.strstart - Oe.match_start) && (Oe.match_length = ue - 1)),
                            Oe.prev_length >= ue && Oe.match_length <= Oe.prev_length) {
                                for (go = Oe.strstart + Oe.lookahead - ue,
                                $s = l._tr_tally(Oe, Oe.strstart - 1 - Oe.prev_match, Oe.prev_length - ue),
                                Oe.lookahead -= Oe.prev_length - 1,
                                Oe.prev_length -= 2; ++Oe.strstart <= go && (Oe.ins_h = (Oe.ins_h << Oe.hash_shift ^ Oe.window[Oe.strstart + ue - 1]) & Oe.hash_mask,
                                gm = Oe.prev[Oe.strstart & Oe.w_mask] = Oe.head[Oe.ins_h],
                                Oe.head[Oe.ins_h] = Oe.strstart),
                                --Oe.prev_length != 0; )
                                    ;
                                if (Oe.match_available = 0,
                                Oe.match_length = ue - 1,
                                Oe.strstart++,
                                $s && (Ht(Oe, !1),
                                Oe.strm.avail_out === 0))
                                    return $
                            } else if (Oe.match_available) {
                                if (($s = l._tr_tally(Oe, 0, Oe.window[Oe.strstart - 1])) && Ht(Oe, !1),
                                Oe.strstart++,
                                Oe.lookahead--,
                                Oe.strm.avail_out === 0)
                                    return $
                            } else
                                Oe.match_available = 1,
                                Oe.strstart++,
                                Oe.lookahead--
                        }
                        return Oe.match_available && ($s = l._tr_tally(Oe, 0, Oe.window[Oe.strstart - 1]),
                        Oe.match_available = 0),
                        Oe.insert = Oe.strstart < ue - 1 ? Oe.strstart : ue - 1,
                        R0 === f ? (Ht(Oe, !0),
                        Oe.strm.avail_out === 0 ? ba : us) : Oe.last_lit && (Ht(Oe, !1),
                        Oe.strm.avail_out === 0) ? $ : pt
                    }
                    function bf(Oe, R0, gm, $s, go) {
                        this.good_length = Oe,
                        this.max_lazy = R0,
                        this.nice_length = gm,
                        this.max_chain = $s,
                        this.func = go
                    }
                    function $0() {
                        this.strm = null,
                        this.status = 0,
                        this.pending_buf = null,
                        this.pending_buf_size = 0,
                        this.pending_out = 0,
                        this.pending = 0,
                        this.wrap = 0,
                        this.gzhead = null,
                        this.gzindex = 0,
                        this.method = y,
                        this.last_flush = -1,
                        this.w_size = 0,
                        this.w_bits = 0,
                        this.w_mask = 0,
                        this.window = null,
                        this.window_size = 0,
                        this.prev = null,
                        this.head = null,
                        this.ins_h = 0,
                        this.hash_size = 0,
                        this.hash_bits = 0,
                        this.hash_mask = 0,
                        this.hash_shift = 0,
                        this.block_start = 0,
                        this.match_length = 0,
                        this.prev_match = 0,
                        this.match_available = 0,
                        this.strstart = 0,
                        this.match_start = 0,
                        this.lookahead = 0,
                        this.prev_length = 0,
                        this.max_chain_length = 0,
                        this.max_lazy_match = 0,
                        this.level = 0,
                        this.strategy = 0,
                        this.good_match = 0,
                        this.nice_match = 0,
                        this.dyn_ltree = new o.Buf16(2 * P),
                        this.dyn_dtree = new o.Buf16(2 * (2 * T + 1)),
                        this.bl_tree = new o.Buf16(2 * (2 * C + 1)),
                        Kt(this.dyn_ltree),
                        Kt(this.dyn_dtree),
                        Kt(this.bl_tree),
                        this.l_desc = null,
                        this.d_desc = null,
                        this.bl_desc = null,
                        this.bl_count = new o.Buf16(W + 1),
                        this.heap = new o.Buf16(2 * R + 1),
                        Kt(this.heap),
                        this.heap_len = 0,
                        this.heap_max = 0,
                        this.depth = new o.Buf16(2 * R + 1),
                        Kt(this.depth),
                        this.l_buf = 0,
                        this.lit_bufsize = 0,
                        this.last_lit = 0,
                        this.d_buf = 0,
                        this.opt_len = 0,
                        this.static_len = 0,
                        this.matches = 0,
                        this.insert = 0,
                        this.bi_buf = 0,
                        this.bi_valid = 0
                    }
                    function ie(Oe) {
                        var R0;
                        return Oe && Oe.state ? (Oe.total_in = Oe.total_out = 0,
                        Oe.data_type = b,
                        (R0 = Oe.state).pending = 0,
                        R0.pending_out = 0,
                        R0.wrap < 0 && (R0.wrap = -R0.wrap),
                        R0.status = R0.wrap ? I : M,
                        Oe.adler = R0.wrap === 2 ? 0 : 1,
                        R0.last_flush = d,
                        l._tr_init(R0),
                        h) : Wd(Oe, m)
                    }
                    function He(Oe) {
                        var R0 = ie(Oe);
                        return R0 === h && (function(gm) {
                            gm.window_size = 2 * gm.w_size,
                            Kt(gm.head),
                            gm.max_lazy_match = s[gm.level].max_lazy,
                            gm.good_match = s[gm.level].good_length,
                            gm.nice_match = s[gm.level].nice_length,
                            gm.max_chain_length = s[gm.level].max_chain,
                            gm.strstart = 0,
                            gm.block_start = 0,
                            gm.lookahead = 0,
                            gm.insert = 0,
                            gm.match_length = gm.prev_length = ue - 1,
                            gm.match_available = 0,
                            gm.ins_h = 0
                        }
                        )(Oe.state),
                        R0
                    }
                    function mm(Oe, R0, gm, $s, go, Yl) {
                        if (!Oe)
                            return m;
                        var lv = 1;
                        if (R0 === g && (R0 = 6),
                        $s < 0 ? (lv = 0,
                        $s = -$s) : 15 < $s && (lv = 2,
                        $s -= 16),
                        go < 1 || w < go || gm !== y || $s < 8 || 15 < $s || R0 < 0 || 9 < R0 || Yl < 0 || x < Yl)
                            return Wd(Oe, m);
                        $s === 8 && ($s = 9);
                        var Ox = new $0;
                        return (Oe.state = Ox).strm = Oe,
                        Ox.wrap = lv,
                        Ox.gzhead = null,
                        Ox.w_bits = $s,
                        Ox.w_size = 1 << Ox.w_bits,
                        Ox.w_mask = Ox.w_size - 1,
                        Ox.hash_bits = go + 7,
                        Ox.hash_size = 1 << Ox.hash_bits,
                        Ox.hash_mask = Ox.hash_size - 1,
                        Ox.hash_shift = ~~((Ox.hash_bits + ue - 1) / ue),
                        Ox.window = new o.Buf8(2 * Ox.w_size),
                        Ox.head = new o.Buf16(Ox.hash_size),
                        Ox.prev = new o.Buf16(Ox.w_size),
                        Ox.lit_bufsize = 1 << go + 6,
                        Ox.pending_buf_size = 4 * Ox.lit_bufsize,
                        Ox.pending_buf = new o.Buf8(Ox.pending_buf_size),
                        Ox.d_buf = 1 * Ox.lit_bufsize,
                        Ox.l_buf = 3 * Ox.lit_bufsize,
                        Ox.level = R0,
                        Ox.strategy = Yl,
                        Ox.method = gm,
                        He(Oe)
                    }
                    s = [new bf(0,0,0,0,function(Oe, R0) {
                        var gm = 65535;
                        for (gm > Oe.pending_buf_size - 5 && (gm = Oe.pending_buf_size - 5); ; ) {
                            if (Oe.lookahead <= 1) {
                                if (Xe(Oe),
                                Oe.lookahead === 0 && R0 === d)
                                    return $;
                                if (Oe.lookahead === 0)
                                    break
                            }
                            Oe.strstart += Oe.lookahead,
                            Oe.lookahead = 0;
                            var $s = Oe.block_start + gm;
                            if ((Oe.strstart === 0 || Oe.strstart >= $s) && (Oe.lookahead = Oe.strstart - $s,
                            Oe.strstart = $s,
                            Ht(Oe, !1),
                            Oe.strm.avail_out === 0) || Oe.strstart - Oe.block_start >= Oe.w_size - ve && (Ht(Oe, !1),
                            Oe.strm.avail_out === 0))
                                return $
                        }
                        return Oe.insert = 0,
                        R0 === f ? (Ht(Oe, !0),
                        Oe.strm.avail_out === 0 ? ba : us) : (Oe.strstart > Oe.block_start && (Ht(Oe, !1),
                        Oe.strm.avail_out),
                        $)
                    }
                    ), new bf(4,4,8,4,jr), new bf(4,5,16,8,jr), new bf(4,6,32,32,jr), new bf(4,4,16,16,fs), new bf(8,16,32,32,fs), new bf(8,16,128,128,fs), new bf(8,32,128,256,fs), new bf(32,128,258,1024,fs), new bf(32,258,258,4096,fs)],
                    a.deflateInit = function(Oe, R0) {
                        return mm(Oe, R0, y, 15, 8, 0)
                    }
                    ,
                    a.deflateInit2 = mm,
                    a.deflateReset = He,
                    a.deflateResetKeep = ie,
                    a.deflateSetHeader = function(Oe, R0) {
                        return Oe && Oe.state ? Oe.state.wrap !== 2 ? m : (Oe.state.gzhead = R0,
                        h) : m
                    }
                    ,
                    a.deflate = function(Oe, R0) {
                        var gm, $s, go, Yl;
                        if (!Oe || !Oe.state || 5 < R0 || R0 < 0)
                            return Oe ? Wd(Oe, m) : m;
                        if ($s = Oe.state,
                        !Oe.output || !Oe.input && Oe.avail_in !== 0 || $s.status === 666 && R0 !== f)
                            return Wd(Oe, Oe.avail_out === 0 ? -5 : m);
                        if ($s.strm = Oe,
                        gm = $s.last_flush,
                        $s.last_flush = R0,
                        $s.status === I)
                            if ($s.wrap === 2)
                                Oe.adler = 0,
                                $e($s, 31),
                                $e($s, 139),
                                $e($s, 8),
                                $s.gzhead ? ($e($s, ($s.gzhead.text ? 1 : 0) + ($s.gzhead.hcrc ? 2 : 0) + ($s.gzhead.extra ? 4 : 0) + ($s.gzhead.name ? 8 : 0) + ($s.gzhead.comment ? 16 : 0)),
                                $e($s, 255 & $s.gzhead.time),
                                $e($s, $s.gzhead.time >> 8 & 255),
                                $e($s, $s.gzhead.time >> 16 & 255),
                                $e($s, $s.gzhead.time >> 24 & 255),
                                $e($s, $s.level === 9 ? 2 : 2 <= $s.strategy || $s.level < 2 ? 4 : 0),
                                $e($s, 255 & $s.gzhead.os),
                                $s.gzhead.extra && $s.gzhead.extra.length && ($e($s, 255 & $s.gzhead.extra.length),
                                $e($s, $s.gzhead.extra.length >> 8 & 255)),
                                $s.gzhead.hcrc && (Oe.adler = c(Oe.adler, $s.pending_buf, $s.pending, 0)),
                                $s.gzindex = 0,
                                $s.status = 69) : ($e($s, 0),
                                $e($s, 0),
                                $e($s, 0),
                                $e($s, 0),
                                $e($s, 0),
                                $e($s, $s.level === 9 ? 2 : 2 <= $s.strategy || $s.level < 2 ? 4 : 0),
                                $e($s, 3),
                                $s.status = M);
                            else {
                                var lv = y + ($s.w_bits - 8 << 4) << 8;
                                lv |= (2 <= $s.strategy || $s.level < 2 ? 0 : $s.level < 6 ? 1 : $s.level === 6 ? 2 : 3) << 6,
                                $s.strstart !== 0 && (lv |= 32),
                                lv += 31 - lv % 31,
                                $s.status = M,
                                G($s, lv),
                                $s.strstart !== 0 && (G($s, Oe.adler >>> 16),
                                G($s, 65535 & Oe.adler)),
                                Oe.adler = 1
                            }
                        if ($s.status === 69)
                            if ($s.gzhead.extra) {
                                for (go = $s.pending; $s.gzindex < (65535 & $s.gzhead.extra.length) && ($s.pending !== $s.pending_buf_size || ($s.gzhead.hcrc && $s.pending > go && (Oe.adler = c(Oe.adler, $s.pending_buf, $s.pending - go, go)),
                                lt(Oe),
                                go = $s.pending,
                                $s.pending !== $s.pending_buf_size)); )
                                    $e($s, 255 & $s.gzhead.extra[$s.gzindex]),
                                    $s.gzindex++;
                                $s.gzhead.hcrc && $s.pending > go && (Oe.adler = c(Oe.adler, $s.pending_buf, $s.pending - go, go)),
                                $s.gzindex === $s.gzhead.extra.length && ($s.gzindex = 0,
                                $s.status = 73)
                            } else
                                $s.status = 73;
                        if ($s.status === 73)
                            if ($s.gzhead.name) {
                                go = $s.pending;
                                do {
                                    if ($s.pending === $s.pending_buf_size && ($s.gzhead.hcrc && $s.pending > go && (Oe.adler = c(Oe.adler, $s.pending_buf, $s.pending - go, go)),
                                    lt(Oe),
                                    go = $s.pending,
                                    $s.pending === $s.pending_buf_size)) {
                                        Yl = 1;
                                        break
                                    }
                                    Yl = $s.gzindex < $s.gzhead.name.length ? 255 & $s.gzhead.name.charCodeAt($s.gzindex++) : 0,
                                    $e($s, Yl)
                                } while (Yl !== 0);
                                $s.gzhead.hcrc && $s.pending > go && (Oe.adler = c(Oe.adler, $s.pending_buf, $s.pending - go, go)),
                                Yl === 0 && ($s.gzindex = 0,
                                $s.status = 91)
                            } else
                                $s.status = 91;
                        if ($s.status === 91)
                            if ($s.gzhead.comment) {
                                go = $s.pending;
                                do {
                                    if ($s.pending === $s.pending_buf_size && ($s.gzhead.hcrc && $s.pending > go && (Oe.adler = c(Oe.adler, $s.pending_buf, $s.pending - go, go)),
                                    lt(Oe),
                                    go = $s.pending,
                                    $s.pending === $s.pending_buf_size)) {
                                        Yl = 1;
                                        break
                                    }
                                    Yl = $s.gzindex < $s.gzhead.comment.length ? 255 & $s.gzhead.comment.charCodeAt($s.gzindex++) : 0,
                                    $e($s, Yl)
                                } while (Yl !== 0);
                                $s.gzhead.hcrc && $s.pending > go && (Oe.adler = c(Oe.adler, $s.pending_buf, $s.pending - go, go)),
                                Yl === 0 && ($s.status = 103)
                            } else
                                $s.status = 103;
                        if ($s.status === 103 && ($s.gzhead.hcrc ? ($s.pending + 2 > $s.pending_buf_size && lt(Oe),
                        $s.pending + 2 <= $s.pending_buf_size && ($e($s, 255 & Oe.adler),
                        $e($s, Oe.adler >> 8 & 255),
                        Oe.adler = 0,
                        $s.status = M)) : $s.status = M),
                        $s.pending !== 0) {
                            if (lt(Oe),
                            Oe.avail_out === 0)
                                return $s.last_flush = -1,
                                h
                        } else if (Oe.avail_in === 0 && Mr(R0) <= Mr(gm) && R0 !== f)
                            return Wd(Oe, -5);
                        if ($s.status === 666 && Oe.avail_in !== 0)
                            return Wd(Oe, -5);
                        if (Oe.avail_in !== 0 || $s.lookahead !== 0 || R0 !== d && $s.status !== 666) {
                            var Ox = $s.strategy === 2 ? (function(ev, iv) {
                                for (var N; ; ) {
                                    if (ev.lookahead === 0 && (Xe(ev),
                                    ev.lookahead === 0)) {
                                        if (iv === d)
                                            return $;
                                        break
                                    }
                                    if (ev.match_length = 0,
                                    N = l._tr_tally(ev, 0, ev.window[ev.strstart]),
                                    ev.lookahead--,
                                    ev.strstart++,
                                    N && (Ht(ev, !1),
                                    ev.strm.avail_out === 0))
                                        return $
                                }
                                return ev.insert = 0,
                                iv === f ? (Ht(ev, !0),
                                ev.strm.avail_out === 0 ? ba : us) : ev.last_lit && (Ht(ev, !1),
                                ev.strm.avail_out === 0) ? $ : pt
                            }
                            )($s, R0) : $s.strategy === 3 ? (function(ev, iv) {
                                for (var N, bi, Rx, sv, h0 = ev.window; ; ) {
                                    if (ev.lookahead <= ce) {
                                        if (Xe(ev),
                                        ev.lookahead <= ce && iv === d)
                                            return $;
                                        if (ev.lookahead === 0)
                                            break
                                    }
                                    if (ev.match_length = 0,
                                    ev.lookahead >= ue && 0 < ev.strstart && (bi = h0[Rx = ev.strstart - 1]) === h0[++Rx] && bi === h0[++Rx] && bi === h0[++Rx]) {
                                        sv = ev.strstart + ce;
                                        do
                                            ;
                                        while (bi === h0[++Rx] && bi === h0[++Rx] && bi === h0[++Rx] && bi === h0[++Rx] && bi === h0[++Rx] && bi === h0[++Rx] && bi === h0[++Rx] && bi === h0[++Rx] && Rx < sv);
                                        ev.match_length = ce - (sv - Rx),
                                        ev.match_length > ev.lookahead && (ev.match_length = ev.lookahead)
                                    }
                                    if (ev.match_length >= ue ? (N = l._tr_tally(ev, 1, ev.match_length - ue),
                                    ev.lookahead -= ev.match_length,
                                    ev.strstart += ev.match_length,
                                    ev.match_length = 0) : (N = l._tr_tally(ev, 0, ev.window[ev.strstart]),
                                    ev.lookahead--,
                                    ev.strstart++),
                                    N && (Ht(ev, !1),
                                    ev.strm.avail_out === 0))
                                        return $
                                }
                                return ev.insert = 0,
                                iv === f ? (Ht(ev, !0),
                                ev.strm.avail_out === 0 ? ba : us) : ev.last_lit && (Ht(ev, !1),
                                ev.strm.avail_out === 0) ? $ : pt
                            }
                            )($s, R0) : s[$s.level].func($s, R0);
                            if (Ox !== ba && Ox !== us || ($s.status = 666),
                            Ox === $ || Ox === ba)
                                return Oe.avail_out === 0 && ($s.last_flush = -1),
                                h;
                            if (Ox === pt && (R0 === 1 ? l._tr_align($s) : R0 !== 5 && (l._tr_stored_block($s, 0, 0, !1),
                            R0 === 3 && (Kt($s.head),
                            $s.lookahead === 0 && ($s.strstart = 0,
                            $s.block_start = 0,
                            $s.insert = 0))),
                            lt(Oe),
                            Oe.avail_out === 0))
                                return $s.last_flush = -1,
                                h
                        }
                        return R0 !== f ? h : $s.wrap <= 0 ? 1 : ($s.wrap === 2 ? ($e($s, 255 & Oe.adler),
                        $e($s, Oe.adler >> 8 & 255),
                        $e($s, Oe.adler >> 16 & 255),
                        $e($s, Oe.adler >> 24 & 255),
                        $e($s, 255 & Oe.total_in),
                        $e($s, Oe.total_in >> 8 & 255),
                        $e($s, Oe.total_in >> 16 & 255),
                        $e($s, Oe.total_in >> 24 & 255)) : (G($s, Oe.adler >>> 16),
                        G($s, 65535 & Oe.adler)),
                        lt(Oe),
                        0 < $s.wrap && ($s.wrap = -$s.wrap),
                        $s.pending !== 0 ? h : 1)
                    }
                    ,
                    a.deflateEnd = function(Oe) {
                        var R0;
                        return Oe && Oe.state ? (R0 = Oe.state.status) !== I && R0 !== 69 && R0 !== 73 && R0 !== 91 && R0 !== 103 && R0 !== M && R0 !== 666 ? Wd(Oe, m) : (Oe.state = null,
                        R0 === M ? Wd(Oe, -3) : h) : m
                    }
                    ,
                    a.deflateSetDictionary = function(Oe, R0) {
                        var gm, $s, go, Yl, lv, Ox, ev, iv, N = R0.length;
                        if (!Oe || !Oe.state || (Yl = (gm = Oe.state).wrap) === 2 || Yl === 1 && gm.status !== I || gm.lookahead)
                            return m;
                        for (Yl === 1 && (Oe.adler = u(Oe.adler, R0, N, 0)),
                        gm.wrap = 0,
                        N >= gm.w_size && (Yl === 0 && (Kt(gm.head),
                        gm.strstart = 0,
                        gm.block_start = 0,
                        gm.insert = 0),
                        iv = new o.Buf8(gm.w_size),
                        o.arraySet(iv, R0, N - gm.w_size, gm.w_size, 0),
                        R0 = iv,
                        N = gm.w_size),
                        lv = Oe.avail_in,
                        Ox = Oe.next_in,
                        ev = Oe.input,
                        Oe.avail_in = N,
                        Oe.next_in = 0,
                        Oe.input = R0,
                        Xe(gm); gm.lookahead >= ue; ) {
                            for ($s = gm.strstart,
                            go = gm.lookahead - (ue - 1); gm.ins_h = (gm.ins_h << gm.hash_shift ^ gm.window[$s + ue - 1]) & gm.hash_mask,
                            gm.prev[$s & gm.w_mask] = gm.head[gm.ins_h],
                            gm.head[gm.ins_h] = $s,
                            $s++,
                            --go; )
                                ;
                            gm.strstart = $s,
                            gm.lookahead = ue - 1,
                            Xe(gm)
                        }
                        return gm.strstart += gm.lookahead,
                        gm.block_start = gm.strstart,
                        gm.insert = gm.lookahead,
                        gm.lookahead = 0,
                        gm.match_length = gm.prev_length = ue - 1,
                        gm.match_available = 0,
                        Oe.next_in = Ox,
                        Oe.input = ev,
                        Oe.avail_in = lv,
                        gm.wrap = Yl,
                        h
                    }
                    ,
                    a.deflateInfo = "pako deflate (from Nodeca project)"
                }
                , {
                    "../utils/common": 41,
                    "./adler32": 43,
                    "./crc32": 45,
                    "./messages": 51,
                    "./trees": 52
                }],
                47: [function(r, n, a) {
                    n.exports = function() {
                        this.text = 0,
                        this.time = 0,
                        this.xflags = 0,
                        this.os = 0,
                        this.extra = null,
                        this.extra_len = 0,
                        this.name = "",
                        this.comment = "",
                        this.hcrc = 0,
                        this.done = !1
                    }
                }
                , {}],
                48: [function(r, n, a) {
                    n.exports = function(s, o) {
                        var l, u, c, p, d, f, h, m, g, x, b, y, w, R, T, C, P, W, ue, ce, ve, I, M, $, pt;
                        l = s.state,
                        u = s.next_in,
                        $ = s.input,
                        c = u + (s.avail_in - 5),
                        p = s.next_out,
                        pt = s.output,
                        d = p - (o - s.avail_out),
                        f = p + (s.avail_out - 257),
                        h = l.dmax,
                        m = l.wsize,
                        g = l.whave,
                        x = l.wnext,
                        b = l.window,
                        y = l.hold,
                        w = l.bits,
                        R = l.lencode,
                        T = l.distcode,
                        C = (1 << l.lenbits) - 1,
                        P = (1 << l.distbits) - 1;
                        e: do {
                            w < 15 && (y += $[u++] << w,
                            w += 8,
                            y += $[u++] << w,
                            w += 8),
                            W = R[y & C];
                            t: for (; ; ) {
                                if (y >>>= ue = W >>> 24,
                                w -= ue,
                                (ue = W >>> 16 & 255) === 0)
                                    pt[p++] = 65535 & W;
                                else {
                                    if (!(16 & ue)) {
                                        if ((64 & ue) == 0) {
                                            W = R[(65535 & W) + (y & (1 << ue) - 1)];
                                            continue t
                                        }
                                        if (32 & ue) {
                                            l.mode = 12;
                                            break e
                                        }
                                        s.msg = "invalid literal/length code",
                                        l.mode = 30;
                                        break e
                                    }
                                    ce = 65535 & W,
                                    (ue &= 15) && (w < ue && (y += $[u++] << w,
                                    w += 8),
                                    ce += y & (1 << ue) - 1,
                                    y >>>= ue,
                                    w -= ue),
                                    w < 15 && (y += $[u++] << w,
                                    w += 8,
                                    y += $[u++] << w,
                                    w += 8),
                                    W = T[y & P];
                                    r: for (; ; ) {
                                        if (y >>>= ue = W >>> 24,
                                        w -= ue,
                                        !(16 & (ue = W >>> 16 & 255))) {
                                            if ((64 & ue) == 0) {
                                                W = T[(65535 & W) + (y & (1 << ue) - 1)];
                                                continue r
                                            }
                                            s.msg = "invalid distance code",
                                            l.mode = 30;
                                            break e
                                        }
                                        if (ve = 65535 & W,
                                        w < (ue &= 15) && (y += $[u++] << w,
                                        (w += 8) < ue && (y += $[u++] << w,
                                        w += 8)),
                                        h < (ve += y & (1 << ue) - 1)) {
                                            s.msg = "invalid distance too far back",
                                            l.mode = 30;
                                            break e
                                        }
                                        if (y >>>= ue,
                                        w -= ue,
                                        (ue = p - d) < ve) {
                                            if (g < (ue = ve - ue) && l.sane) {
                                                s.msg = "invalid distance too far back",
                                                l.mode = 30;
                                                break e
                                            }
                                            if (M = b,
                                            (I = 0) === x) {
                                                if (I += m - ue,
                                                ue < ce) {
                                                    for (ce -= ue; pt[p++] = b[I++],
                                                    --ue; )
                                                        ;
                                                    I = p - ve,
                                                    M = pt
                                                }
                                            } else if (x < ue) {
                                                if (I += m + x - ue,
                                                (ue -= x) < ce) {
                                                    for (ce -= ue; pt[p++] = b[I++],
                                                    --ue; )
                                                        ;
                                                    if (I = 0,
                                                    x < ce) {
                                                        for (ce -= ue = x; pt[p++] = b[I++],
                                                        --ue; )
                                                            ;
                                                        I = p - ve,
                                                        M = pt
                                                    }
                                                }
                                            } else if (I += x - ue,
                                            ue < ce) {
                                                for (ce -= ue; pt[p++] = b[I++],
                                                --ue; )
                                                    ;
                                                I = p - ve,
                                                M = pt
                                            }
                                            for (; 2 < ce; )
                                                pt[p++] = M[I++],
                                                pt[p++] = M[I++],
                                                pt[p++] = M[I++],
                                                ce -= 3;
                                            ce && (pt[p++] = M[I++],
                                            1 < ce && (pt[p++] = M[I++]))
                                        } else {
                                            for (I = p - ve; pt[p++] = pt[I++],
                                            pt[p++] = pt[I++],
                                            pt[p++] = pt[I++],
                                            2 < (ce -= 3); )
                                                ;
                                            ce && (pt[p++] = pt[I++],
                                            1 < ce && (pt[p++] = pt[I++]))
                                        }
                                        break
                                    }
                                }
                                break
                            }
                        } while (u < c && p < f);
                        u -= ce = w >> 3,
                        y &= (1 << (w -= ce << 3)) - 1,
                        s.next_in = u,
                        s.next_out = p,
                        s.avail_in = u < c ? c - u + 5 : 5 - (u - c),
                        s.avail_out = p < f ? f - p + 257 : 257 - (p - f),
                        l.hold = y,
                        l.bits = w
                    }
                }
                , {}],
                49: [function(r, n, a) {
                    var s = r("../utils/common")
                      , o = r("./adler32")
                      , l = r("./crc32")
                      , u = r("./inffast")
                      , c = r("./inftrees")
                      , p = 1
                      , d = 2
                      , f = 0
                      , h = -2
                      , m = 1
                      , g = 852
                      , x = 592;
                    function b(I) {
                        return (I >>> 24 & 255) + (I >>> 8 & 65280) + ((65280 & I) << 8) + ((255 & I) << 24)
                    }
                    function y() {
                        this.mode = 0,
                        this.last = !1,
                        this.wrap = 0,
                        this.havedict = !1,
                        this.flags = 0,
                        this.dmax = 0,
                        this.check = 0,
                        this.total = 0,
                        this.head = null,
                        this.wbits = 0,
                        this.wsize = 0,
                        this.whave = 0,
                        this.wnext = 0,
                        this.window = null,
                        this.hold = 0,
                        this.bits = 0,
                        this.length = 0,
                        this.offset = 0,
                        this.extra = 0,
                        this.lencode = null,
                        this.distcode = null,
                        this.lenbits = 0,
                        this.distbits = 0,
                        this.ncode = 0,
                        this.nlen = 0,
                        this.ndist = 0,
                        this.have = 0,
                        this.next = null,
                        this.lens = new s.Buf16(320),
                        this.work = new s.Buf16(288),
                        this.lendyn = null,
                        this.distdyn = null,
                        this.sane = 0,
                        this.back = 0,
                        this.was = 0
                    }
                    function w(I) {
                        var M;
                        return I && I.state ? (M = I.state,
                        I.total_in = I.total_out = M.total = 0,
                        I.msg = "",
                        M.wrap && (I.adler = 1 & M.wrap),
                        M.mode = m,
                        M.last = 0,
                        M.havedict = 0,
                        M.dmax = 32768,
                        M.head = null,
                        M.hold = 0,
                        M.bits = 0,
                        M.lencode = M.lendyn = new s.Buf32(g),
                        M.distcode = M.distdyn = new s.Buf32(x),
                        M.sane = 1,
                        M.back = -1,
                        f) : h
                    }
                    function R(I) {
                        var M;
                        return I && I.state ? ((M = I.state).wsize = 0,
                        M.whave = 0,
                        M.wnext = 0,
                        w(I)) : h
                    }
                    function T(I, M) {
                        var $, pt;
                        return I && I.state ? (pt = I.state,
                        M < 0 ? ($ = 0,
                        M = -M) : ($ = 1 + (M >> 4),
                        M < 48 && (M &= 15)),
                        M && (M < 8 || 15 < M) ? h : (pt.window !== null && pt.wbits !== M && (pt.window = null),
                        pt.wrap = $,
                        pt.wbits = M,
                        R(I))) : h
                    }
                    function C(I, M) {
                        var $, pt;
                        return I ? (pt = new y,
                        (I.state = pt).window = null,
                        ($ = T(I, M)) !== f && (I.state = null),
                        $) : h
                    }
                    var P, W, ue = !0;
                    function ce(I) {
                        if (ue) {
                            var M;
                            for (P = new s.Buf32(512),
                            W = new s.Buf32(32),
                            M = 0; M < 144; )
                                I.lens[M++] = 8;
                            for (; M < 256; )
                                I.lens[M++] = 9;
                            for (; M < 280; )
                                I.lens[M++] = 7;
                            for (; M < 288; )
                                I.lens[M++] = 8;
                            for (c(p, I.lens, 0, 288, P, 0, I.work, {
                                bits: 9
                            }),
                            M = 0; M < 32; )
                                I.lens[M++] = 5;
                            c(d, I.lens, 0, 32, W, 0, I.work, {
                                bits: 5
                            }),
                            ue = !1
                        }
                        I.lencode = P,
                        I.lenbits = 9,
                        I.distcode = W,
                        I.distbits = 5
                    }
                    function ve(I, M, $, pt) {
                        var ba, us = I.state;
                        return us.window === null && (us.wsize = 1 << us.wbits,
                        us.wnext = 0,
                        us.whave = 0,
                        us.window = new s.Buf8(us.wsize)),
                        pt >= us.wsize ? (s.arraySet(us.window, M, $ - us.wsize, us.wsize, 0),
                        us.wnext = 0,
                        us.whave = us.wsize) : (pt < (ba = us.wsize - us.wnext) && (ba = pt),
                        s.arraySet(us.window, M, $ - pt, ba, us.wnext),
                        (pt -= ba) ? (s.arraySet(us.window, M, $ - pt, pt, 0),
                        us.wnext = pt,
                        us.whave = us.wsize) : (us.wnext += ba,
                        us.wnext === us.wsize && (us.wnext = 0),
                        us.whave < us.wsize && (us.whave += ba))),
                        0
                    }
                    a.inflateReset = R,
                    a.inflateReset2 = T,
                    a.inflateResetKeep = w,
                    a.inflateInit = function(I) {
                        return C(I, 15)
                    }
                    ,
                    a.inflateInit2 = C,
                    a.inflate = function(I, M) {
                        var $, pt, ba, us, Wd, Mr, Kt, lt, Ht, $e, G, he, Xe, jr, fs, bf, $0, ie, He, mm, Oe, R0, gm, $s, go = 0, Yl = new s.Buf8(4), lv = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
                        if (!I || !I.state || !I.output || !I.input && I.avail_in !== 0)
                            return h;
                        ($ = I.state).mode === 12 && ($.mode = 13),
                        Wd = I.next_out,
                        ba = I.output,
                        Kt = I.avail_out,
                        us = I.next_in,
                        pt = I.input,
                        Mr = I.avail_in,
                        lt = $.hold,
                        Ht = $.bits,
                        $e = Mr,
                        G = Kt,
                        R0 = f;
                        e: for (; ; )
                            switch ($.mode) {
                            case m:
                                if ($.wrap === 0) {
                                    $.mode = 13;
                                    break
                                }
                                for (; Ht < 16; ) {
                                    if (Mr === 0)
                                        break e;
                                    Mr--,
                                    lt += pt[us++] << Ht,
                                    Ht += 8
                                }
                                if (2 & $.wrap && lt === 35615) {
                                    Yl[$.check = 0] = 255 & lt,
                                    Yl[1] = lt >>> 8 & 255,
                                    $.check = l($.check, Yl, 2, 0),
                                    Ht = lt = 0,
                                    $.mode = 2;
                                    break
                                }
                                if ($.flags = 0,
                                $.head && ($.head.done = !1),
                                !(1 & $.wrap) || (((255 & lt) << 8) + (lt >> 8)) % 31) {
                                    I.msg = "incorrect header check",
                                    $.mode = 30;
                                    break
                                }
                                if ((15 & lt) != 8) {
                                    I.msg = "unknown compression method",
                                    $.mode = 30;
                                    break
                                }
                                if (Ht -= 4,
                                Oe = 8 + (15 & (lt >>>= 4)),
                                $.wbits === 0)
                                    $.wbits = Oe;
                                else if (Oe > $.wbits) {
                                    I.msg = "invalid window size",
                                    $.mode = 30;
                                    break
                                }
                                $.dmax = 1 << Oe,
                                I.adler = $.check = 1,
                                $.mode = 512 & lt ? 10 : 12,
                                Ht = lt = 0;
                                break;
                            case 2:
                                for (; Ht < 16; ) {
                                    if (Mr === 0)
                                        break e;
                                    Mr--,
                                    lt += pt[us++] << Ht,
                                    Ht += 8
                                }
                                if ($.flags = lt,
                                (255 & $.flags) != 8) {
                                    I.msg = "unknown compression method",
                                    $.mode = 30;
                                    break
                                }
                                if (57344 & $.flags) {
                                    I.msg = "unknown header flags set",
                                    $.mode = 30;
                                    break
                                }
                                $.head && ($.head.text = lt >> 8 & 1),
                                512 & $.flags && (Yl[0] = 255 & lt,
                                Yl[1] = lt >>> 8 & 255,
                                $.check = l($.check, Yl, 2, 0)),
                                Ht = lt = 0,
                                $.mode = 3;
                            case 3:
                                for (; Ht < 32; ) {
                                    if (Mr === 0)
                                        break e;
                                    Mr--,
                                    lt += pt[us++] << Ht,
                                    Ht += 8
                                }
                                $.head && ($.head.time = lt),
                                512 & $.flags && (Yl[0] = 255 & lt,
                                Yl[1] = lt >>> 8 & 255,
                                Yl[2] = lt >>> 16 & 255,
                                Yl[3] = lt >>> 24 & 255,
                                $.check = l($.check, Yl, 4, 0)),
                                Ht = lt = 0,
                                $.mode = 4;
                            case 4:
                                for (; Ht < 16; ) {
                                    if (Mr === 0)
                                        break e;
                                    Mr--,
                                    lt += pt[us++] << Ht,
                                    Ht += 8
                                }
                                $.head && ($.head.xflags = 255 & lt,
                                $.head.os = lt >> 8),
                                512 & $.flags && (Yl[0] = 255 & lt,
                                Yl[1] = lt >>> 8 & 255,
                                $.check = l($.check, Yl, 2, 0)),
                                Ht = lt = 0,
                                $.mode = 5;
                            case 5:
                                if (1024 & $.flags) {
                                    for (; Ht < 16; ) {
                                        if (Mr === 0)
                                            break e;
                                        Mr--,
                                        lt += pt[us++] << Ht,
                                        Ht += 8
                                    }
                                    $.length = lt,
                                    $.head && ($.head.extra_len = lt),
                                    512 & $.flags && (Yl[0] = 255 & lt,
                                    Yl[1] = lt >>> 8 & 255,
                                    $.check = l($.check, Yl, 2, 0)),
                                    Ht = lt = 0
                                } else
                                    $.head && ($.head.extra = null);
                                $.mode = 6;
                            case 6:
                                if (1024 & $.flags && (Mr < (he = $.length) && (he = Mr),
                                he && ($.head && (Oe = $.head.extra_len - $.length,
                                $.head.extra || ($.head.extra = new Array($.head.extra_len)),
                                s.arraySet($.head.extra, pt, us, he, Oe)),
                                512 & $.flags && ($.check = l($.check, pt, he, us)),
                                Mr -= he,
                                us += he,
                                $.length -= he),
                                $.length))
                                    break e;
                                $.length = 0,
                                $.mode = 7;
                            case 7:
                                if (2048 & $.flags) {
                                    if (Mr === 0)
                                        break e;
                                    for (he = 0; Oe = pt[us + he++],
                                    $.head && Oe && $.length < 65536 && ($.head.name += String.fromCharCode(Oe)),
                                    Oe && he < Mr; )
                                        ;
                                    if (512 & $.flags && ($.check = l($.check, pt, he, us)),
                                    Mr -= he,
                                    us += he,
                                    Oe)
                                        break e
                                } else
                                    $.head && ($.head.name = null);
                                $.length = 0,
                                $.mode = 8;
                            case 8:
                                if (4096 & $.flags) {
                                    if (Mr === 0)
                                        break e;
                                    for (he = 0; Oe = pt[us + he++],
                                    $.head && Oe && $.length < 65536 && ($.head.comment += String.fromCharCode(Oe)),
                                    Oe && he < Mr; )
                                        ;
                                    if (512 & $.flags && ($.check = l($.check, pt, he, us)),
                                    Mr -= he,
                                    us += he,
                                    Oe)
                                        break e
                                } else
                                    $.head && ($.head.comment = null);
                                $.mode = 9;
                            case 9:
                                if (512 & $.flags) {
                                    for (; Ht < 16; ) {
                                        if (Mr === 0)
                                            break e;
                                        Mr--,
                                        lt += pt[us++] << Ht,
                                        Ht += 8
                                    }
                                    if (lt !== (65535 & $.check)) {
                                        I.msg = "header crc mismatch",
                                        $.mode = 30;
                                        break
                                    }
                                    Ht = lt = 0
                                }
                                $.head && ($.head.hcrc = $.flags >> 9 & 1,
                                $.head.done = !0),
                                I.adler = $.check = 0,
                                $.mode = 12;
                                break;
                            case 10:
                                for (; Ht < 32; ) {
                                    if (Mr === 0)
                                        break e;
                                    Mr--,
                                    lt += pt[us++] << Ht,
                                    Ht += 8
                                }
                                I.adler = $.check = b(lt),
                                Ht = lt = 0,
                                $.mode = 11;
                            case 11:
                                if ($.havedict === 0)
                                    return I.next_out = Wd,
                                    I.avail_out = Kt,
                                    I.next_in = us,
                                    I.avail_in = Mr,
                                    $.hold = lt,
                                    $.bits = Ht,
                                    2;
                                I.adler = $.check = 1,
                                $.mode = 12;
                            case 12:
                                if (M === 5 || M === 6)
                                    break e;
                            case 13:
                                if ($.last) {
                                    lt >>>= 7 & Ht,
                                    Ht -= 7 & Ht,
                                    $.mode = 27;
                                    break
                                }
                                for (; Ht < 3; ) {
                                    if (Mr === 0)
                                        break e;
                                    Mr--,
                                    lt += pt[us++] << Ht,
                                    Ht += 8
                                }
                                switch ($.last = 1 & lt,
                                Ht -= 1,
                                3 & (lt >>>= 1)) {
                                case 0:
                                    $.mode = 14;
                                    break;
                                case 1:
                                    if (ce($),
                                    $.mode = 20,
                                    M !== 6)
                                        break;
                                    lt >>>= 2,
                                    Ht -= 2;
                                    break e;
                                case 2:
                                    $.mode = 17;
                                    break;
                                case 3:
                                    I.msg = "invalid block type",
                                    $.mode = 30
                                }
                                lt >>>= 2,
                                Ht -= 2;
                                break;
                            case 14:
                                for (lt >>>= 7 & Ht,
                                Ht -= 7 & Ht; Ht < 32; ) {
                                    if (Mr === 0)
                                        break e;
                                    Mr--,
                                    lt += pt[us++] << Ht,
                                    Ht += 8
                                }
                                if ((65535 & lt) != (lt >>> 16 ^ 65535)) {
                                    I.msg = "invalid stored block lengths",
                                    $.mode = 30;
                                    break
                                }
                                if ($.length = 65535 & lt,
                                Ht = lt = 0,
                                $.mode = 15,
                                M === 6)
                                    break e;
                            case 15:
                                $.mode = 16;
                            case 16:
                                if (he = $.length) {
                                    if (Mr < he && (he = Mr),
                                    Kt < he && (he = Kt),
                                    he === 0)
                                        break e;
                                    s.arraySet(ba, pt, us, he, Wd),
                                    Mr -= he,
                                    us += he,
                                    Kt -= he,
                                    Wd += he,
                                    $.length -= he;
                                    break
                                }
                                $.mode = 12;
                                break;
                            case 17:
                                for (; Ht < 14; ) {
                                    if (Mr === 0)
                                        break e;
                                    Mr--,
                                    lt += pt[us++] << Ht,
                                    Ht += 8
                                }
                                if ($.nlen = 257 + (31 & lt),
                                lt >>>= 5,
                                Ht -= 5,
                                $.ndist = 1 + (31 & lt),
                                lt >>>= 5,
                                Ht -= 5,
                                $.ncode = 4 + (15 & lt),
                                lt >>>= 4,
                                Ht -= 4,
                                286 < $.nlen || 30 < $.ndist) {
                                    I.msg = "too many length or distance symbols",
                                    $.mode = 30;
                                    break
                                }
                                $.have = 0,
                                $.mode = 18;
                            case 18:
                                for (; $.have < $.ncode; ) {
                                    for (; Ht < 3; ) {
                                        if (Mr === 0)
                                            break e;
                                        Mr--,
                                        lt += pt[us++] << Ht,
                                        Ht += 8
                                    }
                                    $.lens[lv[$.have++]] = 7 & lt,
                                    lt >>>= 3,
                                    Ht -= 3
                                }
                                for (; $.have < 19; )
                                    $.lens[lv[$.have++]] = 0;
                                if ($.lencode = $.lendyn,
                                $.lenbits = 7,
                                gm = {
                                    bits: $.lenbits
                                },
                                R0 = c(0, $.lens, 0, 19, $.lencode, 0, $.work, gm),
                                $.lenbits = gm.bits,
                                R0) {
                                    I.msg = "invalid code lengths set",
                                    $.mode = 30;
                                    break
                                }
                                $.have = 0,
                                $.mode = 19;
                            case 19:
                                for (; $.have < $.nlen + $.ndist; ) {
                                    for (; bf = (go = $.lencode[lt & (1 << $.lenbits) - 1]) >>> 16 & 255,
                                    $0 = 65535 & go,
                                    !((fs = go >>> 24) <= Ht); ) {
                                        if (Mr === 0)
                                            break e;
                                        Mr--,
                                        lt += pt[us++] << Ht,
                                        Ht += 8
                                    }
                                    if ($0 < 16)
                                        lt >>>= fs,
                                        Ht -= fs,
                                        $.lens[$.have++] = $0;
                                    else {
                                        if ($0 === 16) {
                                            for ($s = fs + 2; Ht < $s; ) {
                                                if (Mr === 0)
                                                    break e;
                                                Mr--,
                                                lt += pt[us++] << Ht,
                                                Ht += 8
                                            }
                                            if (lt >>>= fs,
                                            Ht -= fs,
                                            $.have === 0) {
                                                I.msg = "invalid bit length repeat",
                                                $.mode = 30;
                                                break
                                            }
                                            Oe = $.lens[$.have - 1],
                                            he = 3 + (3 & lt),
                                            lt >>>= 2,
                                            Ht -= 2
                                        } else if ($0 === 17) {
                                            for ($s = fs + 3; Ht < $s; ) {
                                                if (Mr === 0)
                                                    break e;
                                                Mr--,
                                                lt += pt[us++] << Ht,
                                                Ht += 8
                                            }
                                            Ht -= fs,
                                            Oe = 0,
                                            he = 3 + (7 & (lt >>>= fs)),
                                            lt >>>= 3,
                                            Ht -= 3
                                        } else {
                                            for ($s = fs + 7; Ht < $s; ) {
                                                if (Mr === 0)
                                                    break e;
                                                Mr--,
                                                lt += pt[us++] << Ht,
                                                Ht += 8
                                            }
                                            Ht -= fs,
                                            Oe = 0,
                                            he = 11 + (127 & (lt >>>= fs)),
                                            lt >>>= 7,
                                            Ht -= 7
                                        }
                                        if ($.have + he > $.nlen + $.ndist) {
                                            I.msg = "invalid bit length repeat",
                                            $.mode = 30;
                                            break
                                        }
                                        for (; he--; )
                                            $.lens[$.have++] = Oe
                                    }
                                }
                                if ($.mode === 30)
                                    break;
                                if ($.lens[256] === 0) {
                                    I.msg = "invalid code -- missing end-of-block",
                                    $.mode = 30;
                                    break
                                }
                                if ($.lenbits = 9,
                                gm = {
                                    bits: $.lenbits
                                },
                                R0 = c(p, $.lens, 0, $.nlen, $.lencode, 0, $.work, gm),
                                $.lenbits = gm.bits,
                                R0) {
                                    I.msg = "invalid literal/lengths set",
                                    $.mode = 30;
                                    break
                                }
                                if ($.distbits = 6,
                                $.distcode = $.distdyn,
                                gm = {
                                    bits: $.distbits
                                },
                                R0 = c(d, $.lens, $.nlen, $.ndist, $.distcode, 0, $.work, gm),
                                $.distbits = gm.bits,
                                R0) {
                                    I.msg = "invalid distances set",
                                    $.mode = 30;
                                    break
                                }
                                if ($.mode = 20,
                                M === 6)
                                    break e;
                            case 20:
                                $.mode = 21;
                            case 21:
                                if (6 <= Mr && 258 <= Kt) {
                                    I.next_out = Wd,
                                    I.avail_out = Kt,
                                    I.next_in = us,
                                    I.avail_in = Mr,
                                    $.hold = lt,
                                    $.bits = Ht,
                                    u(I, G),
                                    Wd = I.next_out,
                                    ba = I.output,
                                    Kt = I.avail_out,
                                    us = I.next_in,
                                    pt = I.input,
                                    Mr = I.avail_in,
                                    lt = $.hold,
                                    Ht = $.bits,
                                    $.mode === 12 && ($.back = -1);
                                    break
                                }
                                for ($.back = 0; bf = (go = $.lencode[lt & (1 << $.lenbits) - 1]) >>> 16 & 255,
                                $0 = 65535 & go,
                                !((fs = go >>> 24) <= Ht); ) {
                                    if (Mr === 0)
                                        break e;
                                    Mr--,
                                    lt += pt[us++] << Ht,
                                    Ht += 8
                                }
                                if (bf && (240 & bf) == 0) {
                                    for (ie = fs,
                                    He = bf,
                                    mm = $0; bf = (go = $.lencode[mm + ((lt & (1 << ie + He) - 1) >> ie)]) >>> 16 & 255,
                                    $0 = 65535 & go,
                                    !(ie + (fs = go >>> 24) <= Ht); ) {
                                        if (Mr === 0)
                                            break e;
                                        Mr--,
                                        lt += pt[us++] << Ht,
                                        Ht += 8
                                    }
                                    lt >>>= ie,
                                    Ht -= ie,
                                    $.back += ie
                                }
                                if (lt >>>= fs,
                                Ht -= fs,
                                $.back += fs,
                                $.length = $0,
                                bf === 0) {
                                    $.mode = 26;
                                    break
                                }
                                if (32 & bf) {
                                    $.back = -1,
                                    $.mode = 12;
                                    break
                                }
                                if (64 & bf) {
                                    I.msg = "invalid literal/length code",
                                    $.mode = 30;
                                    break
                                }
                                $.extra = 15 & bf,
                                $.mode = 22;
                            case 22:
                                if ($.extra) {
                                    for ($s = $.extra; Ht < $s; ) {
                                        if (Mr === 0)
                                            break e;
                                        Mr--,
                                        lt += pt[us++] << Ht,
                                        Ht += 8
                                    }
                                    $.length += lt & (1 << $.extra) - 1,
                                    lt >>>= $.extra,
                                    Ht -= $.extra,
                                    $.back += $.extra
                                }
                                $.was = $.length,
                                $.mode = 23;
                            case 23:
                                for (; bf = (go = $.distcode[lt & (1 << $.distbits) - 1]) >>> 16 & 255,
                                $0 = 65535 & go,
                                !((fs = go >>> 24) <= Ht); ) {
                                    if (Mr === 0)
                                        break e;
                                    Mr--,
                                    lt += pt[us++] << Ht,
                                    Ht += 8
                                }
                                if ((240 & bf) == 0) {
                                    for (ie = fs,
                                    He = bf,
                                    mm = $0; bf = (go = $.distcode[mm + ((lt & (1 << ie + He) - 1) >> ie)]) >>> 16 & 255,
                                    $0 = 65535 & go,
                                    !(ie + (fs = go >>> 24) <= Ht); ) {
                                        if (Mr === 0)
                                            break e;
                                        Mr--,
                                        lt += pt[us++] << Ht,
                                        Ht += 8
                                    }
                                    lt >>>= ie,
                                    Ht -= ie,
                                    $.back += ie
                                }
                                if (lt >>>= fs,
                                Ht -= fs,
                                $.back += fs,
                                64 & bf) {
                                    I.msg = "invalid distance code",
                                    $.mode = 30;
                                    break
                                }
                                $.offset = $0,
                                $.extra = 15 & bf,
                                $.mode = 24;
                            case 24:
                                if ($.extra) {
                                    for ($s = $.extra; Ht < $s; ) {
                                        if (Mr === 0)
                                            break e;
                                        Mr--,
                                        lt += pt[us++] << Ht,
                                        Ht += 8
                                    }
                                    $.offset += lt & (1 << $.extra) - 1,
                                    lt >>>= $.extra,
                                    Ht -= $.extra,
                                    $.back += $.extra
                                }
                                if ($.offset > $.dmax) {
                                    I.msg = "invalid distance too far back",
                                    $.mode = 30;
                                    break
                                }
                                $.mode = 25;
                            case 25:
                                if (Kt === 0)
                                    break e;
                                if (he = G - Kt,
                                $.offset > he) {
                                    if ((he = $.offset - he) > $.whave && $.sane) {
                                        I.msg = "invalid distance too far back",
                                        $.mode = 30;
                                        break
                                    }
                                    Xe = he > $.wnext ? (he -= $.wnext,
                                    $.wsize - he) : $.wnext - he,
                                    he > $.length && (he = $.length),
                                    jr = $.window
                                } else
                                    jr = ba,
                                    Xe = Wd - $.offset,
                                    he = $.length;
                                for (Kt < he && (he = Kt),
                                Kt -= he,
                                $.length -= he; ba[Wd++] = jr[Xe++],
                                --he; )
                                    ;
                                $.length === 0 && ($.mode = 21);
                                break;
                            case 26:
                                if (Kt === 0)
                                    break e;
                                ba[Wd++] = $.length,
                                Kt--,
                                $.mode = 21;
                                break;
                            case 27:
                                if ($.wrap) {
                                    for (; Ht < 32; ) {
                                        if (Mr === 0)
                                            break e;
                                        Mr--,
                                        lt |= pt[us++] << Ht,
                                        Ht += 8
                                    }
                                    if (G -= Kt,
                                    I.total_out += G,
                                    $.total += G,
                                    G && (I.adler = $.check = $.flags ? l($.check, ba, G, Wd - G) : o($.check, ba, G, Wd - G)),
                                    G = Kt,
                                    ($.flags ? lt : b(lt)) !== $.check) {
                                        I.msg = "incorrect data check",
                                        $.mode = 30;
                                        break
                                    }
                                    Ht = lt = 0
                                }
                                $.mode = 28;
                            case 28:
                                if ($.wrap && $.flags) {
                                    for (; Ht < 32; ) {
                                        if (Mr === 0)
                                            break e;
                                        Mr--,
                                        lt += pt[us++] << Ht,
                                        Ht += 8
                                    }
                                    if (lt !== (4294967295 & $.total)) {
                                        I.msg = "incorrect length check",
                                        $.mode = 30;
                                        break
                                    }
                                    Ht = lt = 0
                                }
                                $.mode = 29;
                            case 29:
                                R0 = 1;
                                break e;
                            case 30:
                                R0 = -3;
                                break e;
                            case 31:
                                return -4;
                            case 32:
                            default:
                                return h
                            }
                        return I.next_out = Wd,
                        I.avail_out = Kt,
                        I.next_in = us,
                        I.avail_in = Mr,
                        $.hold = lt,
                        $.bits = Ht,
                        ($.wsize || G !== I.avail_out && $.mode < 30 && ($.mode < 27 || M !== 4)) && ve(I, I.output, I.next_out, G - I.avail_out) ? ($.mode = 31,
                        -4) : ($e -= I.avail_in,
                        G -= I.avail_out,
                        I.total_in += $e,
                        I.total_out += G,
                        $.total += G,
                        $.wrap && G && (I.adler = $.check = $.flags ? l($.check, ba, G, I.next_out - G) : o($.check, ba, G, I.next_out - G)),
                        I.data_type = $.bits + ($.last ? 64 : 0) + ($.mode === 12 ? 128 : 0) + ($.mode === 20 || $.mode === 15 ? 256 : 0),
                        ($e == 0 && G === 0 || M === 4) && R0 === f && (R0 = -5),
                        R0)
                    }
                    ,
                    a.inflateEnd = function(I) {
                        if (!I || !I.state)
                            return h;
                        var M = I.state;
                        return M.window && (M.window = null),
                        I.state = null,
                        f
                    }
                    ,
                    a.inflateGetHeader = function(I, M) {
                        var $;
                        return I && I.state ? (2 & ($ = I.state).wrap) == 0 ? h : (($.head = M).done = !1,
                        f) : h
                    }
                    ,
                    a.inflateSetDictionary = function(I, M) {
                        var $, pt = M.length;
                        return I && I.state ? ($ = I.state).wrap !== 0 && $.mode !== 11 ? h : $.mode === 11 && o(1, M, pt, 0) !== $.check ? -3 : ve(I, M, pt, pt) ? ($.mode = 31,
                        -4) : ($.havedict = 1,
                        f) : h
                    }
                    ,
                    a.inflateInfo = "pako inflate (from Nodeca project)"
                }
                , {
                    "../utils/common": 41,
                    "./adler32": 43,
                    "./crc32": 45,
                    "./inffast": 48,
                    "./inftrees": 50
                }],
                50: [function(r, n, a) {
                    var s = r("../utils/common")
                      , o = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258, 0, 0]
                      , l = [16, 16, 16, 16, 16, 16, 16, 16, 17, 17, 17, 17, 18, 18, 18, 18, 19, 19, 19, 19, 20, 20, 20, 20, 21, 21, 21, 21, 16, 72, 78]
                      , u = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577, 0, 0]
                      , c = [16, 16, 16, 16, 17, 17, 18, 18, 19, 19, 20, 20, 21, 21, 22, 22, 23, 23, 24, 24, 25, 25, 26, 26, 27, 27, 28, 28, 29, 29, 64, 64];
                    n.exports = function(p, d, f, h, m, g, x, b) {
                        var y, w, R, T, C, P, W, ue, ce, ve = b.bits, I = 0, M = 0, $ = 0, pt = 0, ba = 0, us = 0, Wd = 0, Mr = 0, Kt = 0, lt = 0, Ht = null, $e = 0, G = new s.Buf16(16), he = new s.Buf16(16), Xe = null, jr = 0;
                        for (I = 0; I <= 15; I++)
                            G[I] = 0;
                        for (M = 0; M < h; M++)
                            G[d[f + M]]++;
                        for (ba = ve,
                        pt = 15; 1 <= pt && G[pt] === 0; pt--)
                            ;
                        if (pt < ba && (ba = pt),
                        pt === 0)
                            return m[g++] = 20971520,
                            m[g++] = 20971520,
                            b.bits = 1,
                            0;
                        for ($ = 1; $ < pt && G[$] === 0; $++)
                            ;
                        for (ba < $ && (ba = $),
                        I = Mr = 1; I <= 15; I++)
                            if (Mr <<= 1,
                            (Mr -= G[I]) < 0)
                                return -1;
                        if (0 < Mr && (p === 0 || pt !== 1))
                            return -1;
                        for (he[1] = 0,
                        I = 1; I < 15; I++)
                            he[I + 1] = he[I] + G[I];
                        for (M = 0; M < h; M++)
                            d[f + M] !== 0 && (x[he[d[f + M]]++] = M);
                        if (P = p === 0 ? (Ht = Xe = x,
                        19) : p === 1 ? (Ht = o,
                        $e -= 257,
                        Xe = l,
                        jr -= 257,
                        256) : (Ht = u,
                        Xe = c,
                        -1),
                        I = $,
                        C = g,
                        Wd = M = lt = 0,
                        R = -1,
                        T = (Kt = 1 << (us = ba)) - 1,
                        p === 1 && 852 < Kt || p === 2 && 592 < Kt)
                            return 1;
                        for (; ; ) {
                            for (W = I - Wd,
                            ce = x[M] < P ? (ue = 0,
                            x[M]) : x[M] > P ? (ue = Xe[jr + x[M]],
                            Ht[$e + x[M]]) : (ue = 96,
                            0),
                            y = 1 << I - Wd,
                            $ = w = 1 << us; m[C + (lt >> Wd) + (w -= y)] = W << 24 | ue << 16 | ce | 0,
                            w !== 0; )
                                ;
                            for (y = 1 << I - 1; lt & y; )
                                y >>= 1;
                            if (y !== 0 ? (lt &= y - 1,
                            lt += y) : lt = 0,
                            M++,
                            --G[I] == 0) {
                                if (I === pt)
                                    break;
                                I = d[f + x[M]]
                            }
                            if (ba < I && (lt & T) !== R) {
                                for (Wd === 0 && (Wd = ba),
                                C += $,
                                Mr = 1 << (us = I - Wd); us + Wd < pt && !((Mr -= G[us + Wd]) <= 0); )
                                    us++,
                                    Mr <<= 1;
                                if (Kt += 1 << us,
                                p === 1 && 852 < Kt || p === 2 && 592 < Kt)
                                    return 1;
                                m[R = lt & T] = ba << 24 | us << 16 | C - g | 0
                            }
                        }
                        return lt !== 0 && (m[C + lt] = I - Wd << 24 | 64 << 16 | 0),
                        b.bits = ba,
                        0
                    }
                }
                , {
                    "../utils/common": 41
                }],
                51: [function(r, n, a) {
                    n.exports = {
                        2: "need dictionary",
                        1: "stream end",
                        0: "",
                        "-1": "file error",
                        "-2": "stream error",
                        "-3": "data error",
                        "-4": "insufficient memory",
                        "-5": "buffer error",
                        "-6": "incompatible version"
                    }
                }
                , {}],
                52: [function(r, n, a) {
                    var s = r("../utils/common")
                      , o = 0
                      , l = 1;
                    function u(go) {
                        for (var Yl = go.length; 0 <= --Yl; )
                            go[Yl] = 0
                    }
                    var c = 0
                      , p = 29
                      , d = 256
                      , f = d + 1 + p
                      , h = 30
                      , m = 19
                      , g = 2 * f + 1
                      , x = 15
                      , b = 16
                      , y = 7
                      , w = 256
                      , R = 16
                      , T = 17
                      , C = 18
                      , P = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0]
                      , W = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13]
                      , ue = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7]
                      , ce = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]
                      , ve = new Array(2 * (f + 2));
                    u(ve);
                    var I = new Array(2 * h);
                    u(I);
                    var M = new Array(512);
                    u(M);
                    var $ = new Array(256);
                    u($);
                    var pt = new Array(p);
                    u(pt);
                    var ba, us, Wd, Mr = new Array(h);
                    function Kt(go, Yl, lv, Ox, ev) {
                        this.static_tree = go,
                        this.extra_bits = Yl,
                        this.extra_base = lv,
                        this.elems = Ox,
                        this.max_length = ev,
                        this.has_stree = go && go.length
                    }
                    function lt(go, Yl) {
                        this.dyn_tree = go,
                        this.max_code = 0,
                        this.stat_desc = Yl
                    }
                    function Ht(go) {
                        return go < 256 ? M[go] : M[256 + (go >>> 7)]
                    }
                    function $e(go, Yl) {
                        go.pending_buf[go.pending++] = 255 & Yl,
                        go.pending_buf[go.pending++] = Yl >>> 8 & 255
                    }
                    function G(go, Yl, lv) {
                        go.bi_valid > b - lv ? (go.bi_buf |= Yl << go.bi_valid & 65535,
                        $e(go, go.bi_buf),
                        go.bi_buf = Yl >> b - go.bi_valid,
                        go.bi_valid += lv - b) : (go.bi_buf |= Yl << go.bi_valid & 65535,
                        go.bi_valid += lv)
                    }
                    function he(go, Yl, lv) {
                        G(go, lv[2 * Yl], lv[2 * Yl + 1])
                    }
                    function Xe(go, Yl) {
                        for (var lv = 0; lv |= 1 & go,
                        go >>>= 1,
                        lv <<= 1,
                        0 < --Yl; )
                            ;
                        return lv >>> 1
                    }
                    function jr(go, Yl, lv) {
                        var Ox, ev, iv = new Array(x + 1), N = 0;
                        for (Ox = 1; Ox <= x; Ox++)
                            iv[Ox] = N = N + lv[Ox - 1] << 1;
                        for (ev = 0; ev <= Yl; ev++) {
                            var bi = go[2 * ev + 1];
                            bi !== 0 && (go[2 * ev] = Xe(iv[bi]++, bi))
                        }
                    }
                    function fs(go) {
                        var Yl;
                        for (Yl = 0; Yl < f; Yl++)
                            go.dyn_ltree[2 * Yl] = 0;
                        for (Yl = 0; Yl < h; Yl++)
                            go.dyn_dtree[2 * Yl] = 0;
                        for (Yl = 0; Yl < m; Yl++)
                            go.bl_tree[2 * Yl] = 0;
                        go.dyn_ltree[2 * w] = 1,
                        go.opt_len = go.static_len = 0,
                        go.last_lit = go.matches = 0
                    }
                    function bf(go) {
                        8 < go.bi_valid ? $e(go, go.bi_buf) : 0 < go.bi_valid && (go.pending_buf[go.pending++] = go.bi_buf),
                        go.bi_buf = 0,
                        go.bi_valid = 0
                    }
                    function $0(go, Yl, lv, Ox) {
                        var ev = 2 * Yl
                          , iv = 2 * lv;
                        return go[ev] < go[iv] || go[ev] === go[iv] && Ox[Yl] <= Ox[lv]
                    }
                    function ie(go, Yl, lv) {
                        for (var Ox = go.heap[lv], ev = lv << 1; ev <= go.heap_len && (ev < go.heap_len && $0(Yl, go.heap[ev + 1], go.heap[ev], go.depth) && ev++,
                        !$0(Yl, Ox, go.heap[ev], go.depth)); )
                            go.heap[lv] = go.heap[ev],
                            lv = ev,
                            ev <<= 1;
                        go.heap[lv] = Ox
                    }
                    function He(go, Yl, lv) {
                        var Ox, ev, iv, N, bi = 0;
                        if (go.last_lit !== 0)
                            for (; Ox = go.pending_buf[go.d_buf + 2 * bi] << 8 | go.pending_buf[go.d_buf + 2 * bi + 1],
                            ev = go.pending_buf[go.l_buf + bi],
                            bi++,
                            Ox === 0 ? he(go, ev, Yl) : (he(go, (iv = $[ev]) + d + 1, Yl),
                            (N = P[iv]) !== 0 && G(go, ev -= pt[iv], N),
                            he(go, iv = Ht(--Ox), lv),
                            (N = W[iv]) !== 0 && G(go, Ox -= Mr[iv], N)),
                            bi < go.last_lit; )
                                ;
                        he(go, w, Yl)
                    }
                    function mm(go, Yl) {
                        var lv, Ox, ev, iv = Yl.dyn_tree, N = Yl.stat_desc.static_tree, bi = Yl.stat_desc.has_stree, Rx = Yl.stat_desc.elems, sv = -1;
                        for (go.heap_len = 0,
                        go.heap_max = g,
                        lv = 0; lv < Rx; lv++)
                            iv[2 * lv] !== 0 ? (go.heap[++go.heap_len] = sv = lv,
                            go.depth[lv] = 0) : iv[2 * lv + 1] = 0;
                        for (; go.heap_len < 2; )
                            iv[2 * (ev = go.heap[++go.heap_len] = sv < 2 ? ++sv : 0)] = 1,
                            go.depth[ev] = 0,
                            go.opt_len--,
                            bi && (go.static_len -= N[2 * ev + 1]);
                        for (Yl.max_code = sv,
                        lv = go.heap_len >> 1; 1 <= lv; lv--)
                            ie(go, iv, lv);
                        for (ev = Rx; lv = go.heap[1],
                        go.heap[1] = go.heap[go.heap_len--],
                        ie(go, iv, 1),
                        Ox = go.heap[1],
                        go.heap[--go.heap_max] = lv,
                        go.heap[--go.heap_max] = Ox,
                        iv[2 * ev] = iv[2 * lv] + iv[2 * Ox],
                        go.depth[ev] = (go.depth[lv] >= go.depth[Ox] ? go.depth[lv] : go.depth[Ox]) + 1,
                        iv[2 * lv + 1] = iv[2 * Ox + 1] = ev,
                        go.heap[1] = ev++,
                        ie(go, iv, 1),
                        2 <= go.heap_len; )
                            ;
                        go.heap[--go.heap_max] = go.heap[1],
                        (function(h0, av) {
                            var L, A, F, Qt, ps, pr, mo = av.dyn_tree, Lt = av.max_code, rv = av.stat_desc.static_tree, Ev = av.stat_desc.has_stree, re = av.stat_desc.extra_bits, dv = av.stat_desc.extra_base, mv = av.stat_desc.max_length, zm = 0;
                            for (Qt = 0; Qt <= x; Qt++)
                                h0.bl_count[Qt] = 0;
                            for (mo[2 * h0.heap[h0.heap_max] + 1] = 0,
                            L = h0.heap_max + 1; L < g; L++)
                                mv < (Qt = mo[2 * mo[2 * (A = h0.heap[L]) + 1] + 1] + 1) && (Qt = mv,
                                zm++),
                                mo[2 * A + 1] = Qt,
                                Lt < A || (h0.bl_count[Qt]++,
                                ps = 0,
                                dv <= A && (ps = re[A - dv]),
                                pr = mo[2 * A],
                                h0.opt_len += pr * (Qt + ps),
                                Ev && (h0.static_len += pr * (rv[2 * A + 1] + ps)));
                            if (zm !== 0) {
                                do {
                                    for (Qt = mv - 1; h0.bl_count[Qt] === 0; )
                                        Qt--;
                                    h0.bl_count[Qt]--,
                                    h0.bl_count[Qt + 1] += 2,
                                    h0.bl_count[mv]--,
                                    zm -= 2
                                } while (0 < zm);
                                for (Qt = mv; Qt !== 0; Qt--)
                                    for (A = h0.bl_count[Qt]; A !== 0; )
                                        Lt < (F = h0.heap[--L]) || (mo[2 * F + 1] !== Qt && (h0.opt_len += (Qt - mo[2 * F + 1]) * mo[2 * F],
                                        mo[2 * F + 1] = Qt),
                                        A--)
                            }
                        }
                        )(go, Yl),
                        jr(iv, sv, go.bl_count)
                    }
                    function Oe(go, Yl, lv) {
                        var Ox, ev, iv = -1, N = Yl[1], bi = 0, Rx = 7, sv = 4;
                        for (N === 0 && (Rx = 138,
                        sv = 3),
                        Yl[2 * (lv + 1) + 1] = 65535,
                        Ox = 0; Ox <= lv; Ox++)
                            ev = N,
                            N = Yl[2 * (Ox + 1) + 1],
                            ++bi < Rx && ev === N || (bi < sv ? go.bl_tree[2 * ev] += bi : ev !== 0 ? (ev !== iv && go.bl_tree[2 * ev]++,
                            go.bl_tree[2 * R]++) : bi <= 10 ? go.bl_tree[2 * T]++ : go.bl_tree[2 * C]++,
                            iv = ev,
                            sv = (bi = 0) === N ? (Rx = 138,
                            3) : ev === N ? (Rx = 6,
                            3) : (Rx = 7,
                            4))
                    }
                    function R0(go, Yl, lv) {
                        var Ox, ev, iv = -1, N = Yl[1], bi = 0, Rx = 7, sv = 4;
                        for (N === 0 && (Rx = 138,
                        sv = 3),
                        Ox = 0; Ox <= lv; Ox++)
                            if (ev = N,
                            N = Yl[2 * (Ox + 1) + 1],
                            !(++bi < Rx && ev === N)) {
                                if (bi < sv)
                                    for (; he(go, ev, go.bl_tree),
                                    --bi != 0; )
                                        ;
                                else
                                    ev !== 0 ? (ev !== iv && (he(go, ev, go.bl_tree),
                                    bi--),
                                    he(go, R, go.bl_tree),
                                    G(go, bi - 3, 2)) : bi <= 10 ? (he(go, T, go.bl_tree),
                                    G(go, bi - 3, 3)) : (he(go, C, go.bl_tree),
                                    G(go, bi - 11, 7));
                                iv = ev,
                                sv = (bi = 0) === N ? (Rx = 138,
                                3) : ev === N ? (Rx = 6,
                                3) : (Rx = 7,
                                4)
                            }
                    }
                    u(Mr);
                    var gm = !1;
                    function $s(go, Yl, lv, Ox) {
                        G(go, (c << 1) + (Ox ? 1 : 0), 3),
                        (function(ev, iv, N, bi) {
                            bf(ev),
                            $e(ev, N),
                            $e(ev, ~N),
                            s.arraySet(ev.pending_buf, ev.window, iv, N, ev.pending),
                            ev.pending += N
                        }
                        )(go, Yl, lv)
                    }
                    a._tr_init = function(go) {
                        gm || ((function() {
                            var Yl, lv, Ox, ev, iv, N = new Array(x + 1);
                            for (ev = Ox = 0; ev < p - 1; ev++)
                                for (pt[ev] = Ox,
                                Yl = 0; Yl < 1 << P[ev]; Yl++)
                                    $[Ox++] = ev;
                            for ($[Ox - 1] = ev,
                            ev = iv = 0; ev < 16; ev++)
                                for (Mr[ev] = iv,
                                Yl = 0; Yl < 1 << W[ev]; Yl++)
                                    M[iv++] = ev;
                            for (iv >>= 7; ev < h; ev++)
                                for (Mr[ev] = iv << 7,
                                Yl = 0; Yl < 1 << W[ev] - 7; Yl++)
                                    M[256 + iv++] = ev;
                            for (lv = 0; lv <= x; lv++)
                                N[lv] = 0;
                            for (Yl = 0; Yl <= 143; )
                                ve[2 * Yl + 1] = 8,
                                Yl++,
                                N[8]++;
                            for (; Yl <= 255; )
                                ve[2 * Yl + 1] = 9,
                                Yl++,
                                N[9]++;
                            for (; Yl <= 279; )
                                ve[2 * Yl + 1] = 7,
                                Yl++,
                                N[7]++;
                            for (; Yl <= 287; )
                                ve[2 * Yl + 1] = 8,
                                Yl++,
                                N[8]++;
                            for (jr(ve, f + 1, N),
                            Yl = 0; Yl < h; Yl++)
                                I[2 * Yl + 1] = 5,
                                I[2 * Yl] = Xe(Yl, 5);
                            ba = new Kt(ve,P,d + 1,f,x),
                            us = new Kt(I,W,0,h,x),
                            Wd = new Kt(new Array(0),ue,0,m,y)
                        }
                        )(),
                        gm = !0),
                        go.l_desc = new lt(go.dyn_ltree,ba),
                        go.d_desc = new lt(go.dyn_dtree,us),
                        go.bl_desc = new lt(go.bl_tree,Wd),
                        go.bi_buf = 0,
                        go.bi_valid = 0,
                        fs(go)
                    }
                    ,
                    a._tr_stored_block = $s,
                    a._tr_flush_block = function(go, Yl, lv, Ox) {
                        var ev, iv, N = 0;
                        0 < go.level ? (go.strm.data_type === 2 && (go.strm.data_type = (function(bi) {
                            var Rx, sv = 4093624447;
                            for (Rx = 0; Rx <= 31; Rx++,
                            sv >>>= 1)
                                if (1 & sv && bi.dyn_ltree[2 * Rx] !== 0)
                                    return o;
                            if (bi.dyn_ltree[18] !== 0 || bi.dyn_ltree[20] !== 0 || bi.dyn_ltree[26] !== 0)
                                return l;
                            for (Rx = 32; Rx < d; Rx++)
                                if (bi.dyn_ltree[2 * Rx] !== 0)
                                    return l;
                            return o
                        }
                        )(go)),
                        mm(go, go.l_desc),
                        mm(go, go.d_desc),
                        N = (function(bi) {
                            var Rx;
                            for (Oe(bi, bi.dyn_ltree, bi.l_desc.max_code),
                            Oe(bi, bi.dyn_dtree, bi.d_desc.max_code),
                            mm(bi, bi.bl_desc),
                            Rx = m - 1; 3 <= Rx && bi.bl_tree[2 * ce[Rx] + 1] === 0; Rx--)
                                ;
                            return bi.opt_len += 3 * (Rx + 1) + 5 + 5 + 4,
                            Rx
                        }
                        )(go),
                        ev = go.opt_len + 3 + 7 >>> 3,
                        (iv = go.static_len + 3 + 7 >>> 3) <= ev && (ev = iv)) : ev = iv = lv + 5,
                        lv + 4 <= ev && Yl !== -1 ? $s(go, Yl, lv, Ox) : go.strategy === 4 || iv === ev ? (G(go, 2 + (Ox ? 1 : 0), 3),
                        He(go, ve, I)) : (G(go, 4 + (Ox ? 1 : 0), 3),
                        (function(bi, Rx, sv, h0) {
                            var av;
                            for (G(bi, Rx - 257, 5),
                            G(bi, sv - 1, 5),
                            G(bi, h0 - 4, 4),
                            av = 0; av < h0; av++)
                                G(bi, bi.bl_tree[2 * ce[av] + 1], 3);
                            R0(bi, bi.dyn_ltree, Rx - 1),
                            R0(bi, bi.dyn_dtree, sv - 1)
                        }
                        )(go, go.l_desc.max_code + 1, go.d_desc.max_code + 1, N + 1),
                        He(go, go.dyn_ltree, go.dyn_dtree)),
                        fs(go),
                        Ox && bf(go)
                    }
                    ,
                    a._tr_tally = function(go, Yl, lv) {
                        return go.pending_buf[go.d_buf + 2 * go.last_lit] = Yl >>> 8 & 255,
                        go.pending_buf[go.d_buf + 2 * go.last_lit + 1] = 255 & Yl,
                        go.pending_buf[go.l_buf + go.last_lit] = 255 & lv,
                        go.last_lit++,
                        Yl === 0 ? go.dyn_ltree[2 * lv]++ : (go.matches++,
                        Yl--,
                        go.dyn_ltree[2 * ($[lv] + d + 1)]++,
                        go.dyn_dtree[2 * Ht(Yl)]++),
                        go.last_lit === go.lit_bufsize - 1
                    }
                    ,
                    a._tr_align = function(go) {
                        G(go, 2, 3),
                        he(go, w, ve),
                        (function(Yl) {
                            Yl.bi_valid === 16 ? ($e(Yl, Yl.bi_buf),
                            Yl.bi_buf = 0,
                            Yl.bi_valid = 0) : 8 <= Yl.bi_valid && (Yl.pending_buf[Yl.pending++] = 255 & Yl.bi_buf,
                            Yl.bi_buf >>= 8,
                            Yl.bi_valid -= 8)
                        }
                        )(go)
                    }
                }
                , {
                    "../utils/common": 41
                }],
                53: [function(r, n, a) {
                    n.exports = function() {
                        this.input = null,
                        this.next_in = 0,
                        this.avail_in = 0,
                        this.total_in = 0,
                        this.output = null,
                        this.next_out = 0,
                        this.avail_out = 0,
                        this.total_out = 0,
                        this.msg = "",
                        this.state = null,
                        this.data_type = 2,
                        this.adler = 0
                    }
                }
                , {}],
                54: [function(r, n, a) {
                    (function(s) {
                        (function(o, l) {
                            if (!o.setImmediate) {
                                var u, c, p, d, f = 1, h = {}, m = !1, g = o.document, x = Object.getPrototypeOf && Object.getPrototypeOf(o);
                                x = x && x.setTimeout ? x : o,
                                u = {}.toString.call(o.process) === "[object process]" ? function(R) {
                                    process$1.nextTick(function() {
                                        y(R)
                                    })
                                }
                                : (function() {
                                    if (o.postMessage && !o.importScripts) {
                                        var R = !0
                                          , T = o.onmessage;
                                        return o.onmessage = function() {
                                            R = !1
                                        }
                                        ,
                                        o.postMessage("", "*"),
                                        o.onmessage = T,
                                        R
                                    }
                                }
                                )() ? (d = "setImmediate$" + Math.random() + "$",
                                o.addEventListener ? o.addEventListener("message", w, !1) : o.attachEvent("onmessage", w),
                                function(R) {
                                    o.postMessage(d + R, "*")
                                }
                                ) : o.MessageChannel ? ((p = new MessageChannel).port1.onmessage = function(R) {
                                    y(R.data)
                                }
                                ,
                                function(R) {
                                    p.port2.postMessage(R)
                                }
                                ) : g && "onreadystatechange"in g.createElement("script") ? (c = g.documentElement,
                                function(R) {
                                    var T = g.createElement("script");
                                    T.onreadystatechange = function() {
                                        y(R),
                                        T.onreadystatechange = null,
                                        c.removeChild(T),
                                        T = null
                                    }
                                    ,
                                    c.appendChild(T)
                                }
                                ) : function(R) {
                                    setTimeout(y, 0, R)
                                }
                                ,
                                x.setImmediate = function(R) {
                                    typeof R != "function" && (R = new Function("" + R));
                                    for (var T = new Array(arguments.length - 1), C = 0; C < T.length; C++)
                                        T[C] = arguments[C + 1];
                                    var P = {
                                        callback: R,
                                        args: T
                                    };
                                    return h[f] = P,
                                    u(f),
                                    f++
                                }
                                ,
                                x.clearImmediate = b
                            }
                            function b(R) {
                                delete h[R]
                            }
                            function y(R) {
                                if (m)
                                    setTimeout(y, 0, R);
                                else {
                                    var T = h[R];
                                    if (T) {
                                        m = !0;
                                        try {
                                            (function(C) {
                                                var P = C.callback
                                                  , W = C.args;
                                                switch (W.length) {
                                                case 0:
                                                    P();
                                                    break;
                                                case 1:
                                                    P(W[0]);
                                                    break;
                                                case 2:
                                                    P(W[0], W[1]);
                                                    break;
                                                case 3:
                                                    P(W[0], W[1], W[2]);
                                                    break;
                                                default:
                                                    P.apply(l, W)
                                                }
                                            }
                                            )(T)
                                        } finally {
                                            b(R),
                                            m = !1
                                        }
                                    }
                                }
                            }
                            function w(R) {
                                R.source === o && typeof R.data == "string" && R.data.indexOf(d) === 0 && y(+R.data.slice(d.length))
                            }
                        }
                        )(typeof self > "u" ? s === void 0 ? this : s : self)
                    }
                    ).call(this, typeof commonjsGlobal < "u" ? commonjsGlobal : typeof self < "u" ? self : typeof window < "u" ? window : {})
                }
                , {}]
            }, {}, [10])(10)
        })
    }
    )(jszip_min)),
    jszip_min.exports
}
var jszip_minExports = requireJszip_min();
const JSZip = getDefaultExportFromCjs(jszip_minExports)
  , log$1 = logger.scoped("file-explorer");
function LoadingSkeleton() {
    return jsxRuntimeExports.jsx("div", {
        className: "space-y-1 p-2",
        children: [1, 2, 3, 4, 5].map(e => jsxRuntimeExports.jsxs("div", {
            className: "flex items-center gap-2 px-2 py-1",
            children: [jsxRuntimeExports.jsx(Skeleton, {
                className: "h-4 w-4 shrink-0"
            }), jsxRuntimeExports.jsx(Skeleton, {
                className: "h-4 flex-1"
            })]
        }, e))
    })
}
function EmptyState() {
    return jsxRuntimeExports.jsxs("div", {
        className: "flex flex-col items-center justify-center py-12 text-center px-4",
        children: [jsxRuntimeExports.jsx("div", {
            className: "flex items-center justify-center size-14 rounded-xl bg-muted mb-3",
            children: jsxRuntimeExports.jsx(FolderOpen, {
                className: "size-7 text-muted-foreground"
            })
        }), jsxRuntimeExports.jsx("p", {
            className: "text-base font-medium text-foreground",
            children: "No files yet"
        }), jsxRuntimeExports.jsx("p", {
            className: "text-sm text-muted-foreground mt-1",
            children: "Drag and drop files here, or use the import button."
        }), jsxRuntimeExports.jsx("p", {
            className: "text-sm text-muted-foreground",
            children: "Files created by the AI agent will also appear here."
        })]
    })
}
function NoSearchResults() {
    return jsxRuntimeExports.jsx("div", {
        className: "flex flex-col items-center justify-center py-12 text-center px-4",
        children: jsxRuntimeExports.jsx("p", {
            className: "text-sm text-muted-foreground",
            children: "No files match your search"
        })
    })
}
function FileExplorer({onOpenFile: e}) {
    const {files: t, allFiles: r, expandedPaths: n, selectedPaths: a, searchQuery: s, isLoading: o, error: l, draggedPath: u, dropTargetPath: c, renamingPath: p, setSearchQuery: d, toggleExpanded: f, expandPath: h, collapsePath: m, selectItem: g, toggleItemInSelection: x, selectRange: b, selectAll: y, clearSelection: w, deleteItems: R, renameItem: T, moveItem: C, createFile: P, createFolder: W, setDraggedPath: ue, setDropTargetPath: ce, setRenamingPath: ve, getNodeAtPath: I} = useFileExplorer()
      , [M,$] = reactExports.useState({
        isOpen: !1,
        position: {
            x: 0,
            y: 0
        },
        node: null
    })
      , [pt,ba] = reactExports.useState({
        isOpen: !1,
        paths: []
    })
      , us = reactExports.useRef(null)
      , Wd = reactExports.useRef(null)
      , [Mr,Kt] = reactExports.useState(!1)
      , lt = reactExports.useRef(null)
      , Ht = reactExports.useCallback( (A, F) => {
        F.shiftKey ? b(A) : F.metaKey || F.ctrlKey ? x(A) : g(A)
    }
    , [b, x, g])
      , $e = reactExports.useCallback(A => {
        A.type === "file" ? e(A.path) : f(A.path)
    }
    , [e, f])
      , G = reactExports.useCallback( (A, F) => {
        A.preventDefault(),
        a.has(F.path) || g(F.path),
        $({
            isOpen: !0,
            position: {
                x: A.clientX,
                y: A.clientY
            },
            node: F
        })
    }
    , [a, g])
      , he = reactExports.useCallback( () => {
        M.node?.type === "file" && e(M.node.path)
    }
    , [M.node, e])
      , Xe = reactExports.useCallback(async () => {
        if (M.node)
            try {
                const A = await getUnifiedFsInstance();
                if (M.node.type === "file") {
                    const F = await A.readFileBuffer(M.node.path)
                      , Qt = new ArrayBuffer(F.byteLength);
                    new Uint8Array(Qt).set(F);
                    const ps = new Blob([Qt])
                      , pr = URL.createObjectURL(ps)
                      , mo = document.createElement("a");
                    mo.href = pr,
                    mo.download = M.node.name,
                    document.body.appendChild(mo),
                    mo.click(),
                    document.body.removeChild(mo),
                    URL.revokeObjectURL(pr)
                } else {
                    const F = new JSZip
                      , Qt = M.node.path
                      , ps = M.node.name
                      , pr = async (Ev, re) => {
                        const dv = await A.readdir(Ev);
                        for (const mv of dv) {
                            const zm = mv.endsWith("/") ? mv.slice(0, -1) : mv
                              , uv = `${Ev}/${zm}`;
                            if ((await A.stat(uv)).isDirectory) {
                                const Dv = re.folder(zm);
                                Dv && await pr(uv, Dv)
                            } else {
                                const Dv = await A.readFileBuffer(uv);
                                re.file(zm, Dv)
                            }
                        }
                    }
                    ;
                    await pr(Qt, F);
                    const mo = await F.generateAsync({
                        type: "blob"
                    })
                      , Lt = URL.createObjectURL(mo)
                      , rv = document.createElement("a");
                    rv.href = Lt,
                    rv.download = `${ps}.zip`,
                    document.body.appendChild(rv),
                    rv.click(),
                    document.body.removeChild(rv),
                    URL.revokeObjectURL(Lt)
                }
            } catch (A) {
                log$1.error("Download failed:", A)
            }
    }
    , [M.node])
      , jr = reactExports.useCallback(async () => {
        const A = [...a][0];
        if (!A)
            return;
        const F = chrome.runtime.getURL(`editor.html?file=${encodeURIComponent(A)}`)
          , ps = (await chrome.tabs.query({})).find(pr => pr.url === F);
        ps?.id ? (await chrome.tabs.update(ps.id, {
            active: !0
        }),
        ps.windowId && await chrome.windows.update(ps.windowId, {
            focused: !0
        })) : chrome.tabs.create({
            url: F
        })
    }
    , [a])
      , fs = reactExports.useCallback(async () => {
        try {
            let A = "/workspace";
            M.node && (M.node.type === "directory" ? A = M.node.path : A = M.node.path.substring(0, M.node.path.lastIndexOf("/")) || "/workspace"),
            A === "/mnt" && (A = "/workspace");
            const F = await P(A, "untitled.txt");
            h(A),
            ve(F),
            g(F),
            Wd.current = F
        } catch (A) {
            log$1.error("Failed to create file:", A)
        }
    }
    , [M.node, P, h, ve, g])
      , bf = reactExports.useCallback(async () => {
        try {
            let A = "/workspace";
            M.node && (M.node.type === "directory" ? A = M.node.path : A = M.node.path.substring(0, M.node.path.lastIndexOf("/")) || "/workspace"),
            A === "/mnt" && (A = "/workspace");
            const F = await W(A, "untitled");
            h(A),
            ve(F),
            g(F)
        } catch (A) {
            log$1.error("Failed to create folder:", A)
        }
    }
    , [M.node, W, h, ve, g])
      , $0 = reactExports.useCallback(A => {
        A.target.closest("[data-path]") || (A.preventDefault(),
        $({
            isOpen: !0,
            position: {
                x: A.clientX,
                y: A.clientY
            },
            node: null
        }))
    }
    , [])
      , ie = reactExports.useCallback( () => {
        M.node && ve(M.node.path)
    }
    , [M.node, ve])
      , He = reactExports.useCallback( () => {
        const A = [...a];
        A.length > 0 && ba({
            isOpen: !0,
            paths: A
        })
    }
    , [a])
      , mm = reactExports.useCallback(async () => {
        try {
            await R(pt.paths),
            ba({
                isOpen: !1,
                paths: []
            })
        } catch (A) {
            log$1.error("Delete failed:", A)
        }
    }
    , [R, pt.paths])
      , Oe = reactExports.useCallback(async (A, F) => {
        try {
            if (await T(A, F),
            Wd.current === A) {
                const ps = `${A.substring(0, A.lastIndexOf("/")) || "/workspace"}/${F}`;
                Wd.current = null;
                const pr = chrome.runtime.getURL(`editor.html?file=${encodeURIComponent(ps)}`);
                chrome.tabs.create({
                    url: pr
                })
            }
        } catch (Qt) {
            log$1.error("Rename failed:", Qt)
        }
    }
    , [T])
      , R0 = reactExports.useCallback(A => {
        ue(A)
    }
    , [ue])
      , gm = reactExports.useCallback(A => {
        u && A !== u && !A.startsWith(u + "/") && ce(A)
    }
    , [u, ce])
      , $s = reactExports.useCallback( () => {
        ce(null)
    }
    , [ce])
      , go = reactExports.useCallback(async (A, F) => {
        try {
            await C(A, F)
        } catch (Qt) {
            log$1.error("Move failed:", Qt)
        }
    }
    , [C])
      , Yl = reactExports.useCallback( () => {
        ue(null),
        ce(null)
    }
    , [ue, ce])
      , lv = reactExports.useCallback(A => {
        A.preventDefault(),
        A.stopPropagation(),
        A.dataTransfer?.types.includes("Files") && Kt(!0)
    }
    , [])
      , Ox = reactExports.useCallback(A => {
        A.preventDefault(),
        A.stopPropagation();
        const F = A.relatedTarget;
        lt.current?.contains(F) || Kt(!1)
    }
    , [])
      , ev = reactExports.useCallback(A => {
        A.preventDefault(),
        A.stopPropagation(),
        A.dataTransfer && (A.dataTransfer.dropEffect = "copy")
    }
    , [])
      , iv = reactExports.useCallback(async (A, F, Qt) => {
        const ps = `${F}/${A.name}`;
        if (A.isFile) {
            const pr = A
              , mo = await new Promise( (rv, Ev) => {
                pr.file(rv, Ev)
            }
            )
              , Lt = new Uint8Array(await mo.arrayBuffer());
            await Qt.writeFile(ps, Lt)
        } else if (A.isDirectory) {
            const pr = A;
            await Qt.mkdir(ps, {
                recursive: !0
            });
            const mo = pr.createReader()
              , Lt = await new Promise( (rv, Ev) => {
                const re = []
                  , dv = () => {
                    mo.readEntries(mv => {
                        mv.length === 0 ? rv(re) : (re.push(...mv),
                        dv())
                    }
                    , Ev)
                }
                ;
                dv()
            }
            );
            for (const rv of Lt)
                await iv(rv, ps, Qt)
        }
    }
    , [])
      , N = reactExports.useCallback(async A => {
        A.preventDefault(),
        A.stopPropagation(),
        Kt(!1);
        const F = A.dataTransfer?.items;
        if (F)
            try {
                const Qt = await getUnifiedFsInstance()
                  , ps = "/workspace"
                  , pr = [];
                for (let mo = 0; mo < F.length; mo++) {
                    const Lt = F[mo];
                    if (Lt.kind === "file") {
                        const rv = Lt.webkitGetAsEntry();
                        rv && pr.push(rv)
                    }
                }
                for (const mo of pr)
                    await iv(mo, ps, Qt);
                log$1.log("Imported", pr.length, "items from drag & drop")
            } catch (Qt) {
                log$1.error("Native drop failed:", Qt)
            }
    }
    , [iv])
      , bi = reactExports.useCallback(async () => {
        try {
            const A = await window.showOpenFilePicker({
                multiple: !0
            })
              , F = await getUnifiedFsInstance();
            for (const Qt of A) {
                const ps = await Qt.getFile()
                  , pr = new Uint8Array(await ps.arrayBuffer());
                await F.writeFile(`/workspace/${ps.name}`, pr)
            }
            log$1.log("Imported", A.length, "files")
        } catch (A) {
            A.name !== "AbortError" && log$1.error("File import failed:", A)
        }
    }
    , [])
      , Rx = reactExports.useCallback(async () => {
        try {
            const A = await window.showDirectoryPicker()
              , F = await getUnifiedFsInstance()
              , Qt = async (pr, mo) => {
                for await(const Lt of pr.values()) {
                    const rv = `${mo}/${Lt.name}`;
                    if (Lt.kind === "file") {
                        const re = await Lt.getFile()
                          , dv = new Uint8Array(await re.arrayBuffer());
                        await F.writeFile(rv, dv)
                    } else {
                        const Ev = Lt;
                        await F.mkdir(rv, {
                            recursive: !0
                        }),
                        await Qt(Ev, rv)
                    }
                }
            }
              , ps = `/workspace/${A.name}`;
            await F.mkdir(ps, {
                recursive: !0
            }),
            await Qt(A, ps),
            log$1.log("Imported folder:", A.name)
        } catch (A) {
            A.name !== "AbortError" && log$1.error("Folder import failed:", A)
        }
    }
    , [])
      , sv = reactExports.useCallback(A => {
        const F = getVisiblePaths(t, n);
        if (F.length === 0)
            return;
        const Qt = [...a][a.size - 1]
          , ps = Qt ? F.indexOf(Qt) : -1;
        switch (A.key) {
        case "ArrowDown":
            {
                A.preventDefault();
                const pr = Math.min(ps + 1, F.length - 1);
                A.shiftKey ? b(F[pr]) : g(F[pr]);
                break
            }
        case "ArrowUp":
            {
                A.preventDefault();
                const pr = Math.max(ps - 1, 0);
                A.shiftKey ? b(F[pr]) : g(F[pr]);
                break
            }
        case "ArrowRight":
            {
                if (A.preventDefault(),
                Qt) {
                    const pr = I(Qt);
                    pr?.type === "directory" && (n.has(Qt) ? pr.children && pr.children.length > 0 && g(pr.children[0].path) : h(Qt))
                }
                break
            }
        case "ArrowLeft":
            {
                if (A.preventDefault(),
                Qt)
                    if (I(Qt)?.type === "directory" && n.has(Qt))
                        m(Qt);
                    else {
                        const mo = Qt.substring(0, Qt.lastIndexOf("/")) || "/";
                        mo !== "/" && F.includes(mo) && g(mo)
                    }
                break
            }
        case "Enter":
            {
                if (A.preventDefault(),
                Qt) {
                    const pr = I(Qt);
                    pr && (pr.type === "file" ? e(Qt) : f(Qt))
                }
                break
            }
        case "Delete":
        case "Backspace":
            {
                A.preventDefault(),
                a.size > 0 && ba({
                    isOpen: !0,
                    paths: [...a]
                });
                break
            }
        case "F2":
            {
                A.preventDefault(),
                a.size === 1 && ve([...a][0]);
                break
            }
        case "Escape":
            {
                A.preventDefault(),
                p ? ve(null) : w();
                break
            }
        case "a":
            {
                (A.metaKey || A.ctrlKey) && (A.preventDefault(),
                y());
                break
            }
        }
    }
    , [t, n, a, p, g, b, y, w, h, m, f, I, e, ve])
      , h0 = r.length === 0
      , av = t.length === 0 && s.trim() !== ""
      , L = pt.paths.map(A => A.split("/").pop() || A);
    return jsxRuntimeExports.jsxs("div", {
        ref: lt,
        className: "flex flex-col h-full relative",
        onDragEnter: lv,
        onDragOver: ev,
        onDragLeave: Ox,
        onDrop: N,
        children: [Mr && jsxRuntimeExports.jsx("div", {
            className: "absolute inset-0 flex items-center justify-center bg-accent/50 backdrop-blur-sm z-50 pointer-events-none border-2 border-dashed border-primary/50 m-1 rounded-lg",
            children: jsxRuntimeExports.jsxs("div", {
                className: "flex flex-col items-center gap-2 text-primary",
                children: [jsxRuntimeExports.jsx(Upload, {
                    className: "size-10"
                }), jsxRuntimeExports.jsx("span", {
                    className: "text-sm font-medium",
                    children: "Drop files here to import"
                })]
            })
        }), jsxRuntimeExports.jsxs("div", {
            className: "p-2 border-b flex gap-2 items-center",
            children: [jsxRuntimeExports.jsx("div", {
                className: "flex-1",
                children: jsxRuntimeExports.jsx(SearchBar, {
                    value: s,
                    onChange: d
                })
            }), jsxRuntimeExports.jsxs(DropdownMenu, {
                children: [jsxRuntimeExports.jsx(DropdownMenuTrigger, {
                    render: jsxRuntimeExports.jsx(Button, {
                        variant: "ghost",
                        size: "icon"
                    }),
                    children: jsxRuntimeExports.jsx(Upload, {
                        className: "size-4"
                    })
                }), jsxRuntimeExports.jsxs(DropdownMenuContent, {
                    align: "end",
                    children: [jsxRuntimeExports.jsxs(DropdownMenuItem, {
                        onClick: bi,
                        children: [jsxRuntimeExports.jsx(File$1, {}), "Import Files"]
                    }), jsxRuntimeExports.jsxs(DropdownMenuItem, {
                        onClick: Rx,
                        children: [jsxRuntimeExports.jsx(Folder, {}), "Import Folder"]
                    })]
                })]
            })]
        }), jsxRuntimeExports.jsx(ScrollArea, {
            className: "flex-1",
            children: jsxRuntimeExports.jsx("div", {
                ref: us,
                tabIndex: 0,
                onKeyDown: sv,
                onContextMenu: $0,
                className: "outline-none min-h-[200px]",
                children: o ? jsxRuntimeExports.jsx(LoadingSkeleton, {}) : l ? jsxRuntimeExports.jsx("div", {
                    className: "p-4 text-center text-destructive text-sm",
                    children: l
                }) : h0 ? jsxRuntimeExports.jsx(EmptyState, {}) : av ? jsxRuntimeExports.jsx(NoSearchResults, {}) : jsxRuntimeExports.jsx(FileTree, {
                    nodes: t,
                    expandedPaths: n,
                    selectedPaths: a,
                    draggedPath: u,
                    dropTargetPath: c,
                    renamingPath: p,
                    onToggleExpand: f,
                    onSelect: Ht,
                    onDoubleClick: $e,
                    onDragStart: R0,
                    onDragOver: gm,
                    onDragLeave: $s,
                    onDrop: go,
                    onDragEnd: Yl,
                    onContextMenu: G,
                    onRename: Oe,
                    onCancelRename: () => ve(null)
                })
            })
        }), jsxRuntimeExports.jsx(FileContextMenu, {
            isOpen: M.isOpen,
            position: M.position,
            node: M.node,
            selectedCount: a.size,
            onClose: () => $(A => ({
                ...A,
                isOpen: !1
            })),
            onOpen: he,
            onEdit: jr,
            onDownload: Xe,
            onRename: ie,
            onDelete: He,
            onNewFile: fs,
            onNewFolder: bf
        }), jsxRuntimeExports.jsx(DeleteDialog, {
            isOpen: pt.isOpen,
            itemNames: L,
            onClose: () => ba({
                isOpen: !1,
                paths: []
            }),
            onConfirm: mm
        })]
    })
}
const MODEL_CONTEXT_LIMITS = {
    "gemini-3-flash-preview": 256e3,
    "claude-sonnet-4-6": 2e5,
    "claude-opus-4-6": 256e3,
    "gpt-5.4": 256e3,
    "gpt-5.4-mini": 4e5,
    default: 256e3
};
function getModelContextLimit(e) {
    return MODEL_CONTEXT_LIMITS[e] ?? MODEL_CONTEXT_LIMITS.default
}
const log = logger.scoped("auth")
  , API_BASE_URL$2 = "https://www.dobrowser.io";
function useAuth() {
    const {data: e, isPending: t, error: r, refetch: n} = authClient.useSession()
      , [a,s] = reactExports.useState(!1)
      , [o,l] = reactExports.useState(null)
      , u = e?.session?.token;
    reactExports.useEffect( () => {
        u && setStoredToken(u)
    }
    , [u]);
    const c = reactExports.useCallback(async () => {
        s(!0),
        l(null);
        try {
            const f = chrome.runtime.id
              , h = `${API_BASE_URL$2}/auth/extension-login?extensionId=${f}`
              , m = await chrome.tabs.create({
                url: h
            })
              , g = await waitForAuthToken(m.id);
            await setStoredToken(g),
            await n()
        } catch (f) {
            log.error("Login error:", f);
            const h = f instanceof Error ? f.message : "Failed to log in";
            l(h)
        } finally {
            s(!1)
        }
    }
    , [n])
      , p = reactExports.useCallback(async () => {
        try {
            await authClient.signOut(),
            await clearStoredToken(),
            await n()
        } catch (f) {
            log.error("Logout error:", f),
            await clearStoredToken()
        }
    }
    , [n]);
    return {
        authState: t || a ? {
            status: "loading"
        } : r || o ? {
            status: "error",
            error: o || r?.message || "Unknown error"
        } : e?.user ? {
            status: "loggedIn",
            token: e.session.token
        } : {
            status: "loggedOut"
        },
        login: c,
        logout: p
    }
}
function waitForAuthToken(e) {
    return new Promise( (t, r) => {
        const n = setTimeout( () => {
            chrome.runtime.onMessageExternal.removeListener(a),
            chrome.tabs.onRemoved.removeListener(s),
            r(new Error("Login timed out"))
        }
        , 3e5)
          , a = (o, l, u) => {
            l.tab?.id === e && o.type === "AUTH_TOKEN" && o.token && (clearTimeout(n),
            chrome.runtime.onMessageExternal.removeListener(a),
            chrome.tabs.onRemoved.removeListener(s),
            u({
                success: !0
            }),
            chrome.tabs.remove(e).catch( () => {}
            ),
            t(o.token))
        }
          , s = o => {
            o === e && (clearTimeout(n),
            chrome.runtime.onMessageExternal.removeListener(a),
            chrome.tabs.onRemoved.removeListener(s),
            r(new Error("Login cancelled")))
        }
        ;
        chrome.runtime.onMessageExternal.addListener(a),
        chrome.tabs.onRemoved.addListener(s)
    }
    )
}
const API_BASE_URL$1 = "https://www.dobrowser.io";
function LoginView({authState: e, onLogin: t}) {
    const r = e.status === "loading"
      , n = e.status === "error" ? e.error : null;
    return jsxRuntimeExports.jsxs("div", {
        className: "flex flex-col items-center justify-center h-screen px-6 gap-6",
        children: [jsxRuntimeExports.jsxs("div", {
            className: "text-center space-y-2",
            children: [jsxRuntimeExports.jsx("h1", {
                className: "text-lg font-semibold",
                children: "Welcome to Do Browser"
            }), jsxRuntimeExports.jsx("p", {
                className: "text-sm text-muted-foreground",
                children: "Please sign in to continue"
            })]
        }), jsxRuntimeExports.jsxs("div", {
            className: "w-full max-w-[280px] space-y-4",
            children: [jsxRuntimeExports.jsx(Button, {
                onClick: t,
                disabled: r,
                size: "lg",
                className: "w-full gap-2",
                children: r ? jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
                    children: [jsxRuntimeExports.jsx(LoaderCircle, {
                        className: "size-4 animate-spin"
                    }), "Signing in..."]
                }) : jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
                    children: [jsxRuntimeExports.jsx(GoogleIcon, {}), "Sign in with Google"]
                })
            }), n && jsxRuntimeExports.jsx("p", {
                className: "text-xs text-destructive text-center",
                children: n
            })]
        }), jsxRuntimeExports.jsx("div", {
            className: "max-w-[280px] space-y-2 text-center",
            children: jsxRuntimeExports.jsxs("p", {
                className: "text-[10px] text-muted-foreground",
                children: ["By signing in, you agree to our", " ", jsxRuntimeExports.jsx("a", {
                    href: `${API_BASE_URL$1}/tos`,
                    target: "_blank",
                    rel: "noopener noreferrer",
                    className: "text-primary hover:underline",
                    children: "Terms of Service"
                }), " ", "and", " ", jsxRuntimeExports.jsx("a", {
                    href: `${API_BASE_URL$1}/privacy`,
                    target: "_blank",
                    rel: "noopener noreferrer",
                    className: "text-primary hover:underline",
                    children: "Privacy Policy"
                }), "."]
            })
        })]
    })
}
function GoogleIcon() {
    return jsxRuntimeExports.jsxs("svg", {
        className: "size-4",
        viewBox: "0 0 24 24",
        children: [jsxRuntimeExports.jsx("path", {
            fill: "currentColor",
            d: "M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        }), jsxRuntimeExports.jsx("path", {
            fill: "currentColor",
            d: "M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        }), jsxRuntimeExports.jsx("path", {
            fill: "currentColor",
            d: "M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        }), jsxRuntimeExports.jsx("path", {
            fill: "currentColor",
            d: "M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        })]
    })
}
const API_BASE_URL = "https://www.dobrowser.io"
  , features = ["Automate repetitive browser tasks", "Multi-step workflows with one prompt", "Fill forms, extract data, navigate sites", "Works across multiple tabs"];
function UpsellModal({open: e, userEmail: t, onRefresh: r, onClose: n}) {
    const a = useAppStore(p => p.useProxy)
      , {data: s} = useSubscriptionStatus(e && a)
      , o = s?.freeMessagesUsed ?? 0
      , l = s?.freeMessagesLimit ?? FREE_MESSAGE_LIMIT
      , u = Math.max(l - o, 0)
      , c = o >= l;
    return jsxRuntimeExports.jsx(AlertDialog, {
        open: e,
        children: jsxRuntimeExports.jsxs(AlertDialogContent, {
            className: "max-w-sm p-6",
            children: [jsxRuntimeExports.jsx("button", {
                type: "button",
                onClick: n,
                className: "absolute right-4 top-4 text-muted-foreground/60 hover:text-foreground transition-colors",
                children: jsxRuntimeExports.jsx(X$1, {
                    className: "size-4"
                })
            }), jsxRuntimeExports.jsxs("div", {
                className: "space-y-5",
                children: [jsxRuntimeExports.jsxs("div", {
                    children: [jsxRuntimeExports.jsx("h2", {
                        className: "text-lg font-semibold",
                        children: "Do Browser"
                    }), jsxRuntimeExports.jsx("p", {
                        className: "text-sm text-muted-foreground",
                        children: "AI-powered browser automation"
                    })]
                }), s && jsxRuntimeExports.jsx("div", {
                    className: `text-sm rounded-lg px-3.5 py-2.5 border ${c ? "bg-amber-500/10 border-amber-500/20 text-amber-200" : "bg-muted/40 border-border/50 text-muted-foreground"}`,
                    children: c ? jsxRuntimeExports.jsxs("span", {
                        children: ["You've used all ", l, " free messages. Subscribe to continue."]
                    }) : jsxRuntimeExports.jsxs("span", {
                        children: ["You have ", u, " free message", u !== 1 ? "s" : "", " remaining."]
                    })
                }), jsxRuntimeExports.jsx("div", {
                    children: jsxRuntimeExports.jsxs("p", {
                        className: "text-sm text-muted-foreground",
                        children: [jsxRuntimeExports.jsx("span", {
                            className: "text-base font-semibold text-foreground",
                            children: "From $25"
                        }), jsxRuntimeExports.jsx("span", {
                            className: "text-muted-foreground",
                            children: "/mo"
                        })]
                    })
                }), jsxRuntimeExports.jsx("ul", {
                    className: "space-y-1.5",
                    children: features.map(p => jsxRuntimeExports.jsxs("li", {
                        className: "flex items-start gap-2",
                        children: [jsxRuntimeExports.jsx(Check, {
                            className: "size-3.5 text-muted-foreground/70 mt-0.5 shrink-0",
                            strokeWidth: 2.5
                        }), jsxRuntimeExports.jsx("span", {
                            className: "text-sm text-muted-foreground",
                            children: p
                        })]
                    }, p))
                }), jsxRuntimeExports.jsxs("div", {
                    className: "space-y-1.5 pt-1",
                    children: [jsxRuntimeExports.jsx(Button, {
                        className: "w-full",
                        size: "lg",
                        onClick: () => window.open(`${API_BASE_URL}/settings`, "_blank"),
                        children: "View plans"
                    }), jsxRuntimeExports.jsxs(Button, {
                        variant: "ghost",
                        size: "sm",
                        className: "w-full text-xs text-muted-foreground/70 hover:text-muted-foreground",
                        onClick: r,
                        children: ["I've subscribed, continue", jsxRuntimeExports.jsx(ArrowRight, {
                            className: "size-3 ml-1"
                        })]
                    })]
                }), jsxRuntimeExports.jsx("div", {
                    className: "border-t border-border/40 pt-3 -mx-1",
                    children: jsxRuntimeExports.jsx("p", {
                        className: "text-[11px] text-muted-foreground/40 text-center",
                        children: t || "Unknown email"
                    })
                })]
            })]
        })
    })
}
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 2,
            refetchOnWindowFocus: !0
        }
    }
});
class ChatErrorBoundary extends reactExports.Component {
    state = {
        error: null
    };
    static getDerivedStateFromError(t) {
        return {
            error: t
        }
    }
    render() {
        return this.state.error ? jsxRuntimeExports.jsx("div", {
            className: "flex flex-col h-full p-3",
            children: jsxRuntimeExports.jsxs("div", {
                className: "text-destructive",
                children: [jsxRuntimeExports.jsx("p", {
                    className: "font-medium",
                    children: "Failed to load chat"
                }), jsxRuntimeExports.jsx("p", {
                    className: "text-sm text-muted-foreground mt-1",
                    children: this.state.error.message
                })]
            })
        }) : this.props.children
    }
}
function ChatLoadingSkeleton() {
    return jsxRuntimeExports.jsxs("div", {
        className: "flex flex-col h-full p-3 space-y-3",
        children: [jsxRuntimeExports.jsx("div", {
            className: "flex-1 space-y-3",
            children: [1, 2, 3].map(e => jsxRuntimeExports.jsx(Skeleton, {
                className: "h-16 w-full rounded-lg"
            }, e))
        }), jsxRuntimeExports.jsx(Skeleton, {
            className: "h-10 w-full rounded-md"
        })]
    })
}
function SettingsLoadingSkeleton() {
    return jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
        children: [jsxRuntimeExports.jsxs("div", {
            className: "flex items-center justify-between px-3 py-2 border-b border-border",
            children: [jsxRuntimeExports.jsx(Skeleton, {
                className: "h-5 w-20"
            }), jsxRuntimeExports.jsx(Skeleton, {
                className: "size-6 rounded-md"
            })]
        }), jsxRuntimeExports.jsx("div", {
            className: "p-3 border-b border-border",
            children: jsxRuntimeExports.jsx(Skeleton, {
                className: "h-8 w-full rounded-md"
            })
        }), jsxRuntimeExports.jsx("div", {
            className: "p-3 space-y-2",
            children: [1, 2, 3].map(e => jsxRuntimeExports.jsx(Skeleton, {
                className: "h-16 w-full rounded-lg"
            }, e))
        })]
    })
}
function AppContent({logout: e}) {
    const t = useUser()
      , {data: r} = useSubscriptionStatus(!0)
      , {view: n, activeThreadId: a, loadSettings: s, isSettingsLoaded: o, geminiApiKey: l, useProxy: u, provider: c, hostedModel: p, anthropicModel: d, anthropicOAuthCredentials: f, openaiModel: h, openaiOAuthCredentials: m, showSubscriptionRequired: g, setShowSubscriptionRequired: x, routePendingOmniboxCommand: b} = useAppStore()
      , y = reactExports.useCallback( () => {
        x(!1)
    }
    , [x])
      , w = reactExports.useCallback(ve => {
        const I = `chrome-extension://${chrome.runtime.id}/viewer.html?file=${encodeURIComponent(ve)}`;
        chrome.tabs.create({
            url: I
        })
    }
    , []);
    reactExports.useEffect( () => {
        s()
    }
    , [s]),
    reactExports.useEffect( () => {
        if (!o)
            return;
        async function ve() {
            const M = await chrome.storage.local.get([OMNIBOX_STORAGE_KEYS.message, OMNIBOX_STORAGE_KEYS.messageId])
              , $ = M[OMNIBOX_STORAGE_KEYS.message]
              , pt = typeof $ == "string" ? $ : null
              , ba = M[OMNIBOX_STORAGE_KEYS.messageId]
              , us = typeof ba == "string" ? ba : null;
            !pt || !us || b(us)
        }
        ve();
        function I(M, $) {
            if ($ !== "local")
                return;
            const pt = M[OMNIBOX_STORAGE_KEYS.message]
              , ba = M[OMNIBOX_STORAGE_KEYS.messageId];
            !pt && !ba || ve()
        }
        return chrome.storage.onChanged.addListener(I),
        () => {
            chrome.storage.onChanged.removeListener(I)
        }
    }
    , [o, b]);
    const R = reactExports.useMemo( () => a ? {
        geminiApiKey: l,
        useProxy: u,
        hasActiveSubscription: r?.hasSubscription,
        provider: c,
        hostedModel: p,
        anthropicModel: d,
        anthropicOAuthCredentials: f,
        openaiModel: h,
        openaiOAuthCredentials: m,
        threadId: a
    } : null, [l, u, r?.hasSubscription, c, p, d, f, h, m, a])
      , T = useLiveQuery( () => a ? db$1.threads.get(a) : void 0, [a])
      , C = n === "settings" ? "Settings" : n === "chat" ? T?.title || "Chat" : n === "files" ? "Files" : void 0
      , W = c === "anthropic-oauth" ? d : c === "openai-oauth" ? h : c === "proxy" ? p === "gemini" ? "gemini-3-flash-preview" : p : "gemini-3-flash-preview"
      , ue = reactExports.useMemo( () => getModelContextLimit(W), [W])
      , ce = reactExports.useMemo( () => !T || T.messages.length === 0 ? 0 : estimateContextTokens(T.messages).tokens, [T]);
    return jsxRuntimeExports.jsx("div", {
        className: "flex flex-col h-screen bg-background",
        children: o ? jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
            children: [jsxRuntimeExports.jsx(AnnouncementBanner, {}), jsxRuntimeExports.jsx(Header, {
                title: C,
                tokenUsage: T?.tokenUsage,
                modelId: W,
                contextTokensUsed: ce,
                contextWindow: ue
            }), jsxRuntimeExports.jsxs("main", {
                className: "flex-1 overflow-hidden",
                children: [n === "threads" && jsxRuntimeExports.jsx(ThreadListView, {}), n === "chat" && R && jsxRuntimeExports.jsx(AgentEnvironmentProvider, {
                    config: R,
                    children: jsxRuntimeExports.jsx(ChatErrorBoundary, {
                        children: jsxRuntimeExports.jsx(reactExports.Suspense, {
                            fallback: jsxRuntimeExports.jsx(ChatLoadingSkeleton, {}),
                            children: jsxRuntimeExports.jsx(ChatView, {})
                        })
                    })
                }), n === "settings" && jsxRuntimeExports.jsx(SettingsView, {
                    logout: e
                }), n === "files" && jsxRuntimeExports.jsx(FileExplorer, {
                    onOpenFile: w
                })]
            }), jsxRuntimeExports.jsx(UpsellModal, {
                open: g,
                userEmail: t?.email,
                onRefresh: y,
                onClose: y
            })]
        }) : jsxRuntimeExports.jsx(SettingsLoadingSkeleton, {})
    })
}
function App() {
    const {authState: e, login: t, logout: r} = useAuth();
    return reactExports.useEffect( () => {
        const n = () => {
            chrome.runtime.sendMessage({
                type: "sidepanel-heartbeat"
            })
        }
        ;
        n();
        const a = setInterval(n, 500)
          , s = o => {
            o.type === "close-sidepanel" && window.close()
        }
        ;
        return chrome.runtime.onMessage.addListener(s),
        () => {
            clearInterval(a),
            chrome.runtime.onMessage.removeListener(s)
        }
    }
    , []),
    e.status === "loggedOut" || e.status === "error" ? jsxRuntimeExports.jsx("div", {
        className: "h-screen bg-background",
        children: jsxRuntimeExports.jsx(LoginView, {
            authState: e,
            onLogin: t
        })
    }) : e.status === "loading" ? jsxRuntimeExports.jsxs("div", {
        className: "flex flex-col h-screen bg-background",
        children: [jsxRuntimeExports.jsxs("div", {
            className: "flex items-center justify-between px-3 py-2 border-b border-border",
            children: [jsxRuntimeExports.jsx(Skeleton, {
                className: "h-5 w-20"
            }), jsxRuntimeExports.jsx(Skeleton, {
                className: "size-6 rounded-md"
            })]
        }), jsxRuntimeExports.jsx("div", {
            className: "flex-1 flex items-center justify-center",
            children: jsxRuntimeExports.jsx("div", {
                className: "text-sm text-muted-foreground",
                children: "Loading..."
            })
        })]
    }) : jsxRuntimeExports.jsx(QueryClientProvider, {
        client: queryClient,
        children: jsxRuntimeExports.jsx(AppContent, {
            logout: r
        })
    })
}
const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
function applyTheme(e) {
    document.documentElement.classList.toggle("dark", e)
}
applyTheme(mediaQuery.matches);
mediaQuery.addEventListener("change", e => applyTheme(e.matches));
ReactDOM.createRoot(document.getElementById("root")).render(jsxRuntimeExports.jsx(ErrorBoundary, {
    children: jsxRuntimeExports.jsx(App, {})
}));
export {AssistantMessageEventStream as A, Buffer as B, calculateCost as c, distExports$1 as d, getEnvApiKey as g, supportsXhigh as s};
