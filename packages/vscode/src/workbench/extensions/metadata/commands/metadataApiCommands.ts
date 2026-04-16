/* eslint-disable import/no-unresolved */
import { zipUnpackagedFiles } from 'vscode/metadataApi';

import { registerCommand } from '../../core/extensionRegistration';
import { listFilesAndDirsRecursive } from '../core/workspaceCache';
import {
    getWorkspaceDefaultRootUri,
    getWorkspaceRootPath,
    getWorkspaceRootUri,
    getWorkspaceUri,
    toWorkspaceRelativeLabel,
} from '../core/workspacePaths';
import { createManifestGenerationRuntime } from '../runtime/manifestGenerationRuntime';
import { inferMetadataMemberFromRelativePath } from '../runtime/metadataPathInference';
import { createMetadataRetrieveRuntime } from '../runtime/metadataRetrieveRuntime';
import { TOOLING_METADATA_TYPES } from '../runtime/metadataRetrieveRuntimeHelpers';
import { fetchAndPopulateWorkspace } from '../runtime/workspaceSync';

const NEW_BUNDLE_TYPES = new Set(['LightningComponentBundle', 'AuraDefinitionBundle']);

const METADATA_API_MAP_PATH = '.salesforce/metadata-api-map.json';

function escapeXmlValue(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function buildTargetedPackageXml(
    types: Array<{ xmlName: string; member: string }>,
    apiVersion: string
) {
    const version = String(apiVersion || '60.0').replace(/[^0-9.]/g, '') || '60.0';
    const typesXml = types
        .map(
            ({ xmlName, member }) =>
                `  <types>\n    <members>${escapeXmlValue(member)}</members>\n    <name>${escapeXmlValue(xmlName)}</name>\n  </types>`
        )
        .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n${typesXml}\n  <version>${version}</version>\n</Package>`;
}

function findMemberForPath(filePath: string, membersMap: Record<string, any> | null) {
    const normalized = String(filePath || '')
        .trim()
        .replace(/\\/g, '/')
        .replace(/\/+/g, '/');
    if (!normalized || !membersMap) return null;
    for (const entry of Object.values(membersMap)) {
        const paths = Array.isArray(entry?.paths) ? entry.paths : [];
        if (
            paths.some(
                p =>
                    String(p || '')
                        .trim()
                        .replace(/\\/g, '/')
                        .replace(/\/+/g, '/') === normalized
            )
        ) {
            return entry as { type: string; fullName: string; paths: string[] };
        }
    }
    return null;
}

export function parsePackageXml(xmlText) {
    const output = new Map();
    const text = String(xmlText || '');
    if (!text.trim()) return output;
    try {
        const doc = new DOMParser().parseFromString(text, 'application/xml');
        const types = Array.from(doc.getElementsByTagName('types') || []);
        for (const typeNode of types) {
            const nameElement = typeNode.getElementsByTagName('name')?.[0];
            const typeName = nameElement?.textContent ? String(nameElement.textContent).trim() : '';
            if (!typeName) continue;
            const members = Array.from(typeNode.getElementsByTagName('members') || [])
                .map(member => String(member.textContent || '').trim())
                .filter(Boolean);
            if (!members.length) continue;
            output.set(typeName, new Set(members));
        }
        return output;
    } catch {
        // fall back to regex parser
    }
    const typesBlocks = text.split(/<types>/i).slice(1);
    for (const block of typesBlocks) {
        const nameMatch = block.match(/<name>\s*([^<]+)\s*<\/name>/i);
        const typeName = nameMatch ? String(nameMatch[1]).trim() : '';
        if (!typeName) continue;
        const members = Array.from(block.matchAll(/<members>\s*([^<]+)\s*<\/members>/gi))
            .map(match => String(match[1] || '').trim())
            .filter(Boolean);
        if (!members.length) continue;
        output.set(typeName, new Set(members));
    }
    return output;
}

export function registerMetadataApiCommands({ connectionRuntime, context, deployTools }) {
    const { output, state, vscode } = context;
    const retrieveRuntime = createMetadataRetrieveRuntime({
        connectionRuntime,
        state,
        updateSourceTrackingForPaths: deployTools.updateSourceTrackingForPaths,
        vscode,
    });
    const manifestRuntime = createManifestGenerationRuntime({ vscode });

    async function loadMetadataApiMapCached(options: { force?: boolean } = {}) {
        if (!options?.force && state?.metadataApiMapCache) return state.metadataApiMapCache;
        try {
            const uri = getWorkspaceUri(vscode, METADATA_API_MAP_PATH);
            const bytes = await vscode.workspace.fs.readFile(uri);
            const parsed = JSON.parse(
                new TextDecoder().decode(bytes || new Uint8Array()) || '{}'
            );
            const next =
                parsed && typeof parsed === 'object' ? parsed : { items: {}, members: {} };
            if (!next.items || typeof next.items !== 'object') next.items = {};
            if (!next.members || typeof next.members !== 'object') next.members = {};
            if (state) state.metadataApiMapCache = next;
            return next;
        } catch {
            return { items: {}, members: {} };
        }
    }

    function logMetadataApiDeployResult(status: Record<string, unknown> | null | undefined) {
        try {
            const details = (status?.details ?? null) as Record<string, unknown> | null;
            const failures = Array.isArray(details?.componentFailures)
                ? (details.componentFailures as Record<string, unknown>[])
                : [];
            const successes = Array.isArray(details?.componentSuccesses)
                ? (details.componentSuccesses as Record<string, unknown>[])
                : [];

            const lines: string[] = [
                '',
                `=== Metadata API Deploy (${new Date().toLocaleString()}) ===`,
                `Target: ${connectionRuntime.loadStoredConn()?.instanceUrl || 'bridge'}`,
                `Deploy ID: ${status?.id || 'unknown'}`,
                `Status: ${status?.status || (status?.success ? 'Succeeded' : 'Failed')}`,
            ];
            if (status?.errorMessage) lines.push(`Error: ${status.errorMessage}`);
            if (failures.length) {
                lines.push('', 'Failures:');
                for (const f of failures) {
                    const loc = f.lineNumber ? ` (line ${f.lineNumber}, col ${f.columnNumber})` : '';
                    lines.push(
                        `  FAIL  ${f.fileName}${loc} • ${f.problem || f.problemType || 'Unknown error'}`
                    );
                }
            }
            if (successes.length) {
                lines.push('', 'Success:');
                for (const s of successes) {
                    lines.push(`  OK    ${s.fileName}`);
                }
            }
            context.logLines(lines);
            if (!status?.success && output) {
                output.show(true);
            }
        } catch {
            // ignore logging errors
        }
    }

    function zipBytesToBase64(bytes: Uint8Array): string {
        const chunkSize = 0x8000;
        let binary = '';
        for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
        }
        return btoa(binary);
    }

    async function deployPathsViaMetadataApi(
        conn,
        filePaths: string[],
        options: { showProgress?: boolean; title?: string; checkOnly?: boolean } = {}
    ) {
        const bridgeClient = await connectionRuntime.resolveBridgeClient();
        if (!bridgeClient) {
            throw new Error(connectionRuntime.getInjectedConnectionRequiredMessage());
        }

        const metadataApiMap = await loadMetadataApiMapCached();
        const membersByKey = new Map<string, { type: string; fullName: string; paths: string[] }>();
        const allDeployPaths = new Set<string>();
        const unmapped: string[] = [];

        for (const filePath of Array.isArray(filePaths) ? filePaths : []) {
            const member = findMemberForPath(filePath, metadataApiMap.members);
            if (!member) {
                unmapped.push(filePath);
                continue;
            }
            const key = `${member.type}::${member.fullName}`;
            if (!membersByKey.has(key)) membersByKey.set(key, member);
            for (const p of member.paths || []) {
                if (p) allDeployPaths.add(p);
            }
        }

        if (membersByKey.size === 0) {
            throw new Error(
                unmapped.length
                    ? 'Cannot map selected file(s) to a Metadata API member. Fetch metadata first.'
                    : 'No Metadata API members found for the selected file(s).'
            );
        }

        const types = Array.from(membersByKey.values()).map(m => ({
            xmlName: m.type,
            member: m.fullName,
        }));

        const storedConn = connectionRuntime.loadStoredConn();
        const apiVersion =
            String(conn?.apiVersion || storedConn?.apiVersion || '').replace(/[^0-9.]/g, '') || '60.0';
        const packageXmlText = buildTargetedPackageXml(types, apiVersion);

        const root = getWorkspaceDefaultRootUri(vscode);
        const rootPath = `${root.path.replace(/\/+$/, '')}/`;
        const pathToBytes: Record<string, Uint8Array> = {
            'unpackaged/package.xml': new TextEncoder().encode(packageXmlText),
        };

        for (const deployPath of allDeployPaths) {
            const relativePath = deployPath.startsWith(rootPath)
                ? deployPath.slice(rootPath.length)
                : null;
            if (!relativePath) continue;
            try {
                // eslint-disable-next-line no-await-in-loop
                const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(deployPath));
                pathToBytes[`unpackaged/${relativePath}`] = bytes;
            } catch {
                // file may not be accessible; skip
            }
        }

        const zipBytes = zipUnpackagedFiles(pathToBytes);
        const zipBase64 = zipBytesToBase64(zipBytes);
        const checkOnly = Boolean(options?.checkOnly);
        const progressTitle = options?.title || (checkOnly ? 'Validating deploy…' : 'Deploying…');

        const runDeploy = async () =>
            await bridgeClient.deployViaMetadataApi({ zipBase64, checkOnly });

        const status =
            options?.showProgress !== false
                ? await vscode.window.withProgress(
                      {
                          location: vscode.ProgressLocation.Notification,
                          title: progressTitle,
                          cancellable: false,
                      },
                      async progress => {
                          progress.report({ message: 'Sending to Salesforce via bridge…' });
                          return await runDeploy();
                      }
                  )
                : await runDeploy();

        logMetadataApiDeployResult(status);
        if (!status.success) {
            throw new Error(
                status.errorMessage || `Deploy failed: ${status.status || 'Unknown error'}`
            );
        }
        return status;
    }

    async function deployAndRetrieveNewBundle(
        conn,
        filePaths: string[],
        options: { showProgress?: boolean; title?: string } = {}
    ) {
        const bridgeClient = await connectionRuntime.resolveBridgeClient();
        if (!bridgeClient) {
            throw new Error(connectionRuntime.getInjectedConnectionRequiredMessage());
        }

        const storedConn = connectionRuntime.loadStoredConn();
        const apiVersion =
            String(conn?.apiVersion || storedConn?.apiVersion || '').replace(/[^0-9.]/g, '') ||
            '60.0';
        const root = getWorkspaceDefaultRootUri(vscode);
        const rootPath = `${root.path.replace(/\/+$/, '')}/`;

        // Infer bundle members from file paths
        const membersByKey = new Map<
            string,
            { type: string; fullName: string; bundleDirPath: string }
        >();
        for (const filePath of Array.isArray(filePaths) ? filePaths : []) {
            const relativePath = filePath.startsWith(rootPath)
                ? filePath.slice(rootPath.length)
                : null;
            if (!relativePath) continue;
            const member = inferMetadataMemberFromRelativePath(relativePath);
            if (!member || !NEW_BUNDLE_TYPES.has(member.type)) continue;
            const key = `${member.type}::${member.fullName}`;
            if (membersByKey.has(key)) continue;
            const lastSlash = filePath.lastIndexOf('/');
            const bundleDirPath = lastSlash > 0 ? filePath.slice(0, lastSlash) : filePath;
            membersByKey.set(key, { type: member.type, fullName: member.fullName, bundleDirPath });
        }

        if (membersByKey.size === 0) {
            throw new Error(
                'No LWC or Aura bundles could be inferred from the selected file(s). Make sure the file is inside an lwc or aura folder.'
            );
        }

        const types = Array.from(membersByKey.values()).map(m => ({
            xmlName: m.type,
            member: m.fullName,
        }));
        const packageXmlText = buildTargetedPackageXml(types, apiVersion);
        const pathToBytes: Record<string, Uint8Array> = {
            'unpackaged/package.xml': new TextEncoder().encode(packageXmlText),
        };

        for (const { bundleDirPath } of membersByKey.values()) {
            const bundleDirUri = vscode.Uri.file(bundleDirPath);
            try {
                // eslint-disable-next-line no-await-in-loop
                const entries = await vscode.workspace.fs.readDirectory(bundleDirUri);
                for (const [name, fileType] of entries) {
                    if (fileType !== 1 /* FileType.File */) continue;
                    const fileUri = vscode.Uri.joinPath(bundleDirUri, name);
                    const absolutePath = fileUri.path;
                    const relPath = absolutePath.startsWith(rootPath)
                        ? absolutePath.slice(rootPath.length)
                        : null;
                    if (!relPath) continue;
                    try {
                        // eslint-disable-next-line no-await-in-loop
                        const bytes = await vscode.workspace.fs.readFile(fileUri);
                        pathToBytes[`unpackaged/${relPath}`] = bytes;
                    } catch {
                        // skip unreadable files
                    }
                }
            } catch {
                // skip if dir is unreadable
            }
        }

        const zipBytes = zipUnpackagedFiles(pathToBytes);
        const zipBase64 = zipBytesToBase64(zipBytes);
        const progressTitle = options?.title || 'Deploying new component to Salesforce…';

        const runDeploy = async () =>
            await bridgeClient.deployViaMetadataApi({ zipBase64, checkOnly: false });

        const status =
            options?.showProgress !== false
                ? await vscode.window.withProgress(
                      {
                          location: vscode.ProgressLocation.Notification,
                          title: progressTitle,
                          cancellable: false,
                      },
                      async progress => {
                          progress.report({ message: 'Sending to Salesforce via bridge…' });
                          return await runDeploy();
                      }
                  )
                : await runDeploy();

        logMetadataApiDeployResult(status);
        if (!status.success) {
            throw new Error(
                status.errorMessage || `Deploy failed: ${status.status || 'Unknown error'}`
            );
        }

        // Retrieve the bundles to populate tooling-map.json so subsequent deploys use Tooling API
        const typesMap = new Map<string, Set<string>>();
        for (const { type, fullName } of membersByKey.values()) {
            if (!typesMap.has(type)) typesMap.set(type, new Set());
            typesMap.get(type)!.add(fullName);
        }
        try {
            await retrieveRuntime.retrieveToolingTypes(conn, typesMap);
            if (deployTools && typeof deployTools.invalidateToolingMap === 'function') {
                deployTools.invalidateToolingMap();
            }
        } catch {
            // Non-fatal: deploy succeeded; tooling-map update failed
        }

        return status;
    }

    // Expose so that deployAndSourceTracking can call it for metadataApi-mapped files
    if (deployTools && typeof deployTools === 'object') {
        deployTools.deployPathsViaMetadataApi = deployPathsViaMetadataApi;
        if (typeof deployTools.setMetadataApiDeploy === 'function') {
            deployTools.setMetadataApiDeploy(deployPathsViaMetadataApi);
        }
        if (typeof deployTools.setNewBundleDeploy === 'function') {
            deployTools.setNewBundleDeploy(deployAndRetrieveNewBundle);
        }
    }

    registerCommand(context, vscode, 'salesforceMetadata.fetchMetadata', async () => {
        const conn = connectionRuntime.loadStoredConn();
        if (!conn.instanceUrl || !conn.accessToken) {
            await vscode.window.showErrorMessage(
                connectionRuntime.getInjectedConnectionRequiredMessage()
            );
            return;
        }

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Fetching and updating project from Salesforce…',
                cancellable: false,
            },
            async () =>
                await connectionRuntime.withToolingClientAuthed(conn, async client => {
                    await fetchAndPopulateWorkspace(vscode, client);
                })
        );

        deployTools.invalidateToolingMap();
        try {
            await vscode.commands.executeCommand('salesforceMetadata.refreshProject');
        } catch {
            // ignore
        }
        await vscode.window.showInformationMessage(
            'Project sync complete. Files from Salesforce were fetched and updated.'
        );
    });

    async function deployViaMetadataApi(
        conn,
        { checkOnly, packageXmlText }: { checkOnly?: boolean; packageXmlText?: string } = {}
    ) {
        const bridgeClient = await connectionRuntime.resolveBridgeClient();
        if (!bridgeClient) {
            throw new Error(connectionRuntime.getInjectedConnectionRequiredMessage());
        }

        const root = getWorkspaceDefaultRootUri(vscode);
        const { files } = await listFilesAndDirsRecursive(vscode, root);
        const pathToBytes = {
            'unpackaged/package.xml': new TextEncoder().encode(String(packageXmlText || '')),
        };
        for (const uri of files || []) {
            const path = uri?.path || '';
            if (!path || path.includes('/.salesforce/') || path.includes('/.vscode/')) continue;
            const defaultRootPath = `${root.path.replace(/\/+$/, '')}/`;
            const relativePath = path.startsWith(defaultRootPath)
                ? path.slice(defaultRootPath.length)
                : null;
            if (!relativePath) continue;
            // eslint-disable-next-line no-await-in-loop
            const bytes = await vscode.workspace.fs.readFile(uri);
            pathToBytes[`unpackaged/${relativePath}`] = bytes;
        }

        const zipBytes = zipUnpackagedFiles(pathToBytes);
        const zipBase64 = zipBytesToBase64(zipBytes);

        const status = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: checkOnly ? 'Validating deploy…' : 'Deploying…',
                cancellable: false,
            },
            async progress => {
                progress.report({ message: 'Sending to Salesforce via bridge…' });
                return await bridgeClient.deployViaMetadataApi({
                    zipBase64,
                    checkOnly: Boolean(checkOnly),
                });
            }
        );
        logMetadataApiDeployResult(status);
        if (!status.success) {
            throw new Error(
                status.errorMessage || `Deploy failed: ${status.status || 'Unknown error'}`
            );
        }
        return status;
    }

    async function pickPackageXmlUnderWorkspace() {
        const projectRoot = getWorkspaceRootUri(vscode);
        const { files } = await listFilesAndDirsRecursive(vscode, projectRoot);
        const candidates = (files || [])
            .filter(uri => uri?.path && uri.path.toLowerCase().endsWith('package.xml'))
            .slice(0, 50);
        if (!candidates.length) return null;
        const picked = await vscode.window.showQuickPick(
            candidates.map(uri => ({
                label: toWorkspaceRelativeLabel(vscode, uri.path),
                description: uri.path,
                uri,
            })),
            {
                title: 'Select package.xml',
                placeHolder: 'Select a package.xml',
                ignoreFocusOut: true,
                matchOnDescription: true,
            }
        );
        return picked?.uri || null;
    }

    function parseDescribeMetadataTypes(doc: any) {
        const output = new Set<string>();
        try {
            const metadataObjects = Array.from(
                doc.getElementsByTagNameNS?.('*', 'metadataObjects') ||
                    doc.getElementsByTagName('metadataObjects') ||
                    []
            );
            for (const metadataObject of metadataObjects as any[]) {
                const xmlNameElement =
                    metadataObject.getElementsByTagNameNS?.('*', 'xmlName')?.[0] ||
                    metadataObject.getElementsByTagName('xmlName')?.[0];
                const name = xmlNameElement?.textContent
                    ? String(xmlNameElement.textContent).trim()
                    : '';
                if (name) output.add(name);
            }
        } catch {
            // ignore
        }
        return Array.from(output).sort((left, right) => left.localeCompare(right));
    }

    registerCommand(context, vscode, 'salesforceMetadata.retrieveManifest', async () => {
        const conn = connectionRuntime.loadStoredConn();
        if (!conn.instanceUrl || !conn.accessToken) {
            await vscode.window.showErrorMessage(
                connectionRuntime.getInjectedConnectionRequiredMessage()
            );
            return;
        }

        const projectRoot = getWorkspaceRootUri(vscode);
        const { files } = await listFilesAndDirsRecursive(vscode, projectRoot);
        const candidates = (files || [])
            .filter(uri => uri?.path && uri.path.toLowerCase().endsWith('package.xml'))
            .slice(0, 50);
        if (!candidates.length) {
            await vscode.window.showWarningMessage(
                `No package.xml found under ${getWorkspaceRootPath(vscode)}.`
            );
            return;
        }

        const picked = await vscode.window.showQuickPick(
            candidates.map(uri => ({
                label: toWorkspaceRelativeLabel(vscode, uri.path),
                description: uri.path,
                uri,
            })),
            {
                title: 'Retrieve from manifest (package.xml)',
                placeHolder: 'Select a package.xml',
                ignoreFocusOut: true,
                matchOnDescription: true,
            }
        );
        if (!picked?.uri) return;

        const xml = new TextDecoder().decode(await vscode.workspace.fs.readFile(picked.uri));
        const manifest = parsePackageXml(xml);
        if (!manifest.size) {
            await vscode.window.showErrorMessage('Manifest parse failed or contains no <types>.');
            return;
        }

        const toolingSupported = new Set([
            'ApexClass',
            'ApexTrigger',
            'LightningComponentBundle',
            'AuraDefinitionBundle',
        ]);
        const requestedToolingTypes = Array.from(manifest.keys()).filter(type =>
            toolingSupported.has(type)
        );
        const hasUnsupported = Array.from(manifest.keys()).some(
            type => !toolingSupported.has(type)
        );

        if (hasUnsupported) {
            const pick = await vscode.window.showQuickPick(
                [
                    {
                        label: 'Retrieve full manifest via Metadata API (recommended)',
                        detail: 'Supports Flows, Permission Sets, Custom Objects, and more',
                        _metadataApi: true,
                    },
                    {
                        label: 'Retrieve supported types via Tooling API (fast)',
                        detail: 'Only: ApexClass, ApexTrigger, LightningComponentBundle, AuraDefinitionBundle',
                        _tooling: true,
                    },
                ],
                {
                    title: 'Manifest contains non-Tooling types',
                    ignoreFocusOut: true,
                }
            );
            if (!pick) return;
            if (pick._metadataApi) {
                const result = await retrieveRuntime.retrieveViaMetadataApi(conn, manifest, {
                    title: 'Retrieving manifest via Metadata API...',
                });
                deployTools.invalidateToolingMap();
                try {
                    await vscode.commands.executeCommand('salesforceMetadata.refreshProject');
                } catch {
                    // ignore
                }
                await vscode.window.showInformationMessage(
                    `Retrieved ${result.writtenPaths.length} file(s) via Metadata API.`
                );
                return;
            }
        }

        if (!requestedToolingTypes.length) {
            await vscode.window.showWarningMessage(
                'Manifest does not include Tooling-supported types. Use “Retrieve Source in Manifest (Metadata API)” instead.'
            );
            return;
        }

        const result = await retrieveRuntime.retrieveToolingTypes(conn, manifest, {
            title: 'Retrieving manifest contents...',
        });
        deployTools.invalidateToolingMap();
        await vscode.window.showInformationMessage(
            `Retrieved ${result.writtenPaths.length} file(s) from manifest.`
        );
        try {
            await vscode.commands.executeCommand('salesforceMetadata.refreshProject');
        } catch {
            // ignore
        }
    });

    registerCommand(context, vscode, 'salesforceMetadata.generateManifestFile', async () => {
        try {
            const fileNameInput = await vscode.window.showInputBox({
                title: 'Generate manifest file',
                prompt: 'Enter a name for the generated manifest file',
                placeHolder: 'package.xml',
                value: 'package.xml',
                ignoreFocusOut: true,
            });
            if (fileNameInput === undefined) {
                return;
            }

            const generated = await manifestRuntime.generatePackageXmlFromWorkspace();
            const saved = await manifestRuntime.writeManifestFile(
                fileNameInput,
                generated.packageXml
            );
            const doc = await vscode.workspace.openTextDocument(saved.uri);
            await vscode.window.showTextDocument(doc, { preview: false });
            await vscode.window.showInformationMessage(
                `Generated ${saved.fileName} from workspace source files (${generated.sourcePaths.length} files scanned).`
            );
        } catch (error) {
            await vscode.window.showErrorMessage(
                error instanceof Error ? error.message : 'Failed to generate manifest file.'
            );
        }
    });

    registerCommand(context, vscode, 'salesforceMetadata.retrieveMetadataApi', async () => {
        const conn = connectionRuntime.loadStoredConn();
        if (!conn.instanceUrl || !conn.accessToken) {
            await vscode.window.showErrorMessage(
                connectionRuntime.getInjectedConnectionRequiredMessage()
            );
            return;
        }
        const uri = await pickPackageXmlUnderWorkspace();
        if (!uri) {
            await vscode.window.showWarningMessage(
                `No package.xml found under ${getWorkspaceRootPath(vscode)}.`
            );
            return;
        }
        const xml = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
        const manifest = parsePackageXml(xml);
        if (!manifest.size) {
            await vscode.window.showErrorMessage('Manifest parse failed or contains no <types>.');
            return;
        }
        const result = await retrieveRuntime.retrieveViaMetadataApi(conn, manifest, {
            title: 'Retrieving via Metadata API...',
        });
        deployTools.invalidateToolingMap();
        try {
            await vscode.commands.executeCommand('salesforceMetadata.refreshProject');
        } catch {
            // ignore
        }
        await vscode.window.showInformationMessage(
            `Retrieved ${result.writtenPaths.length} file(s) via Metadata API.`
        );
    });

    registerCommand(context, vscode, 'salesforceMetadata.retrieveMetadataApiPick', async () => {
        const conn = connectionRuntime.loadStoredConn();
        if (!conn.instanceUrl || !conn.accessToken) {
            await vscode.window.showErrorMessage(
                connectionRuntime.getInjectedConnectionRequiredMessage()
            );
            return;
        }

        const types = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Loading Metadata API types…',
                cancellable: false,
            },
            async () =>
                await retrieveRuntime.withMetadataApiClientAuthed(conn, async client => {
                    const doc = await client.describeMetadata(client.apiVersion);
                    return parseDescribeMetadataTypes(doc);
                })
        );
        if (!types?.length) {
            await vscode.window.showErrorMessage(
                'Unable to load Metadata API types (describeMetadata returned none).'
            );
            return;
        }

        const typePick = await vscode.window.showQuickPick(
            types.map(type => ({ label: type })),
            {
                title: 'Retrieve (Metadata API)',
                placeHolder: 'Select a metadata type',
                ignoreFocusOut: true,
            }
        );
        if (!typePick?.label) return;

        let members = [];
        try {
            const listed = await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `Listing ${typePick.label}…`,
                    cancellable: false,
                },
                async () =>
                    await retrieveRuntime.withMetadataApiClientAuthed(conn, async client => {
                        return await client.listMetadata({
                            queries: [{ type: typePick.label }],
                            asOfVersion: client.apiVersion,
                        });
                    })
            );
            const items = (listed || [])
                .map(row => String(row?.fullName || '').trim())
                .filter(Boolean)
                .slice(0, 300)
                .map(label => ({ label }));
            const picked = await vscode.window.showQuickPick(
                [{ label: '*', description: 'All members' }, ...items],
                {
                    title: `Select ${typePick.label} members`,
                    placeHolder: 'Pick members (or * for all)',
                    canPickMany: true,
                    ignoreFocusOut: true,
                }
            );
            if (!picked?.length) return;
            members = picked.some(item => item.label === '*')
                ? ['*']
                : picked.map(item => item.label).filter(Boolean);
        } catch {
            const raw = await vscode.window.showInputBox({
                title: `Members for ${typePick.label}`,
                prompt: 'Enter * for all, or comma-separated members',
                value: '*',
                ignoreFocusOut: true,
            });
            if (!raw) return;
            const text = String(raw).trim();
            members =
                text === '*'
                    ? ['*']
                    : text
                          .split(',')
                          .map(member => member.trim())
                          .filter(Boolean);
        }

        if (!members.length) return;
        const typesMap = new Map([[typePick.label, new Set(members)]]);
        const runtime = TOOLING_METADATA_TYPES.has(typePick.label)
            ? retrieveRuntime.retrieveToolingTypes(conn, typesMap, {
                  title: `Retrieving ${typePick.label}...`,
              })
            : retrieveRuntime.retrieveViaMetadataApi(conn, typesMap, {
                  title: `Retrieving ${typePick.label} via Metadata API...`,
              });
        const result = await runtime;
        deployTools.invalidateToolingMap();
        try {
            await vscode.commands.executeCommand('salesforceMetadata.refreshProject');
        } catch {
            // ignore
        }
        await vscode.window.showInformationMessage(
            `Retrieved ${result.writtenPaths.length} file(s).`
        );
    });

    registerCommand(context, vscode, 'salesforceMetadata.deployMetadataApi', async () => {
        const conn = connectionRuntime.loadStoredConn();
        if (!conn.instanceUrl || !conn.accessToken) {
            await vscode.window.showErrorMessage(
                connectionRuntime.getInjectedConnectionRequiredMessage()
            );
            return;
        }
        const uri = await pickPackageXmlUnderWorkspace();
        if (!uri) {
            await vscode.window.showWarningMessage(
                `No package.xml found under ${getWorkspaceRootPath(vscode)}.`
            );
            return;
        }
        const xml = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
        await deployViaMetadataApi(conn, { packageXmlText: xml, checkOnly: false });
        await vscode.window.showInformationMessage('Deploy succeeded (Metadata API).');
    });

    registerCommand(context, vscode, 'salesforceMetadata.validateDeployMetadataApi', async () => {
        const conn = connectionRuntime.loadStoredConn();
        if (!conn.instanceUrl || !conn.accessToken) {
            await vscode.window.showErrorMessage(
                connectionRuntime.getInjectedConnectionRequiredMessage()
            );
            return;
        }
        const uri = await pickPackageXmlUnderWorkspace();
        if (!uri) {
            await vscode.window.showWarningMessage(
                `No package.xml found under ${getWorkspaceRootPath(vscode)}.`
            );
            return;
        }
        const xml = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
        await deployViaMetadataApi(conn, { packageXmlText: xml, checkOnly: true });
        await vscode.window.showInformationMessage('Validation succeeded (Metadata API).');
    });
}

export const __testables = {
    parsePackageXml,
};
