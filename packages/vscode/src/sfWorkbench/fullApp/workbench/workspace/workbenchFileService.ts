import { createIndexedDbWorkspaceProvider } from '../indexedDbWorkspaceProvider';

export function mergeServiceOverrides(...overrides) {
    return overrides.reduce((result, nextOverrides) => {
        if (!nextOverrides || typeof nextOverrides !== 'object') {
            return result;
        }
        return {
            ...result,
            ...nextOverrides,
        };
    }, {});
}

function resolveBundledFileServiceHelper(vscodeBundle) {
    if (!vscodeBundle) {
        return { helper: null, source: 'missing' };
    }
    if (vscodeBundle?.serviceHelpers?.FileServiceWrapper) {
        return {
            helper: vscodeBundle.serviceHelpers.FileServiceWrapper,
            source: 'serviceHelpers',
        };
    }
    return { helper: null, source: 'missing' };
}

function resolveGetServiceOverride(helper) {
    if (typeof helper?.default === 'function') {
        return helper.default.bind(helper);
    }
    if (typeof helper === 'function') {
        return helper;
    }
    return null;
}

export function createWorkbenchFilesService({
    vscodeBundle,
    vscode,
    workspaceRoot,
    providerFactory = createIndexedDbWorkspaceProvider,
}) {
    const { helper, source } = resolveBundledFileServiceHelper(vscodeBundle);
    const getBundledServiceOverride = resolveGetServiceOverride(helper);

    return {
        workspaceRoot,
        helperSource: source,
        hasOverlayRegistration() {
            return typeof helper?.registerFileSystemOverlay === 'function';
        },
        getServiceOverrides(options = {}) {
            if (!getBundledServiceOverride) {
                return {};
            }

            return mergeServiceOverrides(getBundledServiceOverride(options) || {});
        },
        createWorkspaceProvider({ fs, nextWorkspaceRoot = workspaceRoot }) {
            if (!fs) {
                throw new Error(
                    'A filesystem instance is required to create a workspace provider.'
                );
            }

            const provider = providerFactory({
                fs,
                vscode,
                workspaceRoot: nextWorkspaceRoot,
            });

            return provider;
        },
        registerWorkspaceOverlay(priority, provider) {
            if (typeof helper?.registerFileSystemOverlay !== 'function') {
                throw new Error(
                    'The bundled file service helper does not expose registerFileSystemOverlay.'
                );
            }

            return helper.registerFileSystemOverlay(priority, provider);
        },
        mountWorkspaceOverlay({ fs, provider, priority = 1, nextWorkspaceRoot = workspaceRoot }) {
            const workspaceProvider =
                provider ||
                this.createWorkspaceProvider({
                    fs,
                    nextWorkspaceRoot,
                });
            const overlayDisposable = this.registerWorkspaceOverlay(priority, workspaceProvider);

            return {
                provider: workspaceProvider,
                overlayDisposable,
            };
        },
    };
}

export const __testables = {
    mergeServiceOverrides,
    resolveBundledFileServiceHelper,
    resolveGetServiceOverride,
};
