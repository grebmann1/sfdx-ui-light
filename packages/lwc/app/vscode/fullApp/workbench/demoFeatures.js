export async function runDemoFeatures(app, getVscodeBundle) {
    if (app?._isChromeExtension) {
        return;
    }
    const vscodeBundle = await getVscodeBundle();
    const vscode = vscodeBundle.vscode;
    await showWelcomeNotifications(vscode);
    await setupScmDemo(app, vscode);
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

        const openCommand = vscode.commands.registerCommand('scm-demo.open-file', async uri => {
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
