import { resolveWorkspaceApiVersionFromVscode } from '../../../workbench/workspace/sfdxProject';
import { pathExists, writeTextFile, listFilesAndDirsRecursive } from '../core/workspaceCache';
import {
    getManifestFileUri,
    getWorkspaceRootPath,
    toWorkspaceRelativeLabel,
} from '../core/workspacePaths';

type SourceSelection = {
    sourceUri?: { path?: string } | null;
    uris?: Array<{ path?: string }> | null;
    activeUri?: { path?: string } | null;
};

type InferredMetadataMember = {
    type: string;
    member: string;
};

function normalizePath(value) {
    return String(value || '').replace(/\\/g, '/');
}

function trimSuffix(value, suffix) {
    return value.endsWith(suffix) ? value.slice(0, -suffix.length) : value;
}

export function appendXmlExtension(fileName) {
    const trimmed = String(fileName || '').trim();
    if (!trimmed) {
        return 'package.xml';
    }
    const leaf = trimmed.split('/').pop()?.trim() || 'package';
    return leaf.toLowerCase().endsWith('.xml') ? leaf : `${leaf}.xml`;
}

export function normalizeManifestFileName(fileName) {
    return appendXmlExtension(fileName);
}

function isDirectoryType(vscode, fileType) {
    const numericType = Number(fileType);
    return vscode.FileType?.Directory
        ? (numericType & vscode.FileType.Directory) === vscode.FileType.Directory
        : numericType === 2;
}

function addMember(typesMap, type, member) {
    if (!type || !member) return;
    if (!typesMap.has(type)) {
        typesMap.set(type, new Set());
    }
    typesMap.get(type)?.add(member);
}

function serializePackageXml(typesMap, apiVersion) {
    const lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<Package xmlns="http://soap.sforce.com/2006/04/metadata">',
    ];
    const sortedTypes = Array.from(typesMap.keys()).sort((left, right) =>
        left.localeCompare(right)
    );
    for (const type of sortedTypes) {
        lines.push('    <types>');
        const members = Array.from(typesMap.get(type) || []).sort((left, right) =>
            left.localeCompare(right)
        );
        for (const member of members) {
            lines.push(`        <members>${member}</members>`);
        }
        lines.push(`        <name>${type}</name>`);
        lines.push('    </types>');
    }
    lines.push(`    <version>${String(apiVersion || '').trim() || '61.0'}</version>`);
    lines.push('</Package>');
    lines.push('');
    return lines.join('\n');
}

export function inferMetadataFromRelativePath(relativePath): InferredMetadataMember | null {
    const normalizedPath = normalizePath(relativePath).replace(/^\/+/, '');
    if (
        !normalizedPath ||
        normalizedPath.startsWith('.salesforce/') ||
        normalizedPath.startsWith('.vscode/') ||
        normalizedPath.startsWith('manifest/')
    ) {
        return null;
    }

    const segments = normalizedPath.split('/').filter(Boolean);
    if (segments.length >= 2) {
        const parentDir = segments[segments.length - 2];
        const fileName = segments[segments.length - 1];
        if (parentDir === 'classes') {
            if (fileName.endsWith('.cls') || fileName.endsWith('.cls-meta.xml')) {
                return {
                    type: 'ApexClass',
                    member: trimSuffix(trimSuffix(fileName, '.cls-meta.xml'), '.cls'),
                };
            }
        }
        if (parentDir === 'triggers') {
            if (fileName.endsWith('.trigger') || fileName.endsWith('.trigger-meta.xml')) {
                return {
                    type: 'ApexTrigger',
                    member: trimSuffix(trimSuffix(fileName, '.trigger-meta.xml'), '.trigger'),
                };
            }
        }
        if (parentDir === 'layouts' && fileName.endsWith('.layout-meta.xml')) {
            return { type: 'Layout', member: trimSuffix(fileName, '.layout-meta.xml') };
        }
        if (parentDir === 'permissionsets' && fileName.endsWith('.permissionset-meta.xml')) {
            return {
                type: 'PermissionSet',
                member: trimSuffix(fileName, '.permissionset-meta.xml'),
            };
        }
        if (parentDir === 'applications' && fileName.endsWith('.app-meta.xml')) {
            return { type: 'CustomApplication', member: trimSuffix(fileName, '.app-meta.xml') };
        }
        if (parentDir === 'tabs' && fileName.endsWith('.tab-meta.xml')) {
            return { type: 'CustomTab', member: trimSuffix(fileName, '.tab-meta.xml') };
        }
        if (parentDir === 'labels' && fileName.endsWith('.labels-meta.xml')) {
            return { type: 'CustomLabels', member: trimSuffix(fileName, '.labels-meta.xml') };
        }
        if (parentDir === 'flexipages' && fileName.endsWith('.flexipage-meta.xml')) {
            return { type: 'FlexiPage', member: trimSuffix(fileName, '.flexipage-meta.xml') };
        }
        if (parentDir === 'flows' && fileName.endsWith('.flow-meta.xml')) {
            return { type: 'Flow', member: trimSuffix(fileName, '.flow-meta.xml') };
        }
    }

    const lwcIndex = segments.indexOf('lwc');
    if (lwcIndex >= 0 && segments[lwcIndex + 1]) {
        return { type: 'LightningComponentBundle', member: segments[lwcIndex + 1] };
    }

    const auraIndex = segments.indexOf('aura');
    if (auraIndex >= 0 && segments[auraIndex + 1]) {
        return { type: 'AuraDefinitionBundle', member: segments[auraIndex + 1] };
    }

    const objectIndex = segments.indexOf('objects');
    if (objectIndex >= 0 && segments[objectIndex + 1]) {
        const objectName = segments[objectIndex + 1];
        const leaf = segments[segments.length - 1];
        if (leaf === `${objectName}.object-meta.xml`) {
            return { type: 'CustomObject', member: objectName };
        }
        if (segments[objectIndex + 2] === 'fields' && leaf.endsWith('.field-meta.xml')) {
            return {
                type: 'CustomField',
                member: `${objectName}.${trimSuffix(leaf, '.field-meta.xml')}`,
            };
        }
    }

    return null;
}

async function expandSelectionToFiles(vscode, uris) {
    const files = [];
    const seen = new Set<string>();

    for (const uri of uris || []) {
        const path = normalizePath(uri?.path);
        if (!path || seen.has(path)) continue;
        seen.add(path);
        try {
            // eslint-disable-next-line no-await-in-loop
            const stat = await vscode.workspace.fs.stat(uri);
            if (isDirectoryType(vscode, stat?.type)) {
                // eslint-disable-next-line no-await-in-loop
                const listed = await listFilesAndDirsRecursive(vscode, uri);
                for (const fileUri of listed.files || []) {
                    const filePath = normalizePath(fileUri?.path);
                    if (!filePath || seen.has(filePath)) continue;
                    seen.add(filePath);
                    files.push(fileUri);
                }
                continue;
            }
        } catch {
            // Fall through and treat the value like a file selection.
        }
        files.push(uri);
    }

    return files;
}

export async function collectSelectedSourceUris(vscode, selection: SourceSelection = {}) {
    const selectedUris = [];
    if (Array.isArray(selection.uris) && selection.uris.length) {
        selectedUris.push(...selection.uris.filter(Boolean));
    }
    if (selection.sourceUri?.path) {
        selectedUris.push(selection.sourceUri);
    }
    if (!selectedUris.length && selection.activeUri?.path) {
        selectedUris.push(selection.activeUri);
    }
    return await expandSelectionToFiles(vscode, selectedUris);
}

async function generatePackageXmlFromPaths(vscode, sourceUris) {
    const sourcePaths = sourceUris.map(uri => normalizePath(uri?.path)).filter(Boolean);
    const workspaceRoot = `${getWorkspaceRootPath(vscode).replace(/\/+$/, '')}/`;
    const typesMap = new Map<string, Set<string>>();
    for (const sourceUri of sourceUris) {
        const path = normalizePath(sourceUri?.path);
        if (!path) continue;
        const relativePath = path.startsWith(workspaceRoot)
            ? path.slice(workspaceRoot.length)
            : path;
        const inferred = inferMetadataFromRelativePath(relativePath);
        if (!inferred) continue;
        addMember(typesMap, inferred.type, inferred.member);
    }

    if (!typesMap.size) {
        throw new Error(
            'The selected resources do not map to supported Salesforce source metadata.'
        );
    }

    const apiVersion = await resolveWorkspaceApiVersionFromVscode(vscode);
    return {
        packageXml: serializePackageXml(typesMap, apiVersion),
        sourcePaths,
        usedFallback: true,
    };
}

export function createManifestGenerationRuntime({ vscode }) {
    return {
        collectSelectedSourceUris: async (selection: SourceSelection = {}) =>
            await collectSelectedSourceUris(vscode, selection),
        generatePackageXmlFromSelection: async (selection: SourceSelection = {}) => {
            const selectedUris = await collectSelectedSourceUris(vscode, selection);
            if (!selectedUris.length) {
                throw new Error('Select one or more source files or folders first.');
            }
            return {
                ...(await generatePackageXmlFromPaths(vscode, selectedUris)),
                selectedUris,
            };
        },
        writeManifestFile: async (fileName, packageXml) => {
            const normalizedFileName = normalizeManifestFileName(fileName);
            const targetUri = getManifestFileUri(vscode, normalizedFileName);
            if (await pathExists(vscode, targetUri)) {
                throw new Error(
                    `${toWorkspaceRelativeLabel(vscode, targetUri.path)} already exists. Choose another manifest name.`
                );
            }
            await writeTextFile(vscode, targetUri, packageXml);
            return { fileName: normalizedFileName, uri: targetUri };
        },
    };
}

export const __testables = {
    appendXmlExtension,
    collectSelectedSourceUris,
    inferMetadataFromRelativePath,
    normalizeManifestFileName,
    serializePackageXml,
};
