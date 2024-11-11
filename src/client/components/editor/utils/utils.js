import { isChromeExtension } from 'shared/utils';

function buildWorkerDefinition(workerPath, basePath, useModuleWorker) {
    const monWin = self;
    const workerOverrideGlobals = {
        basePath: basePath,
        workerPath: workerPath,
        workerOptions: {
            type: useModuleWorker ? 'module' : 'classic'
        }
    };
    if (!monWin.MonacoEnvironment) {
        monWin.MonacoEnvironment = {
            workerOverrideGlobals: workerOverrideGlobals,
            createTrustedTypesPolicy: (_policyName) => {
                return undefined;
            }
        };
    }
    const monEnv = monWin.MonacoEnvironment;
    monEnv.workerOverrideGlobals = workerOverrideGlobals;
    const getWorker = (_, label) => {
        const buildWorker = (globals, label, workerName, editorType) => {
            globals.workerOptions.name = label;
            const workerFilename = globals.workerOptions.type === 'module' ? `${workerName}-es.js` : `${workerName}-iife.js`;
            const workerPathLocal = `${globals.workerPath}/${workerFilename}`;
            const workerUrl = new URL(workerPathLocal, globals.basePath);
            console.log('--> Monaco Worker created');
            //console.log(`${editorType}: url: ${workerUrl.href} created from basePath: ${globals.basePath} and file: ${workerPathLocal}`);
            return new Worker(workerUrl.href, globals.workerOptions);
        };
        switch (label) {
            case 'typescript':
            case 'javascript':
                return buildWorker(workerOverrideGlobals, label, 'tsWorker', 'TS Worker');
            case 'html':
            case 'handlebars':
            case 'xml':
                return buildWorker(workerOverrideGlobals, label, 'htmlWorker', 'HTML Worker');
            case 'css':
            case 'scss':
            case 'less':
                return buildWorker(workerOverrideGlobals, label, 'cssWorker', 'CSS Worker');
            case 'json':
                return buildWorker(workerOverrideGlobals, label, 'jsonWorker', 'JSON Worker');
            default:
                return buildWorker(workerOverrideGlobals, label, 'editorWorker', 'Editor Worker');
        }
    };
    monEnv.getWorker = getWorker;
}

export const setupMonaco = async () => {
    //console.log('######## setupMonaco ########');
    // import.meta.url is replaced when building it for the chrome app
    const _modulePath = isChromeExtension()?chrome.runtime.getURL('/libs/monaco/workers'):import.meta.url;
    buildWorkerDefinition('/libs/monaco/workers', _modulePath, false);
    return window.monaco;
}

