import http, { type IncomingMessage, type ServerResponse } from 'node:http';

import { getAllOrgs, getStoredOrg, seeOrgDetails } from './desktopServices';
import type { DesktopLegacyBus } from './desktopLegacyBus';
import type { WindowManager } from './windowManager';

type DesktopAutomationServerOptions = {
    host?: string;
    legacyBus: DesktopLegacyBus;
    openInstance: (payload: Record<string, any>) => Promise<void>;
    port?: number;
    windowManager: WindowManager;
};

type JsonBody = Record<string, any>;

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 12346;

export class DesktopAutomationServer {
    private readonly host: string;
    private readonly legacyBus: DesktopLegacyBus;
    private readonly openInstance: (payload: Record<string, any>) => Promise<void>;
    private readonly port: number;
    private server: http.Server | null = null;
    private readonly windowManager: WindowManager;

    constructor(options: DesktopAutomationServerOptions) {
        this.host = options.host || DEFAULT_HOST;
        this.legacyBus = options.legacyBus;
        this.openInstance = options.openInstance;
        this.port = options.port || DEFAULT_PORT;
        this.windowManager = options.windowManager;
    }

    async start(): Promise<string> {
        if (this.server) {
            return this.getBaseUrl();
        }

        this.server = http.createServer((request, response) => {
            void this.handleRequest(request, response);
        });

        await new Promise<void>((resolve, reject) => {
            const server = this.server;
            if (!server) {
                reject(new Error('Automation server failed to initialize.'));
                return;
            }

            server.once('error', reject);
            server.listen(this.port, this.host, () => {
                server.off('error', reject);
                resolve();
            });
        });

        return this.getBaseUrl();
    }

    async stop(): Promise<void> {
        const server = this.server;
        this.server = null;

        if (!server) {
            return;
        }

        await new Promise<void>((resolve, reject) => {
            server.close(error => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve();
            });
        });
    }

    getBaseUrl(): string {
        return `http://${this.host}:${String(this.port)}`;
    }

    private async handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
        const method = String(request.method || 'GET').toUpperCase();
        const requestUrl = new URL(request.url || '/', 'http://localhost');

        try {
            if (method === 'GET' && requestUrl.pathname === '/health') {
                this.writeJson(response, 200, { status: 'ok' });
                return;
            }

            if (method !== 'POST') {
                this.writeJson(response, 405, { status: 'error', message: 'Method Not Allowed' });
                return;
            }

            const body = await this.readJsonBody(request);

            switch (requestUrl.pathname) {
                case '/electron/open-instance':
                    await this.openInstance(body);
                    this.writeJson(response, 200, { status: 'success' });
                    return;
                case '/electron/list-of-windows':
                    this.writeJson(response, 200, {
                        windows: this.windowManager.listWindowAliases(),
                    });
                    return;
                case '/org/list': {
                    const orgs = await getAllOrgs();
                    this.writeJson(response, 200, {
                        orgs: [
                            ...orgs.sfdxOrgs.result.nonScratchOrgs.map(item => ({
                                ...item,
                                credentialType: 'OAUTH',
                            })),
                            ...orgs.sfdxOrgs.result.scratchOrgs.map(item => ({
                                ...item,
                                credentialType: 'OAUTH',
                            })),
                            ...orgs.storedOrgs.map(item => ({
                                ...item,
                                credentialType: item.credentialType || 'USERNAME',
                            })),
                        ],
                    });
                    return;
                }
                case '/org/session': {
                    const alias = String(body.alias || '').trim();
                    if (!alias) {
                        this.writeJson(response, 400, {
                            status: 'error',
                            message: 'Alias is required',
                        });
                        return;
                    }

                    const details = (await getStoredOrg(alias)) || (await seeOrgDetails(alias));
                    this.writeJson(response, 200, {
                        sessionId: details.accessToken || details.sessionId || null,
                        serverUrl: details.instanceUrl || details.serverUrl || null,
                    });
                    return;
                }
                case '/navigation/navigate':
                    await this.forwardToAliasWindow(body.alias, 'electron-navigate-to', {
                        application: body.application,
                    });
                    this.writeJson(response, 200, {
                        status: 'success',
                        message: `Navigated to ${String(body.application || '')}`,
                    });
                    return;
                case '/soql/query':
                    this.writeJson(
                        response,
                        200,
                        await this.forwardToAliasWindow(body.alias, '/soql/query', body)
                    );
                    return;
                case '/soql/navigate-tab':
                    this.writeJson(
                        response,
                        200,
                        await this.forwardToAliasWindow(body.alias, '/soql/navigate-tab', body)
                    );
                    return;
                case '/soql/queries':
                    this.writeJson(
                        response,
                        200,
                        await this.forwardToAliasWindow(body.alias, '/soql/queries', body)
                    );
                    return;
                case '/api/execute':
                    this.writeJson(
                        response,
                        200,
                        await this.forwardToAliasWindow(body.alias, '/api/execute', body)
                    );
                    return;
                case '/api/scripts':
                    this.writeJson(
                        response,
                        200,
                        await this.forwardToAliasWindow(body.alias, '/api/scripts', body)
                    );
                    return;
                case '/apex/execute':
                    this.writeJson(
                        response,
                        200,
                        await this.forwardToAliasWindow(body.alias, '/apex/execute', body)
                    );
                    return;
                case '/apex/scripts':
                    this.writeJson(
                        response,
                        200,
                        await this.forwardToAliasWindow(body.alias, '/apex/scripts', body)
                    );
                    return;
                default:
                    this.writeJson(response, 404, { status: 'error', message: 'Not Found' });
            }
        } catch (error) {
            this.writeJson(response, 500, {
                status: 'error',
                message:
                    error instanceof Error ? error.message : 'Desktop automation request failed.',
            });
        }
    }

    private async forwardToAliasWindow(
        alias: unknown,
        channel: string,
        payload: JsonBody
    ): Promise<unknown> {
        const normalizedAlias = String(alias || '').trim();
        const targetWindow = this.windowManager.getWindowByAlias(normalizedAlias);

        if (!normalizedAlias || !targetWindow || targetWindow.webContents.isDestroyed()) {
            throw new Error(
                `No window found for alias: ${normalizedAlias || '<missing>'}. Open the org in the desktop app first.`
            );
        }

        return this.legacyBus.send(channel, payload, targetWindow.webContents);
    }

    private async readJsonBody(request: IncomingMessage): Promise<JsonBody> {
        const chunks: Buffer[] = [];
        for await (const chunk of request) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }

        if (chunks.length === 0) {
            return {};
        }

        return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    }

    private writeJson(response: ServerResponse, statusCode: number, payload: unknown): void {
        response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify(payload));
    }
}
