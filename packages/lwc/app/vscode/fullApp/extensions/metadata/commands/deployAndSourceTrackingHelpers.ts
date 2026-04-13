export const DEPLOYABLE_TOOLING_TYPES = new Set([
    'ApexClass',
    'ApexTrigger',
    'LightningComponentResource',
    'AuraDefinition',
]);
const WORKSPACE_RELATIVE_MARKERS = ['/force-app/', '/manifest/', '/.salesforce/'];

function normalizePath(value) {
    const normalized = String(value || '')
        .trim()
        .replace(/\\/g, '/')
        .replace(/\/+/g, '/');
    if (!normalized) {
        return '';
    }
    return `/${normalized.replace(/^\/+/, '').replace(/\/+$/, '')}`;
}

function joinWorkspacePath(workspaceRoot, relativePath) {
    const root = normalizePath(workspaceRoot);
    const relative = String(relativePath || '')
        .trim()
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .replace(/\/+/g, '/');
    if (!root || !relative) {
        return '';
    }
    return `${root}/${relative}`.replace(/\/+/g, '/');
}

export function isDeployableToolingEntry(entry) {
    return Boolean(
        entry?.type && entry?.id && !entry?.readOnly && DEPLOYABLE_TOOLING_TYPES.has(entry.type)
    );
}

export function deriveWorkspaceRelativePath(path) {
    const normalizedPath = normalizePath(path);
    if (!normalizedPath) {
        return '';
    }
    for (const marker of WORKSPACE_RELATIVE_MARKERS) {
        const markerIndex = normalizedPath.indexOf(marker);
        if (markerIndex >= 0) {
            return normalizedPath.slice(markerIndex + 1);
        }
    }
    return '';
}

export function remapPathToWorkspaceRoot(path, workspaceRoot) {
    const relativePath = deriveWorkspaceRelativePath(path);
    return relativePath ? joinWorkspacePath(workspaceRoot, relativePath) : '';
}

export function resolveTrackedPath(path, trackedItems, workspaceRoot) {
    const normalizedPath = normalizePath(path);
    if (!normalizedPath) {
        return null;
    }
    const exactEntry = trackedItems?.[normalizedPath];
    if (exactEntry) {
        return {
            entry: exactEntry,
            path: normalizedPath,
            source: 'exact',
        };
    }
    const remappedPath = remapPathToWorkspaceRoot(normalizedPath, workspaceRoot);
    if (!remappedPath || remappedPath === normalizedPath) {
        return null;
    }
    const remappedEntry = trackedItems?.[remappedPath];
    if (!remappedEntry) {
        return null;
    }
    return {
        entry: remappedEntry,
        path: remappedPath,
        source: 'remapped',
    };
}

export function classifyToolingCommandPath(path, toolingMapItems, metadataApiItems, workspaceRoot) {
    const toolingMatch = resolveTrackedPath(path, toolingMapItems, workspaceRoot);
    if (toolingMatch) {
        return {
            ...toolingMatch,
            status: 'tooling',
        };
    }
    const metadataMatch = resolveTrackedPath(path, metadataApiItems, workspaceRoot);
    if (metadataMatch) {
        return {
            ...metadataMatch,
            status: 'metadata',
        };
    }
    return {
        entry: null,
        path: normalizePath(path),
        source: 'none',
        status: 'missing',
    };
}

export function classifyDeployPath(path, toolingMapItems, metadataApiItems, workspaceRoot) {
    const resolved = classifyToolingCommandPath(
        path,
        toolingMapItems,
        metadataApiItems,
        workspaceRoot
    );
    if (resolved.status === 'metadata') {
        return {
            ...resolved,
            reason: 'metadataApi',
            status: 'unsupported',
        };
    }
    if (resolved.status !== 'tooling') {
        return {
            ...resolved,
            reason: 'missingToolingEntry',
            status: 'missing',
        };
    }
    if (resolved.entry?.readOnly) {
        return {
            ...resolved,
            reason: 'readOnly',
            status: 'readOnly',
        };
    }
    if (resolved.entry?.type && !DEPLOYABLE_TOOLING_TYPES.has(resolved.entry.type)) {
        return {
            ...resolved,
            reason: 'unsupportedToolingType',
            status: 'unsupported',
        };
    }
    if (!isDeployableToolingEntry(resolved.entry)) {
        return {
            ...resolved,
            reason: 'missingDeployIdentity',
            status: 'missing',
        };
    }
    return {
        ...resolved,
        reason: 'deployable',
        status: 'deployable',
    };
}

export function buildCurrentFileWarningMessage(resolution, actionLabel = 'This action') {
    const action = String(actionLabel || 'This action').trim() || 'This action';
    const reason = resolution?.reason || resolution?.status || 'missing';
    if (reason === 'metadataApi' || reason === 'metadata') {
        return `${action} only supports Tooling API files. This file is tracked via Metadata API instead.`;
    }
    if (reason === 'readOnly') {
        return `${action} cannot use this read-only namespaced or managed file from the workbench.`;
    }
    if (reason === 'unsupportedToolingType') {
        const typeLabel = resolution?.entry?.type ? ` ${resolution.entry.type}` : '';
        return `${action} does not support${typeLabel} files.`;
    }
    if (reason === 'missingDeployIdentity') {
        return `${action} could not resolve a deployable tooling record for this file. Fetch metadata first.`;
    }
    return 'This file is not in tooling-map.json. Fetch metadata first. If you recently reconnected or the workspace root changed, reopen the file or refresh metadata.';
}

export function partitionChangedPathsForDeploy(paths, mapItems) {
    const summary = {
        deployablePaths: [],
        missingPaths: [],
        readOnlyPaths: [],
        unsupportedPaths: [],
    };
    for (const path of Array.isArray(paths) ? paths : []) {
        const entry = mapItems?.[path];
        if (!entry) {
            summary.missingPaths.push(path);
            continue;
        }
        if (entry.readOnly) {
            summary.readOnlyPaths.push(path);
            continue;
        }
        if (!DEPLOYABLE_TOOLING_TYPES.has(entry.type)) {
            summary.unsupportedPaths.push(path);
            continue;
        }
        if (!isDeployableToolingEntry(entry)) {
            summary.missingPaths.push(path);
            continue;
        }
        summary.deployablePaths.push(path);
    }
    return summary;
}

export function buildChangedFileDeployQuickPickItems(paths, mapItems) {
    return (Array.isArray(paths) ? paths : []).map(path => {
        const entry = mapItems?.[path] || {};
        const segments = String(path || '')
            .split('/')
            .filter(Boolean);
        const label = segments[segments.length - 1] || String(path || '(unknown)');
        const parentPath =
            segments.length > 1 ? `/${segments.slice(0, -1).join('/')}` : '/workspace';
        const details = [entry.type || 'Tracked file', parentPath];
        if (entry.namespace) {
            details.push(`namespace: ${entry.namespace}`);
        }
        return {
            label,
            description: path,
            detail: details.join(' • '),
            picked: true,
            path,
        };
    });
}

export function pruneChangedPathsForSuccessfulDeploys(trackedPaths, results) {
    const successPaths = (Array.isArray(results) ? results : [])
        .filter(result => result?.ok === true && result?.path)
        .map(result => result.path);
    for (const path of successPaths) {
        trackedPaths?.delete?.(path);
    }
    return successPaths;
}

function pickCloneSafeConnectionValue(primaryValue, fallbackValue) {
    const preferred = String(primaryValue ?? '').trim();
    if (preferred) {
        return preferred;
    }
    return String(fallbackValue ?? '').trim();
}

export function buildDeployWorkerConnection(liveConnection, storedConnection) {
    return {
        instanceUrl: pickCloneSafeConnectionValue(
            liveConnection?.instanceUrl,
            storedConnection?.instanceUrl
        ),
        accessToken: pickCloneSafeConnectionValue(
            liveConnection?.accessToken,
            storedConnection?.accessToken
        ),
        apiVersion: pickCloneSafeConnectionValue(
            liveConnection?.apiVersion,
            storedConnection?.apiVersion
        ),
    };
}

export const __testables = {
    DEPLOYABLE_TOOLING_TYPES,
    buildChangedFileDeployQuickPickItems,
    buildCurrentFileWarningMessage,
    buildDeployWorkerConnection,
    classifyDeployPath,
    classifyToolingCommandPath,
    deriveWorkspaceRelativePath,
    isDeployableToolingEntry,
    partitionChangedPathsForDeploy,
    pruneChangedPathsForSuccessfulDeploys,
    remapPathToWorkspaceRoot,
    resolveTrackedPath,
};
