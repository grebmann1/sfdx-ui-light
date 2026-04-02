import type { Application, NextFunction, Request, Response } from 'express';
import { openai } from './llm/openaiModel';

function authMiddleware(req: Request, res: Response, next: NextFunction) {
    const apiKeys = [
        process.env.SALESFORCE_KEY,
        process.env.SALESFORCE_KEY1,
        process.env.SALESFORCE_KEY2,
        process.env.SALESFORCE_KEY3,
        process.env.SALESFORCE_KEY4,
        process.env.SALESFORCE_KEY5,
    ].filter(Boolean);
    const rawAuthHeader = req.headers['authorization'];
    const authHeader = Array.isArray(rawAuthHeader) ? rawAuthHeader[0] : rawAuthHeader;
    const isAuthorized = apiKeys.some(key => authHeader === `Bearer ${key}`);
    if (!apiKeys.length || !authHeader || !isAuthorized) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

function corsMiddleware(_req: Request, res: Response, next: NextFunction) {
    res.set({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    });
    next();
}

type StreamFn = (signal: AbortSignal) => Promise<void>;
type ErrorFn = (err: Error, res: Response) => Promise<void> | void;

function streamSSE(res: Response, streamFn: StreamFn, errorFn?: ErrorFn) {
    res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
    });
    res.flushHeaders && res.flushHeaders();
    const abortController = new AbortController();
    // To improve: when the client disconnects, abort the stream
    /* res.req.on('close', () => {
        console.log('--> close');
        abortController.abort();
    }); */
    (async () => {
        try {
            await streamFn(abortController.signal);
            res.write('data: [DONE]\n\n');
            res.end();
        } catch (err) {
            if (errorFn) {
                await errorFn(err as Error, res);
            } else {
                res.write(`data: ${JSON.stringify({ error: (err as Error).message })}\n\n`);
                res.end();
            }
        }
    })();
}

type OpenAiProxyOptions = {
    path?: string;
};

export default function openaiProxy(app: Application, options: OpenAiProxyOptions = {}) {
    const openaiModel = openai(process.env);
    const path = options.path || '/openai/v1';

    // Apply CORS and Auth middleware to all /openai/v1/ routes
    app.use(`${path}/`, corsMiddleware, authMiddleware);

    // General OPTIONS handler for all /openai/v1/*
    app.options(`${path}{/*splat}`, (_req: Request, res: Response) => {
        res.status(200).json({ body: 'ok' });
    });

    // POST /openai/v1/chat/completions
    app.post(`${path}/chat/completions`, async (req: Request, res: Response, next: NextFunction) => {
        try {
            const body = req.body;
            if (!body) {
                return res.status(400).json({ error: 'Invalid JSON' });
            }
            if (!openaiModel.supportModels.includes(body.model)) {
                return res.status(400).json({ error: `Model ${body.model} not supported` });
            }
            if (body.stream) {
                return streamSSE(
                    res,
                    async signal => {
                        for await (const chunk of openaiModel.stream(body, signal)) {
                            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
                            (res as any).flush && (res as any).flush();
                        }
                    },
                    async (err, response) => {
                        response.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
                        response.end();
                    }
                );
            }
            // Non-streaming
            const result = await openaiModel.invoke(body);
            res.json(result);
        } catch (err) {
            next(err);
        }
    });

    // POST /openai/v1/responses
    app.post(`${path}/responses`, async (req: Request, res: Response, next: NextFunction) => {
        try {
            const body = req.body;
            if (!body) {
                return res.status(400).json({ error: 'Invalid JSON' });
            }
            if (!openaiModel.supportModels.includes(body.model)) {
                return res.status(400).json({ error: `Model ${body.model} not supported` });
            }
            if (body.stream) {
                return streamSSE(
                    res,
                    async signal => {
                        for await (const chunk of openaiModel.streamResponse(body, signal)) {
                            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
                            (res as any).flush && (res as any).flush();
                        }
                    },
                    async (err, response) => {
                        response.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
                        response.end();
                    }
                );
            }
            // Non-streaming
            const result = await openaiModel.invokeResponse(body);
            res.json(result);
        } catch (err) {
            next(err);
        }
    });

    // GET /openai/v1/models
    app.get(`${path}/models`, (_req: Request, res: Response, next: NextFunction) => {
        try {
            const data = openaiModel.supportModels.map(model => ({
                id: model,
                object: 'model',
                owned_by: openaiModel.name,
                created: Math.floor(Date.now() / 1000),
            }));
            res.json({ object: 'list', data });
        } catch (err) {
            next(err);
        }
    });

    // Centralized error handler for non-streaming errors
    app.use(`${path}{/*splat}`, (err: Error, _req: Request, res: Response, _next: NextFunction) => {
        res.status(500).json({ error: err.message || 'Internal Server Error' });
    });
}
