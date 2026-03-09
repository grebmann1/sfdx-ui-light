const OpenAI = require('openai');

const { getSupportedBuiltInToolTypes } = require('./modelToolSupport');

function authMiddleware(req, res, next) {
    const apiKeys = [
        process.env.OPENAI_GATE_KEY,
        process.env.SALESFORCE_KEY,
        process.env.SALESFORCE_KEY1,
        process.env.SALESFORCE_KEY2,
        process.env.SALESFORCE_KEY3,
        process.env.SALESFORCE_KEY4,
        process.env.SALESFORCE_KEY5,
    ].filter(Boolean);
    const acceptPlaceholder =
        process.env.OPENAI_GATE_ACCEPT_PLACEHOLDER === 'true' ||
        process.env.OPENAI_GATE_ACCEPT_PLACEHOLDER === '1';
    if (acceptPlaceholder) {
        apiKeys.push('gate');
    }
    const authHeader = req.headers['authorization'];
    const isAuthorized =
        apiKeys.length && authHeader && apiKeys.some(key => authHeader === `Bearer ${key}`);
    if (!isAuthorized) {
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

/**
 * Filter request tools: keep all function tools; keep built-in tools only if supported by the model.
 * Does not modify instructions or input (skills and context remain as sent by the client).
 *
 * @param {Array} tools - Request body tools array
 * @param {string} model - Model id
 * @returns {Array} Filtered tools array
 */
function filterToolsByModel(tools, model) {
    if (!Array.isArray(tools) || tools.length === 0) return tools;
    const allowed = getSupportedBuiltInToolTypes(model);
    return tools.filter(tool => {
        if (!tool || typeof tool !== 'object') return false;
        if (tool.type === 'function') return true;
        const builtInType = tool.type || tool.providerData?.type;
        if (!builtInType) return false;
        return allowed.has(builtInType);
    });
}

function openAIGate(app, options = {}) {
    const path = options.path || '/openai-gate/v1';
    const apiKey = process.env.OPENAI_KEY;
    if (!apiKey) {
        console.warn('openAIGate: OPENAI_KEY is not set; Responses API calls will fail.');
    }
    const client = new OpenAI({ apiKey: apiKey || 'dummy' });

    app.use(`${path}/`, corsMiddleware, authMiddleware);

    app.options(path + '/responses', (req, res) => {
        res.status(200).json({ body: 'ok' });
    });

    app.post(`${path}/responses`, async (req, res, next) => {
        const abortController = new AbortController();
        req.on('close', () => {
            abortController.abort();
        });

        try {
            const body = req.body;
            if (!body) {
                return res.status(400).json({ error: 'Invalid JSON' });
            }
            const model = body.model;
            if (!model) {
                return res.status(400).json({ error: 'Missing model' });
            }

            const filteredTools = filterToolsByModel(body.tools, model);
            const filteredBody = { ...body, tools: filteredTools };

            if (body.stream) {
                res.set({
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    Connection: 'keep-alive',
                });
                res.flushHeaders && res.flushHeaders();
                const stream = await client.responses.create(
                    { ...filteredBody, stream: true },
                    { signal: abortController.signal }
                );
                for await (const chunk of stream) {
                    if (abortController.signal.aborted) break;
                    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
                    if (res.flush) res.flush();
                }
                res.write('data: [DONE]\n\n');
                return res.end();
            }

            const response = await client.responses.create(
                { ...filteredBody, stream: false },
                { signal: abortController.signal }
            );
            res.json(response);
        } catch (err) {
            if (err.name === 'AbortError') {
                return res.end();
            }
            const status =
                err.status || (err.message && err.message.includes('not supported') ? 400 : 500);
            const message = err.message || 'Internal Server Error';
            if (!res.headersSent) {
                res.status(status).json({ error: message });
            }
        }
    });
}

module.exports = openAIGate;
module.exports.filterToolsByModel = filterToolsByModel;
