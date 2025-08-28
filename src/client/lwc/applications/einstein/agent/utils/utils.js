import { loadExtensionConfigFromCache, saveExtensionConfigToCache } from 'shared/cacheManager';

export const readFileContent = (file) => {
    return new Promise((resolve) => {
        if (file.size > 20 * 1024 * 1024) { // 20MB limit
            resolve({
                name: file.name,
                type: file.type,
                size: file.size,
                content: null,
                note: 'File too large to include content.'
            });
        } else if (file.type.startsWith('text/')) {
            const reader = new FileReader();
            reader.onload = (e) => resolve({
                name: file.name,
                type: file.type,
                size: file.size,
                content: e.target.result
            });
            reader.readAsText(file);
        } else {
            const reader = new FileReader();
            reader.onload = (e) => resolve({
                name: file.name,
                type: file.type,
                size: file.size,
                content: e.target.result
            });
            reader.readAsDataURL(file);
        }
    });
};

/* export const CONVERSATION_CACHE_KEY = 'einsteinAgentConversation';

export async function loadConversationFromCache() {
    const key = CONVERSATION_CACHE_KEY;
    const configMap = await loadExtensionConfigFromCache([key]);
    const configText = configMap ? configMap[key] : null;
    const cachedConversation = configText ? JSON.parse(configText) : null;
    return cachedConversation;
}

export async function saveConversationToCache(conversation) {
    const key = CONVERSATION_CACHE_KEY;
    const data = JSON.stringify(conversation);
    await saveExtensionConfigToCache({ [key]: data });
}

export async function clearConversationCache() {
    const key = CONVERSATION_CACHE_KEY;
    await saveExtensionConfigToCache({ [key]: null });
} */