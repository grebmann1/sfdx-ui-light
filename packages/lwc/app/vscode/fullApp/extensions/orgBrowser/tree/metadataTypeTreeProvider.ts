import { createCustomFieldNode } from './customFieldNode';
import {
    createOrgBrowserNode,
    createTreeItem,
    isFolderType,
    type OrgBrowserNode,
} from './orgBrowserNode';

const ROOT_CACHE_KEY = '__root__';

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

    private async loadChildren(element: OrgBrowserNode | undefined, conn) {
        if (!element) {
            const types = await this.dataRuntime.listMetadataTypes(conn);
            return types.map(type =>
                createOrgBrowserNode({
                    kind: type.inFolder || isFolderType(type.xmlName) ? 'folderType' : 'type',
                    label: type.xmlName,
                    xmlName: type.xmlName,
                })
            );
        }

        if (element.kind === 'customObject') {
            const describe = await this.dataRuntime.describeCustomObject(
                element.componentName,
                conn
            );
            const fields = Array.isArray(describe?.fields)
                ? describe.fields
                      .filter(field => field?.custom)
                      .sort((left, right) =>
                          String(left?.name || '').localeCompare(String(right?.name || ''))
                      )
                : [];
            const nodes = [];
            for (const field of fields) {
                const fullName = `${element.componentName}.${String(field?.name || '').trim()}`;
                // eslint-disable-next-line no-await-in-loop
                const filePresent = await this.dataRuntime.isMemberPresent('CustomField', fullName);
                nodes.push(createCustomFieldNode(element, field, { filePresent }));
            }
            return nodes;
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
            return folders.map(folder =>
                createOrgBrowserNode({
                    kind: 'folder',
                    folderName: String(folder.fullName || ''),
                    label: String(folder.fullName || ''),
                    namespace: folder.namespacePrefix ? String(folder.namespacePrefix) : undefined,
                    xmlName: element.xmlName,
                })
            );
        }

        if (element.kind === 'folder') {
            const members = await this.dataRuntime.listMetadata(
                element.xmlName,
                element.folderName,
                conn
            );
            return await this.buildComponentNodes(element.xmlName, members);
        }

        if (element.kind === 'type') {
            const members = await this.dataRuntime.listMetadata(element.xmlName, undefined, conn);
            return await this.buildComponentNodes(element.xmlName, members);
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
