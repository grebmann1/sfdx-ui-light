const { openai } = require('./llm/openaiModel');

function authMiddleware(req, res, next) {
    const apiKey = process.env.SALESFORCE_KEY;
    const authHeader = req.headers['authorization'];
    if (!apiKey || !authHeader || authHeader !== `Bearer ${apiKey}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

function corsMiddleware(req, res, next) {
    res.set({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    });
    next();
}

function streamSSE(res, streamFn, errorFn) {
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
                await errorFn(err, res);
            } else {
                res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
                res.end();
            }
        }
    })();
}

function registerOpenaiProxy(app) {
    const openaiModel = openai(process.env);

    // Apply CORS and Auth middleware to all /openai/v1/ routes
    app.use('/openai/v1/', corsMiddleware, authMiddleware);

    // General OPTIONS handler for all /openai/v1/*
    app.options('/openai/v1/{*splat}', (req, res) => {
        res.status(200).json({ body: 'ok' });
    });

    // POST /openai/v1/chat/completions
    app.post('/openai/v1/chat/completions', async (req, res, next) => {
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
                    async (signal) => {
                        for await (const chunk of openaiModel.stream(body, signal)) {
                            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
                            res.flush && res.flush();
                        }
                    },
                    async (err, res) => {
                        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
                        res.end();
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
    app.post('/openai/v1/responses', async (req, res, next) => {
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
                    async (signal) => {
                        for await (const chunk of openaiModel.streamResponse(body, signal)) {
                            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
                            res.flush && res.flush();
                        }
                    },
                    async (err, res) => {
                        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
                        res.end();
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
    app.get('/openai/v1/models', (req, res, next) => {
        try {
            const data = openaiModel.supportModels.map((model) => ({
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
    app.use('/openai/v1/', (err, req, res, next) => {
        res.status(500).json({ error: err.message || 'Internal Server Error' });
    });
}

module.exports = registerOpenaiProxy;