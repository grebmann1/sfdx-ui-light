export type DisposableLike = { dispose(): void };
import { SALESFORCE_CONTEXT_MENU_GROUP } from './constants';
import { createObjectUrl, fetchTextAsset } from './extensionAssets';

export function toDisposable(value: unknown): DisposableLike {
    if (value && typeof (value as DisposableLike).dispose === 'function') {
        return value as DisposableLike;
    }
    return { dispose() {} };
}

export function createCallbackDisposable(callback?: (() => void) | null): DisposableLike {
    return {
        dispose() {
            try {
                callback?.();
            } catch {
                // ignore cleanup errors
            }
        },
    };
}

export function registerCommand(
    context: { addDisposable: (value: unknown) => unknown },
    vscode: {
        commands?: {
            registerCommand?: (
                command: string,
                handler: (...args: unknown[]) => unknown
            ) => unknown;
        };
    },
    command: string,
    handler: (...args: unknown[]) => unknown
) {
    return context.addDisposable(vscode.commands!.registerCommand(command, handler));
}

type RemoteAsset = {
    sourcePath: string;
    targetPath: string;
    mimeType: string;
    content?: string;
};

type InlineAsset = {
    targetPath: string;
    mimeType: string;
    content: string;
};

export type SalesforceExtensionDefinition = {
    config: Record<string, unknown>;
    remoteAssets?: RemoteAsset[];
    inlineAssets?: InlineAsset[];
    filesOrContents?: Map<string, string>;
};

type ExtensionRegistration = {
    dispose?: () => void;
    whenReady?: () => Promise<void>;
    getApi?: () => Promise<unknown>;
    registerFileUrl?: (path: string, fileUrl: string) => DisposableLike | void;
};

type ExtensionsApi = {
    registerExtension: (
        config: Record<string, unknown>,
        hostKind: unknown,
        options?: Record<string, unknown>
    ) => ExtensionRegistration;
    ExtensionHostKind: { LocalProcess: unknown };
};

export type VscodeBundle = Record<string, unknown> & {
    extensions?: ExtensionsApi;
};

type SetupContext = {
    push: (...items: unknown[]) => void;
    vscodeBundle: VscodeBundle;
};

/**
 * Registers a Salesforce extension dynamically (post-init) via the vscode extensions API.
 */
export async function registerSalesforceExtension(
    vscodeBundle: VscodeBundle,
    definition: SalesforceExtensionDefinition,
    setup?: (vscode: unknown, ctx: SetupContext) => Promise<unknown>,
    options?: Record<string, unknown>
): Promise<DisposableLike> {
    const extensionsApi = vscodeBundle?.extensions;
    if (!extensionsApi?.registerExtension || !extensionsApi?.ExtensionHostKind) {
        return toDisposable(null);
    }

    const config = withDefaultSalesforceMenuGroups(definition.config);
    const assetsMap = await buildAssetsMap(definition);
    const registration = extensionsApi.registerExtension(
        config,
        extensionsApi.ExtensionHostKind.LocalProcess,
        options
    );

    const disposables: DisposableLike[] = [];
    if (registration?.dispose) {
        disposables.push({ dispose: () => registration.dispose?.() });
    }

    if (assetsMap.size > 0 && typeof registration?.registerFileUrl === 'function') {
        for (const [path, fileUrl] of assetsMap.entries()) {
            const fileReg = registration.registerFileUrl(path, fileUrl);
            if (fileReg && typeof fileReg.dispose === 'function') {
                disposables.push(fileReg);
            }
        }
    }

    const push = (...items: unknown[]) => {
        for (const item of items.flat()) {
            if (item && typeof (item as DisposableLike).dispose === 'function') {
                disposables.push(item as DisposableLike);
            }
        }
    };

    await registration.whenReady?.();

    const vscode = await registration?.getApi?.().catch(() => null);
    const result = await setup?.(vscode, { push, vscodeBundle });
    push(result);

    return createCallbackDisposable(() => {
        for (const disposable of [...disposables].reverse()) {
            try {
                disposable?.dispose?.();
            } catch {
                // ignore
            }
        }
    });
}

async function buildAssetsMap(
    definition: SalesforceExtensionDefinition
): Promise<Map<string, string>> {
    const { remoteAssets, inlineAssets, filesOrContents } = definition;
    const map: Map<string, string> = filesOrContents ? new Map(filesOrContents) : new Map();

    for (const { targetPath, mimeType, content } of inlineAssets || []) {
        map.set(targetPath, createObjectUrl(content, mimeType));
    }

    const remoteLoaded = await Promise.allSettled(
        (remoteAssets || []).map(async ({ sourcePath, targetPath, mimeType, content }) => ({
            targetPath,
            objectUrl: createObjectUrl(content || (await fetchTextAsset(sourcePath)), mimeType),
        }))
    );

    for (const result of remoteLoaded) {
        if (result.status === 'fulfilled') {
            map.set(result.value.targetPath, result.value.objectUrl);
        }
    }

    return map;
}

function withDefaultSalesforceMenuGroups(config: Record<string, unknown>): Record<string, unknown> {
    const contributes = toRecord(config.contributes);
    const menus = contributes ? toRecord(contributes.menus) : null;
    if (!menus) {
        return config;
    }

    let hasChanges = false;
    const normalizedMenus: Record<string, unknown> = {};

    for (const [menuLocation, menuItems] of Object.entries(menus)) {
        if (!Array.isArray(menuItems)) {
            normalizedMenus[menuLocation] = menuItems;
            continue;
        }

        normalizedMenus[menuLocation] = menuItems.map(menuItem => {
            const normalizedItem = withDefaultMenuGroup(menuItem);
            if (normalizedItem !== menuItem) {
                hasChanges = true;
            }
            return normalizedItem;
        });
    }

    if (!hasChanges) {
        return config;
    }

    return {
        ...config,
        contributes: {
            ...contributes,
            menus: normalizedMenus,
        },
    };
}

function withDefaultMenuGroup(menuItem: unknown): unknown {
    const menuContribution = toRecord(menuItem);
    if (!menuContribution || typeof menuContribution.command !== 'string') {
        return menuItem;
    }
    if (typeof menuContribution.group === 'string' && menuContribution.group.length > 0) {
        return menuItem;
    }

    return {
        ...menuContribution,
        group: SALESFORCE_CONTEXT_MENU_GROUP,
    };
}

function toRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    return value as Record<string, unknown>;
}
