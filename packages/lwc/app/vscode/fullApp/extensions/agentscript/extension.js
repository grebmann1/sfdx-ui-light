import {
    AGENTSCRIPT_EXTENSION_ASSETS,
    AGENTSCRIPT_EXTENSION_CONFIG,
    AGENTSCRIPT_SERVER_WORKER_URL,
} from './constants.js';

const loadExtension = async () => {
    const filesOrContents = new Map();

    const loadedAssets = await Promise.all(
        AGENTSCRIPT_EXTENSION_ASSETS.map(async ({ sourcePath, targetPath, mimeType }) => ({
            targetPath,
            objectUrl: URL.createObjectURL(
                new Blob([await fetch(sourcePath).then(response => response.text())], {
                    type: mimeType,
                })
            ),
        }))
    );

    loadedAssets.forEach(({ targetPath, objectUrl }) => {
        filesOrContents.set(targetPath, objectUrl);
    });

    return {
        config: AGENTSCRIPT_EXTENSION_CONFIG,
        filesOrContents,
    };
};

const activate = async vscodeWrapper => {
    // Use bundled language server from the extension's server directory
    const { BrowserMessageReader, BrowserMessageWriter } =
        vscodeWrapper.vscodeApi.VSCodeLanguageClientBrowser;
    const loadAgentScriptWorker = () => {
        return new Worker(AGENTSCRIPT_SERVER_WORKER_URL, {
            type: 'module',
            name: 'Agent Script LS',
        });
    };

    const worker = loadAgentScriptWorker();
    const reader = new BrowserMessageReader(worker);
    const writer = new BrowserMessageWriter(worker);

    const languageClientConfig = {
        languageId: 'agentscript',
        clientOptions: {
            documentSelector: [
                { scheme: 'file', language: 'agentscript' },
                { scheme: 'file', language: 'agentscript', pattern: '**/*.agent' },
                { scheme: 'file', language: 'agentscript', pattern: '**/*.afscript' },
            ],
        },
        connection: {
            options: {
                $type: 'MessageChannel',
                worker,
            },
            messageTransports: { reader, writer },
        },
    };

    return { languageClientConfig };
};

export { loadExtension, activate };
