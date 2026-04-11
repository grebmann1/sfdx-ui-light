import fs from 'node:fs/promises';
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import path from 'node:path';

const CONTENT_TYPES: Record<string, string> = {
    '.css': 'text/css; charset=utf-8',
    '.gif': 'image/gif',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain; charset=utf-8',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.xml': 'application/xml; charset=utf-8',
};

export class DesktopRendererServer {
    private readonly appVersion: string;
    private readonly webRoot: string;
    private server: http.Server | null = null;
    private baseUrl: string | null = null;

    constructor(options: { webRoot: string; appVersion: string }) {
        this.webRoot = options.webRoot;
        this.appVersion = options.appVersion;
    }

    async start(): Promise<string> {
        if (this.baseUrl) {
            return this.baseUrl;
        }

        await fs.access(this.webRoot);

        this.server = http.createServer((request, response) => {
            void this.handleRequest(request, response);
        });

        await new Promise<void>((resolve, reject) => {
            const server = this.server;
            if (!server) {
                reject(new Error('Renderer server failed to initialize.'));
                return;
            }

            server.once('error', reject);
            server.listen(0, '127.0.0.1', () => {
                server.off('error', reject);
                resolve();
            });
        });

        const address = this.server.address();
        if (!address || typeof address === 'string') {
            throw new Error('Renderer server failed to bind to a local port.');
        }

        this.baseUrl = `http://127.0.0.1:${String(address.port)}`;
        return this.baseUrl;
    }

    async stop(): Promise<void> {
        const server = this.server;
        this.server = null;
        this.baseUrl = null;

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

    private async handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
        const method = String(request.method || 'GET').toUpperCase();
        if (!['GET', 'HEAD'].includes(method)) {
            response.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
            response.end('Method Not Allowed');
            return;
        }

        const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
        if (requestUrl.pathname === '/version') {
            response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            response.end(
                JSON.stringify({
                    version: this.appVersion,
                })
            );
            return;
        }

        const filePath = await this.resolveRequestPath(requestUrl.pathname);
        if (!filePath) {
            response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            response.end('Not Found');
            return;
        }

        const contentType =
            CONTENT_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';

        try {
            const content = await fs.readFile(filePath);
            response.writeHead(200, { 'Content-Type': contentType });
            if (method === 'HEAD') {
                response.end();
                return;
            }

            response.end(content);
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            response.end(
                error instanceof Error ? error.message : 'Failed to serve renderer asset.'
            );
        }
    }

    private async resolveRequestPath(requestPath: string): Promise<string | null> {
        const decodedPath = decodeURIComponent(requestPath || '/');
        const normalizedPath = decodedPath === '/' ? '/index.html' : decodedPath;
        const sanitizedPath = path
            .normalize(normalizedPath)
            .replace(/^(\.\.(\/|\\|$))+/, '')
            .replace(/^[/\\]+/, '');

        const candidates = [path.join(this.webRoot, sanitizedPath)];
        if (!path.extname(sanitizedPath)) {
            candidates.unshift(path.join(this.webRoot, sanitizedPath, 'index.html'));
        }

        for (const candidate of candidates) {
            if (!candidate.startsWith(this.webRoot)) {
                continue;
            }

            try {
                const stats = await fs.stat(candidate);
                if (stats.isFile()) {
                    return candidate;
                }
            } catch {
                // Keep trying candidates.
            }
        }

        return null;
    }
}
