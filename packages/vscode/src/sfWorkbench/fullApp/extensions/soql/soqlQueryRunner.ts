export type ToolingClient = { requestJson: (path: string) => Promise<Record<string, unknown>> };

export type ConnectionRuntimeLike = {
    withToolingClientAuthed: <T>(
        conn: Record<string, unknown>,
        fn: (client: ToolingClient) => Promise<T>
    ) => Promise<T>;
};

export function sanitizeSoqlText(soql: string | undefined | null): string {
    return String(soql || '')
        .split(/\r?\n/)
        .filter(line => {
            const trimmed = line.trim();
            return !trimmed.startsWith('//') && !trimmed.startsWith('--');
        })
        .join('\n')
        .trim();
}

export type SoqlQueryResult = {
    query: string;
    tooling: boolean;
    totalSize: number;
    records: Record<string, unknown>[];
};

export async function executeSoqlQuery({
    connectionRuntime,
    conn,
    soql,
    tooling = false,
}: {
    connectionRuntime: ConnectionRuntimeLike;
    conn: Record<string, unknown>;
    soql: string;
    tooling?: boolean;
}): Promise<SoqlQueryResult | null> {
    const query = sanitizeSoqlText(soql);
    if (!query) return null;
    const path = tooling
        ? `/tooling/query?q=${encodeURIComponent(query)}`
        : `/query?q=${encodeURIComponent(query)}`;
    return connectionRuntime.withToolingClientAuthed(conn, async client => {
        const first = (await client.requestJson(path)) as Record<string, unknown>;
        const pages: Record<string, unknown>[] = [first];
        let nextUrl = first?.nextRecordsUrl as string | undefined;
        while (nextUrl) {
            // eslint-disable-next-line no-await-in-loop
            const page = (await client.requestJson(nextUrl)) as Record<string, unknown>;
            pages.push(page);
            nextUrl = page?.nextRecordsUrl as string | undefined;
        }
        const records = pages.flatMap(page => (page?.records as Record<string, unknown>[]) || []);
        return {
            query,
            tooling: Boolean(tooling),
            totalSize: Number(first?.totalSize ?? records.length),
            records,
        };
    });
}
