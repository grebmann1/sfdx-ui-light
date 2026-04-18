/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2024 TypeFox and others.
 * Licensed under the MIT License. See LICENSE in the package root for license information.
 * ------------------------------------------------------------------------------------------ */

import { LogLevel } from '@codingame/monaco-vscode-api';
import { ConsoleLogger, type ILogger } from '@codingame/monaco-vscode-log-service-override';
import { MonacoLanguageClient, MonacoLanguageClientWithProposedFeatures } from 'monaco-languageclient';
import { createUrl, type WorkerConfigOptionsDirect, type WorkerConfigOptionsParams } from 'monaco-languageclient/common';
import { CloseAction, ErrorAction, MessageTransports, State } from 'vscode-languageclient/browser.js';
import { BrowserMessageReader, BrowserMessageWriter } from 'vscode-languageserver-protocol/browser.js';
import { toSocket, WebSocketMessageReader, WebSocketMessageWriter } from 'vscode-ws-jsonrpc';
import type { LanguageClientConfig, LanguageClientRestartOptions } from './lcconfig.js';

export interface LanguageClientError {
    message: string;
    error: Error | string;
}

export class LanguageClientWrapper {

    private languageClient?: MonacoLanguageClient | MonacoLanguageClientWithProposedFeatures;
    private languageClientConfig: LanguageClientConfig;
    private worker?: Worker;
    private port?: MessagePort;
    private languageId: string;
    private logger: ILogger | undefined;

    constructor(config: LanguageClientConfig) {
        this.languageClientConfig = config;
        this.languageId = this.languageClientConfig.languageId;
        this.logger = new ConsoleLogger(this.languageClientConfig.logLevel ?? LogLevel.Off);
    }

    haveLanguageClient(): boolean {
        return this.languageClient !== undefined;
    }

    getLanguageClient(): MonacoLanguageClient | undefined {
        return this.languageClient;
    }

    getWorker(): Worker | undefined {
        return this.worker;
    }

    isStarted(): boolean {
        return this.languageClient !== undefined && this.languageClient.isRunning();
    }

    async start(): Promise<void> {
        if (this.languageClient?.isRunning() ?? false) {
            this.logger?.info('startLanguageClientConnection: monaco-languageclient already running!');
            return Promise.resolve();
        }

        return new Promise<void>((resolve, reject) => {
            const conConfig = this.languageClientConfig.connection;
            const conOptions = conConfig.options;

            if (conOptions.$type === 'WebSocketDirect' || conOptions.$type === 'WebSocketParams' || conOptions.$type === 'WebSocketUrl') {
                const webSocket = conOptions.$type === 'WebSocketDirect' ? conOptions.webSocket : new WebSocket(createUrl(conOptions));
                this.initMessageTransportWebSocket(webSocket, resolve, reject);
            } else {
                // init of worker and start of languageclient can be handled directly, because worker available already
                this.initMessageTransportWorker(conOptions, resolve, reject);
            }
        });
    }

    /**
     * Restart the languageclient with options to control worker handling
     *
     * @param updatedWorker Set a new worker here that should be used. keepWorker has no effect then, as we want to dispose of the prior workers
     * @param disposeWorker Set to false if worker should not be disposed
     */
    async restart(updatedWorker?: Worker, forceWorkerDispose?: boolean): Promise<void> {
        await this.dispose(forceWorkerDispose);

        this.worker = updatedWorker;
        this.logger?.info('Re-Starting monaco-languageclient');
        return this.start();
    }

    protected async initMessageTransportWebSocket(webSocket: WebSocket, resolve: () => void, reject: (reason?: unknown) => void) {

        let messageTransports = this.languageClientConfig.connection.messageTransports;
        if (messageTransports === undefined) {
            const iWebSocket = toSocket(webSocket);
            messageTransports = {
                reader: new WebSocketMessageReader(iWebSocket),
                writer: new WebSocketMessageWriter(iWebSocket)
            };
        }

        // if websocket is already open, then start the languageclient directly
        if (webSocket.readyState === WebSocket.OPEN) {
            await this.performLanguageClientStart(messageTransports, resolve, reject);
        }

        // otherwise start on open
        webSocket.onopen = async () => {
            await this.performLanguageClientStart(messageTransports, resolve, reject);
        };
        webSocket.onerror = (ev: Event) => {
            const languageClientError: LanguageClientError = {
                message: `languageClientWrapper (${this.languageId}): Websocket connection failed.`,
                error: (ev as ErrorEvent).error ?? 'No error was provided.'
            };
            reject(languageClientError);
        };
    }

    protected async initMessageTransportWorker(lccOptions: WorkerConfigOptionsDirect | WorkerConfigOptionsParams, resolve: () => void, reject: (reason?: unknown) => void) {
        if (!this.worker) {
            if (lccOptions.$type === 'WorkerConfig') {
                const workerConfig = lccOptions as WorkerConfigOptionsParams;
                this.worker = new Worker(workerConfig.url.href, {
                    type: workerConfig.type,
                    name: workerConfig.workerName
                });
            } else {
                const workerDirectConfig = lccOptions as WorkerConfigOptionsDirect;
                this.worker = workerDirectConfig.worker;
            }

            // Attach onerror for both worker types so startup failures surface a real message.
            if (this.worker) {
                this.worker.onerror = (ev) => {
                    const languageClientError: LanguageClientError = {
                        message: `languageClientWrapper (${this.languageId}): Worker error detected.`,
                        error: ev.error ?? ev.message ?? 'No error details provided.'
                    };
                    reject(languageClientError);
                };
            }

            if (lccOptions.messagePort !== undefined) {
                this.port = lccOptions.messagePort;
            }
        }

        const portOrWorker = this.port ? this.port : this.worker;
        let messageTransports = this.languageClientConfig.connection.messageTransports;
        if (messageTransports === undefined) {
            messageTransports = {
                reader: new BrowserMessageReader(portOrWorker),
                writer: new BrowserMessageWriter(portOrWorker)
            };
        }

        await this.performLanguageClientStart(messageTransports, resolve, reject);
    }

    protected async performLanguageClientStart(messageTransports: MessageTransports, resolve: () => void, reject: (reason?: unknown) => void) {
        let starting = true;
        // do not perform another start attempt if already running
        if (this.languageClient?.isRunning() ?? false) {
            this.logger?.info('performLanguageClientStart: monaco-languageclient already running!');
            resolve();
        }

        const mlcConfig = {
            id: this.languageClientConfig.languageId,
            name: `${this.languageClientConfig.languageId} Language Client`,
            clientOptions: {
                // Keep the client alive on reader errors: the onClose handler below
                // stops it when the underlying transport actually closes. Returning
                // ErrorAction.Continue prevents vscode-languageclient from logging a
                // misleading "Shutting down server" message on transient errors.
                errorHandler: {
                    error: (e: Error) => {
                        if (starting) {
                            const reason = e?.message ?? String(e ?? 'unknown');
                            reject(new Error(`Error occurred in language client (${this.languageId}): ${reason}`));
                        }
                        return { action: ErrorAction.Continue };
                    },
                    closed: () => ({ action: CloseAction.DoNotRestart })
                },
                // ...but allow overriding all options from outside
                ...this.languageClientConfig.clientOptions,
            },
            messageTransports
        };

        const conOptions = this.languageClientConfig.connection.options;
        this.initRestartConfiguration(messageTransports, this.languageClientConfig.restartOptions);

        const isWebSocket = conOptions.$type === 'WebSocketParams' || conOptions.$type === 'WebSocketUrl' || conOptions.$type === 'WebSocketDirect';

        messageTransports.reader.onClose(async () => {
            await this.languageClient?.stop();

            if (isWebSocket && conOptions.stopOptions !== undefined) {
                const stopOptions = conOptions.stopOptions;
                stopOptions.onCall(this.getLanguageClient());
                if (stopOptions.reportStatus !== undefined) {
                    this.logger?.info(this.reportStatus().join('\n'));
                }
            }
        });

        try {
            this.languageClient = this.languageClientConfig.useClientWithProposedFeatures === true ? new MonacoLanguageClientWithProposedFeatures(mlcConfig) : new MonacoLanguageClient(mlcConfig);
            if (this.languageClientConfig.registerFeatures !== undefined) {
                this.languageClient.registerFeatures(this.languageClientConfig.registerFeatures);
            }

            await this.languageClient.start();

            // Mark startup phase over before resolving so post-start errors don't
            // incorrectly trigger the startup rejection path.
            starting = false;

            if (isWebSocket && conOptions.startOptions !== undefined) {
                const startOptions = conOptions.startOptions;
                startOptions.onCall(this.getLanguageClient());
                if (startOptions.reportStatus !== undefined) {
                    this.logger?.info(this.reportStatus().join('\n'));
                }
            }
        } catch (e: unknown) {
            starting = false;
            const languageClientError: LanguageClientError = {
                message: `languageClientWrapper (${this.languageId}): Start was unsuccessful.`,
                error: Object.hasOwn(e ?? {}, 'cause') ? (e as Error) : 'No error was provided.'
            };
            reject(languageClientError);
            return;
        }
        this.logger?.info(`languageClientWrapper (${this.languageId}): Started successfully.`);
        resolve();
    }

    protected initRestartConfiguration(messageTransports: MessageTransports, restartOptions?: LanguageClientRestartOptions) {
        if (restartOptions !== undefined) {
            let retry = 0;

            const readerOnError = messageTransports.reader.onError(() => restartLC);
            const readerOnClose = messageTransports.reader.onClose(() => restartLC);

            const restartLC = async () => {
                if (this.isStarted()) {
                    try {
                        readerOnError.dispose();
                        readerOnClose.dispose();

                        await this.restart(this.worker, restartOptions.keepWorker);
                    } finally {
                        retry++;
                        if (retry > (restartOptions.retries) && !this.isStarted()) {
                            this.logger?.info(`Disabling Language Client. Failed to start clangd after ${restartOptions.retries} retries`);
                        } else {
                            setTimeout(async () => {
                                await this.restart(this.worker, restartOptions.keepWorker);
                            }, restartOptions.timeout);
                        }
                    }
                }
            };
        }
    }

    protected disposeWorker() {
        this.worker?.terminate();
        this.worker = undefined;
    }

    async dispose(forceWorkerDispose?: boolean): Promise<void> {
        try {
            if (this.isStarted()) {
                await this.languageClient?.dispose();
                this.languageClient = undefined;
                this.logger?.info('monaco-languageclient was successfully disposed.');
            }
        } catch (e) {
            const languageClientError: LanguageClientError = {
                message: `languageClientWrapper (${this.languageId}): Disposing the monaco-languageclient resulted in error.`,
                error: Object.hasOwn(e ?? {}, 'cause') ? (e as Error) : 'No error was provided.'
            };
            return Promise.reject(languageClientError);
        } finally {
            // always terminate the worker if desired
            if (this.languageClientConfig.disposeWorker === true || forceWorkerDispose === true) {
                this.disposeWorker();
            }
        }
    }

    reportStatus() {
        const status: string[] = [];
        const languageClient = this.getLanguageClient();
        status.push('LanguageClientWrapper status:');
        status.push(`LanguageClient: ${languageClient?.name ?? 'Language Client'} is in a '${State[languageClient?.state ?? 1]}' state`);
        return status;
    }
}
