/* eslint-disable import/no-unresolved */
import { createWorkbenchShellService } from '../../metadata/commands/workbenchShellService.js';
import { getActiveSalesforceWorkbenchHost } from '../../salesforce/salesforceWorkbenchHost.js';
const MAX_BASH_OUTPUT_CHARS = 30000;

const shellServicesByConversationId = new Map();

export const WORKBENCH_BASH_TOOL_DEFINITIONS = [
    {
        name: 'bash',
        toolReferenceName: 'bash',
        displayName: 'Run Bash Command',
        userDescription: 'Execute a bash command in the workbench sandbox, including sf CLI shims.',
        modelDescription:
            'Use this tool to run bash commands in the workbench sandbox. Supports sf apex run, sf data query, sf api request, sf org list, and sf org open.',
        canBeReferencedInPrompt: true,
        inputSchema: {
            type: 'object',
            properties: {
                command: { type: 'string' },
                description: { type: 'string' },
            },
            required: ['command'],
            additionalProperties: false,
        },
    },
];

function truncateText(text, maxChars = MAX_BASH_OUTPUT_CHARS) {
    const value = typeof text === 'string' ? text : String(text ?? '');
    if (value.length <= maxChars) {
        return value;
    }
    return `${value.slice(0, maxChars)}\n\n[Truncated ${value.length - maxChars} chars]`;
}

function getConversationKey(conversationId) {
    return typeof conversationId === 'string' && conversationId.trim()
        ? conversationId.trim()
        : 'default';
}

function getOrCreateShellService(conversationId) {
    const key = getConversationKey(conversationId);
    if (shellServicesByConversationId.has(key)) {
        return shellServicesByConversationId.get(key);
    }

    const host = getActiveSalesforceWorkbenchHost();
    if (!host?.connectionRuntime || !host?.context) {
        throw new Error('Salesforce shell services are not ready yet.');
    }

    const shellService = createWorkbenchShellService(host);
    shellServicesByConversationId.set(key, shellService);
    return shellService;
}

function formatBashResultText(result) {
    const sections = [
        `Command: ${result.command || ''}`,
        `CWD: ${result.cwd || '/workspace'}`,
        `Exit code: ${Number(result.exitCode ?? 1)}`,
    ];
    const stdout = String(result.stdout || '');
    const stderr = String(result.stderr || '');
    if (stdout) {
        sections.push(`stdout:\n${stdout}`);
    }
    if (stderr) {
        sections.push(`stderr:\n${stderr}`);
    }
    return truncateText(sections.join('\n\n'));
}

export function createWorkbenchBashTools() {
    return [
        {
            name: 'bash',
            description:
                'Execute a bash command in the workbench sandbox. Supports sf CLI shims for Apex, SOQL, API, and org commands.',
            parameters: {
                type: 'object',
                properties: {
                    command: {
                        type: 'string',
                        description: 'The bash command to execute.',
                    },
                    description: {
                        type: 'string',
                        description: 'Short description of what the command does.',
                    },
                },
                required: ['command'],
                additionalProperties: false,
            },
            execute: async input => {
                try {
                    const command = String(input?.command ?? '').trim();
                    if (!command) {
                        throw new Error('A bash command is required.');
                    }
                    const shellService = getOrCreateShellService(input?.conversationId);
                    const result = await shellService.run(command, {
                        cwd: shellService.getCwd(),
                        source: 'agent',
                    });
                    return {
                        isError: Number(result.exitCode ?? 1) !== 0,
                        command: result.command,
                        cwd: result.cwd,
                        stdout: result.stdout,
                        stderr: result.stderr,
                        exitCode: Number(result.exitCode ?? 1),
                        text: formatBashResultText(result),
                    };
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    return {
                        isError: true,
                        exitCode: 1,
                        text: `Error: ${message}`,
                        error: message,
                    };
                }
            },
            shouldConfirm: () => true,
            buildConfirmation: vscodeApi => ({
                title: vscodeApi.l10n.t('Run bash command'),
                message: new vscodeApi.MarkdownString(
                    'AI wants to execute a bash command in the workbench sandbox using `bash`.'
                ),
            }),
        },
    ];
}
