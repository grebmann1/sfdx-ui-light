import { createCustomFieldNode } from './customFieldNode';
import {
    createOrgBrowserNode,
    createTreeItem,
    isFolderType,
    type OrgBrowserNode,
} from './orgBrowserNode';

const ROOT_CACHE_KEY = '__root__';
const EMPTY_NODE_LABEL = 'No items found';
const EMPTY_ROOT_LABEL = 'No metadata types available';

function buildNamespacedObjectApiName(
    namespace: string | undefined,
    componentName: string | undefined
) {
    const normalizedComponentName = String(componentName || '').trim();
    if (!normalizedComponentName) {
        return '';
    }
    const normalizedNamespace = String(namespace || '').trim();
    if (!normalizedNamespace) {
        return normalizedComponentName;
    }
    return `${normalizedNamespace}__${normalizedComponentName}`;
}

function stripNamespacePrefix(namespace: string | undefined, value: string) {
    const normalizedNamespace = String(namespace || '').trim();
    const normalizedValue = String(value || '').trim();
    if (!normalizedNamespace) {
        return normalizedValue;
    }
    return normalizedValue.replace(new RegExp(`^${normalizedNamespace}__`), '');
}

function hasUsableWorkbenchConnection(conn) {
    return Boolean(conn?.instanceUrl && conn?.accessToken);
}

export class MetadataTypeTreeProvider {
    private childrenCache = new Map<string, Promise<OrgBrowserNode[]> | OrgBrowserNode[]>();
    private emitter;
    private treeView = null;

    constructor(
        private connectionRuntime,
        private dataRuntime,
        private vscode
    ) {
        const EventEmitterCtor =
            vscode.EventEmitter ||
            class {
                event = () => {};
                fire() {}
                dispose() {}
            };
        this.emitter = new EventEmitterCtor();
    }

    get onDidChangeTreeData() {
        return this.emitter.event;
    }

    setTreeView(treeView) {
        this.treeView = treeView || null;
        this.updateViewMessage();
    }

    fireChangeEvent(node?: OrgBrowserNode) {
        this.emitter.fire(node);
    }

    async refreshType(node?: OrgBrowserNode) {
        if (typeof this.dataRuntime?.invalidateCustomObjectFieldPresenceCache === 'function') {
            if (!node) {
                this.dataRuntime.invalidateCustomObjectFieldPresenceCache();
            } else if (node.kind === 'customObject') {
                this.dataRuntime.invalidateCustomObjectFieldPresenceCache(node.componentName);
            } else if (node.kind === 'type' && node.xmlName === 'CustomObject') {
                this.dataRuntime.invalidateCustomObjectFieldPresenceCache();
            }
        }
        if (!node) {
            this.childrenCache.clear();
        } else if (node.kind === 'folder') {
            this.childrenCache.delete(node.id);
        } else {
            this.childrenCache.clear();
        }
        this.updateViewMessage();
        this.fireChangeEvent(node);
    }

    getTreeItem(element: OrgBrowserNode) {
        return createTreeItem(this.vscode, element);
    }

    async getChildren(element?: OrgBrowserNode) {
        const conn = this.connectionRuntime.loadStoredConn();
        this.updateViewMessage(conn);
        if (!hasUsableWorkbenchConnection(conn)) {
            return [];
        }
        const cacheKey = element?.id || ROOT_CACHE_KEY;
        const cached = this.childrenCache.get(cacheKey);
        if (cached) {
            return await cached;
        }
        const pending = this.loadChildren(element, conn)
            .then(children => {
                this.childrenCache.set(cacheKey, children);
                return children;
            })
            .catch(error => {
                this.childrenCache.delete(cacheKey);
                throw error;
            });
        this.childrenCache.set(cacheKey, pending);
        return await pending;
    }

    dispose() {
        try {
            this.emitter.dispose?.();
        } catch {
            // ignore
        }
    }

    private updateViewMessage(conn = this.connectionRuntime.loadStoredConn()) {
        if (!this.treeView) {
            return;
        }
        try {
            this.treeView.message = hasUsableWorkbenchConnection(conn)
                ? 'Browse metadata types and retrieve items into the workspace.'
                : this.connectionRuntime.getConnectionProblemMessage(conn);
        } catch {
            // ignore
        }
    }

    private createEmptyNode(parent: OrgBrowserNode | undefined, label: string) {
        return createOrgBrowserNode({
            kind: 'empty',
            label,
            description: 'Connected org returned no results for this level.',
            componentName: parent ? `__empty__:${parent.id}` : '__empty__root',
            xmlName: parent?.xmlName || '__empty__',
        });
    }

    private async loadChildren(element: OrgBrowserNode | undefined, conn) {
        if (!element) {
            const types = await this.dataRuntime.listMetadataTypes(conn);
            const nodes = types.map(type =>
                createOrgBrowserNode({
                    kind: type.inFolder || isFolderType(type.xmlName) ? 'folderType' : 'type',
                    label: type.xmlName,
                    xmlName: type.xmlName,
                })
            );
            return nodes.length > 0 ? nodes : [this.createEmptyNode(undefined, EMPTY_ROOT_LABEL)];
        }

        if (element.kind === 'customObject') {
            const objectApiName = buildNamespacedObjectApiName(
                element.namespace,
                element.componentName
            );
            const describe = await this.dataRuntime.describeCustomObject(objectApiName, conn);
            const fields = Array.isArray(describe?.fields)
                ? describe.fields
                      .filter(field => field?.custom)
                      .sort((left, right) =>
                          String(left?.name || '').localeCompare(String(right?.name || ''))
                      )
                : [];
            const nodes = await Promise.all(
                fields.map(async field => {
                    const rawFieldName = String(field?.name || '').trim();
                    const memberFieldName = stripNamespacePrefix(element.namespace, rawFieldName);
                    const fullName = `${String(element.componentName || '').trim()}.${memberFieldName}`;
                    const filePresent = await this.dataRuntime.isMemberPresent(
                        'CustomField',
                        fullName
                    );
                    return createCustomFieldNode(element, field, { filePresent });
                })
            );
            return nodes.length > 0 ? nodes : [this.createEmptyNode(element, EMPTY_NODE_LABEL)];
        }

        if (
            element.kind === 'folderType' ||
            (element.kind === 'type' && isFolderType(element.xmlName))
        ) {
            const folders = await this.dataRuntime.listMetadata(
                `${element.xmlName}Folder`,
                undefined,
                conn
            );
            const nodes = folders.map(folder =>
                createOrgBrowserNode({
                    kind: 'folder',
                    folderName: String(folder.fullName || ''),
                    label: String(folder.fullName || ''),
                    namespace: folder.namespacePrefix ? String(folder.namespacePrefix) : undefined,
                    xmlName: element.xmlName,
                })
            );
            return nodes.length > 0 ? nodes : [this.createEmptyNode(element, EMPTY_NODE_LABEL)];
        }

        if (element.kind === 'folder') {
            const members = await this.dataRuntime.listMetadata(
                element.xmlName,
                element.folderName,
                conn
            );
            const nodes = await this.buildComponentNodes(element.xmlName, members);
            return nodes.length > 0 ? nodes : [this.createEmptyNode(element, EMPTY_NODE_LABEL)];
        }

        if (element.kind === 'type') {
            const members = await this.dataRuntime.listMetadata(element.xmlName, undefined, conn);
            const nodes = await this.buildComponentNodes(element.xmlName, members);
            return nodes.length > 0 ? nodes : [this.createEmptyNode(element, EMPTY_NODE_LABEL)];
        }

        return [];
    }

    private async buildComponentNodes(xmlName: string, members) {
        const nodes = [];
        for (const member of members || []) {
            const fullName = String(member?.fullName || '').trim();
            if (!fullName) {
                continue;
            }
            // eslint-disable-next-line no-await-in-loop
            const filePresent = await this.dataRuntime.isMemberPresent(xmlName, fullName);
            nodes.push(
                createOrgBrowserNode({
                    componentName: fullName,
                    filePresent,
                    kind: xmlName === 'CustomObject' ? 'customObject' : 'component',
                    label: fullName,
                    namespace: member?.namespacePrefix ? String(member.namespacePrefix) : undefined,
                    xmlName,
                })
            );
        }
        return nodes;
    }
}
