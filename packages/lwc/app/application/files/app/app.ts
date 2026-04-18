import { track } from 'lwc';
import LightningConfirm from 'lightning/confirm';
import Toast from 'lightning/toast';
import { classSet, isEmpty } from 'shared/utils';
import ToolkitElement from 'core/toolkitElement';
import { getIndexedDbFileSystem } from 'core/fs';

function getFileExtension(path) {
    const name = String(path || '');
    const idx = name.lastIndexOf('.');
    if (idx <= -1 || idx === name.length - 1) return '';
    return name.slice(idx + 1).toLowerCase();
}

function getDoctypeIconForExtension(ext) {
    switch (String(ext || '').toLowerCase()) {
        case 'csv':
            return 'doctype:csv';
        case 'xls':
        case 'xlsx':
            return 'doctype:excel';
        case 'doc':
        case 'docx':
            return 'doctype:word';
        case 'ppt':
        case 'pptx':
            return 'doctype:ppt';
        case 'pdf':
            return 'doctype:pdf';
        case 'zip':
        case 'gz':
        case 'tgz':
            return 'doctype:zip';
        case 'xml':
            return 'doctype:xml';
        case 'html':
        case 'htm':
            return 'doctype:html';
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif':
        case 'webp':
        case 'svg':
            return 'doctype:image';
        case 'mp4':
            return 'doctype:mp4';
        case 'mp3':
        case 'wav':
            return 'doctype:audio';
        case 'exe':
            return 'doctype:exe';
        default:
            return 'doctype:txt';
    }
}

function getIconForEntry({ path, isSymbolicLink }) {
    if (isSymbolicLink) return 'doctype:link';
    return getDoctypeIconForExtension(getFileExtension(path));
}

function toLanguageFromExtension(ext) {
    switch (ext) {
        case 'js':
        case 'mjs':
        case 'cjs':
            return 'javascript';
        case 'ts':
            return 'typescript';
        case 'json':
            return 'json';
        case 'html':
        case 'htm':
            return 'html';
        case 'css':
            return 'css';
        case 'md':
        case 'markdown':
            return 'markdown';
        case 'xml':
            return 'xml';
        case 'yml':
        case 'yaml':
            return 'yaml';
        case 'sh':
        case 'bash':
            return 'bash';
        case 'py':
            return 'python';
        case 'txt':
        default:
            return 'txt';
    }
}

function isImageExtension(ext) {
    switch (String(ext || '').toLowerCase()) {
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif':
        case 'webp':
        case 'svg':
        case 'bmp':
        case 'ico':
        case 'avif':
            return true;
        default:
            return false;
    }
}

function imageMimeTypeFromExtension(ext) {
    switch (String(ext || '').toLowerCase()) {
        case 'png':
            return 'image/png';
        case 'jpg':
        case 'jpeg':
            return 'image/jpeg';
        case 'gif':
            return 'image/gif';
        case 'webp':
            return 'image/webp';
        case 'svg':
            return 'image/svg+xml';
        case 'bmp':
            return 'image/bmp';
        case 'ico':
            return 'image/x-icon';
        case 'avif':
            return 'image/avif';
        default:
            return 'application/octet-stream';
    }
}

function uint8ArrayToBase64(bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.length === 0) return '';
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
}

function buildImageDataUrl(bytes, mimeType) {
    return `data:${mimeType};base64,${uint8ArrayToBase64(bytes)}`;
}

function mimeTypeFromExtension(ext) {
    switch (String(ext || '').toLowerCase()) {
        case 'txt':
        case 'log':
            return 'text/plain';
        case 'md':
        case 'markdown':
            return 'text/markdown';
        case 'json':
            return 'application/json';
        case 'js':
        case 'mjs':
        case 'cjs':
            return 'text/javascript';
        case 'ts':
            return 'text/typescript';
        case 'html':
        case 'htm':
            return 'text/html';
        case 'css':
            return 'text/css';
        case 'xml':
            return 'application/xml';
        case 'yml':
        case 'yaml':
            return 'application/yaml';
        case 'csv':
            return 'text/csv';
        case 'pdf':
            return 'application/pdf';
        case 'zip':
            return 'application/zip';
        case 'gz':
        case 'tgz':
            return 'application/gzip';
        case 'mp4':
            return 'video/mp4';
        case 'mp3':
            return 'audio/mpeg';
        case 'wav':
            return 'audio/wav';
        default:
            return isImageExtension(ext) ? imageMimeTypeFromExtension(ext) : 'application/octet-stream';
    }
}

function getParentPath(path) {
    const normalized = String(path || '').trim();
    if (!normalized || normalized === '/') return '/';
    const index = normalized.lastIndexOf('/');
    if (index <= 0) return '/';
    return normalized.slice(0, index);
}

function looksBinary(bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.length === 0) return false;
    const sampleSize = Math.min(bytes.length, 2048);
    for (let i = 0; i < sampleSize; i += 1) {
        if (bytes[i] === 0) return true;
    }
    return false;
}

function sortDirectoryFirst(a, b) {
    const aDir = !!a?.isDirectory;
    const bDir = !!b?.isDirectory;
    if (aDir !== bDir) return aDir ? -1 : 1;
    const an = String(a?.name || '').toLowerCase();
    const bn = String(b?.name || '').toLowerCase();
    return an.localeCompare(bn);
}

type FileEntry = Record<string, any>;
const TREE_ACTION_DELETE = 'delete';

export default class App extends ToolkitElement {
    fs = getIndexedDbFileSystem();

    rootPath = '/workspace';

    @track tree: FileEntry[] = [];
    @track selectedItem: FileEntry | null = null;
    @track selectedStat: FileEntry | null = null;
    @track selectedContent = '';
    @track selectedLanguage = 'txt';
    @track isPreviewLoading = false;
    @track previewError: string | null = null;
    @track selectedImageUrl: string | null = null;

    searchFields = ['name', 'id', 'keywords', 'path'];
    minSearchLength = 1;
    includeFoldersInResults = true;
    fileTreeNestedItemSpacing = '0.2rem';

    connectedCallback() {
        this.init();
    }

    disconnectedCallback() {
        this.clearImagePreviewUrl();
    }

    clearImagePreviewUrl = () => {
        if (!this.selectedImageUrl) return;
        if (this.selectedImageUrl.startsWith('blob:')) {
            URL.revokeObjectURL(this.selectedImageUrl);
        }
        this.selectedImageUrl = null;
    };

    logFsSnapshot = async (label = 'fs') => {
        try {
            await this.fs.ready;
            const allPaths = this.fs.getAllPaths();
            const sample = allPaths.slice(0, 50);
            // eslint-disable-next-line no-console
            console.groupCollapsed?.(`[files] FS snapshot (${label})`);
            // eslint-disable-next-line no-console
            console.log('totalPaths:', allPaths.length);
            // eslint-disable-next-line no-console
            console.log('samplePaths:', sample);
            try {
                const workspaceEntries = await this.fs.readdirWithFileTypes('/workspace');
                // eslint-disable-next-line no-console
                console.log('/workspace:', workspaceEntries);
            } catch (e) {
                // eslint-disable-next-line no-console
                console.warn('/workspace readdir failed:', e?.message || e);
            }
            try {
                const skillEntries = await this.fs.readdirWithFileTypes('/workspace/skills');
                // eslint-disable-next-line no-console
                console.log('/workspace/skills:', skillEntries);
            } catch (e) {
                // eslint-disable-next-line no-console
                console.warn('/workspace/skills readdir failed:', e?.message || e);
            }
            // eslint-disable-next-line no-console
            console.groupEnd?.();
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('[files] FS snapshot failed:', e?.message || e);
        }
    };

    init = async () => {
        try {
            await this.fs.ready;
            await this.logFsSnapshot('init');
            const rootName = this.rootPath === '/' ? '/' : this.rootPath.split('/').pop();
            const root = {
                id: this.rootPath,
                name: rootName || 'workspace',
                title: this.rootPath,
                path: this.rootPath,
                isDirectory: true,
                isExpandable: true,
                isLoadingChildren: true,
                hasLoadedChildren: false,
                keywords: [this.rootPath, 'workspace'],
                actions: [],
                children: [],
            };
            this.tree = [root];
            await this.loadChildren(root.id);
        } catch (e) {
            this.previewError = e?.message || String(e);
        }
    };

    normalizeDirectoryItem = (parentPath, entry) => {
        const name = entry?.name || '';
        const path = this.fs.resolvePath(parentPath, name);
        const isDirectory = !!entry?.isDirectory;
        const isFile = !!entry?.isFile;
        const isSymbolicLink = !!entry?.isSymbolicLink;

        const keywords = [path, name];
        if (isDirectory) keywords.push('folder');
        if (isFile) keywords.push('file');
        if (isSymbolicLink) keywords.push('symlink');

        const icon = !isDirectory ? getIconForEntry({ path, isSymbolicLink }) : undefined;

        return {
            id: path,
            name,
            title: path,
            path,
            icon,
            isDirectory,
            isFile,
            isSymbolicLink,
            isExpandable: isDirectory,
            isLoadingChildren: false,
            hasLoadedChildren: false,
            keywords,
            actions: [
                {
                    name: TREE_ACTION_DELETE,
                    label: 'Delete',
                    iconName: 'utility:delete',
                },
            ],
            ...(isDirectory ? { children: [] } : {}),
        };
    };

    loadChildren = async dirIdOrPath => {
        const path = String(dirIdOrPath || '').trim() || this.rootPath;
        this.updateTreeNode(path, node => ({
            ...node,
            isLoadingChildren: true,
        }));
        try {
            const entries = await this.fs.readdirWithFileTypes(path);
            const children = (entries || [])
                .map(entry => this.normalizeDirectoryItem(path, entry))
                .sort(sortDirectoryFirst);
            this.updateTreeNode(path, node => ({
                ...node,
                isLoadingChildren: false,
                hasLoadedChildren: true,
                children,
            }));
        } catch (e) {
            this.updateTreeNode(path, node => ({
                ...node,
                isLoadingChildren: false,
                hasLoadedChildren: true,
                children: [],
                loadError: e?.message || String(e),
            }));
        }
    };

    updateTreeNode = (id, updater) => {
        const targetId = String(id || '');
        const visit = items => {
            return (items || []).map(item => {
                if (!item || typeof item !== 'object') return item;
                if (item.id === targetId) {
                    return updater(item);
                }
                if (Array.isArray(item.children) && item.children.length > 0) {
                    return { ...item, children: visit(item.children) };
                }
                return item;
            });
        };
        this.tree = visit(this.tree);
    };

    findTreeNode = (id, items = this.tree) => {
        const targetId = String(id || '');
        const stack = Array.isArray(items) ? [...items] : [];
        while (stack.length > 0) {
            const node = stack.shift();
            if (!node) continue;
            if (node.id === targetId) return node;
            if (Array.isArray(node.children) && node.children.length > 0) {
                stack.unshift(...node.children);
            }
        }
        return null;
    };

    handleToggle = async event => {
        const item = event.detail?.item;
        const id = item?.id;
        if (isEmpty(id)) return;
        const node = this.findTreeNode(id);
        if (!node || !node.isDirectory) return;
        if (node.hasLoadedChildren) return;
        await this.loadChildren(id);
    };

    handleSelect = async event => {
        const item = event.detail?.item;
        if (!item || isEmpty(item.id)) return;
        this.selectedItem = item;
        this.previewError = null;
        this.selectedStat = null;
        this.selectedContent = '';
        this.clearImagePreviewUrl();

        if (item.isDirectory) {
            // No preview for folders yet.
            return;
        }

        this.isPreviewLoading = true;
        try {
            const stat = await this.fs.stat(item.path);
            this.selectedStat = stat;
            const ext = getFileExtension(item.path);
            const bytes = await this.fs.readFileBuffer(item.path);
            if (isImageExtension(ext)) {
                const mimeType = imageMimeTypeFromExtension(ext);
                this.selectedImageUrl = buildImageDataUrl(bytes, mimeType);
                this.selectedLanguage = 'txt';
                this.selectedContent = '';
                return;
            }
            if (looksBinary(bytes)) {
                this.selectedLanguage = 'txt';
                this.selectedContent = `Binary file (${bytes.length} bytes)`;
                return;
            }
            const text = await this.fs.readFile(item.path, 'utf8');
            this.selectedLanguage = toLanguageFromExtension(getFileExtension(item.path));
            this.selectedContent = String(text ?? '');
        } catch (e) {
            this.previewError = e?.message || String(e);
            this.selectedLanguage = 'txt';
            this.selectedContent = '';
        } finally {
            this.isPreviewLoading = false;
        }
    };

    handleDelete = async () => {
        await this.deleteItem(this.selectedItem);
    };

    handleTreeAction = async event => {
        const action = String(event.detail?.action || '').trim();
        const item = event.detail?.item;
        if (!action || !item) return;
        if (action === TREE_ACTION_DELETE) {
            await this.deleteItem(item);
        }
    };

    deleteItem = async item => {
        if (!item || isEmpty(item.path)) return;
        if (item.path === this.rootPath) {
            Toast.show({
                message: 'Cannot delete root folder',
                variant: 'error',
            });
            return;
        }

        const confirmMessage = item.isDirectory
            ? `Delete folder "${item.name}" and all its contents? This action cannot be undone.`
            : `Delete file "${item.name}"? This action cannot be undone.`;
        const confirmed = await LightningConfirm.open({
            variant: 'header',
            theme: 'error',
            label: 'Confirm deletion',
            message: confirmMessage,
        });
        if (!confirmed) return;

        try {
            await this.fs.rm(item.path, {
                recursive: !!item.isDirectory,
                force: false,
            });
            if (this.selectedItem?.path === item.path) {
                this.selectedItem = null;
                this.selectedStat = null;
                this.selectedContent = '';
                this.selectedLanguage = 'txt';
                this.previewError = null;
                this.clearImagePreviewUrl();
            }

            const parentPath = getParentPath(item.path);
            const parentNode = this.findTreeNode(parentPath);
            await this.loadChildren(parentNode ? parentPath : this.rootPath);

            Toast.show({
                message: `${item.isDirectory ? 'Folder' : 'File'} deleted`,
                variant: 'success',
            });
        } catch (e) {
            Toast.show({
                message: e?.message || 'Delete failed',
                variant: 'error',
            });
        }
    };

    handleRefresh = async () => {
        try {
            await this.loadChildren(this.rootPath);
            await this.logFsSnapshot('refresh');
            Toast.show({ message: 'Refreshed', variant: 'success' });
        } catch (e) {
            Toast.show({
                message: e?.message || 'Refresh failed',
                variant: 'error',
            });
        }
    };

    handleCopy = async () => {
        const text = String(this.selectedContent || '');
        if (!text || !navigator.clipboard?.writeText) return;
        try {
            await navigator.clipboard.writeText(text);
            Toast.show({ message: 'Copied to clipboard', variant: 'success' });
        } catch (e) {
            Toast.show({ message: 'Copy failed', variant: 'error' });
        }
    };

    handleDownload = async () => {
        const item = this.selectedItem;
        if (!item || item.isDirectory || isEmpty(item.path)) return;
        try {
            const bytes = await this.fs.readFileBuffer(item.path);
            const ext = getFileExtension(item.path);
            const blob = new Blob([bytes], { type: mimeTypeFromExtension(ext) });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = item.name || 'download.bin';
            anchor.style.display = 'none';
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            Toast.show({ message: 'Download started', variant: 'success' });
        } catch (e) {
            Toast.show({
                message: e?.message || 'Download failed',
                variant: 'error',
            });
        }
    };

    /** Getters **/

    get pageClass() {
        //Overwrite
        return super.pageClass;
    }

    get selectedPath() {
        return this.selectedItem?.path || '';
    }

    get hasSelection() {
        return !!this.selectedItem;
    }

    get isSelectedFile() {
        return !!this.selectedItem && !this.selectedItem.isDirectory;
    }

    get isSelectedDirectory() {
        return !!this.selectedItem && !!this.selectedItem.isDirectory;
    }

    get previewTitle() {
        if (!this.hasSelection) return 'Select a file to preview';
        if (this.isSelectedDirectory) return this.selectedPath || 'Folder';
        return this.selectedPath || 'File';
    }

    get previewSubTitle() {
        if (this.isSelectedDirectory) return 'Folder';
        if (!this.isSelectedFile) return '';
        const size = this.selectedStat?.size;
        const bytes = Number.isFinite(size) ? `${size} bytes` : '';
        return bytes;
    }

    get isMarkdownPreview() {
        return this.isSelectedFile && this.selectedLanguage === 'markdown';
    }

    get isImagePreview() {
        return this.isSelectedFile && !!this.selectedImageUrl;
    }

    get canCopyPreview() {
        return this.isSelectedFile && !this.isImagePreview && !isEmpty(this.selectedContent);
    }

    get isPreviewEmpty() {
        return (
            !this.isPreviewLoading &&
            !this.isImagePreview &&
            isEmpty(this.selectedContent) &&
            isEmpty(this.previewError)
        );
    }
}

