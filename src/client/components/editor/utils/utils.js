import { store } from 'core/store';
import LOGGER from 'shared/logger';
import { isChromeExtension } from 'shared/utils';

import MonacoLwcWidget from './widgets/monacoLwcWidget.js';
export const WIDGETS = {
    MonacoLwcWidget,
};

function buildWorkerDefinition(workerPath, basePath, useModuleWorker) {
    const monWin = self;
    const workerOverrideGlobals = {
        basePath: basePath,
        workerPath: workerPath,
        workerOptions: {
            type: useModuleWorker ? 'module' : 'classic',
        },
    };
    if (!monWin.MonacoEnvironment) {
        monWin.MonacoEnvironment = {
            workerOverrideGlobals: workerOverrideGlobals,
            createTrustedTypesPolicy: _policyName => {
                return undefined;
            },
        };
    }
    const monEnv = monWin.MonacoEnvironment;
    monEnv.workerOverrideGlobals = workerOverrideGlobals;
    const getWorker = (_, label) => {
        const buildWorker = (globals, label, workerName, editorType) => {
            globals.workerOptions.name = label;
            const workerFilename =
                globals.workerOptions.type === 'module'
                    ? `${workerName}-es.js`
                    : `${workerName}-iife.js`;
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
    const _modulePath = isChromeExtension()
        ? chrome.runtime.getURL('/libs/monaco/workers')
        : import.meta.url;
    buildWorkerDefinition('/libs/monaco/workers', _modulePath, false);
    return window.monaco;
};

export const registerCopilot = (monaco, editor, language, handleOpenContextCopilot) => {
    LOGGER.info('registerCopilot', language);

    // Check if OpenAI is available
    if (store.getState().application.openaiKey) {
        editor.addAction({
            id: 'openEditor',
            label: 'openEditor',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK],
            run() {
                LOGGER.info('openEditor');
                handleOpenContextCopilot();
            },
        });
    }
};

// Completion Formatter

export class CompletionFormatter {
    formattedCompletion = '';
    currentColumn = 0;
    constructor(completion, currentColumn) {
        this.formattedCompletion = completion;
        this.currentColumn = currentColumn;
    }

    setCompletion(completion) {
        this.formattedCompletion = completion;
        return this;
    }

    removeInvalidLineBreaks() {
        this.formattedCompletion = this.formattedCompletion.trimEnd();
        return this;
    }

    removeMarkdownCodeSyntax() {
        this.formattedCompletion = this.removeMarkdownCodeBlocks(this.formattedCompletion);
        return this;
    }

    indentByColumn() {
        // Split completion into lines
        const lines = this.formattedCompletion.split('\n');

        // Skip indentation if there's only one line or if there's text before cursor in the line
        if (lines.length <= 1) {
            return this;
        }

        // Create indentation string based on current column position
        const indentation = ' '.repeat(this.currentColumn - 1);

        // Keep first line as is, indent all subsequent lines
        this.formattedCompletion =
            lines[0] +
            '\n' +
            lines
                .slice(1)
                .map(line => indentation + line)
                .join('\n');

        return this;
    }

    removeMarkdownCodeBlocks(text) {
        const codeBlockRegex = /```[\s\S]*?```/g;
        let result = text;
        let match;

        while ((match = codeBlockRegex.exec(text)) !== null) {
            const codeBlock = match[0];
            const codeContent = codeBlock.split('\n').slice(1, -1).join('\n');
            result = result.replace(codeBlock, codeContent);
        }

        return result.trim();
    }

    removeExcessiveNewlines() {
        this.formattedCompletion = this.formattedCompletion.replace(/\n{3,}/g, '\n\n');
        return this;
    }

    build() {
        return this.formattedCompletion;
    }
}
