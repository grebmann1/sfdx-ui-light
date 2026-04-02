export async function runDemoFeatures(app, getVscodeBundle) {
    if (app?._isChromeExtension) {
        return;
    }
    const vscodeBundle = await getVscodeBundle();
    const vscode = vscodeBundle.vscode;
    await showWelcomeNotifications(vscode);
    await setupScmDemo(app, vscode);
    await setupAiDemo(app, vscodeBundle);
}

async function showWelcomeNotifications(vscode) {
    try {
        await vscode.window
            .showInformationMessage('Hello', {
                detail: 'Welcome to the Monaco + VS Code workbench demo',
                modal: true,
            })
            .then(() => {
                return vscode.window.showInformationMessage(
                    'Tip: Open the Command Palette (F1) to explore extra demos.'
                );
            });
    } catch {
        // ignore
    }
}

async function setupScmDemo(app, vscode) {
    try {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }
        const workspaceRoot = app?._workspaceRoot || '/workspace';

        const openCommand = vscode.commands.registerCommand('scm-demo.open-file', async (uri) => {
            await vscode.commands.executeCommand('vscode.open', uri);
        });
        const commitCommand = vscode.commands.registerCommand('scm-demo.commit', async () => {
            await vscode.window.showInformationMessage("You've committed!");
        });

        app._demoDisposables.push(openCommand, commitCommand);

        const scm = vscode.scm.createSourceControl(
            'demo-source-control',
            'Demo Source Control',
            workspaceFolder.uri
        );
        scm.inputBox.placeholder = 'Hello, you can write anything here!';
        scm.acceptInputCommand = {
            command: 'scm-demo.commit',
            title: 'Commit',
        };
        scm.actionButton = {
            command: {
                command: 'scm-demo.commit',
                title: 'Commit',
            },
            enabled: true,
        };
        scm.count = 2;

        const group = scm.createResourceGroup('working-tree', 'Working Tree');
        group.resourceStates = [
            {
                resourceUri: vscode.Uri.file(`${workspaceRoot}/README.md`),
                command: {
                    title: 'Open',
                    command: 'scm-demo.open-file',
                    arguments: [vscode.Uri.file(`${workspaceRoot}/README.md`)],
                },
            },
            {
                resourceUri: vscode.Uri.file(`${workspaceRoot}/.vscode/settings.json`),
                command: {
                    title: 'Open',
                    command: 'scm-demo.open-file',
                    arguments: [vscode.Uri.file(`${workspaceRoot}/.vscode/settings.json`)],
                },
                decorations: {
                    strikeThrough: true,
                    tooltip: 'File is read-only in this demo',
                },
            },
        ];

        app._demoDisposables.push(scm);
    } catch {
        // ignore
    }
}

async function setupAiDemo(app, vscodeBundle) {
    const extensionApi = vscodeBundle?.vscodeApi?.extensions;
    if (!extensionApi?.registerExtension || !extensionApi?.ExtensionHostKind) {
        return;
    }
    const { registerExtension, ExtensionHostKind } = extensionApi;
    const vscode = vscodeBundle.vscode;

    try {
        const { getApi } = registerExtension(
            {
                name: 'aiDemo',
                publisher: 'codingame',
                version: '1.0.0',
                engines: {
                    vscode: '*',
                },
                contributes: {
                    commands: [
                        {
                            command: 'aiSuggestedCommand',
                            title: 'This is a command suggested by the AI',
                        },
                    ],
                    languageModelTools: [
                        {
                            name: 'codingame-tool',
                            toolReferenceName: 'codingame-tool',
                            displayName: 'Codingame tool',
                            userDescription: 'A tool that multiply a number by two',
                            modelDescription: 'Use this tool to get the result of a multiplication by two',
                            canBeReferencedInPrompt: true,
                            inputSchema: {
                                type: 'object',
                                properties: {
                                    value: {
                                        type: 'number',
                                    },
                                },
                                required: ['value'],
                                additionalProperties: false,
                            },
                        },
                    ],
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
            },
            ExtensionHostKind.LocalProcess,
            { system: true }
        );

        void getApi().then(async (vscodeApi) => {
            if (!vscodeApi?.lm || !vscodeApi?.chat) {
                return;
            }

            const commandDisposable = vscodeApi.commands.registerCommand('aiSuggestedCommand', () => {
                void vscodeApi.window.showInformationMessage('Hello', {
                    detail: 'You just ran the AI suggested command',
                    modal: true,
                });
            });

            class CodingameTool {
                async invoke(options) {
                    return new vscode.LanguageModelToolResult([
                        new vscode.LanguageModelTextPart('The result is: ' + options.input.value * 2),
                    ]);
                }

                async prepareInvocation(options) {
                    return {
                        invocationMessage: new vscode.MarkdownString(
                            'Doubling the value `' + options.input.value + '`'
                        ),
                        confirmationMessages: {
                            title: vscode.l10n.t('Use Codingame tool'),
                            message: new vscode.MarkdownString(
                                'AI wants to get the double of `' + options.input.value + '`'
                            ),
                        },
                    };
                }
            }

            vscodeApi.lm.registerTool('codingame-tool', new CodingameTool());

            const chatDisposable = vscodeApi.chat.createChatParticipant(
                'codingame.aiDemo.participant',
                async (request, _context, response) => {
                    const modelResponse = await request.model.sendRequest([
                        vscodeApi.LanguageModelChatMessage.User(request.prompt),
                    ]);
                    for await (const part of modelResponse.stream) {
                        if (part instanceof vscode.LanguageModelTextPart) {
                            response.markdown(part.value);
                        } else if (part instanceof vscode.LanguageModelThinkingPart) {
                            response.thinkingProgress({
                                id: part.id,
                                text: part.value,
                                metadata: part.metadata,
                            });
                        } else if (part instanceof vscode.LanguageModelToolCallPart) {
                            const res = await vscode.lm.invokeTool(part.name, {
                                toolInvocationToken: request.toolInvocationToken,
                                input: part.input,
                            });
                            let toolResult = '';
                            for (const toolPart of res.content) {
                                if (toolPart instanceof vscode.LanguageModelTextPart) {
                                    toolResult += toolPart.value;
                                }
                            }
                            response.markdown('Tool result: `' + toolResult + '`\n');
                        }
                    }
                }
            );

            app._demoDisposables.push(commandDisposable, chatDisposable);
        }).catch(() => {
            // ignore
        });
    } catch {
        // ignore
    }
}
