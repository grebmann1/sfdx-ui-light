import { createWorkbenchAgentBridge } from '../../workbench/agentBridge.js';

const CHAT_PARTICIPANT_ID = 'salesforce.workbench.agent';
const MODEL_VENDOR = 'salesforce-workbench';

const TOOL_DEFINITIONS = [
    {
        name: 'getActiveEditorContext',
        toolReferenceName: 'getActiveEditorContext',
        displayName: 'Get Active Editor Context',
        userDescription: 'Read the active editor path, selection, and text snapshot.',
        modelDescription: 'Use this tool to inspect the current active VS Code editor context.',
        canBeReferencedInPrompt: true,
        inputSchema: {
            type: 'object',
            properties: {
                includeFullText: {
                    type: 'boolean',
                },
            },
            additionalProperties: false,
        },
    },
    {
        name: 'applyActiveEditorEdit',
        toolReferenceName: 'applyActiveEditorEdit',
        displayName: 'Apply Active Editor Edit',
        userDescription: 'Apply a text edit to the current active editor.',
        modelDescription: 'Use this tool to update the active VS Code editor.',
        canBeReferencedInPrompt: true,
        inputSchema: {
            type: 'object',
            properties: {
                content: {
                    type: 'string',
                },
                replaceSelection: {
                    type: 'boolean',
                },
                startLine: {
                    type: 'number',
                },
                startCharacter: {
                    type: 'number',
                },
                endLine: {
                    type: 'number',
                },
                endCharacter: {
                    type: 'number',
                },
            },
            required: ['content'],
            additionalProperties: false,
        },
    },
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
                modes: ['agent'],
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
    enabledApiProposals: [
        'aiRelatedInformation',
        'mappedEditsProvider',
        'chatSessionsProvider',
        'defaultChatParticipant',
        'chatParticipantAdditions',
        'chatParticipantPrivate',
        'languageModelThinkingPart',
        'chatProvider',
    ],
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
                await bridge.handleChatRequest(request, context, response, token);
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
