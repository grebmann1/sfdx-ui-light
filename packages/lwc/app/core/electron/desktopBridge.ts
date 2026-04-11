import LOGGER from 'shared/logger';

type DesktopLaunchIntent =
    | {
          target: 'app';
      }
    | {
          target: 'org';
          orgAlias: string;
      };

type LaunchIntentListener = (intent: DesktopLaunchIntent) => void;
type LegacyDesktopListener = (payload: any) => void;

function getDesktopApi() {
    return window.desktop;
}

function getLegacyElectronApi() {
    return window.electron;
}

export function hasDesktopBridge(): boolean {
    return Boolean(getDesktopApi() || getLegacyElectronApi());
}

export async function getDesktopLaunchIntent(): Promise<DesktopLaunchIntent> {
    const desktopApi = getDesktopApi();
    if (desktopApi?.getLaunchIntent) {
        return desktopApi.getLaunchIntent();
    }

    return { target: 'app' };
}

export function onDesktopLaunchIntent(listener: LaunchIntentListener): () => void {
    const desktopApi = getDesktopApi();
    if (desktopApi?.onLaunchIntent) {
        return desktopApi.onLaunchIntent(listener);
    }

    return () => {};
}

export async function checkDesktopCommands(): Promise<{ sfdx: boolean; java: boolean }> {
    const desktopApi = getDesktopApi();
    if (desktopApi?.checkCommands) {
        return desktopApi.checkCommands();
    }

    const response = (await getLegacyElectronApi()?.invoke?.('util-checkCommands')) as
        | { error?: unknown; result?: { sfdx: boolean; java: boolean } }
        | undefined;

    if (response?.error) {
        throw response.error;
    }

    return response?.result || { sfdx: false, java: false };
}

export async function openDesktopInstance(payload: Record<string, unknown>): Promise<void> {
    const desktopApi = getDesktopApi();
    if (desktopApi?.openInstance) {
        await desktopApi.openInstance(payload);
        return;
    }

    await getLegacyElectronApi()?.invoke?.('OPEN_INSTANCE', payload);
}

export async function openDesktopOrgUrl(payload: Record<string, unknown>): Promise<void> {
    const desktopApi = getDesktopApi();
    if (desktopApi?.openOrgUrl) {
        await desktopApi.openOrgUrl(payload);
        return;
    }

    await getLegacyElectronApi()?.invoke?.('org-openOrgUrl', payload);
}

export async function setDesktopStoredOrg(payload: Record<string, unknown>): Promise<unknown> {
    const desktopApi = getDesktopApi();
    if (desktopApi?.setStoredOrg) {
        return desktopApi.setStoredOrg(payload);
    }

    return getLegacyElectronApi()?.invoke?.('org-setStoredOrg', payload);
}

export async function getDesktopStoredOrg(alias: string): Promise<any> {
    const desktopApi = getDesktopApi();
    if (desktopApi?.getStoredOrg) {
        return desktopApi.getStoredOrg(alias);
    }

    const response = (await getLegacyElectronApi()?.invoke?.('org-seeDetails', { alias })) as
        | { error?: unknown; res?: any }
        | undefined;

    if (response?.error) {
        throw response.error;
    }

    return response?.res;
}

export async function getDesktopOrgs(): Promise<any> {
    const desktopApi = getDesktopApi();
    if (desktopApi?.getAllOrgs) {
        return desktopApi.getAllOrgs();
    }

    return getLegacyElectronApi()?.invoke?.('org-getAllOrgs');
}

export async function getDesktopCodeInitialConfig(alias: string): Promise<{
    projectPath: string | null;
    metadataLoaded: boolean;
}> {
    const desktopApi = getDesktopApi();
    if (desktopApi?.getCodeInitialConfig) {
        return desktopApi.getCodeInitialConfig(alias);
    }

    const response = (await getLegacyElectronApi()?.invoke?.('code-getInitialConfig', {
        alias,
    })) as
        | {
              error?: unknown;
              result?: { projectPath: string | null; metadataLoaded: boolean };
          }
        | undefined;

    if (response?.error) {
        throw response.error;
    }

    return response?.result || { projectPath: null, metadataLoaded: false };
}

export async function selectDesktopCodeProject(payload: {
    alias: string;
    defaultPath?: string | null;
}): Promise<{ projectPath: string | null }> {
    const desktopApi = getDesktopApi();
    if (desktopApi?.selectCodeProject) {
        return desktopApi.selectCodeProject(payload);
    }

    const response = (await getLegacyElectronApi()?.invoke?.(
        'code-createVSCodeProject',
        payload
    )) as
        | {
              error?: unknown;
              result?: { projectPath: string | null };
          }
        | undefined;

    if (response?.error) {
        throw response.error;
    }

    return response?.result || { projectPath: null };
}

export async function openDesktopVSCodeProject(projectPath: string | null): Promise<void> {
    const desktopApi = getDesktopApi();
    if (desktopApi?.openVSCodeProject) {
        await desktopApi.openVSCodeProject(projectPath);
        return;
    }

    await getLegacyElectronApi()?.invoke?.('code-openVSCodeProject', { path: projectPath });
}

export async function getDesktopPmdInstallation(projectPath: string | null): Promise<{
    installationPath: string | null;
    executablePath: string | null;
}> {
    const desktopApi = getDesktopApi();
    if (desktopApi?.getPmdInstallation) {
        return desktopApi.getPmdInstallation(projectPath);
    }

    const response = (await getLegacyElectronApi()?.invoke?.('code-isPmdInstalled', {
        projectPath,
    })) as
        | {
              error?: unknown;
              result?:
                  | { installationPath: string | null; executablePath: string | null }
                  | string
                  | null;
          }
        | undefined;

    if (response?.error) {
        throw response.error;
    }

    if (typeof response?.result === 'string') {
        return {
            installationPath: response.result,
            executablePath: `${response.result}/bin/pmd`,
        };
    }

    return (
        response?.result || {
            installationPath: null,
            executablePath: null,
        }
    );
}

export async function installDesktopLatestPmd(projectPath: string | null): Promise<void> {
    const desktopApi = getDesktopApi();
    if (desktopApi?.installLatestPmd) {
        await desktopApi.installLatestPmd(projectPath);
        return;
    }

    const response = (await getLegacyElectronApi()?.invoke?.('code-installLatestPmd', {
        projectPath,
    })) as
        | {
              error?: unknown;
          }
        | undefined;

    if (response?.error) {
        throw response.error;
    }
}

export async function retrieveDesktopCode(payload: {
    targetPath: string | null;
    alias: string;
    refresh: boolean;
}): Promise<{ runInWorker: boolean; res: unknown }> {
    const desktopApi = getDesktopApi();
    if (desktopApi?.retrieveCode) {
        return desktopApi.retrieveCode(payload);
    }

    const response = (await getLegacyElectronApi()?.invoke?.('code-retrieveCode', payload)) as
        | {
              error?: unknown;
              result?: { runInWorker: boolean; res: unknown };
          }
        | undefined;

    if (response?.error) {
        throw response.error;
    }

    return response?.result || { runInWorker: false, res: null };
}

export async function exportDesktopMetadata(payload: {
    targetPath: string | null;
    alias: string;
}): Promise<void> {
    const desktopApi = getDesktopApi();
    if (desktopApi?.exportMetadata) {
        await desktopApi.exportMetadata(payload);
        return;
    }

    await getLegacyElectronApi()?.invoke?.('code-exportMetadata', payload);
}

export async function runDesktopShell(payload: {
    alias: string;
    targetPath: string | null;
    listenerName: string;
    command: string;
}): Promise<void> {
    const desktopApi = getDesktopApi();
    if (desktopApi?.runShell) {
        await desktopApi.runShell(payload);
        return;
    }

    await getLegacyElectronApi()?.invoke?.('code-runShell', payload);
}

export async function runDesktopSfdxAnalyzer(payload: {
    alias: string;
    listenerName: string;
    command: string;
}): Promise<void> {
    const desktopApi = getDesktopApi();
    if (desktopApi?.runSfdxAnalyzer) {
        await desktopApi.runSfdxAnalyzer(payload);
        return;
    }

    await getLegacyElectronApi()?.invoke?.('code-runSfdxAnalyzer', payload);
}

export function onDesktopLegacyChannel(
    channel: string,
    callback: LegacyDesktopListener
): (() => void) | undefined {
    const legacyApi = getLegacyElectronApi();
    if (!legacyApi?.listener_on || !legacyApi?.listener_off) {
        return undefined;
    }

    legacyApi.listener_on(channel, callback);
    return () => {
        legacyApi.listener_off?.(channel);
    };
}

export async function renameDesktopStoredOrg(payload: {
    oldAlias: string;
    newAlias: string;
}): Promise<void> {
    const desktopApi = getDesktopApi();
    if (desktopApi?.renameStoredOrg) {
        await desktopApi.renameStoredOrg(payload);
        return;
    }

    await getLegacyElectronApi()?.invoke?.('org-renameStoredOrg', {
        alias: payload.oldAlias,
        newAlias: payload.newAlias,
    });
}

export async function removeDesktopStoredOrg(alias: string): Promise<void> {
    const desktopApi = getDesktopApi();
    if (desktopApi?.removeStoredOrg) {
        await desktopApi.removeStoredOrg(alias);
        return;
    }

    await getLegacyElectronApi()?.invoke?.('org-removeStoredOrg', { alias });
}

export async function notifyDesktopLimitedModeStatus(
    payload: Record<string, unknown>
): Promise<void> {
    const desktopApi = getDesktopApi();
    if (desktopApi?.notifyLimitedModeStatus) {
        await desktopApi.notifyLimitedModeStatus(payload);
        return;
    }

    const legacyApi = getLegacyElectronApi();
    const currentChannel = legacyApi?.getChannel?.();
    if (currentChannel && legacyApi?.send) {
        legacyApi.send(currentChannel, payload);
    } else {
        LOGGER.debug('notifyDesktopLimitedModeStatus skipped - no desktop channel available');
    }
}
