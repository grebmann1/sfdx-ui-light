import { sanitizeSoqlText } from './soqlQueryRunner';

type QueryPlanClient = {
    requestJson: (path: string) => Promise<unknown>;
};

type ConnectionRuntimeLike = {
    loadStoredConn: () => Record<string, unknown>;
    withToolingClientAuthed: <T>(
        conn: Record<string, unknown>,
        callback: (client: QueryPlanClient) => Promise<T>
    ) => Promise<T>;
    getInjectedConnectionRequiredMessage: () => string;
};

type OutputChannelLike = {
    clear?: () => void;
    appendLine?: (line: string) => void;
    show?: (preserveFocus?: boolean) => void;
};

type VscodeLike = {
    window?: {
        showErrorMessage?: (message: string) => Thenable<unknown> | Promise<unknown> | unknown;
    };
};

type QueryPlanRow = {
    cardinality: number;
    fields: string[];
    leadingOperationType: string;
    relativeCost: number;
    sobjectCardinality: number;
    sobjectType: string;
};

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asNumber(value: unknown): number {
    return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function asString(value: unknown): string {
    return String(value ?? '');
}

function normalizePlans(payload: unknown): QueryPlanRow[] {
    const plans = asRecord(payload).plans;
    if (!Array.isArray(plans)) {
        return [];
    }
    return plans.map(plan => {
        const row = asRecord(plan);
        return {
            cardinality: asNumber(row.cardinality),
            fields: Array.isArray(row.fields) ? row.fields.map(asString) : [],
            leadingOperationType: asString(row.leadingOperationType),
            relativeCost: asNumber(row.relativeCost),
            sobjectCardinality: asNumber(row.sobjectCardinality),
            sobjectType: asString(row.sobjectType),
        };
    });
}

function formatPlanTable(plans: QueryPlanRow[]): string[] {
    const lines = [
        '| Cardinality | Fields | Leading Operation | Relative Cost | SObject Cardinality | SObject |',
        '| --- | --- | --- | --- | --- | --- |',
    ];
    for (const plan of plans) {
        lines.push(
            `| ${plan.cardinality} | ${plan.fields.join(', ')} | ${plan.leadingOperationType} | ${plan.relativeCost} | ${plan.sobjectCardinality} | ${plan.sobjectType} |`
        );
    }
    return lines;
}

export function formatSoqlQueryPlanOutput(query: string, payload: unknown): string {
    const plans = normalizePlans(payload);
    const lines = ['# SOQL Query Plan', '', `Query: ${query}`, ''];
    if (!plans.length) {
        lines.push('No query plan rows were returned.');
        return lines.join('\n');
    }
    lines.push(...formatPlanTable(plans));
    lines.push('');
    return lines.join('\n');
}

export async function runAndShowSoqlQueryPlan({
    connectionRuntime,
    outputChannel,
    vscode,
    soql,
}: {
    connectionRuntime: ConnectionRuntimeLike;
    outputChannel?: OutputChannelLike | null;
    vscode?: VscodeLike;
    soql: string;
}) {
    const query = sanitizeSoqlText(soql);
    if (!query) {
        throw new Error('A SOQL query is required to run explain.');
    }
    const conn = connectionRuntime.loadStoredConn();
    if (!conn?.instanceUrl || !conn?.accessToken) {
        throw new Error(connectionRuntime.getInjectedConnectionRequiredMessage());
    }
    const explainPath = `/query?explain=${encodeURIComponent(query)}`;
    const response = await connectionRuntime.withToolingClientAuthed(
        conn,
        async client => await client.requestJson(explainPath)
    );
    const formatted = formatSoqlQueryPlanOutput(query, response);
    if (outputChannel?.appendLine) {
        outputChannel.clear?.();
        for (const line of formatted.split('\n')) {
            outputChannel.appendLine(line);
        }
        outputChannel.show?.(true);
    } else {
        await vscode?.window?.showErrorMessage?.(
            'SOQL explain completed, but no output channel is available in this runtime.'
        );
    }
    return response;
}
