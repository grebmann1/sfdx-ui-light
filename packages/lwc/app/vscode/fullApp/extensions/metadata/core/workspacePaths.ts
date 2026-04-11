export function safeSeg(value) {
    return String(value || 'unnamed')
        .replace(/[\\/:*?"<>|]/g, '_')
        .trim();
}

export function auraFilename(bundleName, defType, format) {
    const bundle = safeSeg(bundleName);
    const type = String(defType || '').toUpperCase();
    if (type === 'APPLICATION') return `${bundle}.app`;
    if (type === 'COMPONENT') return `${bundle}.cmp`;
    if (type === 'EVENT') return `${bundle}.evt`;
    if (type === 'INTERFACE') return `${bundle}.intf`;
    if (type === 'TOKENS') return `${bundle}.tokens`;
    if (type === 'TESTSUITE') return `${bundle}.testSuite`;
    if (type === 'STYLE') return `${bundle}.css`;
    if (type === 'CONTROLLER') return `${bundle}Controller.js`;
    if (type === 'HELPER') return `${bundle}Helper.js`;
    if (type === 'RENDERER') return `${bundle}Renderer.js`;
    if (type === 'DESIGN') return `${bundle}.design`;
    if (type === 'DOCUMENTATION') return `${bundle}.auradoc`;
    if (type === 'SVG') return `${bundle}.svg`;
    const extension =
        String(format || '').toUpperCase() === 'JS'
            ? 'js'
            : String(format || '').toUpperCase() === 'CSS'
              ? 'css'
              : 'txt';
    return `${bundle}.${type.toLowerCase()}.${extension}`;
}

export function lwcExtFromFormat(format) {
    const normalized = String(format || '').toUpperCase();
    if (normalized === 'JS') return 'js';
    if (normalized === 'HTML') return 'html';
    if (normalized === 'CSS') return 'css';
    if (normalized === 'XML') return 'xml';
    if (normalized === 'SVG') return 'svg';
    if (normalized === 'JSON') return 'json';
    return 'txt';
}

export function normalizeLwcResourceRelPath(bundleName, filePath, format) {
    const normalizedBundleName = String(bundleName || '');
    let relativePath = String(filePath || '').replace(/^\/+/, '');
    if (/^lwc\//i.test(relativePath)) {
        relativePath = relativePath.slice(4);
    }
    if (
        normalizedBundleName &&
        relativePath.toLowerCase().startsWith(`${normalizedBundleName.toLowerCase()}/`)
    ) {
        relativePath = relativePath.slice(normalizedBundleName.length + 1);
    }
    relativePath = relativePath.replace(/^\/+/, '');
    if (!relativePath) {
        return `${normalizedBundleName || 'component'}.${lwcExtFromFormat(format)}`;
    }
    return relativePath;
}

export function parentUri(uri) {
    const path = uri.path || '';
    const index = path.lastIndexOf('/');
    const parentPath = index > 0 ? path.slice(0, index) : '/';
    return uri.with({ path: parentPath });
}

export function getWorkspaceRootUri(vscode) {
    const folder = Array.isArray(vscode?.workspace?.workspaceFolders)
        ? vscode.workspace.workspaceFolders[0]
        : null;
    return folder?.uri || vscode.Uri.file('/workspace');
}

export function getWorkspaceRootPath(vscode) {
    return getWorkspaceRootUri(vscode)?.path || '/workspace';
}

export function getWorkspaceUri(vscode, relativePath = '') {
    const root = getWorkspaceRootUri(vscode);
    const segments = String(relativePath || '')
        .split('/')
        .filter(Boolean);
    return segments.length ? vscode.Uri.joinPath(root, ...segments) : root;
}

export function getWorkspacePath(vscode, relativePath = '') {
    return getWorkspaceUri(vscode, relativePath).path;
}

export function getWorkspaceMainRootUri(vscode) {
    return getWorkspaceUri(vscode, 'force-app/main');
}

export function getWorkspaceDefaultRootUri(vscode) {
    return getWorkspaceUri(vscode, 'force-app/main/default');
}

export function getManifestDirUri(vscode) {
    return getWorkspaceUri(vscode, 'manifest');
}

export function getManifestFileUri(vscode, fileName = 'package.xml') {
    return vscode.Uri.joinPath(getManifestDirUri(vscode), String(fileName || 'package.xml'));
}

export function getSalesforceStateDirUri(vscode) {
    return getWorkspaceUri(vscode, '.salesforce');
}

export function toWorkspaceRelativeLabel(vscode, path) {
    const root = `${getWorkspaceRootPath(vscode).replace(/\/+$/, '')}/`;
    const value = String(path || '');
    return value.startsWith(root) ? value.slice(root.length) : value;
}

export const __testables = {
    auraFilename,
    lwcExtFromFormat,
    getManifestDirUri,
    getManifestFileUri,
    normalizeLwcResourceRelPath,
    parentUri,
    safeSeg,
};
