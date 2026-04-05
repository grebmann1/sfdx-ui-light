import {
    ACTIVE_EDITOR_TOOL_DEFINITIONS,
    AI_EXTENSION_API_PROPOSALS,
    CHAT_PARTICIPANT_ID,
    MODEL_VENDOR,
} from './constants.js';
import { createWorkbenchAgentBridge } from './core/agentBridge.js';
import { WORKBENCH_BASH_TOOL_DEFINITIONS } from './tools/bashTools.js';
import { VSCODE_FILE_TOOL_DEFINITIONS } from './tools/vscodeFileTools.js';

const TOOL_DEFINITIONS = [
    ...ACTIVE_EDITOR_TOOL_DEFINITIONS,
    ...WORKBENCH_BASH_TOOL_DEFINITIONS,
    ...VSCODE_FILE_TOOL_DEFINITIONS,
];

const config = {
    name: 'workbench-ai',
    displayName: 'Workbench AI',
    description: 'Connect the embedded VS Code chat surface to the Workbench agent runtime.',
    version: '1.0.0',
    publisher: 'salesforce',
    license: 'MIT',
    engines: {
        vscode: '*',
    },
    contributes: {
        chatParticipants: [
            {
                id: CHAT_PARTICIPANT_ID,
                fullName: 'Workbench Agent',
                name: 'workbench-agent',
                isDefault: true,
                modes: ['ask', 'edit', 'agent'],
                locations: ['panel', 'editor', 'terminal'],
            },
        ],
        languageModelChatProviders: [
            {
                vendor: MODEL_VENDOR,
                displayName: 'Workbench Agent',
            },
        ],
        languageModelTools: TOOL_DEFINITIONS,
    },
    enabledApiProposals: AI_EXTENSION_API_PROPOSALS,
};

export async function activate(vscodeBundle) {
    const extensionApi = vscodeBundle?.vscodeApi?.extensions;
    if (!extensionApi?.registerExtension || !extensionApi?.ExtensionHostKind) {
        return { dispose() {} };
    }

    const { registerExtension, ExtensionHostKind } = extensionApi;
    const { getApi } = registerExtension(config, ExtensionHostKind.LocalProcess, {
        system: true,
    });

    const vscodeApi = await getApi().catch(() => null);
    if (!vscodeApi?.chat || !vscodeApi?.lm) {
        return { dispose() {} };
    }

    const bridge = createWorkbenchAgentBridge(vscodeBundle, vscodeApi);
    const disposables = [];

    for (const tool of bridge.createRegisteredTools()) {
        disposables.push(vscodeApi.lm.registerTool(tool.definition.name, tool.createInstance()));
    }

    const onDidChangeLanguageModelChatInformation = new vscodeApi.EventEmitter();
    disposables.push(onDidChangeLanguageModelChatInformation);

    disposables.push(
        vscodeApi.lm.registerLanguageModelChatProvider(MODEL_VENDOR, {
            provideLanguageModelChatInformation() {
                return [bridge.createModelInfo()];
            },
            async provideLanguageModelChatResponse(model, messages, _options, progress, token) {
                await bridge.handleProviderRequest(model, messages, progress, token);
            },
            async provideTokenCount(model, value) {
                return await bridge.provideTokenCount(model, value);
            },
            onDidChangeLanguageModelChatInformation: onDidChangeLanguageModelChatInformation.event,
        })
    );

    disposables.push(
        vscodeApi.chat.createChatParticipant(
            CHAT_PARTICIPANT_ID,
            async (request, context, response, token) => {
                const handledViaModel = await bridge.handleChatRequestViaModel(
                    request,
                    response,
                    token
                );
                if (!handledViaModel) {
                    await bridge.handleChatRequest(request, context, response, token);
                }
            }
        )
    );

    onDidChangeLanguageModelChatInformation.fire();

    return {
        dispose() {
            for (const disposable of disposables) {
                try {
                    disposable?.dispose?.();
                } catch {
                    // ignore
                }
            }
        },
    };
}
