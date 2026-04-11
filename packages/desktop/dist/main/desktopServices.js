"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCommandAvailability = getCommandAvailability;
exports.getConfigValue = getConfigValue;
exports.setConfigValue = setConfigValue;
exports.getCodeInitialConfig = getCodeInitialConfig;
exports.selectCodeProject = selectCodeProject;
exports.openVSCodeProject = openVSCodeProject;
exports.getPmdInstallation = getPmdInstallation;
exports.retrieveCodeWorkspace = retrieveCodeWorkspace;
exports.exportCodeWorkspace = exportCodeWorkspace;
exports.runShellCommand = runShellCommand;
exports.runSfdxAnalyzerCommand = runSfdxAnalyzerCommand;
exports.saveStoredOrg = saveStoredOrg;
exports.installLatestPmd = installLatestPmd;
exports.getStoredOrg = getStoredOrg;
exports.getAllStoredOrgs = getAllStoredOrgs;
exports.renameStoredOrg = renameStoredOrg;
exports.removeStoredOrg = removeStoredOrg;
exports.getAllOrgs = getAllOrgs;
exports.seeOrgDetails = seeOrgDetails;
exports.openOrgUrl = openOrgUrl;
const node_child_process_1 = require("node:child_process");
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const electron_1 = require("electron");
const desktopPaths_1 = require("./desktopPaths");
const desktopServiceUtils_1 = require("./desktopServiceUtils");
const DEFAULT_STORE = {
    storedOrgs: {},
    configs: {},
};
const DEFAULT_SOURCE_API_VERSION = '66.0';
const PMD_RELEASES_API_URL = 'https://api.github.com/repos/pmd/pmd/releases/latest';
function getStorePath() {
    return node_path_1.default.join(electron_1.app.getPath('userData'), 'desktop-store.json');
}
async function readDesktopStore() {
    try {
        const raw = await promises_1.default.readFile(getStorePath(), 'utf8');
        const parsed = JSON.parse(raw);
        return {
            storedOrgs: parsed.storedOrgs || {},
            configs: parsed.configs || {},
        };
    }
    catch {
        return DEFAULT_STORE;
    }
}
async function writeDesktopStore(nextStore) {
    const storePath = getStorePath();
    await promises_1.default.mkdir(node_path_1.default.dirname(storePath), { recursive: true });
    await promises_1.default.writeFile(storePath, JSON.stringify(nextStore, null, 2), 'utf8');
}
function commandExists(commandName) {
    return getCommandPath(commandName) !== null;
}
function getCommandPath(commandName) {
    const result = (0, node_child_process_1.spawnSync)('/bin/zsh', ['-lc', `command -v ${commandName}`], {
        encoding: 'utf8',
    });
    if (result.status !== 0) {
        return null;
    }
    const commandPath = result.stdout.trim();
    return commandPath || null;
}
function runJsonCommand(command, args) {
    const result = (0, node_child_process_1.spawnSync)(command, args, {
        encoding: 'utf8',
    });
    if (result.status !== 0 || !result.stdout) {
        return null;
    }
    try {
        return JSON.parse(result.stdout);
    }
    catch {
        return null;
    }
}
function getCliOrgList() {
    const sfResult = commandExists('sf') && runJsonCommand('sf', ['org', 'list', '--json']);
    if (sfResult?.result) {
        return {
            result: {
                nonScratchOrgs: sfResult.result.nonScratchOrgs || [],
                scratchOrgs: sfResult.result.scratchOrgs || [],
            },
        };
    }
    const sfdxResult = commandExists('sfdx') && runJsonCommand('sfdx', ['force:org:list', '--json']);
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
async function getCommandAvailability() {
    return {
        sfdx: commandExists('sf') || commandExists('sfdx'),
        java: commandExists('java'),
    };
}
async function pathExists(targetPath) {
    if (!targetPath) {
        return false;
    }
    try {
        await promises_1.default.access(targetPath);
        return true;
    }
    catch {
        return false;
    }
}
async function readTemplate(...segments) {
    try {
        return await promises_1.default.readFile((0, desktopPaths_1.getDesktopTemplatePath)(...segments), 'utf8');
    }
    catch {
        return null;
    }
}
async function writeTemplateFile(targetPath, fallbackContent, ...templateSegments) {
    if (await pathExists(targetPath)) {
        return;
    }
    const templateContent = await readTemplate(...templateSegments);
    await promises_1.default.writeFile(targetPath, templateContent || fallbackContent, 'utf8');
}
async function getConfigValue(key, configName = 'default') {
    const store = await readDesktopStore();
    return store.configs[configName]?.[key] ?? null;
}
async function setConfigValue(key, value, configName = 'default') {
    const store = await readDesktopStore();
    const nextConfig = {
        ...(store.configs[configName] || {}),
        [key]: value,
    };
    store.configs[configName] = nextConfig;
    await writeDesktopStore(store);
    return value;
}
async function getCodeInitialConfig(alias) {
    const projectPath = (await getConfigValue('projectPath', alias));
    const hasProjectPath = await pathExists(projectPath);
    return {
        projectPath: hasProjectPath ? projectPath : null,
        metadataLoaded: hasProjectPath,
    };
}
async function selectCodeProject(payload) {
    const result = await electron_1.dialog.showOpenDialog({
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
async function openVSCodeProject(projectPath) {
    if (!projectPath) {
        throw new Error('Project path is required');
    }
    if (!(await pathExists(projectPath))) {
        throw new Error(`Project path does not exist: ${projectPath}`);
    }
    const codeCommand = getCommandPath('code');
    const openProcess = codeCommand
        ? (0, node_child_process_1.spawn)(codeCommand, ['-n', projectPath], {
            detached: true,
            stdio: 'ignore',
        })
        : (0, node_child_process_1.spawn)('/usr/bin/open', ['-a', 'Visual Studio Code', projectPath], {
            detached: true,
            stdio: 'ignore',
        });
    openProcess.unref();
}
async function getPmdInstallation(projectPath) {
    const localInstallationPath = projectPath ? node_path_1.default.join(projectPath, '.sf-toolkit', 'pmd') : null;
    const localExecutablePath = localInstallationPath
        ? node_path_1.default.join(localInstallationPath, 'bin', 'pmd')
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
            installationPath: node_path_1.default.dirname(node_path_1.default.dirname(globalExecutablePath)),
            executablePath: globalExecutablePath,
        };
    }
    return {
        installationPath: null,
        executablePath: null,
    };
}
async function ensureWorkspaceScaffold(projectPath) {
    await promises_1.default.mkdir(projectPath, { recursive: true });
    await promises_1.default.mkdir(node_path_1.default.join(projectPath, 'force-app', 'main', 'default'), { recursive: true });
    await promises_1.default.mkdir(node_path_1.default.join(projectPath, 'manifest'), { recursive: true });
    await promises_1.default.mkdir(node_path_1.default.join(projectPath, '.sf-toolkit', 'pmd', 'reports'), { recursive: true });
    await promises_1.default.mkdir(node_path_1.default.join(projectPath, '.sf-toolkit', 'pmd', 'rulesets', 'apex'), {
        recursive: true,
    });
    const sfdxProjectPath = node_path_1.default.join(projectPath, 'sfdx-project.json');
    const packageXmlPath = node_path_1.default.join(projectPath, 'manifest', 'package.xml');
    const pmdQuickstartPath = node_path_1.default.join(projectPath, '.sf-toolkit', 'pmd', 'rulesets', 'apex', 'quickstart.xml');
    await writeTemplateFile(sfdxProjectPath, JSON.stringify({
        packageDirectories: [
            {
                path: 'force-app',
                default: true,
            },
        ],
        name: node_path_1.default.basename(projectPath) || 'sf-toolkit-workspace',
        namespace: '',
        sfdcLoginUrl: 'https://login.salesforce.com',
        sourceApiVersion: DEFAULT_SOURCE_API_VERSION,
    }, null, 2), 'sfdx-project.json');
    await writeTemplateFile(packageXmlPath, `<?xml version="1.0" encoding="UTF-8"?>\n<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n    <version>${DEFAULT_SOURCE_API_VERSION}</version>\n</Package>\n`, 'package.xml');
    await writeTemplateFile(pmdQuickstartPath, `<?xml version="1.0" encoding="UTF-8"?>\n<ruleset name="quickstart"\n         xmlns="http://pmd.sourceforge.net/ruleset/2.0.0"\n         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n         xsi:schemaLocation="http://pmd.sourceforge.net/ruleset/2.0.0 https://pmd.sourceforge.io/ruleset_2_0_0.xsd">\n   <description>Quickstart configuration of PMD for Salesforce.com Apex. Includes the rules that are most likely to apply everywhere.</description>\n   <rule ref="category/apex/design.xml/CyclomaticComplexity">\n      <priority>3</priority>\n   </rule>\n   <rule ref="category/apex/performance.xml/OperationWithLimitsInLoop">\n      <priority>3</priority>\n   </rule>\n   <rule ref="category/apex/bestpractices.xml/AvoidLogicInTrigger">\n      <priority>3</priority>\n   </rule>\n   <rule ref="category/apex/errorprone.xml/AvoidHardcodingId">\n      <priority>3</priority>\n   </rule>\n   <rule ref="category/apex/security.xml/ApexCRUDViolation">\n      <priority>3</priority>\n   </rule>\n   <rule ref="category/apex/security.xml/ApexSOQLInjection">\n      <priority>3</priority>\n   </rule>\n   <rule ref="category/apex/security.xml/ApexSharingViolations">\n      <priority>3</priority>\n   </rule>\n</ruleset>\n`, 'pmd', 'rulesets', 'apex', 'quickstart.xml');
}
async function summarizeWorkspace(projectPath) {
    let fileCount = 0;
    async function walk(dirPath) {
        const entries = await promises_1.default.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = node_path_1.default.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                await walk(fullPath);
            }
            else {
                fileCount += 1;
            }
        }
    }
    await walk(projectPath);
    return {
        projectPath,
        fileCount,
        hasManifest: await pathExists(node_path_1.default.join(projectPath, 'manifest', 'package.xml')),
        hasProjectConfig: await pathExists(node_path_1.default.join(projectPath, 'sfdx-project.json')),
    };
}
function getPreferredSfCommand() {
    if (commandExists('sf')) {
        return 'sf';
    }
    if (commandExists('sfdx')) {
        return 'sfdx';
    }
    return null;
}
function runCliCommand(command, args, cwd) {
    const result = (0, node_child_process_1.spawnSync)(command, args, {
        cwd,
        encoding: 'utf8',
    });
    if (result.status !== 0) {
        throw new Error(result.stderr?.trim() ||
            result.stdout?.trim() ||
            `Command failed: ${command} ${args.join(' ')}`);
    }
}
async function renameCliOrgAlias(oldAlias, newAlias) {
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
function logoutCliOrg(alias) {
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
function normalizeAnalyzerCommand(command) {
    const normalizedCommand = String(command || '').trim();
    if (!normalizedCommand) {
        return normalizedCommand;
    }
    if (!commandExists('sfdx') && commandExists('sf')) {
        return normalizedCommand.replace(/^sfdx\s+scanner:run\b/, 'sf scanner run');
    }
    return normalizedCommand;
}
async function retrieveCodeWorkspace(payload) {
    const projectPath = payload.targetPath;
    if (!projectPath) {
        throw new Error('Project path is required');
    }
    await ensureWorkspaceScaffold(projectPath);
    await setConfigValue('projectPath', projectPath, payload.alias);
    const command = getPreferredSfCommand();
    if (payload.refresh && command) {
        const result = command === 'sf'
            ? (0, node_child_process_1.spawnSync)('sf', [
                'project',
                'generate',
                'manifest',
                '--from-org',
                payload.alias,
                '--output-dir',
                'manifest',
                '--name',
                'package.xml',
            ], {
                cwd: projectPath,
                encoding: 'utf8',
            })
            : (0, node_child_process_1.spawnSync)('sfdx', [
                'force:source:manifest:create',
                '--fromorg',
                payload.alias,
                '--outputdir',
                'manifest',
                '--name',
                'package',
            ], {
                cwd: projectPath,
                encoding: 'utf8',
            });
        if (!result || result.status !== 0) {
            throw new Error(result?.stderr?.trim() ||
                result?.stdout?.trim() ||
                'Failed to generate a package manifest from Salesforce.');
        }
        const retrieveResult = (0, node_child_process_1.spawnSync)(command, command === 'sf'
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
            ], {
            cwd: projectPath,
            encoding: 'utf8',
        });
        if (retrieveResult.status !== 0) {
            throw new Error(retrieveResult.stderr?.trim() ||
                retrieveResult.stdout?.trim() ||
                'Failed to retrieve metadata from Salesforce.');
        }
    }
    return {
        projectPath,
        refreshed: Boolean(payload.refresh),
        summary: await summarizeWorkspace(projectPath),
    };
}
async function exportCodeWorkspace(payload, sendEvent) {
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
    const defaultArchivePath = node_path_1.default.join(node_path_1.default.dirname(projectPath), `${node_path_1.default.basename(projectPath)}-metadata.zip`);
    const result = await electron_1.dialog.showSaveDialog({
        defaultPath: defaultArchivePath,
        filters: [{ name: 'Zip Archive', extensions: ['zip'] }],
    });
    if (result.canceled || !result.filePath) {
        sendEvent({ action: 'done', canceled: true });
        return;
    }
    const zipResult = (0, node_child_process_1.spawnSync)('/usr/bin/ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', projectPath, result.filePath], {
        encoding: 'utf8',
    });
    if (zipResult.status !== 0) {
        sendEvent({
            action: 'error',
            error: {
                message: zipResult.stderr?.trim() ||
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
async function runShellCommand(payload, sendEvent) {
    if (!payload.command?.trim()) {
        throw new Error('Command is required');
    }
    const cwd = payload.targetPath || process.cwd();
    if (!(await pathExists(cwd))) {
        throw new Error(`Target path does not exist: ${cwd}`);
    }
    const child = (0, node_child_process_1.spawn)('/bin/zsh', ['-lc', normalizeAnalyzerCommand(payload.command)], {
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
async function runSfdxAnalyzerCommand(payload, sendEvent) {
    if (!payload.command?.trim()) {
        throw new Error('Analyzer command is required');
    }
    const projectPath = (await getConfigValue('projectPath', payload.alias));
    const cwd = projectPath || process.cwd();
    if (!(await pathExists(cwd))) {
        throw new Error(`Target path does not exist: ${cwd}`);
    }
    const child = (0, node_child_process_1.spawn)('/bin/zsh', ['-lc', normalizeAnalyzerCommand(payload.command)], {
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
async function saveStoredOrg(alias, configuration) {
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
async function installLatestPmd(projectPath) {
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
    const release = (await releaseResponse.json());
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
    const installationRoot = node_path_1.default.join(projectPath, '.sf-toolkit', 'pmd');
    const tempRoot = node_path_1.default.join(electron_1.app.getPath('temp'), `sf-toolkit-pmd-${Date.now()}`);
    const archivePath = node_path_1.default.join(tempRoot, 'pmd.zip');
    const extractRoot = node_path_1.default.join(tempRoot, 'extract');
    await promises_1.default.mkdir(extractRoot, { recursive: true });
    await promises_1.default.writeFile(archivePath, Buffer.from(await zipResponse.arrayBuffer()));
    const unzipResult = (0, node_child_process_1.spawnSync)('/usr/bin/unzip', ['-oq', archivePath, '-d', extractRoot], {
        encoding: 'utf8',
    });
    if (unzipResult.status !== 0) {
        throw new Error(unzipResult.stderr?.trim() || unzipResult.stdout?.trim() || 'Failed to unpack PMD.');
    }
    const extractedEntries = await promises_1.default.readdir(extractRoot, { withFileTypes: true });
    const extractedDirectory = extractedEntries.find(entry => entry.isDirectory());
    if (!extractedDirectory) {
        throw new Error('Failed to locate the unpacked PMD distribution.');
    }
    await promises_1.default.rm(installationRoot, { recursive: true, force: true });
    await promises_1.default.cp(node_path_1.default.join(extractRoot, extractedDirectory.name), installationRoot, {
        recursive: true,
    });
    await ensureWorkspaceScaffold(projectPath);
    await promises_1.default.rm(tempRoot, { recursive: true, force: true });
    const installed = await getPmdInstallation(projectPath);
    if (!installed.executablePath) {
        throw new Error('PMD installation completed, but the executable could not be found.');
    }
    return installed;
}
async function getStoredOrg(alias) {
    if (!alias) {
        return null;
    }
    const store = await readDesktopStore();
    return store.storedOrgs[alias] || null;
}
async function getAllStoredOrgs() {
    const store = await readDesktopStore();
    return Object.values(store.storedOrgs).sort((left, right) => String(left?.alias || '').localeCompare(String(right?.alias || '')));
}
async function renameStoredOrg(oldAlias, newAlias) {
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
    }
    else {
        await renameCliOrgAlias(oldAlias, newAlias);
    }
    if (currentConfig) {
        store.configs[newAlias] = currentConfig;
    }
    delete store.configs[oldAlias];
    await writeDesktopStore(store);
}
async function removeStoredOrg(alias) {
    const store = await readDesktopStore();
    if (store.storedOrgs[alias]) {
        delete store.storedOrgs[alias];
    }
    else {
        logoutCliOrg(alias);
    }
    delete store.configs[alias];
    await writeDesktopStore(store);
}
async function getAllOrgs() {
    return {
        sfdxOrgs: getCliOrgList(),
        storedOrgs: await getAllStoredOrgs(),
    };
}
async function seeOrgDetails(alias) {
    const storedOrg = await getStoredOrg(alias);
    if (storedOrg) {
        return storedOrg;
    }
    const sfDisplay = commandExists('sf') &&
        runJsonCommand('sf', ['org', 'display', '--target-org', alias, '--json']);
    if (sfDisplay?.result) {
        return sfDisplay.result;
    }
    const sfdxDisplay = commandExists('sfdx') &&
        runJsonCommand('sfdx', ['force:org:display', '--targetusername', alias, '--json']);
    if (sfdxDisplay?.result) {
        return sfdxDisplay.result;
    }
    throw new Error(`No org details found for alias ${alias}`);
}
async function openOrgUrl(payload) {
    const url = (0, desktopServiceUtils_1.buildOrgOpenUrl)(payload);
    if (!url) {
        throw new Error('No valid org URL available');
    }
    await electron_1.shell.openExternal(url);
}
