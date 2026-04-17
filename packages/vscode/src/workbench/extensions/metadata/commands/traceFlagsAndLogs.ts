import { ensureDir, writeTextFile } from '../core/workspaceCache';
import { getWorkspaceUri } from '../core/workspacePaths';

export const DEBUG_LEVEL_DEFAULT_NAME = 'WorkbenchDebug';

const DEBUG_LEVEL_PRESET = {
    ApexCode: 'DEBUG',
    ApexProfiling: 'INFO',
    Callout: 'INFO',
    Database: 'INFO',
    Nba: 'NONE',
    System: 'DEBUG',
    Validation: 'INFO',
    Visualforce: 'INFO',
    Wave: 'NONE',
    Workflow: 'INFO',
};

const LOG_LEVELS = ['NONE', 'ERROR', 'WARN', 'INFO', 'DEBUG', 'FINE', 'FINER', 'FINEST'];

const DEBUG_LEVEL_CATEGORIES = [
    { key: 'ApexCode', label: 'Apex code', default: 'DEBUG' },
    { key: 'ApexProfiling', label: 'Apex profiling', default: 'NONE' },
    { key: 'Callout', label: 'Callout', default: 'NONE' },
    { key: 'Database', label: 'Database', default: 'INFO' },
    { key: 'Nba', label: 'NBA', default: 'NONE' },
    { key: 'System', label: 'System', default: 'DEBUG' },
    { key: 'Validation', label: 'Validation', default: 'NONE' },
    { key: 'Visualforce', label: 'Visualforce', default: 'INFO' },
    { key: 'Wave', label: 'Wave', default: 'NONE' },
    { key: 'Workflow', label: 'Workflow', default: 'NONE' },
] as const;

const SCHEME = 'sf-traceflags';
const FALLBACK_PATH = '.salesforce/traceFlags.json';
const AUTO_COLLECT_INTERVAL_MS = 30_000;
const AUTO_COLLECT_MAX_BACKOFF_MS = 60_000;

const escapeSoql = (value: string) => String(value || '').replace(/'/g, "\\'");

/** Service helpers (plain async functions backed by connectionRuntime.withToolingClientAuthed). */
export function createTraceFlagServices(connectionRuntime) {
    async function listTraceFlags(conn) {
        return await connectionRuntime.withToolingClientAuthed(conn, async client =>
            client.toolingQueryAll(
                'SELECT Id, TracedEntityId, LogType, DebugLevelId, StartDate, ExpirationDate FROM TraceFlag ORDER BY ExpirationDate DESC'
            )
        );
    }

    async function listDebugLevels(conn) {
        return await connectionRuntime.withToolingClientAuthed(conn, async client =>
            client.toolingQueryAll(
                'SELECT Id, DeveloperName, MasterLabel, ApexCode, ApexProfiling, Callout, Database, Nba, System, Validation, Visualforce, Wave, Workflow FROM DebugLevel ORDER BY DeveloperName'
            )
        );
    }

    async function fetchEntityLabels(conn, ids: string[]) {
        if (!ids.length) return new Map<string, string>();
        const result = new Map<string, string>();
        const userIds = ids.filter(id => id.startsWith('005'));
        const classIds = ids.filter(id => id.startsWith('01p'));
        const triggerIds = ids.filter(id => id.startsWith('01q'));
        await connectionRuntime.withToolingClientAuthed(conn, async client => {
            if (userIds.length) {
                const inList = userIds.map(id => `'${escapeSoql(id)}'`).join(',');
                const rows = await client.toolingQueryAll(
                    `SELECT Id, Username, Name FROM User WHERE Id IN (${inList})`
                );
                for (const row of rows || []) {
                    result.set(String(row.Id), `${row.Name || row.Username || row.Id}`);
                }
            }
            if (classIds.length) {
                const inList = classIds.map(id => `'${escapeSoql(id)}'`).join(',');
                const rows = await client.toolingQueryAll(
                    `SELECT Id, Name FROM ApexClass WHERE Id IN (${inList})`
                );
                for (const row of rows || []) {
                    result.set(String(row.Id), `${row.Name || row.Id}`);
                }
            }
            if (triggerIds.length) {
                const inList = triggerIds.map(id => `'${escapeSoql(id)}'`).join(',');
                const rows = await client.toolingQueryAll(
                    `SELECT Id, Name FROM ApexTrigger WHERE Id IN (${inList})`
                );
                for (const row of rows || []) {
                    result.set(String(row.Id), `${row.Name || row.Id}`);
                }
            }
        });
        return result;
    }

    async function ensureDebugLevel(conn, name = DEBUG_LEVEL_DEFAULT_NAME) {
        return await connectionRuntime.withToolingClientAuthed(conn, async client => {
            const rows = await client.toolingQueryAll(
                `SELECT Id FROM DebugLevel WHERE DeveloperName='${escapeSoql(name)}' LIMIT 1`
            );
            let id = rows?.[0]?.Id || '';
            if (!id) {
                const created = await client.requestJson('/tooling/sobjects/DebugLevel', {
                    method: 'POST',
                    body: {
                        DeveloperName: name,
                        MasterLabel: name,
                        ...DEBUG_LEVEL_PRESET,
                    },
                });
                id = created?.id || '';
            }
            if (!id) throw new Error(`Failed to create DebugLevel "${name}".`);
            return id;
        });
    }

    async function ensureTraceFlag(
        conn,
        tracedEntityId: string,
        minutes: number,
        logType: string = 'DEVELOPER_LOG',
        debugLevelId?: string
    ) {
        if (!tracedEntityId) throw new Error('Missing tracedEntityId.');
        const effectiveDebugLevelId = debugLevelId || (await ensureDebugLevel(conn));
        return await connectionRuntime.withToolingClientAuthed(conn, async client => {
            const start = new Date();
            const expiration = new Date(start.getTime() + minutes * 60 * 1000);
            const body = {
                TracedEntityId: tracedEntityId,
                LogType: logType,
                DebugLevelId: effectiveDebugLevelId,
                StartDate: start.toISOString(),
                ExpirationDate: expiration.toISOString(),
            };
            const existing = await client.toolingQueryAll(
                `SELECT Id FROM TraceFlag WHERE TracedEntityId='${escapeSoql(tracedEntityId)}' AND LogType='${escapeSoql(logType)}' ORDER BY ExpirationDate DESC LIMIT 1`
            );
            const existingId = existing?.[0]?.Id || '';
            if (existingId) {
                await client.requestJson(`/tooling/sobjects/TraceFlag/${existingId}`, {
                    method: 'PATCH',
                    body,
                });
                return existingId;
            }
            const created = await client.requestJson('/tooling/sobjects/TraceFlag', {
                method: 'POST',
                body,
            });
            return String(created?.id || '');
        });
    }

    async function deleteTraceFlag(conn, id: string) {
        if (!id) return;
        await connectionRuntime.withToolingClientAuthed(conn, async client => {
            await client.requestJson(`/tooling/sobjects/TraceFlag/${id}`, { method: 'DELETE' });
        });
    }

    async function changeTraceFlagDebugLevel(conn, id: string, newDebugLevelId: string) {
        if (!id || !newDebugLevelId) return;
        await connectionRuntime.withToolingClientAuthed(conn, async client => {
            await client.requestJson(`/tooling/sobjects/TraceFlag/${id}`, {
                method: 'PATCH',
                body: { DebugLevelId: newDebugLevelId },
            });
        });
    }

    async function createDebugLevel(
        conn,
        {
            developerName,
            masterLabel,
            levels,
        }: {
            developerName: string;
            masterLabel: string;
            levels: Record<string, string>;
        }
    ) {
        return await connectionRuntime.withToolingClientAuthed(conn, async client => {
            const payload = {
                DeveloperName: developerName,
                MasterLabel: masterLabel,
                ApexCode: levels.ApexCode || 'NONE',
                ApexProfiling: levels.ApexProfiling || 'NONE',
                Callout: levels.Callout || 'NONE',
                Database: levels.Database || 'NONE',
                Nba: levels.Nba || 'NONE',
                System: levels.System || 'NONE',
                Validation: levels.Validation || 'NONE',
                Visualforce: levels.Visualforce || 'NONE',
                Wave: levels.Wave || 'NONE',
                Workflow: levels.Workflow || 'NONE',
            };
            return await client.requestJson('/tooling/sobjects/DebugLevel', {
                method: 'POST',
                body: payload,
            });
        });
    }

    async function deleteDebugLevel(conn, id: string) {
        if (!id) return;
        await connectionRuntime.withToolingClientAuthed(conn, async client => {
            await client.requestJson(`/tooling/sobjects/DebugLevel/${id}`, { method: 'DELETE' });
        });
    }

    async function listRecentLogs(
        conn,
        { limit = 50, userIds, startTimeAfter }: { limit?: number; userIds?: string[]; startTimeAfter?: string } = {}
    ) {
        const whereClauses: string[] = [];
        if (userIds?.length) {
            const inList = userIds.map(id => `'${escapeSoql(id)}'`).join(',');
            whereClauses.push(`LogUserId IN (${inList})`);
        }
        if (startTimeAfter) {
            whereClauses.push(`StartTime >= ${startTimeAfter}`);
        }
        const where = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
        return await connectionRuntime.withToolingClientAuthed(conn, async client =>
            client.toolingQueryAll(
                `SELECT Id, LogUserId, LogUser.Name, Application, Status, Operation, Request, StartTime, LogLength, DurationMilliseconds FROM ApexLog ${where} ORDER BY StartTime DESC LIMIT ${Number(limit) || 50}`
            )
        );
    }

    async function fetchLogBody(conn, logId: string) {
        return await connectionRuntime.withToolingClientAuthed(conn, async client =>
            client.requestText(`/tooling/sobjects/ApexLog/${logId}/Body`)
        );
    }

    async function searchUsers(conn, term: string) {
        const escaped = String(term || '').replace(/['"\\]/g, '');
        if (!escaped) return [];
        const sosl = `FIND {${escaped}} IN NAME FIELDS RETURNING User(Id, FirstName, LastName, Username, UserType WHERE IsActive = true ORDER BY LastName, FirstName) LIMIT 50`;
        const result = await connectionRuntime.withToolingClientAuthed(conn, async client =>
            client.requestJson(`/search/?q=${encodeURIComponent(sosl)}`)
        );
        const records = result?.searchRecords || result?.records || [];
        return (Array.isArray(records) ? records : []).map(r => ({
            Id: String(r.Id ?? ''),
            FirstName: String(r.FirstName ?? ''),
            LastName: String(r.LastName ?? ''),
            Username: String(r.Username ?? ''),
            UserType: String(r.UserType ?? ''),
        }));
    }

    return {
        listTraceFlags,
        listDebugLevels,
        fetchEntityLabels,
        ensureDebugLevel,
        ensureTraceFlag,
        deleteTraceFlag,
        changeTraceFlagDebugLevel,
        createDebugLevel,
        deleteDebugLevel,
        listRecentLogs,
        fetchLogBody,
        searchUsers,
    };
}

/** Group active flags by log type for the virtual doc view. */
function groupFlagsByLogType(flags, labelMap: Map<string, string>, debugLevelMap: Map<string, string>) {
    const groups: Record<string, unknown[]> = {
        DEVELOPER_LOG: [],
        USER_DEBUG: [],
        CLASS_TRACING: [],
        TRIGGERS: [],
    };
    const now = Date.now();
    for (const flag of flags || []) {
        const expiration = flag?.ExpirationDate ? new Date(flag.ExpirationDate).getTime() : 0;
        if (!expiration || expiration < now) continue;
        const tracedId = String(flag.TracedEntityId || '');
        const bucket = tracedId.startsWith('01q') ? 'TRIGGERS' : String(flag.LogType || 'DEVELOPER_LOG');
        const target = groups[bucket] || (groups[bucket] = []);
        target.push({
            id: String(flag.Id || ''),
            tracedEntityId: tracedId,
            tracedEntity: labelMap.get(tracedId) || tracedId,
            debugLevelId: String(flag.DebugLevelId || ''),
            debugLevel: debugLevelMap.get(String(flag.DebugLevelId || '')) || String(flag.DebugLevelId || ''),
            startDate: flag.StartDate || null,
            expirationDate: flag.ExpirationDate || null,
        });
    }
    return groups;
}

/**
 * Shape the trace-flags virtual-doc content. Exposed as a named helper so the
 * fallback (real file) can reuse the exact same format.
 */
async function buildTraceFlagsContent(services, conn) {
    const [flags, debugLevels] = await Promise.all([
        services.listTraceFlags(conn).catch(() => []),
        services.listDebugLevels(conn).catch(() => []),
    ]);
    const activeFlags = (flags || []).filter(f => {
        const exp = f?.ExpirationDate ? new Date(f.ExpirationDate).getTime() : 0;
        return exp > Date.now();
    });
    const entityIds = [...new Set(activeFlags.map(f => String(f.TracedEntityId || '')).filter(Boolean))];
    const labelMap = await services.fetchEntityLabels(conn, entityIds).catch(() => new Map<string, string>());
    const debugLevelMap = new Map<string, string>(
        (debugLevels || []).map(dl => [String(dl.Id), String(dl.DeveloperName || dl.MasterLabel || dl.Id)])
    );
    const traceFlags = groupFlagsByLogType(activeFlags, labelMap, debugLevelMap);
    return JSON.stringify(
        {
            traceFlags,
            debugLevels: (debugLevels || []).map(dl => ({
                id: dl.Id,
                developerName: dl.DeveloperName,
                masterLabel: dl.MasterLabel,
                apexCode: dl.ApexCode,
                apexProfiling: dl.ApexProfiling,
                callout: dl.Callout,
                database: dl.Database,
                nba: dl.Nba,
                system: dl.System,
                validation: dl.Validation,
                visualforce: dl.Visualforce,
                wave: dl.Wave,
                workflow: dl.Workflow,
            })),
        },
        null,
        2
    );
}

const createTraceFlagsUri = (vscode, orgId: string) =>
    vscode.Uri.parse(`${SCHEME}:org/${orgId || 'default'}/traceFlags.json`);

/** Virtual doc provider (registers via registerTextDocumentContentProvider when available). */
function createTraceFlagsContentProvider(vscode, services, connectionRuntime) {
    const emitter = new vscode.EventEmitter();
    const provider = {
        onDidChange: emitter.event,
        async provideTextDocumentContent() {
            try {
                const conn = connectionRuntime.loadStoredConn();
                if (!conn?.instanceUrl || !conn?.accessToken) {
                    return JSON.stringify({ error: 'No active Salesforce connection.' }, null, 2);
                }
                return await buildTraceFlagsContent(services, conn);
            } catch (error) {
                return JSON.stringify(
                    { error: `Failed to fetch trace flags: ${String((error as Error)?.message || error)}` },
                    null,
                    2
                );
            }
        },
        refresh(uri) {
            emitter.fire(uri);
        },
        dispose() {
            emitter.dispose();
        },
    };
    return provider;
}

/** CodeLens provider that scans the virtual JSON for ids and emits actions. */
function createTraceFlagsCodeLensProvider(vscode) {
    return {
        provideCodeLenses(doc) {
            try {
                if (!doc) return [];
                const uri = doc.uri;
                if (!uri || uri.scheme !== SCHEME) return [];
                const lenses = [];
                let section: 'flags' | 'levels' | null = null;
                for (let i = 0; i < doc.lineCount; i++) {
                    const text = doc.lineAt(i).text;
                    if (/"traceFlags"\s*:/.test(text)) section = 'flags';
                    else if (/"debugLevels"\s*:/.test(text)) section = 'levels';
                    const match = text.match(/"id"\s*:\s*"([^"]+)"/);
                    if (!match) continue;
                    const id = match[1];
                    const range = new vscode.Range(i, 0, i, 0);
                    if (section === 'levels' && id.startsWith('7dl')) {
                        lenses.push(
                            new vscode.CodeLens(range, {
                                title: '$(trash) Delete debug level',
                                command: 'salesforceMetadata.traceFlags.deleteDebugLevelForId',
                                arguments: [id],
                            })
                        );
                    } else if (section === 'flags' && id.startsWith('7tf')) {
                        lenses.push(
                            new vscode.CodeLens(range, {
                                title: '$(edit) Change debug level',
                                command: 'salesforceMetadata.traceFlags.changeDebugLevel',
                                arguments: [id],
                            }),
                            new vscode.CodeLens(range, {
                                title: '$(trash) Delete trace flag',
                                command: 'salesforceMetadata.traceFlags.deleteForId',
                                arguments: [id],
                            })
                        );
                    }
                }
                return lenses;
            } catch {
                return [];
            }
        },
    };
}

/** Log auto-collect — polls for new ApexLog bodies while trace flags are active. */
function createLogAutoCollect({
    vscode,
    connectionRuntime,
    services,
    output,
}: {
    vscode;
    connectionRuntime;
    services;
    output;
}) {
    let timer: ReturnType<typeof setInterval> | null = null;
    let currentIntervalMs = AUTO_COLLECT_INTERVAL_MS;
    let consecutiveEmpty = 0;
    let collecting = 0;
    const known = new Set<string>();

    const statusItem =
        typeof vscode.window?.createStatusBarItem === 'function'
            ? vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 80)
            : null;
    if (statusItem) {
        statusItem.command = 'salesforceMetadata.traceFlags.open';
        statusItem.tooltip = 'Click to open Salesforce trace flags';
    }

    function updateStatus(state: 'idle' | 'active' | 'stopped') {
        if (!statusItem) return;
        if (state === 'stopped') {
            statusItem.hide();
            return;
        }
        statusItem.text = state === 'active' ? `$(sync~spin) SF Logs: ${collecting}` : `$(bug) SF Logs`;
        statusItem.show();
    }

    async function pollOnce() {
        try {
            const conn = connectionRuntime.loadStoredConn();
            if (!conn?.instanceUrl || !conn?.accessToken) return false;
            const flags = await services.listTraceFlags(conn).catch(() => []);
            const nowIso = new Date().toISOString();
            const activeUserFlags = (flags || []).filter(f => {
                const exp = f?.ExpirationDate ? new Date(f.ExpirationDate).getTime() : 0;
                return exp > Date.now() && String(f.TracedEntityId || '').startsWith('005');
            });
            if (activeUserFlags.length === 0) return false;
            const userIds = [
                ...new Set(activeUserFlags.map(f => String(f.TracedEntityId))),
            ];
            const minStart = activeUserFlags
                .map(f => (f.StartDate ? new Date(f.StartDate).getTime() : Number.POSITIVE_INFINITY))
                .reduce((a, b) => (a < b ? a : b), Number.POSITIVE_INFINITY);
            const startTimeAfter =
                Number.isFinite(minStart) && minStart > 0 ? new Date(minStart).toISOString() : nowIso;
            const logs = await services
                .listRecentLogs(conn, { limit: 25, userIds, startTimeAfter })
                .catch(() => []);
            const fresh = (logs || []).filter(l => !known.has(String(l.Id)));
            if (fresh.length === 0) return false;
            const dir = getWorkspaceUri(vscode, '.salesforce/logs');
            await ensureDir(vscode, dir);
            for (const log of fresh) {
                const logId = String(log.Id);
                if (known.has(logId)) continue;
                try {
                    const body = await services.fetchLogBody(conn, logId);
                    const uri = vscode.Uri.joinPath(dir, `${logId}.log`);
                    await writeTextFile(vscode, uri, body || '', { skipCache: true });
                    known.add(logId);
                    collecting++;
                    output?.appendLine?.(
                        `[Log Auto-Collect] Saved ${logId} (${log?.LogUser?.Name || 'Unknown'} · ${log?.Operation || ''})`
                    );
                } catch (error) {
                    output?.appendLine?.(
                        `[Log Auto-Collect] Failed to save ${logId}: ${String((error as Error)?.message || error)}`
                    );
                }
            }
            return true;
        } catch {
            return false;
        }
    }

    async function tick() {
        if (!vscode.window?.state?.active) return;
        const gotNew = await pollOnce();
        if (gotNew) {
            consecutiveEmpty = 0;
            if (currentIntervalMs !== AUTO_COLLECT_INTERVAL_MS) {
                currentIntervalMs = AUTO_COLLECT_INTERVAL_MS;
                reschedule();
            }
            updateStatus('active');
        } else {
            consecutiveEmpty++;
            if (consecutiveEmpty >= 3 && currentIntervalMs < AUTO_COLLECT_MAX_BACKOFF_MS) {
                currentIntervalMs = AUTO_COLLECT_MAX_BACKOFF_MS;
                reschedule();
            }
            updateStatus('idle');
        }
    }

    function reschedule() {
        if (timer) clearInterval(timer);
        timer = setInterval(tick, currentIntervalMs);
    }

    return {
        start() {
            if (timer) return;
            consecutiveEmpty = 0;
            currentIntervalMs = AUTO_COLLECT_INTERVAL_MS;
            updateStatus('idle');
            void tick();
            reschedule();
        },
        stop() {
            if (timer) {
                clearInterval(timer);
                timer = null;
            }
            updateStatus('stopped');
        },
        isRunning() {
            return timer !== null;
        },
        dispose() {
            if (timer) clearInterval(timer);
            timer = null;
            try {
                statusItem?.dispose?.();
            } catch {
                // ignore
            }
        },
    };
}

/** Ensure a `conn.userId` is set; Chatter-first with SOQL fallback. */
export async function ensureCurrentUserId(connectionRuntime, conn) {
    if (conn?.userId) return conn;
    let userId = '';
    let username = conn.username || '';
    try {
        const me = await connectionRuntime.withToolingClientAuthed(conn, async client =>
            client.requestJson('/chatter/users/me')
        );
        userId = String(me?.id || me?.userId || '').trim();
        username = username || String(me?.username || me?.name || '').trim();
    } catch {
        // Chatter may be disabled — fall through to SOQL
    }
    if (!userId && username) {
        try {
            const rows = await connectionRuntime.withToolingClientAuthed(conn, async client =>
                client.toolingQueryAll(
                    `SELECT Id FROM User WHERE Username = '${escapeSoql(username)}' LIMIT 1`
                )
            );
            userId = String(rows?.[0]?.Id || '').trim();
        } catch {
            // ignore
        }
    }
    if (!userId) return conn;
    const next = { ...conn, userId, username: username || conn.username };
    try {
        await connectionRuntime.saveConn?.(next);
        connectionRuntime.setStatus?.(next);
    } catch {
        // ignore persistence errors
    }
    return next;
}

export function registerTraceFlagsAndLogs({
    connectionRuntime,
    context,
}: {
    connectionRuntime;
    context;
}) {
    const { vscode, output } = context;
    const services = createTraceFlagServices(connectionRuntime);
    const provider = createTraceFlagsContentProvider(vscode, services, connectionRuntime);
    context.addDisposable(provider);

    let hasVirtualDocProvider = false;
    try {
        if (typeof vscode.workspace?.registerTextDocumentContentProvider === 'function') {
            context.addDisposable(
                vscode.workspace.registerTextDocumentContentProvider(SCHEME, provider)
            );
            hasVirtualDocProvider = true;
        }
    } catch {
        hasVirtualDocProvider = false;
    }

    try {
        if (
            typeof vscode.languages?.registerCodeLensProvider === 'function' &&
            typeof vscode.CodeLens === 'function' &&
            typeof vscode.Range === 'function'
        ) {
            const lensProvider = createTraceFlagsCodeLensProvider(vscode);
            context.addDisposable(
                vscode.languages.registerCodeLensProvider(
                    [
                        { scheme: SCHEME, language: 'json' },
                        { scheme: SCHEME },
                        { scheme: 'file', pattern: `**/${FALLBACK_PATH}` },
                    ],
                    lensProvider
                )
            );
        }
    } catch {
        // ignore — CodeLens is a nice-to-have
    }

    const autoCollect = createLogAutoCollect({ vscode, connectionRuntime, services, output });
    context.addDisposable(autoCollect);

    function register(command: string, handler: (...args: unknown[]) => unknown) {
        context.addDisposable(vscode.commands.registerCommand(command, handler));
    }

    function requireConnection() {
        const conn = connectionRuntime.loadStoredConn();
        if (!conn.instanceUrl || !conn.accessToken) {
            vscode.window.showErrorMessage(connectionRuntime.getInjectedConnectionRequiredMessage());
            return null;
        }
        return conn;
    }

    async function showTraceFlagsDocument(conn) {
        const orgId = conn.orgId || 'default';
        if (hasVirtualDocProvider) {
            const uri = createTraceFlagsUri(vscode, orgId);
            provider.refresh(uri);
            const doc = await vscode.workspace.openTextDocument(uri);
            try {
                await vscode.languages?.setTextDocumentLanguage?.(doc, 'json');
            } catch {
                // ignore
            }
            await vscode.window.showTextDocument(doc, { preview: false });
            return;
        }
        const uri = getWorkspaceUri(vscode, FALLBACK_PATH);
        const body = await buildTraceFlagsContent(services, conn);
        await writeTextFile(vscode, uri, body, { skipCache: true });
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, { preview: false });
    }

    async function refreshView(conn) {
        if (hasVirtualDocProvider) {
            provider.refresh(createTraceFlagsUri(vscode, conn.orgId || 'default'));
            return;
        }
        try {
            const uri = getWorkspaceUri(vscode, FALLBACK_PATH);
            const body = await buildTraceFlagsContent(services, conn);
            await writeTextFile(vscode, uri, body, { skipCache: true });
        } catch {
            // ignore — the fallback file is best-effort
        }
    }

    async function pickDurationMinutes() {
        const picked = await vscode.window.showQuickPick(
            [
                { label: '15 minutes', minutes: 15 },
                { label: '30 minutes', minutes: 30 },
                { label: '60 minutes', minutes: 60 },
                { label: '120 minutes', minutes: 120 },
            ],
            { title: 'Enable debug logs', placeHolder: 'Select duration', ignoreFocusOut: true }
        );
        return picked?.minutes || 0;
    }

    async function pickDebugLevel(conn): Promise<{ id: string; name: string } | null> {
        const levels = await services.listDebugLevels(conn);
        if (!levels?.length) {
            await vscode.window.showWarningMessage('No DebugLevel records found in this org.');
            return null;
        }
        const picked = await vscode.window.showQuickPick(
            levels.map(dl => ({
                label: dl.MasterLabel || dl.DeveloperName,
                description: `Apex=${dl.ApexCode} DB=${dl.Database} Vf=${dl.Visualforce}`,
                detail: dl.DeveloperName,
                id: dl.Id,
                name: dl.DeveloperName,
            })),
            { placeHolder: 'Pick a debug level', matchOnDescription: true, matchOnDetail: true }
        );
        if (!picked) return null;
        return { id: picked.id, name: picked.name };
    }

    async function pickOrgUser(conn, currentUserId: string) {
        return await new Promise<{ Id: string; Name: string } | null>(resolve => {
            const picker = vscode.window.createQuickPick();
            picker.placeholder = 'Type at least 2 characters to search users';
            picker.matchOnDescription = true;
            picker.items = [];
            let debounce: ReturnType<typeof setTimeout> | null = null;
            picker.onDidChangeValue((value: string) => {
                if (debounce) clearTimeout(debounce);
                if (!value || value.length < 2) {
                    picker.items = [];
                    return;
                }
                debounce = setTimeout(async () => {
                    picker.busy = true;
                    try {
                        const records = await services.searchUsers(conn, value);
                        picker.items = records
                            .filter(r => r.Id !== currentUserId)
                            .map(r => ({
                                label: `${r.FirstName} ${r.LastName}`.trim() || r.Username,
                                description: `${r.Username} (${r.UserType})`,
                                detail: r.Id,
                                userId: r.Id,
                            }));
                    } catch {
                        picker.items = [];
                    } finally {
                        picker.busy = false;
                    }
                }, 300);
            });
            picker.onDidAccept(() => {
                const [selected] = picker.activeItems;
                picker.hide();
                if (!selected) {
                    resolve(null);
                    return;
                }
                resolve({ Id: (selected as { userId: string }).userId, Name: selected.label });
            });
            picker.onDidHide(() => {
                if (debounce) clearTimeout(debounce);
                picker.dispose();
                resolve(null);
            });
            picker.show();
        });
    }

    async function pickLogLevel(category: { key: string; label: string }, defaultValue: string) {
        const picked = await vscode.window.showQuickPick(
            LOG_LEVELS.map(level => ({ label: level, picked: level === defaultValue })),
            { title: category.label, placeHolder: `Pick ${category.label} level`, ignoreFocusOut: true }
        );
        return picked?.label;
    }

    function sanitizeDeveloperName(label: string) {
        return (
            String(label || '')
                .replace(/\W+/g, '_')
                .replace(/^_|_$/g, '')
                .toUpperCase() || 'DebugLevel'
        );
    }

    // ---- Commands --------------------------------------------------------

    register('salesforceMetadata.traceFlags.open', async () => {
        const conn = requireConnection();
        if (!conn) return;
        await showTraceFlagsDocument(conn);
    });

    register('salesforceMetadata.traceFlags.createForCurrentUser', async () => {
        let conn = requireConnection();
        if (!conn) return;
        conn = await ensureCurrentUserId(connectionRuntime, conn);
        if (!conn.userId) {
            await vscode.window.showErrorMessage('Unable to determine current user id for TraceFlag.');
            return;
        }
        const minutes = await pickDurationMinutes();
        if (!minutes) return;
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Enabling debug logs…',
                cancellable: false,
            },
            async () => {
                await services.ensureTraceFlag(conn, conn.userId, minutes);
            }
        );
        await refreshView(conn);
        await vscode.window.showInformationMessage(`Debug logs enabled for ${minutes} minutes.`);
    });

    register('salesforceMetadata.traceFlags.deleteForCurrentUser', async () => {
        let conn = requireConnection();
        if (!conn) return;
        conn = await ensureCurrentUserId(connectionRuntime, conn);
        if (!conn.userId) {
            await vscode.window.showErrorMessage('Unable to determine current user id.');
            return;
        }
        const flags = await services.listTraceFlags(conn);
        const mine = (flags || []).filter(
            f =>
                String(f.TracedEntityId) === conn.userId &&
                String(f.LogType) === 'DEVELOPER_LOG' &&
                f.ExpirationDate &&
                new Date(f.ExpirationDate).getTime() > Date.now()
        );
        if (!mine.length) {
            await vscode.window.showInformationMessage('No active trace flag to delete.');
            return;
        }
        for (const flag of mine) {
            await services.deleteTraceFlag(conn, flag.Id);
        }
        await refreshView(conn);
        await vscode.window.showInformationMessage('Trace flag deleted.');
    });

    register('salesforceMetadata.traceFlags.createForUser', async () => {
        let conn = requireConnection();
        if (!conn) return;
        conn = await ensureCurrentUserId(connectionRuntime, conn);
        const picked = await pickOrgUser(conn, conn.userId || '');
        if (!picked) return;
        const debugLevel = await pickDebugLevel(conn);
        if (!debugLevel) return;
        const minutes = await pickDurationMinutes();
        if (!minutes) return;
        await services.ensureTraceFlag(conn, picked.Id, minutes, 'USER_DEBUG', debugLevel.id);
        await refreshView(conn);
        await vscode.window.showInformationMessage(`Trace flag created for ${picked.Name}.`);
    });

    register('salesforceMetadata.traceFlags.createLogLevel', async () => {
        const conn = requireConnection();
        if (!conn) return;
        const masterLabel = await vscode.window.showInputBox({
            prompt: 'Master label for the new debug level',
            title: 'Create debug level',
            ignoreFocusOut: true,
        });
        if (!masterLabel?.trim()) return;
        const developerName = await vscode.window.showInputBox({
            prompt: 'Developer name (unique)',
            title: 'Create debug level',
            value: sanitizeDeveloperName(masterLabel.trim()),
            ignoreFocusOut: true,
        });
        if (!developerName?.trim()) return;
        const choice = await vscode.window.showQuickPick(
            [
                { label: 'Use defaults', value: true },
                { label: 'Pick each level…', value: false },
            ],
            { title: 'Create debug level', placeHolder: 'How to set the log levels?' }
        );
        if (!choice) return;
        let levels: Record<string, string>;
        if (choice.value) {
            levels = Object.fromEntries(DEBUG_LEVEL_CATEGORIES.map(c => [c.key, c.default]));
        } else {
            levels = {};
            for (const category of DEBUG_LEVEL_CATEGORIES) {
                // eslint-disable-next-line no-await-in-loop
                const picked = await pickLogLevel(category, category.default);
                if (!picked) return;
                levels[category.key] = picked;
            }
        }
        await services.createDebugLevel(conn, {
            developerName: developerName.trim(),
            masterLabel: masterLabel.trim(),
            levels,
        });
        await refreshView(conn);
        await vscode.window.showInformationMessage(`Debug level "${masterLabel.trim()}" created.`);
    });

    register('salesforceMetadata.traceFlags.deleteForId', async (traceFlagId?: string) => {
        const conn = requireConnection();
        if (!conn) return;
        const id = String(traceFlagId || '').trim();
        if (!id) return;
        await services.deleteTraceFlag(conn, id);
        await refreshView(conn);
    });

    register('salesforceMetadata.traceFlags.changeDebugLevel', async (traceFlagId?: string) => {
        const conn = requireConnection();
        if (!conn) return;
        const id = String(traceFlagId || '').trim();
        if (!id) return;
        const debugLevel = await pickDebugLevel(conn);
        if (!debugLevel) return;
        await services.changeTraceFlagDebugLevel(conn, id, debugLevel.id);
        await refreshView(conn);
    });

    register('salesforceMetadata.traceFlags.deleteDebugLevelForId', async (debugLevelId?: string) => {
        const conn = requireConnection();
        if (!conn) return;
        const id = String(debugLevelId || '').trim();
        if (!id) return;
        try {
            await services.deleteDebugLevel(conn, id);
        } catch (error) {
            const message = String((error as Error)?.message || error);
            output?.appendLine?.(`[TraceFlags] Failed to delete DebugLevel ${id}: ${message}`);
            output?.show?.(true);
            await vscode.window.showErrorMessage(`Failed to delete debug level: ${message}`);
            return;
        }
        await refreshView(conn);
    });

    register('salesforceMetadata.logs.autoCollect.start', async () => {
        const conn = requireConnection();
        if (!conn) return;
        autoCollect.start();
        await vscode.window.showInformationMessage(
            'Salesforce log auto-collect started. Logs will be saved under .salesforce/logs.'
        );
    });

    register('salesforceMetadata.logs.autoCollect.stop', async () => {
        autoCollect.stop();
        await vscode.window.showInformationMessage('Salesforce log auto-collect stopped.');
    });

    return { services, autoCollect };
}
