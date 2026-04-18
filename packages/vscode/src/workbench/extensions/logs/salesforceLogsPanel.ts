import { hasUsableConnection } from '../../connection/connectionFactory';
import {
    DEBUG_LEVEL_CATEGORIES,
    DEBUG_LEVEL_DEFAULT_NAME,
    LOG_LEVELS,
} from '../metadata/commands/traceFlagsAndLogs';

const VIEW_ID = 'salesforceMetadata.salesforceLogsPanel';
const PERIODIC_REFRESH_MS = 30_000;

type AutoCollectHandle = {
    start: () => void;
    stop: () => void;
    isRunning: () => boolean;
    getState: () => { running: boolean; collectedCount: number };
    addStatusChangeListener: (
        listener: (state: { running: boolean; collectedCount: number }) => void
    ) => { dispose: () => void };
};

type PanelSnapshot = {
    connected: boolean;
    host: string;
    problemMessage: string;
    activeUserFlag: {
        id: string;
        logType: string;
        debugLevel: string;
        expiresInLabel: string;
        expirationIso: string;
    } | null;
    activeFlags: Array<{
        id: string;
        logType: string;
        tracedEntity: string;
        debugLevel: string;
        expiresInLabel: string;
    }>;
    debugLevelFields: Record<string, string>;
    recentLogs: Array<{
        id: string;
        startLabel: string;
        user: string;
        operation: string;
        lengthKb: string;
    }>;
    autoCollect: { running: boolean; collectedCount: number };
};

function createNonce() {
    return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

// Extracts a human-readable failure reason from anything thrown through
// `vscode.commands.executeCommand`. The Tooling API client attaches the raw
// Salesforce payload on `.payload` (see `formatSfError`), but in some hosts
// the rejection crosses an RPC boundary and arrives as a plain object without
// an Error prototype — so `err instanceof Error` is false and a naive
// `String(err)` collapses to `[object Object]`. This helper digs into the
// common shapes we actually see: Error instances, Salesforce REST error
// payloads (`{errorCode, message}` or arrays of them), proxy/network wrappers
// (`{error, error_description}`), and finally a safe JSON fallback so we
// never surface `[object Object]` to users again.
function formatCommandError(err: unknown): string {
    if (!err) return 'unknown error';
    if (typeof err === 'string') return err;
    if (err instanceof Error && err.message) return err.message;
    const obj = err as Record<string, unknown>;
    const directMessage =
        (typeof obj.message === 'string' && obj.message) ||
        (typeof obj.error_description === 'string' && obj.error_description) ||
        (typeof obj.error === 'string' && obj.error) ||
        '';
    const directCode =
        (typeof obj.errorCode === 'string' && obj.errorCode) ||
        (typeof obj.error_code === 'string' && obj.error_code) ||
        '';
    if (directMessage || directCode) {
        return [directCode, directMessage].filter(Boolean).join(': ');
    }
    const payload = obj.payload ?? obj.body ?? obj.data;
    const first = Array.isArray(payload) ? payload[0] : payload;
    const nested = first as Record<string, unknown> | null | undefined;
    if (nested && typeof nested === 'object') {
        const code =
            (typeof nested.errorCode === 'string' && nested.errorCode) ||
            (typeof nested.error_code === 'string' && nested.error_code) ||
            '';
        const msg =
            (typeof nested.message === 'string' && nested.message) ||
            (typeof nested.error_description === 'string' && nested.error_description) ||
            (typeof nested.error === 'string' && nested.error) ||
            '';
        const combined = [code, msg].filter(Boolean).join(': ');
        if (combined) return combined;
    }
    try {
        const json = JSON.stringify(err);
        if (json && json !== '{}') return json;
    } catch {
        // ignore circular / non-serializable values
    }
    return String(err);
}

function escapeHtml(value: unknown) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatExpiresIn(expirationIso: string | null | undefined) {
    if (!expirationIso) return '';
    const ms = new Date(expirationIso).getTime() - Date.now();
    if (!Number.isFinite(ms) || ms <= 0) return 'expired';
    const totalMinutes = Math.floor(ms / 60_000);
    if (totalMinutes < 60) return `expires in ${totalMinutes}m`;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `expires in ${hours}h ${minutes}m`;
}

function formatStartTime(iso: string | null | undefined) {
    if (!iso) return '';
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return String(iso);
    }
}

function formatLogLength(length: number | null | undefined) {
    const value = Number(length || 0);
    if (!Number.isFinite(value) || value <= 0) return '0 KB';
    return `${Math.max(1, Math.round(value / 1024))} KB`;
}

async function loadSnapshot({
    connectionRuntime,
    services,
    autoCollect,
    currentUserId,
}: {
    connectionRuntime;
    services;
    autoCollect: AutoCollectHandle;
    currentUserId: string;
}): Promise<PanelSnapshot> {
    const conn = connectionRuntime.loadStoredConn();
    const connected = hasUsableConnection(conn);
    let host = '';
    try {
        host = connected ? new URL(conn.instanceUrl).host : '';
    } catch {
        host = '';
    }

    const autoCollectState = autoCollect.getState();

    if (!connected) {
        return {
            connected: false,
            host: '',
            problemMessage: connectionRuntime.getConnectionProblemMessage(conn),
            activeUserFlag: null,
            activeFlags: [],
            debugLevelFields: Object.fromEntries(DEBUG_LEVEL_CATEGORIES.map(c => [c.key, c.default])),
            recentLogs: [],
            autoCollect: autoCollectState,
        };
    }

    const [flags, debugLevels, recentLogs] = await Promise.all([
        services.listTraceFlags(conn).catch(() => []),
        services.listDebugLevels(conn).catch(() => []),
        services.listRecentLogs(conn, { limit: 10 }).catch(() => []),
    ]);

    const now = Date.now();
    const activeFlagsRaw = (flags || []).filter(flag => {
        const exp = flag?.ExpirationDate ? new Date(flag.ExpirationDate).getTime() : 0;
        return exp > now;
    });

    const tracedIds = [
        ...new Set(activeFlagsRaw.map(f => String(f.TracedEntityId || '')).filter(Boolean)),
    ];
    const labelMap: Map<string, string> = tracedIds.length
        ? await services.fetchEntityLabels(conn, tracedIds).catch(() => new Map())
        : new Map();

    const debugLevelMap = new Map<string, { name: string; fields: Record<string, string> }>();
    for (const dl of debugLevels || []) {
        const fields: Record<string, string> = {};
        for (const category of DEBUG_LEVEL_CATEGORIES) {
            fields[category.key] = String(dl[category.key] || category.default);
        }
        debugLevelMap.set(String(dl.Id), {
            name: dl.MasterLabel || dl.DeveloperName || String(dl.Id),
            fields,
        });
    }

    const workbenchDebug = (debugLevels || []).find(
        dl => dl.DeveloperName === DEBUG_LEVEL_DEFAULT_NAME
    );
    const debugLevelFields: Record<string, string> = {};
    for (const category of DEBUG_LEVEL_CATEGORIES) {
        const value = workbenchDebug?.[category.key];
        debugLevelFields[category.key] =
            typeof value === 'string' && LOG_LEVELS.includes(value) ? value : category.default;
    }

    const activeFlags = activeFlagsRaw.map(flag => {
        const id = String(flag.Id || '');
        const tracedId = String(flag.TracedEntityId || '');
        const debugLevelId = String(flag.DebugLevelId || '');
        return {
            id,
            logType: String(flag.LogType || ''),
            tracedEntity: labelMap.get(tracedId) || tracedId,
            debugLevel: debugLevelMap.get(debugLevelId)?.name || debugLevelId,
            expiresInLabel: formatExpiresIn(flag.ExpirationDate),
        };
    });

    const mine = activeFlagsRaw.find(
        flag =>
            String(flag.TracedEntityId || '') === currentUserId &&
            String(flag.LogType || '') === 'DEVELOPER_LOG'
    );
    const activeUserFlag = mine
        ? {
              id: String(mine.Id || ''),
              logType: String(mine.LogType || ''),
              debugLevel:
                  debugLevelMap.get(String(mine.DebugLevelId || ''))?.name ||
                  String(mine.DebugLevelId || ''),
              expiresInLabel: formatExpiresIn(mine.ExpirationDate),
              expirationIso: String(mine.ExpirationDate || ''),
          }
        : null;

    const recentLogsMapped = (recentLogs || []).map(log => ({
        id: String(log.Id || ''),
        startLabel: formatStartTime(log.StartTime),
        user: String(log?.LogUser?.Name || log?.LogUserId || ''),
        operation: String(log.Operation || log.Request || ''),
        lengthKb: formatLogLength(log.LogLength),
    }));

    return {
        connected: true,
        host,
        problemMessage: '',
        activeUserFlag,
        activeFlags,
        debugLevelFields,
        recentLogs: recentLogsMapped,
        autoCollect: autoCollectState,
    };
}

function buildHtml(nonce: string, snapshot: PanelSnapshot) {
    const { connected, host, problemMessage, activeUserFlag, activeFlags, debugLevelFields } =
        snapshot;
    const statusTitle = connected ? 'Salesforce connected' : 'Salesforce disconnected';
    const statusSubtitle = connected
        ? host || 'Org ready'
        : problemMessage || 'Reconnect to enable logs features.';
    const activeFlagLine = activeUserFlag
        ? `${escapeHtml(activeUserFlag.logType)} &middot; ${escapeHtml(
              activeUserFlag.debugLevel
          )} &middot; <span class="sfCountdown" data-expires-iso="${escapeHtml(
              activeUserFlag.expirationIso
          )}">${escapeHtml(activeUserFlag.expiresInLabel)}</span>`
        : 'No active trace flag';

    const primaryAction = activeUserFlag
        ? {
              label: 'Stop Debug Logs',
              command: 'salesforceMetadata.traceFlags.deleteForCurrentUser',
              arg: '',
          }
        : {
              label: 'Enable Debug Logs (30 min)',
              command: 'salesforceMetadata.traceFlags.createForCurrentUser',
              // Pre-select 30 min so the panel button matches its label without
              // opening a duration picker inside the webview.
              arg: '30',
          };

    // Shown only while a flag is active, so users can renew without the
    // Stop → Enable dance. `createForCurrentUser` PATCHes an existing flag,
    // extending StartDate/ExpirationDate by the preset minutes.
    const extendAction = activeUserFlag
        ? {
              label: 'Extend 30 min',
              command: 'salesforceMetadata.traceFlags.createForCurrentUser',
              arg: '30',
          }
        : null;

    const autoCollectLabel = snapshot.autoCollect.running
        ? `Stop Auto-Collect`
        : `Start Auto-Collect`;
    const autoCollectCommand = snapshot.autoCollect.running
        ? 'salesforceMetadata.logs.autoCollect.stop'
        : 'salesforceMetadata.logs.autoCollect.start';

    const levelOptions = (current: string) =>
        LOG_LEVELS.map(
            level =>
                `<option value="${escapeHtml(level)}"${
                    level === current ? ' selected' : ''
                }>${escapeHtml(level)}</option>`
        ).join('');

    const levelEditorRows = DEBUG_LEVEL_CATEGORIES.map(category => {
        const current = debugLevelFields[category.key] || category.default;
        return `
            <label class="sfLevelRow">
                <span class="sfLevelLabel">${escapeHtml(category.label)}</span>
                <select class="sfSelect sfLevelSelect" data-level-key="${escapeHtml(
                    category.key
                )}" ${connected ? '' : 'disabled'}>
                    ${levelOptions(current)}
                </select>
            </label>
        `;
    }).join('');

    const activeFlagsHtml = activeFlags.length
        ? activeFlags
              .map(
                  flag => `
                    <li class="sfListRow">
                        <div class="sfListRowMain">
                            <strong>${escapeHtml(flag.tracedEntity)}</strong>
                            <span class="sfMuted"> &middot; ${escapeHtml(
                                flag.logType
                            )} &middot; ${escapeHtml(flag.debugLevel)}</span>
                            <div class="sfMuted sfListRowSub">${escapeHtml(flag.expiresInLabel)}</div>
                        </div>
                        <div class="sfListRowActions">
                            <button class="sfButton sfButtonSecondary sfButtonSmall"
                                data-command="salesforceMetadata.traceFlags.changeDebugLevel"
                                data-arg='${escapeHtml(JSON.stringify(flag.id))}'>Change level</button>
                            <button class="sfButton sfButtonSecondary sfButtonSmall"
                                data-command="salesforceMetadata.traceFlags.deleteForId"
                                data-arg='${escapeHtml(JSON.stringify(flag.id))}'>Delete</button>
                        </div>
                    </li>
                `
              )
              .join('')
        : '<li class="sfEmpty">No active trace flags.</li>';

    const recentLogsHtml = snapshot.recentLogs.length
        ? snapshot.recentLogs
              .map(
                  log => `
                    <li class="sfListRow sfLogRow" data-log-id="${escapeHtml(log.id)}">
                        <div class="sfListRowMain">
                            <strong>${escapeHtml(log.startLabel)}</strong>
                            <span class="sfMuted"> &middot; ${escapeHtml(log.user)}</span>
                            <div class="sfMuted sfListRowSub">${escapeHtml(
                                log.operation
                            )} &middot; ${escapeHtml(log.lengthKb)}</div>
                        </div>
                        <div class="sfListRowActions">
                            <button class="sfButton sfButtonSecondary sfButtonSmall"
                                data-command="salesforceMetadata.logs.openById"
                                data-arg='${escapeHtml(JSON.stringify(log.id))}'>Open</button>
                        </div>
                    </li>
                `
              )
              .join('')
        : '<li class="sfEmpty">No recent logs found.</li>';

    const footerLabel = snapshot.autoCollect.running
        ? `Auto-Collect: running (${snapshot.autoCollect.collectedCount})`
        : 'Auto-Collect: idle';

    const statusTone = connected ? '#0f766e' : '#8a2c0d';
    const statusBackground = connected ? '#ecfdf5' : '#fff7ed';
    const statusBorder = connected ? '#99f6e4' : '#fdba74';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
        body {
            margin: 0;
            padding: 8px;
            font: 12px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            color: var(--vscode-foreground, #1f2328);
            background: transparent;
        }
        .sfCard {
            border: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.35));
            border-radius: 8px;
            background: var(--vscode-editor-background, #ffffff);
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
            overflow: hidden;
            max-width: 480px;
            margin: 0 auto;
        }
        .sfHeader {
            padding: 8px 10px;
            border-bottom: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.25));
            background: linear-gradient(180deg, rgba(0, 161, 224, 0.10), rgba(0, 161, 224, 0.02));
        }
        .sfTitle {
            margin: 0;
            font-size: 13px;
            font-weight: 700;
        }
        .sfSubtitle {
            margin: 2px 0 0;
            font-size: 11px;
            color: var(--vscode-descriptionForeground, #6a737d);
        }
        .sfBody {
            padding: 8px 10px 10px;
            display: grid;
            gap: 8px;
        }
        .sfStatus {
            padding: 6px 10px;
            border-radius: 6px;
            border: 1px solid ${statusBorder};
            background: ${statusBackground};
            color: ${statusTone};
            font-size: 11px;
        }
        .sfStatus strong {
            font-size: 12px;
        }
        .sfStatus .sfStatusDetail {
            display: block;
            margin-top: 2px;
        }
        .sfSectionTitle {
            font-weight: 700;
            font-size: 10px;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: var(--vscode-descriptionForeground, #6a737d);
            margin: 0 0 4px;
        }
        .sfActions {
            display: grid;
            gap: 6px;
            grid-template-columns: 1fr;
        }
        .sfButton {
            border: 1px solid transparent;
            border-radius: 6px;
            padding: 6px 10px;
            font: inherit;
            cursor: pointer;
            text-align: left;
            width: 100%;
        }
        .sfButton:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        .sfButtonPrimary {
            background: #0176d3;
            color: #ffffff;
        }
        .sfButtonSecondary {
            background: var(--vscode-button-secondaryBackground, rgba(128, 128, 128, 0.14));
            color: var(--vscode-button-secondaryForeground, var(--vscode-foreground, #1f2328));
            border-color: var(--vscode-panel-border, rgba(128, 128, 128, 0.25));
        }
        .sfButtonSmall {
            width: auto;
            padding: 3px 8px;
            font-size: 11px;
            text-align: center;
        }
        .sfSecondaryGrid {
            display: grid;
            gap: 6px;
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .sfLevelGrid {
            display: grid;
            gap: 4px 6px;
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .sfLevelRow {
            display: grid;
            gap: 1px;
        }
        .sfLevelLabel {
            font-size: 10px;
            color: var(--vscode-descriptionForeground, #6a737d);
        }
        .sfSelect {
            width: 100%;
            border: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.25));
            border-radius: 6px;
            padding: 3px 6px;
            font: inherit;
            color: var(--vscode-foreground, #1f2328);
            background: var(--vscode-input-background, rgba(128, 128, 128, 0.08));
        }
        .sfList {
            list-style: none;
            padding: 0;
            margin: 0;
            display: grid;
            gap: 3px;
        }
        .sfListRow {
            display: flex;
            gap: 8px;
            align-items: center;
            justify-content: space-between;
            padding: 4px 8px;
            border: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.2));
            border-radius: 6px;
            background: var(--vscode-editor-inactiveSelectionBackground, rgba(128, 128, 128, 0.04));
        }
        .sfLogRow {
            cursor: pointer;
        }
        .sfListRowMain {
            min-width: 0;
            flex: 1;
        }
        .sfListRowSub {
            font-size: 10px;
        }
        .sfListRowActions {
            display: flex;
            gap: 4px;
            flex-shrink: 0;
        }
        .sfMuted {
            color: var(--vscode-descriptionForeground, #6a737d);
        }
        .sfEmpty {
            padding: 6px;
            color: var(--vscode-descriptionForeground, #6a737d);
            text-align: center;
            font-style: italic;
            font-size: 11px;
        }
        .sfFooter {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 11px;
            color: var(--vscode-descriptionForeground, #6a737d);
        }
    </style>
</head>
<body>
    <div class="sfCard">
        <div class="sfHeader">
            <h2 class="sfTitle">${escapeHtml(statusTitle)}</h2>
            <p class="sfSubtitle">${escapeHtml(statusSubtitle)}</p>
        </div>
        <div class="sfBody">
            <div class="sfStatus">
                <strong>${escapeHtml(
                    connected ? 'Active user trace flag' : 'Connection required'
                )}</strong>
                <span class="sfStatusDetail">${
                    connected ? activeFlagLine : escapeHtml(problemMessage || '')
                }</span>
            </div>
            <div class="sfActions">
                <button class="sfButton sfButtonPrimary" data-command="${escapeHtml(
                    primaryAction.command
                )}"${
                    primaryAction.arg
                        ? ` data-arg="${escapeHtml(primaryAction.arg)}"`
                        : ''
                } ${connected ? '' : 'disabled'}>${escapeHtml(primaryAction.label)}</button>
                ${
                    extendAction
                        ? `<button class="sfButton sfButtonSecondary" data-command="${escapeHtml(
                              extendAction.command
                          )}" data-arg="${escapeHtml(extendAction.arg)}" ${
                              connected ? '' : 'disabled'
                          }>${escapeHtml(extendAction.label)}</button>`
                        : ''
                }
                <div class="sfSecondaryGrid">
                    <button class="sfButton sfButtonSecondary sfButtonSmall" data-command="salesforceMetadata.traceFlags.open" ${
                        connected ? '' : 'disabled'
                    }>Open Trace Flags</button>
                    <button class="sfButton sfButtonSecondary sfButtonSmall" data-command="salesforceMetadata.traceFlags.createForUser" ${
                        connected ? '' : 'disabled'
                    }>Create for User…</button>
                    <button class="sfButton sfButtonSecondary sfButtonSmall" data-command="salesforceMetadata.traceFlags.createLogLevel" ${
                        connected ? '' : 'disabled'
                    }>Create Debug Level</button>
                    <button class="sfButton sfButtonSecondary sfButtonSmall" data-command="${escapeHtml(
                        autoCollectCommand
                    )}" ${connected ? '' : 'disabled'}>${escapeHtml(autoCollectLabel)}</button>
                </div>
            </div>

            <div>
                <p class="sfSectionTitle">${escapeHtml(DEBUG_LEVEL_DEFAULT_NAME)} levels</p>
                <div class="sfLevelGrid">
                    ${levelEditorRows}
                </div>
            </div>

            <div>
                <p class="sfSectionTitle">Active trace flags</p>
                <ul class="sfList">${activeFlagsHtml}</ul>
            </div>

            <div>
                <p class="sfSectionTitle">Recent logs</p>
                <ul class="sfList">${recentLogsHtml}</ul>
            </div>

            <div class="sfFooter">
                <span>${escapeHtml(footerLabel)}</span>
                <button class="sfButton sfButtonSecondary sfButtonSmall" data-action="refresh">Refresh</button>
            </div>
        </div>
    </div>
    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();

        function postCommand(command, arg) {
            const args = [];
            if (arg !== undefined && arg !== null && arg !== '') {
                try { args.push(JSON.parse(arg)); } catch { args.push(arg); }
            }
            vscode.postMessage({ type: 'command', command, args });
        }

        document.querySelectorAll('[data-command]').forEach(button => {
            button.addEventListener('click', event => {
                event.stopPropagation();
                const command = button.getAttribute('data-command');
                const arg = button.getAttribute('data-arg');
                postCommand(command, arg);
            });
        });

        document.querySelectorAll('.sfLogRow').forEach(row => {
            row.addEventListener('click', event => {
                if (event.target.closest('[data-command]')) return;
                const logId = row.getAttribute('data-log-id');
                if (logId) postCommand('salesforceMetadata.logs.openById', JSON.stringify(logId));
            });
        });

        const refreshButton = document.querySelector('[data-action="refresh"]');
        if (refreshButton) {
            refreshButton.addEventListener('click', () => {
                vscode.postMessage({ type: 'refresh' });
            });
        }

        const levelSelects = document.querySelectorAll('.sfLevelSelect');
        let levelDebounce = null;
        function submitLevels() {
            const levels = {};
            levelSelects.forEach(select => {
                const key = select.getAttribute('data-level-key');
                if (key) levels[key] = select.value;
            });
            vscode.postMessage({
                type: 'command',
                command: 'salesforceMetadata.logs.setWorkbenchDebugLevel',
                args: [levels]
            });
        }
        levelSelects.forEach(select => {
            select.addEventListener('change', () => {
                if (levelDebounce) clearTimeout(levelDebounce);
                levelDebounce = setTimeout(submitLevels, 400);
            });
        });

        // Live countdown for the active user trace flag. Ticks every second
        // instead of waiting for the 30s server refresh, so the "expires in"
        // label reflects reality. When it hits zero we ask the host to
        // re-render so the UI flips back to "Enable Debug Logs".
        const countdownEl = document.querySelector('.sfCountdown');
        if (countdownEl) {
            const expiresIso = countdownEl.getAttribute('data-expires-iso') || '';
            const expiresAt = expiresIso ? Date.parse(expiresIso) : NaN;
            if (Number.isFinite(expiresAt)) {
                let expiredHandled = false;
                const tick = () => {
                    const ms = expiresAt - Date.now();
                    if (ms <= 0) {
                        countdownEl.textContent = 'expired';
                        if (!expiredHandled) {
                            expiredHandled = true;
                            vscode.postMessage({ type: 'refresh' });
                        }
                        return;
                    }
                    const totalSeconds = Math.floor(ms / 1000);
                    const hours = Math.floor(totalSeconds / 3600);
                    const minutes = Math.floor((totalSeconds % 3600) / 60);
                    const seconds = totalSeconds % 60;
                    countdownEl.textContent = hours > 0
                        ? 'expires in ' + hours + 'h ' + minutes + 'm'
                        : 'expires in ' + minutes + 'm ' + seconds + 's';
                };
                tick();
                setInterval(tick, 1000);
            }
        }
    </script>
</body>
</html>`;
}

async function resolveCurrentUserId(connectionRuntime): Promise<string> {
    try {
        const conn = connectionRuntime.loadStoredConn();
        return String(conn?.userId || '').trim();
    } catch {
        return '';
    }
}

export function registerSalesforceLogsPanelProvider({
    connectionRuntime,
    context,
    services,
    autoCollect,
}: {
    connectionRuntime;
    context;
    services;
    autoCollect: AutoCollectHandle;
}) {
    const { vscode } = context;

    try {
        if (typeof vscode.window?.registerWebviewViewProvider === 'function') {
            let activeView: {
                webview?: {
                    html?: string;
                    options?: Record<string, unknown>;
                    onDidReceiveMessage?: (
                        handler: (message: unknown) => void
                    ) => { dispose?: () => void } | void;
                };
                onDidChangeVisibility?: (
                    handler: () => void
                ) => { dispose?: () => void } | void;
                onDidDispose?: (handler: () => void) => { dispose?: () => void } | void;
                visible?: boolean;
            } | null = null;
            let renderSequence = 0;
            let periodicTimer: ReturnType<typeof setInterval> | null = null;

            const render = async () => {
                if (!activeView?.webview) return;
                const current = ++renderSequence;
                const nonce = createNonce();
                const currentUserId = await resolveCurrentUserId(connectionRuntime);
                const snapshot = await loadSnapshot({
                    connectionRuntime,
                    services,
                    autoCollect,
                    currentUserId,
                });
                if (current !== renderSequence || !activeView?.webview) return;
                activeView.webview.options = { enableScripts: true };
                activeView.webview.html = buildHtml(nonce, snapshot);
            };

            const startPeriodic = () => {
                if (periodicTimer) return;
                periodicTimer = setInterval(() => {
                    if (activeView?.visible !== false) void render();
                }, PERIODIC_REFRESH_MS);
            };

            const stopPeriodic = () => {
                if (periodicTimer) {
                    clearInterval(periodicTimer);
                    periodicTimer = null;
                }
            };

            const provider = {
                resolveWebviewView(view) {
                    activeView = view;
                    view.webview.onDidReceiveMessage?.(async (message: unknown) => {
                        const msg = (message || {}) as {
                            type?: string;
                            command?: string;
                            args?: unknown[];
                        };
                        if (msg.type === 'refresh') {
                            await render();
                            return;
                        }
                        if (msg.type !== 'command' || !msg.command) return;
                        try {
                            const args = Array.isArray(msg.args) ? msg.args : [];
                            await vscode.commands.executeCommand(String(msg.command), ...args);
                            await render();
                        } catch (err) {
                            // Surface failures (e.g. Salesforce API 4xx/5xx, missing
                            // permissions) instead of swallowing them silently — the
                            // panel has no other way to signal that a click failed.
                            const reason = formatCommandError(err);
                            // Also log the raw error for deeper diagnosis when the
                            // toast reason is generic (e.g. cross-boundary rejections
                            // that lose their Error prototype).
                            try {
                                // eslint-disable-next-line no-console
                                console.error(
                                    `Salesforce Logs: ${msg.command} failed`,
                                    err
                                );
                            } catch {
                                // ignore console failures
                            }
                            void vscode.window.showErrorMessage(
                                `Salesforce Logs: ${msg.command} failed — ${reason}`
                            );
                            void render();
                        }
                    });
                    view.onDidChangeVisibility?.(() => {
                        if (view.visible) void render();
                    });
                    view.onDidDispose?.(() => {
                        if (activeView === view) {
                            activeView = null;
                        }
                    });
                    startPeriodic();
                    void render();
                },
            };

            const connectionListener = connectionRuntime.addStatusChangeListener(() => {
                void render();
            });
            const autoCollectListener = autoCollect.addStatusChangeListener(() => {
                void render();
            });

            context.addDisposable(
                vscode.window.registerWebviewViewProvider(VIEW_ID, provider)
            );
            context.addDisposable({
                dispose() {
                    stopPeriodic();
                    activeView = null;
                    try {
                        connectionListener?.();
                    } catch {
                        // ignore
                    }
                    try {
                        autoCollectListener?.dispose?.();
                    } catch {
                        // ignore
                    }
                },
            });
            return;
        }
    } catch {
        // fall through to tree data provider
    }

    try {
        if (
            typeof vscode.window?.registerTreeDataProvider !== 'function' ||
            typeof vscode.TreeItem !== 'function'
        ) {
            return;
        }

        const treeDataEmitter =
            typeof vscode.EventEmitter === 'function' ? new vscode.EventEmitter() : null;

        class SfLogsPanelProvider {
            get onDidChangeTreeData() {
                return treeDataEmitter?.event;
            }

            refresh() {
                treeDataEmitter?.fire?.();
            }

            getTreeItem(element) {
                return element;
            }

            getChildren(element) {
                if (element) return [];

                const conn = connectionRuntime.loadStoredConn();
                const connected = hasUsableConnection(conn);
                let host = '';
                try {
                    host = connected ? new URL(conn.instanceUrl).host : '';
                } catch {
                    host = '';
                }

                const mkItem = (
                    label,
                    {
                        description,
                        icon,
                        tooltip,
                    }: { description?: string; icon?: string; tooltip?: string } = {}
                ) => {
                    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
                    if (icon && vscode.ThemeIcon) {
                        item.iconPath = new vscode.ThemeIcon(icon);
                    }
                    if (description) item.description = description;
                    if (tooltip) item.tooltip = tooltip;
                    return item;
                };

                const mkAction = (
                    label,
                    command,
                    {
                        args,
                        ...options
                    }: {
                        args?: unknown[];
                        description?: string;
                        icon?: string;
                        tooltip?: string;
                    } = {}
                ) => {
                    const item = mkItem(label, options);
                    item.command = {
                        command,
                        title: label,
                        arguments: Array.isArray(args) ? args : undefined,
                    };
                    return item;
                };

                const items = [
                    mkItem(connected ? `Connected${host ? `: ${host}` : ''}` : 'Disconnected', {
                        icon: connected ? 'cloud' : 'cloud-off',
                        description: connected
                            ? 'Salesforce org ready'
                            : 'Toolkit session required',
                    }),
                ];

                if (!connected) {
                    return items;
                }

                items.push(
                    mkAction(
                        'Enable Debug Logs',
                        'salesforceMetadata.traceFlags.createForCurrentUser',
                        { icon: 'bug' }
                    ),
                    mkAction(
                        'Stop Debug Logs',
                        'salesforceMetadata.traceFlags.deleteForCurrentUser',
                        { icon: 'debug-stop' }
                    ),
                    mkAction('Open Trace Flags', 'salesforceMetadata.traceFlags.open', {
                        icon: 'list-tree',
                    }),
                    mkAction(
                        'Create Trace Flag for User…',
                        'salesforceMetadata.traceFlags.createForUser',
                        { icon: 'person-add' }
                    ),
                    mkAction(
                        'Create Debug Level',
                        'salesforceMetadata.traceFlags.createLogLevel',
                        { icon: 'add' }
                    ),
                    mkAction(
                        autoCollect.isRunning() ? 'Stop Auto-Collect' : 'Start Auto-Collect',
                        autoCollect.isRunning()
                            ? 'salesforceMetadata.logs.autoCollect.stop'
                            : 'salesforceMetadata.logs.autoCollect.start',
                        { icon: 'sync' }
                    )
                );
                return items;
            }
        }

        const provider = new SfLogsPanelProvider();
        const connectionListener = connectionRuntime.addStatusChangeListener(() => {
            provider.refresh();
        });
        const autoCollectListener = autoCollect.addStatusChangeListener(() => {
            provider.refresh();
        });

        context.addDisposable(vscode.window.registerTreeDataProvider(VIEW_ID, provider));
        context.addDisposable({
            dispose() {
                treeDataEmitter?.dispose?.();
                try {
                    connectionListener?.();
                } catch {
                    // ignore
                }
                try {
                    autoCollectListener?.dispose?.();
                } catch {
                    // ignore
                }
            },
        });
    } catch {
        // ignore
    }
}
