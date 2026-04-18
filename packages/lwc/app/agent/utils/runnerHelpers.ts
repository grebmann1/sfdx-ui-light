export function getReasoningConfigFromSelection(selection) {
    if (selection === 'off' || selection === 'none' || !selection) return undefined;
    return { reasoningEffort: selection, reasoningSummary: 'auto' };
}

export function sanitizePathSegment(value, fallback = 'item') {
    const text = String(value || '')
        .trim()
        .replace(/[^a-zA-Z0-9._-]/g, '_');
    return text.length > 0 ? text : fallback;
}

export function extensionForMimeType(mimeType, fallback = 'bin') {
    switch (mimeType) {
        case 'image/jpeg':
            return 'jpg';
        case 'image/png':
            return 'png';
        case 'image/webp':
            return 'webp';
        case 'image/gif':
            return 'gif';
        case 'image/svg+xml':
            return 'svg';
        default:
            return fallback;
    }
}

export function parseDataUrl(dataUrl) {
    if (typeof dataUrl !== 'string') return null;
    const match = dataUrl.match(/^data:([^;,]+)(;[^,]*)?,(.*)$/);
    if (!match) return null;
    const mediaType = match[1] || 'application/octet-stream';
    const metadata = match[2] || '';
    const payload = match[3] || '';
    const isBase64 = metadata.toLowerCase().includes(';base64');
    if (!isBase64 || !payload) return null;
    return { mediaType, base64: payload };
}

export function isAbortLikeError(error) {
    const name = error?.name || '';
    const message = error?.message || '';
    return name === 'AbortError' || message.toLowerCase().includes('aborted');
}

const CONTEXT_OVERFLOW_PATTERNS = [
    /prompt is too long/i,
    /input is too long for requested model/i,
    /exceeds the context window/i,
    /input token count.*exceeds the maximum/i,
    /maximum prompt length is \d+/i,
    /reduce the length of the messages/i,
    /maximum context length is \d+ tokens/i,
    /exceeds the limit of \d+/i,
    /exceeds the available context size/i,
    /greater than the context length/i,
    /context window exceeds limit/i,
    /exceeded model token limit/i,
    /too large for model with \d+ maximum context length/i,
    /model_context_window_exceeded/i,
    /context[_ ]length[_ ]exceeded/i,
    /too many tokens/i,
    /token limit exceeded/i,
];

export function isContextOverflowError(error) {
    const message = error?.message || '';
    return CONTEXT_OVERFLOW_PATTERNS.some(pattern => pattern.test(String(message)));
}

export function cloneMessageForStreaming(message) {
    if (!message || typeof message !== 'object') return {};
    return {
        ...message,
        ...(Array.isArray(message.parts)
            ? { parts: message.parts.map(part => ({ ...(part || {}) })) }
            : {}),
        ...(Array.isArray(message.content)
            ? { content: message.content.map(part => ({ ...(part || {}) })) }
            : {}),
    };
}

export function normalizeToolInputSchema(schema, zod) {
    if (schema != null) return schema;
    return zod.object({});
}

export async function persistPromptImageFiles(filesData, fs, conversationId, logger) {
    const source = Array.isArray(filesData) ? filesData : [];
    if (!fs || source.length === 0) return source;

    const baseDir = `/workspace/tmp/${sanitizePathSegment(conversationId || 'default')}`;
    try {
        await fs.mkdir(baseDir, { recursive: true });
    } catch (_) {
        // Best effort: keep message flow even if directory creation fails.
    }

    const persisted = await Promise.all(
        source.map(async (file, index) => {
            if (!file || typeof file !== 'object') return file;
            if (!file.content) return file;

            const safeName = sanitizePathSegment(file.name || `file-${index}`);
            const filePath = `${baseDir}/${safeName}`;

            try {
                const isTextContent =
                    (file.type?.startsWith?.('text/') || file.type === 'application/json') &&
                    typeof file.content === 'string';
                if (isTextContent) {
                    await fs.writeFile(filePath, file.content, { encoding: 'utf8' });
                    return { ...file, path: filePath };
                }

                const parsed = parseDataUrl(file.content);
                if (!parsed) return file;

                const ext = extensionForMimeType(parsed.mediaType, safeName.split('.').pop() || 'bin');
                const hasExt = /\.[a-zA-Z0-9]+$/.test(safeName);
                const finalName = hasExt ? safeName : `${safeName}.${ext}`;
                const binaryPath = `${baseDir}/${finalName}`;
                await fs.writeFile(binaryPath, parsed.base64, { encoding: 'base64' });
                return { ...file, path: binaryPath, mediaType: parsed.mediaType };
            } catch (error) {
                logger?.warn?.('[agent] failed to persist attached file', {
                    conversationId,
                    fileName: file.name,
                    message: error instanceof Error ? error.message : String(error),
                });
                return file;
            }
        })
    );

    return persisted;
}
