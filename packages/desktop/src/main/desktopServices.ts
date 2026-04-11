import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

import { app, dialog, shell } from 'electron';

import { getDesktopTemplatePath } from './desktopPaths';
import { buildOrgOpenUrl } from './desktopServiceUtils';

type DesktopStore = {
    storedOrgs: Record<string, any>;
    configs: Record<string, Record<string, unknown>>;
};

const DEFAULT_STORE: DesktopStore = {
    storedOrgs: {},
    configs: {},
};
const DEFAULT_SOURCE_API_VERSION = '66.0';
const PMD_RELEASES_API_URL = 'https://api.github.com/repos/pmd/pmd/releases/latest';

type StreamEventSender = (payload: Record<string, unknown>) => void;

function getStorePath(): string {
    return path.join(app.getPath('userData'), 'desktop-store.json');
}

async function readDesktopStore(): Promise<DesktopStore> {
    try {
        const raw = await fs.readFile(getStorePath(), 'utf8');
        const parsed = JSON.parse(raw) as Partial<DesktopStore>;
        return {
            storedOrgs: parsed.storedOrgs || {},
            configs: parsed.configs || {},
        };
    } catch {
        return DEFAULT_STORE;
    }
}

async function writeDesktopStore(nextStore: DesktopStore): Promise<void> {
    const storePath = getStorePath();
    await fs.mkdir(path.dirname(storePath), { recursive: true });
    await fs.writeFile(storePath, JSON.stringify(nextStore, null, 2), 'utf8');
}

function commandExists(commandName: string): boolean {
    return getCommandPath(commandName) !== null;
}

function getCommandPath(commandName: string): string | null {
    const result = spawnSync('/bin/zsh', ['-lc', `command -v ${commandName}`], {
        encoding: 'utf8',
    });

    if (result.status !== 0) {
        return null;
    }

    const commandPath = result.stdout.trim();
    return commandPath || null;
}

function runJsonCommand(command: string, args: string[]): any | null {
    const result = spawnSync(command, args, {
        encoding: 'utf8',
    });

    if (result.status !== 0 || !result.stdout) {
        return null;
    }

    try {
        return JSON.parse(result.stdout);
    } catch {
        return null;
    }
}

function getCliOrgList(): { result: { nonScratchOrgs: any[]; scratchOrgs: any[] } } {
    const sfResult = commandExists('sf') && runJsonCommand('sf', ['org', 'list', '--json']);
    if (sfResult?.result) {
        return {
            result: {
                nonScratchOrgs: sfResult.result.nonScratchOrgs || [],
                scratchOrgs: sfResult.result.scratchOrgs || [],
            },
        };
    }

    const sfdxResult =
        commandExists('sfdx') && runJsonCommand('sfdx', ['force:org:list', '--json']);
    if (sfdxResult?.result) {
        return {
            result: {
                nonScratchOrgs: sfdxResult.result.nonScratchOrgs || [],
                scratchOrgs: sfdxResult.result.scratchOrgs || [],
            },
        };
    }

    return {
        result: {
            nonScratchOrgs: [],
            scratchOrgs: [],
        },
    };
}

export async function getCommandAvailability(): Promise<{ sfdx: boolean; java: boolean }> {
    return {
        sfdx: commandExists('sf') || commandExists('sfdx'),
        java: commandExists('java'),
    };
}

async function pathExists(targetPath: string | null | undefined): Promise<boolean> {
    if (!targetPath) {
        return false;
    }

    try {
        await fs.access(targetPath);
        return true;
    } catch {
        return false;
    }
}

async function readTemplate(...segments: string[]): Promise<string | null> {
    try {
        return await fs.readFile(getDesktopTemplatePath(...segments), 'utf8');
    } catch {
        return null;
    }
}

async function writeTemplateFile(
    targetPath: string,
    fallbackContent: string,
    ...templateSegments: string[]
): Promise<void> {
    if (await pathExists(targetPath)) {
        return;
    }

    const templateContent = await readTemplate(...templateSegments);
    await fs.writeFile(targetPath, templateContent || fallbackContent, 'utf8');
}

export async function getConfigValue(key: string, configName = 'default'): Promise<unknown | null> {
    const store = await readDesktopStore();
    return store.configs[configName]?.[key] ?? null;
}

export async function setConfigValue(
    key: string,
    value: unknown,
    configName = 'default'
): Promise<unknown> {
    const store = await readDesktopStore();
    const nextConfig = {
        ...(store.configs[configName] || {}),
        [key]: value,
    };

    store.configs[configName] = nextConfig;
    await writeDesktopStore(store);
    return value;
}

export async function getCodeInitialConfig(alias: string): Promise<{
    projectPath: string | null;
    metadataLoaded: boolean;
}> {
    const projectPath = (await getConfigValue('projectPath', alias)) as string | null;
    const hasProjectPath = await pathExists(projectPath);

    return {
        projectPath: hasProjectPath ? projectPath : null,
        metadataLoaded: hasProjectPath,
    };
}

export async function selectCodeProject(payload: {
    alias: string;
    defaultPath?: string | null;
}): Promise<{
    projectPath: string | null;
}> {
    const result = await dialog.showOpenDialog({
        defaultPath: payload.defaultPath || undefined,
        properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
        return {
            projectPath: payload.defaultPath || null,
        };
    }

    const projectPath = result.filePaths[0] || null;
    if (projectPath) {
        await setConfigValue('projectPath', projectPath, payload.alias);
    }

    return {
        projectPath,
    };
}

export async function openVSCodeProject(projectPath: string | null | undefined): Promise<void> {
    if (!projectPath) {
        throw new Error('Project path is required');
    }

    if (!(await pathExists(projectPath))) {
        throw new Error(`Project path does not exist: ${projectPath}`);
    }

    const codeCommand = getCommandPath('code');
    const openProcess = codeCommand
        ? spawn(codeCommand, ['-n', projectPath], {
              detached: true,
              stdio: 'ignore',
          })
        : spawn('/usr/bin/open', ['-a', 'Visual Studio Code', projectPath], {
              detached: true,
              stdio: 'ignore',
          });
    openProcess.unref();
}

export async function getPmdInstallation(projectPath: string | null | undefined): Promise<{
    installationPath: string | null;
    executablePath: string | null;
}> {
    const localInstallationPath = projectPath ? path.join(projectPath, '.sf-toolkit', 'pmd') : null;
    const localExecutablePath = localInstallationPath
        ? path.join(localInstallationPath, 'bin', 'pmd')
        : null;

    if (await pathExists(localExecutablePath)) {
        return {
            installationPath: localInstallationPath,
            executablePath: localExecutablePath,
        };
    }

    const globalExecutablePath = getCommandPath('pmd');
    if (globalExecutablePath) {
        return {
            installationPath: path.dirname(path.dirname(globalExecutablePath)),
            executablePath: globalExecutablePath,
        };
    }

    return {
        installationPath: null,
        executablePath: null,
    };
}

async function ensureWorkspaceScaffold(projectPath: string): Promise<void> {
    await fs.mkdir(projectPath, { recursive: true });
    await fs.mkdir(path.join(projectPath, 'force-app', 'main', 'default'), { recursive: true });
    await fs.mkdir(path.join(projectPath, 'manifest'), { recursive: true });
    await fs.mkdir(path.join(projectPath, '.sf-toolkit', 'pmd', 'reports'), { recursive: true });
    await fs.mkdir(path.join(projectPath, '.sf-toolkit', 'pmd', 'rulesets', 'apex'), {
        recursive: true,
    });

    const sfdxProjectPath = path.join(projectPath, 'sfdx-project.json');
    const packageXmlPath = path.join(projectPath, 'manifest', 'package.xml');
    const pmdQuickstartPath = path.join(
        projectPath,
        '.sf-toolkit',
        'pmd',
        'rulesets',
        'apex',
        'quickstart.xml'
    );

    await writeTemplateFile(
        sfdxProjectPath,
        JSON.stringify(
            {
                packageDirectories: [
                    {
                        path: 'force-app',
                        default: true,
                    },
                ],
                name: path.basename(projectPath) || 'sf-toolkit-workspace',
                namespace: '',
                sfdcLoginUrl: 'https://login.salesforce.com',
                sourceApiVersion: DEFAULT_SOURCE_API_VERSION,
            },
            null,
            2
        ),
        'sfdx-project.json'
    );

    await writeTemplateFile(
        packageXmlPath,
        `<?xml version="1.0" encoding="UTF-8"?>\n<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n    <version>${DEFAULT_SOURCE_API_VERSION}</version>\n</Package>\n`,
        'package.xml'
    );

    await writeTemplateFile(
        pmdQuickstartPath,
        `<?xml version="1.0" encoding="UTF-8"?>\n<ruleset name="quickstart"\n         xmlns="http://pmd.sourceforge.net/ruleset/2.0.0"\n         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n         xsi:schemaLocation="http://pmd.sourceforge.net/ruleset/2.0.0 https://pmd.sourceforge.io/ruleset_2_0_0.xsd">\n   <description>Quickstart configuration of PMD for Salesforce.com Apex. Includes the rules that are most likely to apply everywhere.</description>\n   <rule ref="category/apex/design.xml/CyclomaticComplexity">\n      <priority>3</priority>\n   </rule>\n   <rule ref="category/apex/performance.xml/OperationWithLimitsInLoop">\n      <priority>3</priority>\n   </rule>\n   <rule ref="category/apex/bestpractices.xml/AvoidLogicInTrigger">\n      <priority>3</priority>\n   </rule>\n   <rule ref="category/apex/errorprone.xml/AvoidHardcodingId">\n      <priority>3</priority>\n   </rule>\n   <rule ref="category/apex/security.xml/ApexCRUDViolation">\n      <priority>3</priority>\n   </rule>\n   <rule ref="category/apex/security.xml/ApexSOQLInjection">\n      <priority>3</priority>\n   </rule>\n   <rule ref="category/apex/security.xml/ApexSharingViolations">\n      <priority>3</priority>\n   </rule>\n</ruleset>\n`,
        'pmd',
        'rulesets',
        'apex',
        'quickstart.xml'
    );
}

async function summarizeWorkspace(projectPath: string): Promise<{
    projectPath: string;
    fileCount: number;
    hasManifest: boolean;
    hasProjectConfig: boolean;
}> {
    let fileCount = 0;

    async function walk(dirPath: string): Promise<void> {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                await walk(fullPath);
            } else {
                fileCount += 1;
            }
        }
    }

    await walk(projectPath);

    return {
        projectPath,
        fileCount,
        hasManifest: await pathExists(path.join(projectPath, 'manifest', 'package.xml')),
        hasProjectConfig: await pathExists(path.join(projectPath, 'sfdx-project.json')),
    };
}

function getPreferredSfCommand(): 'sf' | 'sfdx' | null {
    if (commandExists('sf')) {
        return 'sf';
    }
    if (commandExists('sfdx')) {
        return 'sfdx';
    }
    return null;
}

function runCliCommand(command: string, args: string[], cwd?: string): void {
    const result = spawnSync(command, args, {
        cwd,
        encoding: 'utf8',
    });

    if (result.status !== 0) {
        throw new Error(
            result.stderr?.trim() ||
                result.stdout?.trim() ||
                `Command failed: ${command} ${args.join(' ')}`
        );
    }
}

async function renameCliOrgAlias(oldAlias: string, newAlias: string): Promise<void> {
    const command = getPreferredSfCommand();
    if (!command) {
        throw new Error('The Salesforce CLI is required to rename CLI-backed org aliases.');
    }

    const details = await seeOrgDetails(oldAlias);
    const username = String(details?.username || '').trim();
    if (!username) {
        throw new Error(`Failed to resolve the username for alias ${oldAlias}.`);
    }

    if (command === 'sf') {
        runCliCommand('sf', ['alias', 'set', `${newAlias}=${username}`, '--json']);
        runCliCommand('sf', ['alias', 'unset', oldAlias, '--json']);
        return;
    }

    runCliCommand('sfdx', ['force:alias:set', `${newAlias}=${username}`, '--json']);
    runCliCommand('sfdx', ['force:alias:unset', oldAlias, '--json']);
}

function logoutCliOrg(alias: string): void {
    const command = getPreferredSfCommand();
    if (!command) {
        throw new Error('The Salesforce CLI is required to remove CLI-backed orgs.');
    }

    if (command === 'sf') {
        runCliCommand('sf', ['org', 'logout', '--target-org', alias, '--no-prompt', '--json']);
        return;
    }

    runCliCommand('sfdx', ['force:auth:logout', '--targetusername', alias, '--noprompt', '--json']);
}

function normalizeAnalyzerCommand(command: string): string {
    const normalizedCommand = String(command || '').trim();
    if (!normalizedCommand) {
        return normalizedCommand;
    }

    if (!commandExists('sfdx') && commandExists('sf')) {
        return normalizedCommand.replace(/^sfdx\s+scanner:run\b/, 'sf scanner run');
    }

    return normalizedCommand;
}

export async function retrieveCodeWorkspace(payload: {
    alias: string;
    targetPath: string | null | undefined;
    refresh?: boolean;
}): Promise<{
    projectPath: string;
    refreshed: boolean;
    summary: {
        projectPath: string;
        fileCount: number;
        hasManifest: boolean;
        hasProjectConfig: boolean;
    };
}> {
    const projectPath = payload.targetPath;
    if (!projectPath) {
        throw new Error('Project path is required');
    }

    await ensureWorkspaceScaffold(projectPath);
    await setConfigValue('projectPath', projectPath, payload.alias);

    const command = getPreferredSfCommand();
    if (payload.refresh && command) {
        const result =
            command === 'sf'
                ? spawnSync(
                      'sf',
                      [
                          'project',
                          'generate',
                          'manifest',
                          '--from-org',
                          payload.alias,
                          '--output-dir',
                          'manifest',
                          '--name',
                          'package.xml',
                      ],
                      {
                          cwd: projectPath,
                          encoding: 'utf8',
                      }
                  )
                : spawnSync(
                      'sfdx',
                      [
                          'force:source:manifest:create',
                          '--fromorg',
                          payload.alias,
                          '--outputdir',
                          'manifest',
                          '--name',
                          'package',
                      ],
                      {
                          cwd: projectPath,
                          encoding: 'utf8',
                      }
                  );

        if (!result || result.status !== 0) {
            throw new Error(
                result?.stderr?.trim() ||
                    result?.stdout?.trim() ||
                    'Failed to generate a package manifest from Salesforce.'
            );
        }

        const retrieveResult = spawnSync(
            command,
            command === 'sf'
                ? [
                      'project',
                      'retrieve',
                      'start',
                      '--target-org',
                      payload.alias,
                      '--manifest',
                      'manifest/package.xml',
                      '--ignore-conflicts',
                  ]
                : [
                      'force:source:retrieve',
                      '--targetusername',
                      payload.alias,
                      '--manifest',
                      'manifest/package.xml',
                  ],
            {
                cwd: projectPath,
                encoding: 'utf8',
            }
        );

        if (retrieveResult.status !== 0) {
            throw new Error(
                retrieveResult.stderr?.trim() ||
                    retrieveResult.stdout?.trim() ||
                    'Failed to retrieve metadata from Salesforce.'
            );
        }
    }

    return {
        projectPath,
        refreshed: Boolean(payload.refresh),
        summary: await summarizeWorkspace(projectPath),
    };
}

export async function exportCodeWorkspace(
    payload: {
        alias: string;
        targetPath: string | null | undefined;
    },
    sendEvent: StreamEventSender
): Promise<void> {
    const projectPath = payload.targetPath;
    if (!projectPath) {
        sendEvent({ action: 'error', error: { message: 'Project path is required' } });
        return;
    }

    if (!(await pathExists(projectPath))) {
        sendEvent({
            action: 'error',
            error: { message: `Project path does not exist: ${projectPath}` },
        });
        return;
    }

    const defaultArchivePath = path.join(
        path.dirname(projectPath),
        `${path.basename(projectPath)}-metadata.zip`
    );
    const result = await dialog.showSaveDialog({
        defaultPath: defaultArchivePath,
        filters: [{ name: 'Zip Archive', extensions: ['zip'] }],
    });

    if (result.canceled || !result.filePath) {
        sendEvent({ action: 'done', canceled: true });
        return;
    }

    const zipResult = spawnSync(
        '/usr/bin/ditto',
        ['-c', '-k', '--sequesterRsrc', '--keepParent', projectPath, result.filePath],
        {
            encoding: 'utf8',
        }
    );

    if (zipResult.status !== 0) {
        sendEvent({
            action: 'error',
            error: {
                message:
                    zipResult.stderr?.trim() ||
                    zipResult.stdout?.trim() ||
                    'Failed to create metadata archive.',
            },
        });
        return;
    }

    sendEvent({
        action: 'done',
        archivePath: result.filePath,
    });
}

export async function runShellCommand(
    payload: {
        targetPath?: string | null;
        command?: string;
    },
    sendEvent: StreamEventSender
): Promise<void> {
    if (!payload.command?.trim()) {
        throw new Error('Command is required');
    }

    const cwd = payload.targetPath || process.cwd();
    if (!(await pathExists(cwd))) {
        throw new Error(`Target path does not exist: ${cwd}`);
    }

    const child = spawn('/bin/zsh', ['-lc', normalizeAnalyzerCommand(payload.command)], {
        cwd,
        env: process.env,
    });

    child.stdout.on('data', chunk => {
        sendEvent({ action: 'message', data: chunk.toString() });
    });
    child.stderr.on('data', chunk => {
        sendEvent({ action: 'message', data: chunk.toString() });
    });
    child.on('error', error => {
        sendEvent({ action: 'error', data: error.message, error: { message: error.message } });
    });
    child.on('close', code => {
        sendEvent({ action: 'exit', code: code ?? 0 });
    });
}

export async function runSfdxAnalyzerCommand(
    payload: {
        alias: string;
        command?: string;
    },
    sendEvent: StreamEventSender
): Promise<void> {
    if (!payload.command?.trim()) {
        throw new Error('Analyzer command is required');
    }

    const projectPath = (await getConfigValue('projectPath', payload.alias)) as string | null;
    const cwd = projectPath || process.cwd();
    if (!(await pathExists(cwd))) {
        throw new Error(`Target path does not exist: ${cwd}`);
    }

    const child = spawn('/bin/zsh', ['-lc', normalizeAnalyzerCommand(payload.command)], {
        cwd,
        env: process.env,
    });

    let stderr = '';
    child.stderr.on('data', chunk => {
        stderr += chunk.toString();
    });
    child.on('error', error => {
        sendEvent({ action: 'error', error: { message: error.message } });
    });
    child.on('close', code => {
        if (code && code !== 0) {
            sendEvent({
                action: 'error',
                error: {
                    message: stderr.trim() || `Analyzer command exited with code ${String(code)}`,
                },
            });
            return;
        }

        sendEvent({ action: 'done' });
    });
}

export async function saveStoredOrg(alias: string, configuration: any): Promise<any> {
    const store = await readDesktopStore();
    const normalizedAlias = alias || configuration?.alias;
    if (!normalizedAlias) {
        throw new Error('Alias is required');
    }

    store.storedOrgs[normalizedAlias] = {
        ...(configuration || {}),
        alias: normalizedAlias,
        id: normalizedAlias,
        status: configuration?.status || 'Connected',
    };
    await writeDesktopStore(store);

    return store.storedOrgs[normalizedAlias];
}

export async function installLatestPmd(projectPath: string | null | undefined): Promise<{
    installationPath: string | null;
    executablePath: string | null;
}> {
    if (!projectPath) {
        throw new Error('Project path is required');
    }

    await ensureWorkspaceScaffold(projectPath);

    const existingInstallation = await getPmdInstallation(projectPath);
    if (existingInstallation.executablePath) {
        return existingInstallation;
    }

    const releaseResponse = await fetch(PMD_RELEASES_API_URL, {
        headers: {
            Accept: 'application/vnd.github+json',
            'User-Agent': 'sf-toolkit-desktop',
        },
    });

    if (!releaseResponse.ok) {
        throw new Error(`Failed to fetch PMD release metadata: ${releaseResponse.status}`);
    }

    const release = (await releaseResponse.json()) as {
        assets?: Array<{ browser_download_url?: string; name?: string }>;
    };
    const downloadUrl = release.assets?.find(asset => {
        return typeof asset.name === 'string' && /^pmd-dist-.*-bin\.zip$/.test(asset.name);
    })?.browser_download_url;

    if (!downloadUrl) {
        throw new Error('Failed to find a PMD binary distribution asset.');
    }

    const zipResponse = await fetch(downloadUrl, {
        headers: {
            'User-Agent': 'sf-toolkit-desktop',
        },
    });

    if (!zipResponse.ok) {
        throw new Error(`Failed to download PMD: ${zipResponse.status}`);
    }

    const installationRoot = path.join(projectPath, '.sf-toolkit', 'pmd');
    const tempRoot = path.join(app.getPath('temp'), `sf-toolkit-pmd-${Date.now()}`);
    const archivePath = path.join(tempRoot, 'pmd.zip');
    const extractRoot = path.join(tempRoot, 'extract');

    await fs.mkdir(extractRoot, { recursive: true });
    await fs.writeFile(archivePath, Buffer.from(await zipResponse.arrayBuffer()));

    const unzipResult = spawnSync('/usr/bin/unzip', ['-oq', archivePath, '-d', extractRoot], {
        encoding: 'utf8',
    });
    if (unzipResult.status !== 0) {
        throw new Error(
            unzipResult.stderr?.trim() || unzipResult.stdout?.trim() || 'Failed to unpack PMD.'
        );
    }

    const extractedEntries = await fs.readdir(extractRoot, { withFileTypes: true });
    const extractedDirectory = extractedEntries.find(entry => entry.isDirectory());
    if (!extractedDirectory) {
        throw new Error('Failed to locate the unpacked PMD distribution.');
    }

    await fs.rm(installationRoot, { recursive: true, force: true });
    await fs.cp(path.join(extractRoot, extractedDirectory.name), installationRoot, {
        recursive: true,
    });
    await ensureWorkspaceScaffold(projectPath);
    await fs.rm(tempRoot, { recursive: true, force: true });

    const installed = await getPmdInstallation(projectPath);
    if (!installed.executablePath) {
        throw new Error('PMD installation completed, but the executable could not be found.');
    }

    return installed;
}

export async function getStoredOrg(alias: string): Promise<any | null> {
    if (!alias) {
        return null;
    }

    const store = await readDesktopStore();
    return store.storedOrgs[alias] || null;
}

export async function getAllStoredOrgs(): Promise<any[]> {
    const store = await readDesktopStore();
    return Object.values(store.storedOrgs).sort((left, right) =>
        String(left?.alias || '').localeCompare(String(right?.alias || ''))
    );
}

export async function renameStoredOrg(oldAlias: string, newAlias: string): Promise<void> {
    if (!oldAlias || !newAlias) {
        throw new Error('Both oldAlias and newAlias are required');
    }

    const store = await readDesktopStore();
    const current = store.storedOrgs[oldAlias];
    const currentConfig = store.configs[oldAlias];

    if (current) {
        store.storedOrgs[newAlias] = {
            ...current,
            alias: newAlias,
            id: newAlias,
        };
        delete store.storedOrgs[oldAlias];
    } else {
        await renameCliOrgAlias(oldAlias, newAlias);
    }

    if (currentConfig) {
        store.configs[newAlias] = currentConfig;
    }
    delete store.configs[oldAlias];
    await writeDesktopStore(store);
}

export async function removeStoredOrg(alias: string): Promise<void> {
    const store = await readDesktopStore();
    if (store.storedOrgs[alias]) {
        delete store.storedOrgs[alias];
    } else {
        logoutCliOrg(alias);
    }

    delete store.configs[alias];
    await writeDesktopStore(store);
}

export async function getAllOrgs(): Promise<{
    sfdxOrgs: { result: { nonScratchOrgs: any[]; scratchOrgs: any[] } };
    storedOrgs: any[];
}> {
    return {
        sfdxOrgs: getCliOrgList(),
        storedOrgs: await getAllStoredOrgs(),
    };
}

export async function seeOrgDetails(alias: string): Promise<any> {
    const storedOrg = await getStoredOrg(alias);
    if (storedOrg) {
        return storedOrg;
    }

    const sfDisplay =
        commandExists('sf') &&
        runJsonCommand('sf', ['org', 'display', '--target-org', alias, '--json']);
    if (sfDisplay?.result) {
        return sfDisplay.result;
    }

    const sfdxDisplay =
        commandExists('sfdx') &&
        runJsonCommand('sfdx', ['force:org:display', '--targetusername', alias, '--json']);
    if (sfdxDisplay?.result) {
        return sfdxDisplay.result;
    }

    throw new Error(`No org details found for alias ${alias}`);
}

export async function openOrgUrl(payload: Record<string, any>): Promise<void> {
    const url = buildOrgOpenUrl(payload);
    if (!url) {
        throw new Error('No valid org URL available');
    }

    await shell.openExternal(url);
}
