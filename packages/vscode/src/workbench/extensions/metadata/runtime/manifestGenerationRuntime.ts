import { resolveWorkspaceApiVersionFromVscode } from '../../../workspace/sfdxProject';
import { pathExists, writeTextFile, listFilesAndDirsRecursive } from '../core/workspaceCache';
import {
    getManifestFileUri,
    getWorkspaceRootPath,
    getWorkspaceRootUri,
    toWorkspaceRelativeLabel,
} from '../core/workspacePaths';

import {
    inferMetadataMemberFromRelativePath,
    normalizeMetadataPath,
    shouldIgnoreMetadataRelativePath,
} from './metadataPathInference';

type SourceSelection = {
    sourceUri?: PathLikeUri | null;
    uris?: PathLikeUri[] | null;
    activeUri?: PathLikeUri | null;
};

type PathLikeUri = {
    path?: string;
};

type InferredMetadataMember = {
    type: string;
    member: string;
};

function toWorkspaceRelativePath(path, workspaceRoot) {
    if (!path) {
        return '';
    }
    const normalizedPath = normalizeMetadataPath(path);
    if (workspaceRoot && normalizedPath.startsWith(workspaceRoot)) {
        return normalizedPath.slice(workspaceRoot.length);
    }
    return normalizedPath.replace(/^\/+/, '');
}

function shouldSkipManifestSourcePath(path, workspaceRoot) {
    const relativePath = toWorkspaceRelativePath(path, workspaceRoot);
    return shouldIgnoreMetadataRelativePath(relativePath);
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

function serializePackageXml(typesMap: Map<string, Set<string>>, apiVersion) {
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
    const inferred = inferMetadataMemberFromRelativePath(relativePath);
    return inferred
        ? {
              type: inferred.type,
              member: inferred.fullName,
          }
        : null;
}

async function expandSelectionToFiles(vscode, uris: PathLikeUri[]) {
    const files = [];
    const seen = new Set<string>();

    for (const uri of uris || []) {
        const path = normalizeMetadataPath(uri?.path);
        if (!path || seen.has(path)) continue;
        seen.add(path);
        try {
            // eslint-disable-next-line no-await-in-loop
            const stat = await vscode.workspace.fs.stat(uri);
            if (isDirectoryType(vscode, stat?.type)) {
                // eslint-disable-next-line no-await-in-loop
                const listed = await listFilesAndDirsRecursive(vscode, uri);
                for (const fileUri of listed.files || []) {
                    const filePath = normalizeMetadataPath(fileUri?.path);
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

export async function collectWorkspaceSourceUris(vscode) {
    const workspaceRootUri = getWorkspaceRootUri(vscode);
    const workspaceRoot = `${getWorkspaceRootPath(vscode).replace(/\/+$/, '')}/`;
    const { files } = await listFilesAndDirsRecursive(vscode, workspaceRootUri);
    return (files || []).filter(uri => {
        const path = normalizeMetadataPath(uri?.path);
        return path && !shouldSkipManifestSourcePath(path, workspaceRoot);
    });
}

async function requireWorkspaceSourceUris(vscode) {
    const workspaceSourceUris = await collectWorkspaceSourceUris(vscode);
    if (!workspaceSourceUris.length) {
        throw new Error(
            'No Salesforce source files found under the workspace root. Retrieve metadata or open a Salesforce project first.'
        );
    }
    return workspaceSourceUris;
}

async function generatePackageXmlFromPaths(vscode, sourceUris: PathLikeUri[]) {
    const workspaceRoot = `${getWorkspaceRootPath(vscode).replace(/\/+$/, '')}/`;
    const sourcePaths: string[] = Array.from(
        new Set(
            sourceUris
                .map(uri => normalizeMetadataPath(uri?.path))
                .filter(
                    (path): path is string =>
                        Boolean(path) && !shouldSkipManifestSourcePath(path, workspaceRoot)
                )
        )
    );
    if (!sourcePaths.length) {
        throw new Error(
            'The selected resources do not map to supported Salesforce source metadata.'
        );
    }

    const typesMap = new Map<string, Set<string>>();
    for (const sourceUri of sourceUris) {
        const path = normalizeMetadataPath(sourceUri?.path);
        if (!path || shouldSkipManifestSourcePath(path, workspaceRoot)) continue;
        const relativePath = toWorkspaceRelativePath(path, workspaceRoot);
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
        usedFallback: false,
    };
}

export function createManifestGenerationRuntime({ vscode }) {
    return {
        collectSelectedSourceUris: async (selection: SourceSelection = {}) =>
            await collectSelectedSourceUris(vscode, selection),
        generatePackageXmlFromSelection: async (selection: SourceSelection = {}) => {
            const selectedUris = await collectSelectedSourceUris(vscode, selection);
            const workspaceSourceUris = await requireWorkspaceSourceUris(vscode);
            return {
                ...(await generatePackageXmlFromPaths(vscode, workspaceSourceUris)),
                selectedUris,
            };
        },
        generatePackageXmlFromWorkspace: async () => {
            const workspaceSourceUris = await requireWorkspaceSourceUris(vscode);
            return {
                ...(await generatePackageXmlFromPaths(vscode, workspaceSourceUris)),
                workspaceSourceUris,
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
    collectWorkspaceSourceUris,
    collectSelectedSourceUris,
    inferMetadataFromRelativePath,
    normalizeManifestFileName,
    serializePackageXml,
};
