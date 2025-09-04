import { store } from 'core/store';
import LOGGER from 'shared/logger';
import { isChromeExtension } from 'shared/utils';
import { registerCompletion,CompletionCopilot } from 'monacopilot';

function buildWorkerDefinition(workerPath, basePath) {
    // eslint-disable-next-line no-restricted-globals
    const monWin = self;
    const workerOverrideGlobals = {
        basePath,
        workerPath,
        workerOptions: {
            type: 'classic',
        },
    };
    if (!monWin.MonacoEnvironment) {
        monWin.MonacoEnvironment = {
            workerOverrideGlobals,
            createTrustedTypesPolicy: _policyName => undefined,
        };
    }
    const monEnv = monWin.MonacoEnvironment;
    monEnv.workerOverrideGlobals = workerOverrideGlobals;
    const getWorker = (_, label) => {
        const buildWorker = (globals, label2, workerName) => {
            globals.workerOptions.name = label2;
            const workerFilename = `${workerName}.worker.js`;
            const workerPathLocal = `${globals.workerPath}/${workerFilename}`;
            const workerUrl = new URL(workerPathLocal, globals.basePath);
            return new Worker(workerUrl.href, globals.workerOptions);
        };
        switch (label) {
            case 'json':
                return buildWorker(workerOverrideGlobals, label, 'json');
            default:
                return buildWorker(workerOverrideGlobals, label, 'editor');
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

export const registerAIWidgets = ({monaco, editor, language, handleOpenContextCopilot}) => {
    

    // Check if OpenAI is available for the Context Copilot feature
    if (store.getState().application.openaiKey) {
        LOGGER.info('registerAIWidgets --> ', language);
        // Register the action to open the context copilot
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

    // Check if Mistral API key is available for the Autocomplete feature
    const mistralKey = store.getState().application.mistralKey;
    if(mistralKey) {
        LOGGER.info('registerMonacoAutocomplete --> ', language);
        // Register the monaco autocomplete
        registerMonacoAutocomplete(monaco, editor, language, mistralKey);
    }
};

export const registerMonacoAutocomplete = (monaco, editor, language, mistralKey) => {
    LOGGER.info('registerMonacoAutocomplete', language);
    const copilot = new CompletionCopilot(mistralKey, {
        provider: 'mistral',
        model: 'codestral',
    });

    registerCompletion(monaco, editor, {
        language,
        technologies:['salesforce'],
        requestHandler: async ({ body }) => {
            // Prepare context for the assistant
            //LOGGER.log('body', body);
            
            const completion = await copilot.complete({ body});
            return completion;
        }
    }); 
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
