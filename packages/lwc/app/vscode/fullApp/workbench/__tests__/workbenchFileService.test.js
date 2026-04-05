/* eslint-env jest */
import { createWorkbenchFilesService, __testables } from '../workbenchFileService.js';

function createHelperStub() {
    return {
        default: jest.fn(options => ({
            fileServiceOverride: options,
        })),
        registerFileSystemOverlay: jest.fn((priority, provider) => ({
            dispose: jest.fn(),
            priority,
            provider,
        })),
    };
}

describe('workbenchFileService', () => {
    it('prefers the bundled file service helper from serviceHelpers', () => {
        const helper = createHelperStub();

        expect(
            __testables.resolveBundledFileServiceHelper({
                serviceHelpers: { FileServiceWrapper: helper },
            })
        ).toEqual({
            helper,
            source: 'serviceHelpers',
        });
    });

    it('returns bundled service overrides from the helper default export', () => {
        const helper = createHelperStub();
        const service = createWorkbenchFilesService({
            vscodeBundle: {
                serviceHelpers: {
                    FileServiceWrapper: helper,
                },
            },
            vscode: {},
            workspaceRoot: '/workspace',
        });

        const overrides = service.getServiceOverrides({
            statMiddleware: jest.fn(),
        });

        expect(helper.default).toHaveBeenCalledWith({
            statMiddleware: expect.any(Function),
        });
        expect(overrides).toEqual({
            fileServiceOverride: {
                statMiddleware: expect.any(Function),
            },
        });
    });

    it('creates and mounts a workspace overlay through the bundled helper', () => {
        const helper = createHelperStub();
        const providerFactory = jest.fn(({ fs, workspaceRoot }) => ({
            fs,
            workspaceRoot,
            capabilities: 2,
        }));
        const service = createWorkbenchFilesService({
            vscodeBundle: {
                serviceHelpers: {
                    FileServiceWrapper: helper,
                },
            },
            vscode: {},
            workspaceRoot: '/workspace',
            providerFactory,
        });
        const fs = { id: 'app-fs' };

        const mounted = service.mountWorkspaceOverlay({
            fs,
            priority: 5,
        });

        expect(providerFactory).toHaveBeenCalledWith({
            fs,
            vscode: {},
            workspaceRoot: '/workspace',
        });
        expect(helper.registerFileSystemOverlay).toHaveBeenCalledWith(5, mounted.provider);
        expect(mounted.provider).toMatchObject({
            fs,
            workspaceRoot: '/workspace',
        });
    });
});
