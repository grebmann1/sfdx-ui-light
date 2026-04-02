const config = {
    name: "agentscript-extension",
    displayName: "Agent Script Language Support",
    description: "VSCode extension for Agent Script language support",
    version: "1.2.1",
    publisher: "salesforce",
    license: "Apache-2.0",
    // browser: "/workspace/extension.js", /** Needed if we want to auto execute some code  */
    engines: {
        vscode: '*'
    },
    contributes: {
        languages: [
            {
                id: "agentscript",
                aliases: ["Agent Scripting"],
                extensions: [".agent", ".afscript"],
                configuration: "/workspace/language-configuration.json",
            },
        ],
        grammars: [
            {
                language: "agentscript",
                scopeName: "source.agentscript",
                path: "/workspace/agentscript.tmLanguage.json",
            },
        ],
        /* snippets: [
            {
                language: "agentscript",
                path: "/workspace/agentscript-code-snippets.json",
            },
        ], */
        themes: [
            {
                id: "Tokyo Night",
                label: "Tokyo Night",
                uiTheme: "vs-dark",
                path: "/workspace/tokyo-night-color-theme.json",
            },
            {
                id: "Shades of Purple (Super Dark)",
                label: "Shades of Purple (Super Dark)",
                uiTheme: "vs-dark",
                path: "/workspace/shades-of-purple-super-dark.json",
            },
        ],
    },
    activationEvents: ["*"],
};

const loadExtension = async () => {
    const filesOrContents = new Map();

    const [server, grammar, languageConfiguration, tokyoNightTheme, shadesOfPurpleTheme] = await Promise.all([
        fetch("/libs/extensions/agentscript-extension/server/server.browser.js").then(response => response.text()),
        fetch("/libs/extensions/agentscript-extension/grammar/agentscript.tmLanguage.json").then(response => response.text()),
        fetch("/libs/extensions/agentscript-extension/grammar/language-configuration.json").then(response => response.text()),
        fetch("/libs/extensions/agentscript-extension/themes/tokyo-night-color-theme.json").then(response => response.text()),
        fetch("/libs/extensions/agentscript-extension/themes/shades-of-purple-super-dark.json").then(response => response.text()),
    ]);

    const serverBlob = new Blob([server], { type: 'application/javascript' });
    const grammarBlob = new Blob([grammar], { type: 'application/json' });
    const languageConfigurationBlob = new Blob([languageConfiguration], { type: 'application/json' });
    const tokyoNightThemeBlob = new Blob([tokyoNightTheme], { type: 'application/json' });
    const shadesOfPurpleThemeBlob = new Blob([shadesOfPurpleTheme], { type: 'application/json' });

    filesOrContents.set('/workspace/server.js', URL.createObjectURL(serverBlob));
    filesOrContents.set('/workspace/agentscript.tmLanguage.json', URL.createObjectURL(grammarBlob));
    filesOrContents.set('/workspace/language-configuration.json', URL.createObjectURL(languageConfigurationBlob));
    filesOrContents.set('/workspace/tokyo-night-color-theme.json', URL.createObjectURL(tokyoNightThemeBlob));
    filesOrContents.set('/workspace/shades-of-purple-super-dark.json', URL.createObjectURL(shadesOfPurpleThemeBlob));


    return {
        config,
        filesOrContents
    };
};


const activate = async (vscodeWrapper) => {
    // Use bundled language server from the extension's server directory
    const { BrowserMessageReader, BrowserMessageWriter } = vscodeWrapper.vscodeApi.VSCodeLanguageClientBrowser;
    const workerUrl = "/libs/extensions/agentscript-extension/server/server.browser.js";

    const loadAgentScriptWorker = () => {
        return new Worker(workerUrl, {
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