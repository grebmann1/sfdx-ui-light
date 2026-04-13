export type SoqlItemContext = {
    sobjectName?: string;
    fieldName?: string;
    relationshipName?: string;
    onlyAggregatable?: boolean;
    onlyGroupable?: boolean;
    onlySortable?: boolean;
    onlyNillable?: boolean;
    onlyTypes?: string[];
    mostLikelyItems?: string[];
    dontShowRelationshipField?: boolean;
};

type SchemaField = {
    name?: string;
    label?: string;
    type?: string;
    relationshipName?: string;
    referenceTo?: string[];
    picklistValues?: string[];
    filterable?: boolean;
    sortable?: boolean;
    aggregatable?: boolean;
    groupable?: boolean;
    nillable?: boolean;
};

type SchemaChildRel = {
    childSObject?: string;
    field?: string;
    relationshipName?: string;
};

type SObjectDescribe = {
    name?: string;
    fields?: SchemaField[];
    childRelationships?: SchemaChildRel[];
};

export type ProtocolCompletionItem = {
    label: string | { label: string };
    kind?: number;
    insertText?: string;
    detail?: string;
    data?: { soqlContext?: SoqlItemContext };
    sortText?: string;
    filterText?: string;
    preselect?: boolean;
};

type CompletionItemKindEnum = {
    Field: number;
    Class: number;
    Value: number;
    Snippet: number;
    Keyword: number;
    EnumMember: number;
};

export type SchemaToolsApi = {
    ensureGlobalDescribe: (
        conn: Record<string, unknown>,
        opts?: { force?: boolean }
    ) => Promise<{ sobjects?: { name?: string; label?: string; queryable?: boolean }[] }>;
    ensureSObjectDescribe: (
        conn: Record<string, unknown>,
        name: string,
        opts?: { force?: boolean }
    ) => Promise<SObjectDescribe | null>;
};

export type SoqlCompletionMiddlewareDeps = {
    CompletionItemKind: CompletionItemKindEnum;
    loadConnection: () => Record<string, unknown> | null;
    getSchemaApi: () => SchemaToolsApi | null;
};

const EXPANDABLE_ITEM_PATTERN = /__([A-Z_]+)/;

function getLabelString(item: ProtocolCompletionItem): string {
    return typeof item.label === 'string' ? item.label : item.label.label;
}

function objectFieldMatchesSOQLContext(field: SchemaField, soqlContext: SoqlItemContext): boolean {
    const aggregatable = field.aggregatable !== false;
    const groupable = field.groupable !== false;
    const sortable = field.sortable !== false;
    const nillable = field.nillable !== false;
    return (
        (aggregatable || !soqlContext.onlyAggregatable) &&
        (groupable || !soqlContext.onlyGroupable) &&
        (sortable || !soqlContext.onlySortable) &&
        (nillable || !soqlContext.onlyNillable) &&
        (!soqlContext.onlyTypes?.length || soqlContext.onlyTypes.includes(String(field.type || '')))
    );
}

function newCompletionItem(
    kinds: CompletionItemKindEnum,
    label: string,
    insertText: string,
    kind: number = kinds.Field,
    extraOptions: Partial<ProtocolCompletionItem> = {}
): ProtocolCompletionItem {
    return {
        label,
        kind,
        insertText,
        ...extraOptions,
    };
}

function newFieldCompletionItems(
    kinds: CompletionItemKindEnum,
    field: SchemaField,
    soqlContext: SoqlItemContext
): ProtocolCompletionItem[] {
    const fieldItems: ProtocolCompletionItem[] = [];
    const fieldNameLowercase = String(field.name || '').toLowerCase();
    const isPreferredItem = soqlContext.mostLikelyItems?.some(
        f => f.toLowerCase() === fieldNameLowercase
    );

    fieldItems.push(
        newCompletionItem(
            kinds,
            (isPreferredItem ? '★ ' : '') + String(field.name),
            String(field.name),
            kinds.Field,
            Object.assign(
                { detail: field.type || '' },
                isPreferredItem
                    ? {
                          preselect: true,
                          sortText: ` ${field.name}`,
                          filterText: ` ${field.name}`,
                      }
                    : {}
            )
        )
    );
    if (field.relationshipName && !soqlContext.dontShowRelationshipField) {
        fieldItems.push(
            newCompletionItem(
                kinds,
                `${field.relationshipName}`,
                `${field.relationshipName}.`,
                kinds.Class,
                {
                    detail: `Ref. to ${(field.referenceTo || []).join(',')}`,
                }
            )
        );
    }
    return fieldItems;
}

export function createSoqlCompletionMiddleware(deps: SoqlCompletionMiddlewareDeps) {
    const { CompletionItemKind, loadConnection, getSchemaApi } = deps;

    async function safeRetrieveSObject(sobjectName?: string): Promise<SObjectDescribe | undefined> {
        if (!sobjectName) {
            return undefined;
        }
        const conn = loadConnection();
        const api = getSchemaApi();
        if (!conn || !api || !conn.instanceUrl || !conn.accessToken) {
            return undefined;
        }
        try {
            const result = await api.ensureSObjectDescribe(conn, sobjectName);
            return result || undefined;
        } catch {
            return undefined;
        }
    }

    async function filterByContext(
        items: ProtocolCompletionItem[]
    ): Promise<ProtocolCompletionItem[]> {
        const filteredItems: ProtocolCompletionItem[] = [];

        for (const item of items) {
            if (
                !EXPANDABLE_ITEM_PATTERN.test(getLabelString(item)) &&
                item?.data?.soqlContext?.sobjectName &&
                item?.data?.soqlContext?.fieldName
            ) {
                const objMetadata = await safeRetrieveSObject(item.data.soqlContext.sobjectName);
                if (objMetadata) {
                    const fieldMeta = objMetadata.fields?.find(
                        f => f.name === item.data?.soqlContext?.fieldName
                    );
                    if (
                        fieldMeta &&
                        !objectFieldMatchesSOQLContext(fieldMeta, item.data.soqlContext)
                    ) {
                        continue;
                    }
                }
            }

            filteredItems.push(item);
        }

        return filteredItems;
    }

    const expandFunctions: Record<
        string,
        (soqlContext: SoqlItemContext) => Promise<ProtocolCompletionItem[]>
    > = {
        SOBJECTS_PLACEHOLDER: async () => {
            const conn = loadConnection();
            const api = getSchemaApi();
            if (!conn || !api || !conn.instanceUrl || !conn.accessToken) {
                return [];
            }
            try {
                const global = await api.ensureGlobalDescribe(conn);
                const sobjects = Array.isArray(global?.sobjects) ? global.sobjects : [];
                return sobjects
                    .filter(obj => obj?.queryable !== false)
                    .map(obj => {
                        const name = String(obj?.name || '');
                        return newCompletionItem(
                            CompletionItemKind,
                            name,
                            name,
                            CompletionItemKind.Class,
                            {
                                detail: String(obj?.label || name),
                            }
                        );
                    });
            } catch {
                return [];
            }
        },

        SOBJECT_FIELDS_PLACEHOLDER: async soqlContext => {
            const objMetadata = await safeRetrieveSObject(soqlContext.sobjectName);
            if (!objMetadata) {
                return [];
            }

            return (objMetadata.fields || []).reduce(
                (fieldItems: ProtocolCompletionItem[], field) => {
                    if (!objectFieldMatchesSOQLContext(field, soqlContext)) {
                        return fieldItems;
                    }
                    return [
                        ...fieldItems,
                        ...newFieldCompletionItems(CompletionItemKind, field, soqlContext),
                    ];
                },
                []
            );
        },

        RELATIONSHIPS_PLACEHOLDER: async soqlContext => {
            const objMetadata = await safeRetrieveSObject(soqlContext.sobjectName);
            if (!objMetadata) {
                return [];
            }

            return (objMetadata.childRelationships || []).reduce(
                (fieldItems: ProtocolCompletionItem[], childRelationship) => {
                    if (!childRelationship.relationshipName) {
                        return fieldItems;
                    }

                    fieldItems.push(
                        newCompletionItem(
                            CompletionItemKind,
                            `${childRelationship.relationshipName}`,
                            String(childRelationship.relationshipName),
                            CompletionItemKind.Class,
                            { detail: childRelationship.childSObject }
                        )
                    );

                    return fieldItems;
                },
                []
            );
        },

        RELATIONSHIP_FIELDS_PLACEHOLDER: async soqlContext => {
            const parentObject = await safeRetrieveSObject(soqlContext.sobjectName);
            if (!parentObject) {
                return [];
            }

            const relationship = parentObject.childRelationships?.find(
                rel => rel.relationshipName === soqlContext.relationshipName
            );

            if (!relationship) {
                return [];
            }

            const objMetadata = await safeRetrieveSObject(relationship?.childSObject);
            if (!objMetadata) {
                return [];
            }

            return (objMetadata.fields || []).reduce(
                (fieldItems: ProtocolCompletionItem[], field) => {
                    if (!objectFieldMatchesSOQLContext(field, soqlContext)) {
                        return fieldItems;
                    }
                    return [
                        ...fieldItems,
                        ...newFieldCompletionItems(CompletionItemKind, field, soqlContext),
                    ];
                },
                []
            );
        },

        LITERAL_VALUES_FOR_FIELD: async soqlContext => {
            const objMetadata = await safeRetrieveSObject(soqlContext.sobjectName);
            if (!objMetadata || !soqlContext.fieldName) {
                return [];
            }

            let items: ProtocolCompletionItem[] = [];
            const fieldMeta = objMetadata.fields?.find(
                field => field.name === soqlContext.fieldName
            );
            if (fieldMeta) {
                if (
                    ['picklist', 'multipicklist'].includes(String(fieldMeta.type || '')) &&
                    fieldMeta?.picklistValues
                ) {
                    items = items.concat(
                        fieldMeta.picklistValues.map(v =>
                            newCompletionItem(
                                CompletionItemKind,
                                String(v),
                                `'${v}'`,
                                CompletionItemKind.Value,
                                {}
                            )
                        )
                    );
                }
            }

            return items;
        },
    };

    async function expandPlaceholders(
        items: ProtocolCompletionItem[]
    ): Promise<ProtocolCompletionItem[]> {
        const expandedItems = [...items];

        for (const [index, item] of items.entries()) {
            const parsedCommand = getLabelString(item).match(EXPANDABLE_ITEM_PATTERN);
            if (parsedCommand) {
                const commandName = parsedCommand[1];

                const handler = expandFunctions[commandName];
                if (handler) {
                    expandedItems.splice(
                        index,
                        1,
                        ...(await handler(item?.data?.soqlContext ?? {}))
                    );
                }
            }
        }

        return expandedItems;
    }

    return {
        provideCompletionItem: async (
            document: unknown,
            position: unknown,
            context: unknown,
            token: unknown,
            next: (...args: unknown[]) => Promise<ProtocolCompletionItem[]>
        ) => {
            const items = await next(document, position, context, token);
            return expandPlaceholders(await filterByContext(items));
        },
    };
}
