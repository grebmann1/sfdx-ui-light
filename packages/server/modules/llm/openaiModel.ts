import OpenAI from 'openai';

type OpenAiBaseOptions = {
    pre?: (req: unknown) => unknown;
    createClient: (req: unknown) => OpenAI;
};

type ModelRequest = {
    model: string;
    stream?: boolean;
    [key: string]: unknown;
};

function openaiBase(options: OpenAiBaseOptions) {
    const pre = options.pre ?? (req => req);
    return {
        name: 'openai',
        supportModels: [],
        requiredEnv: ['OPENAI_KEY'],
        async invoke(req: ModelRequest) {
            const _req = pre(req) as ModelRequest;
            const client = options.createClient(_req);
            return (client.chat.completions as any).create({
                ..._req,
                stream: false,
            });
        },
        async *stream(req: ModelRequest, signal: AbortSignal) {
            const _req = pre(req) as ModelRequest;
            const client = options.createClient(_req);
            const stream = await (client.chat.completions as any).create({
                ..._req,
                stream: true,
            });
            for await (const it of stream) {
                if (signal?.aborted) {
                    throw new Error('Aborted');
                }
                yield it;
            }
        },
        async invokeResponse(req: ModelRequest) {
            const _req = pre(req) as ModelRequest;
            const client = options.createClient(_req);
            return client.responses.create({
                ..._req,
                stream: false,
            });
        },
        async *streamResponse(req: ModelRequest, signal: AbortSignal) {
            const _req = pre(req) as ModelRequest;
            const client = options.createClient(_req);
            const stream = await client.responses.create({
                ..._req,
                stream: true,
            });
            for await (const it of stream) {
                if (signal?.aborted) {
                    throw new Error('Aborted');
                }
                yield it;
            }
        },
    };
}

export function openai(env: NodeJS.ProcessEnv) {
    const supportedModels = [
        // GPT-3.5
        'gpt-3.5-turbo',
        'gpt-3.5-turbo-0125',
        'gpt-3.5-turbo-1106',
        'gpt-3.5-turbo-16k',
        'gpt-3.5-turbo-instruct',
        'gpt-3.5-turbo-instruct-0914',

        // GPT-4
        'gpt-4-0314',
        'gpt-4-0613',
        'gpt-4',
        'gpt-4-1106-preview',
        'gpt-4-0125-preview',
        'gpt-4-turbo-preview',
        'gpt-4-turbo',
        'gpt-4-turbo-2024-04-09',

        // GPT-4o
        'gpt-4o',
        'gpt-4o-2024-05-13',
        'gpt-4o-2024-08-06',
        'gpt-4o-2024-11-20',
        'gpt-4o-audio-preview',
        'gpt-4o-audio-preview-2024-12-17',
        'gpt-4o-audio-preview-2025-06-03',
        'gpt-4o-realtime-preview',
        'gpt-4o-realtime-preview-2024-12-17',
        'gpt-4o-realtime-preview-2025-06-03',
        'gpt-4o-search-preview',
        'gpt-4o-search-preview-2025-03-11',
        'gpt-4o-mini',
        'gpt-4o-mini-2024-07-18',
        'gpt-4o-mini-audio-preview',
        'gpt-4o-mini-audio-preview-2024-12-17',
        'gpt-4o-mini-realtime-preview',
        'gpt-4o-mini-realtime-preview-2024-12-17',
        'gpt-4o-mini-search-preview',
        'gpt-4o-mini-search-preview-2025-03-11',
        'gpt-4o-mini-transcribe',
        'gpt-4o-mini-transcribe-2025-03-20',
        'gpt-4o-mini-transcribe-2025-12-15',
        'gpt-4o-mini-tts',
        'gpt-4o-mini-tts-2025-03-20',
        'gpt-4o-mini-tts-2025-12-15',
        'gpt-4o-transcribe',
        'gpt-4o-transcribe-diarize',

        // GPT-4.1
        'gpt-4.1',
        'gpt-4.1-2025-04-14',
        'gpt-4.1-mini',
        'gpt-4.1-mini-2025-04-14',
        'gpt-4.1-nano',
        'gpt-4.1-nano-2025-04-14',

        // GPT-5.x
        'gpt-5',
        'gpt-5-2025-08-07',
        'gpt-5-chat-latest',
        'gpt-5-mini',
        'gpt-5-mini-2025-08-07',
        'gpt-5-nano',
        'gpt-5-nano-2025-08-07',
        'gpt-5-pro',
        'gpt-5-pro-2025-10-06',
        'gpt-5-search-api',
        'gpt-5-search-api-2025-10-14',
        'gpt-5-codex',
        'gpt-5.1',
        'gpt-5.1-2025-11-13',
        'gpt-5.1-chat-latest',
        'gpt-5.1-codex',
        'gpt-5.1-codex-mini',
        'gpt-5.1-codex-max',
        'gpt-5.2',
        'gpt-5.2-2025-12-11',
        'gpt-5.2-chat-latest',
        'gpt-5.2-pro',
        'gpt-5.2-pro-2025-12-11',
        'gpt-5.2-codex',
        'gpt-5.3-codex',
        'gpt-5.3-chat-latest',
        'gpt-5.4',
        'gpt-5.4-2026-03-05',
        'gpt-5.4-mini',
        'gpt-5.4-mini-2026-03-17',
        'gpt-5.4-nano',
        'gpt-5.4-nano-2026-03-17',
        'gpt-5.4-pro',
        'gpt-5.4-pro-2026-03-05',

        // O-series
        'o1',
        'o1-2024-12-17',
        'o1-pro',
        'o1-pro-2025-03-19',
        'o3-mini',
        'o3-mini-2025-01-31',
        'o3',
        'o3-2025-04-16',
        'o3-pro',
        'o3-pro-2025-06-10',
        'o3-deep-research',
        'o3-deep-research-2025-06-26',
        'o4-mini',
        'o4-mini-2025-04-16',
        'o4-mini-deep-research',
        'o4-mini-deep-research-2025-06-26',

        // Computer use
        'computer-use-preview',
        'computer-use-preview-2025-03-11',

        // Audio + realtime
        'gpt-audio',
        'gpt-audio-2025-08-28',
        'gpt-audio-1.5',
        'gpt-audio-mini',
        'gpt-audio-mini-2025-10-06',
        'gpt-audio-mini-2025-12-15',
        'gpt-realtime',
        'gpt-realtime-2025-08-28',
        'gpt-realtime-1.5',
        'gpt-realtime-mini',
        'gpt-realtime-mini-2025-10-06',
        'gpt-realtime-mini-2025-12-15',

        // TTS + speech
        'tts-1',
        'tts-1-1106',
        'tts-1-hd',
        'tts-1-hd-1106',
        'whisper-1',

        // Embeddings
        'text-embedding-3-small',
        'text-embedding-3-large',
        'text-embedding-ada-002',

        // Image
        'dall-e-2',
        'dall-e-3',
        'gpt-image-1',
        'gpt-image-1-mini',
        'gpt-image-1.5',
        'chatgpt-image-latest',

        // Moderation
        'omni-moderation-latest',
        'omni-moderation-2024-09-26',

        // Legacy
        'davinci-002',
        'babbage-002',
    ];
    const client_builder = (_model: string) => {
        let base_client = new OpenAI({
            apiKey: env.OPENAI_KEY,
        });
        return openaiBase({ createClient: () => base_client });
    };
    return {
        name: 'openai',
        supportModels: supportedModels,
        requiredEnv: ['OPENAI_KEY'],
        invoke: (req: ModelRequest) => client_builder(req.model).invoke(req),
        stream: (req: ModelRequest, signal: AbortSignal) =>
            client_builder(req.model).stream(req, signal),
        invokeResponse: (req: ModelRequest) => client_builder(req.model).invokeResponse(req),
        streamResponse: (req: ModelRequest, signal: AbortSignal) =>
            client_builder(req.model).streamResponse(req, signal),
    };
}
