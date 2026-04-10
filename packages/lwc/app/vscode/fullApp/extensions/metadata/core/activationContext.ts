function createDiagnosticCollection(vscode, name, disposables) {
    const collection = vscode.languages?.createDiagnosticCollection
        ? vscode.languages.createDiagnosticCollection(name)
        : null;
    if (collection) {
        disposables.push(collection);
    }
    return collection;
}

function disposeAll(disposables) {
    for (const disposable of disposables) {
        try {
            disposable?.dispose?.();
        } catch {
            // ignore
        }
    }
}

export function createActivationContext(vscodeBundle) {
    const vscode = vscodeBundle?.vscode;
    if (!vscode?.commands || !vscode?.window || !vscode?.workspace) {
        return null;
    }

    const disposables = [];
    const diagnostics = {
        lwc: createDiagnosticCollection(vscode, 'salesforceLwcEslint', disposables),
        deploy: createDiagnosticCollection(vscode, 'salesforceDeploy', disposables),
        login: createDiagnosticCollection(vscode, 'salesforceLogin', disposables),
        apexExecuteAnonymous: createDiagnosticCollection(
            vscode,
            'apexExecuteAnonymous',
            disposables
        ),
        apexTests: createDiagnosticCollection(vscode, 'apexTests', disposables),
        shell: createDiagnosticCollection(vscode, 'salesforceShell', disposables),
    };

    const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusItem.show();
    disposables.push(statusItem);

    const output =
        typeof vscode.window?.createOutputChannel === 'function'
            ? vscode.window.createOutputChannel('Salesforce (Workbench)')
            : null;
    if (output) {
        disposables.push(output);
    }

    return {
        disposables,
        diagnostics,
        output,
        state: {
            deployWorker: null,
            toolingMapCache: null,
        },
        statusItem,
        vscode,
        vscodeBundle,
        addDisposable(disposable) {
            if (disposable) {
                disposables.push(disposable);
            }
            return disposable;
        },
        logLines(lines) {
            if (!output) return;
            try {
                for (const line of lines || []) {
                    output.appendLine(String(line));
                }
            } catch {
                // ignore
            }
        },
        dispose() {
            disposeAll(disposables);
        },
    };
}

export const __testables = {
    disposeAll,
};
