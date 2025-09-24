import { loadExtensionConfigFromCache, saveExtensionConfigToCache } from 'shared/cacheManager';
import StreamingAgentService from './streamingAgentService';
import Context from './context';
import Constants from './constants';
import { guid, isNotUndefinedOrNull } from 'shared/utils';


const readFileContent = (file) => {
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

function getMessageKey(message) {
    return message._key || message.id || message.callId || guid();
}

function areMessagesEqual(msg1, msg2) {
    return (msg1 && msg2) && (
        (msg1._key === msg2._key && isNotUndefinedOrNull(msg1._key)) || 
        (msg1.id === msg2.id && isNotUndefinedOrNull(msg1.id))
    );
}

function appendMessageIfNotExists(messages, newMsg) {
    if (!messages.some(m => areMessagesEqual(m, newMsg))) {
        return [...messages, newMsg];
    }
    return messages || [];
}

function updateOrAppendMessage(messages, newMsg) {
    if (messages && messages.length > 0 && areMessagesEqual(messages[messages.length - 1], newMsg)) {
        return [
            ...messages.slice(0, messages.length - 1),
            { ...messages[messages.length - 1], ...newMsg }
        ];
    }
    return [...(messages || []), newMsg];
}

function formatMessage(message, filesData = [], guidFn = guid) {
    const result = {
        ...message,
        _key: getMessageKey(message),
    };
    // Process files and enrich the message with the file informations
    const files = (filesData || []).map(f => ({ name: f.name, type: f.type, size: f.size, _openaiFileId: f._openaiFileId, content: f.content }));
    if (files && files.length > 0) {
        if (!Array.isArray(result.content)) {
            result.content = [
                { type: 'input_text', text: result.content, isInputText: true, key: result._key + '-0' }
            ];
        }
        files.forEach(file => {
            if (file.type && file.type.startsWith('image/') && file.content) {
                result.content.push({
                    type: 'input_image',
                    image: file.content,
                    key: result._key + '-img-' + file.name
                });
            } else if (file.type === 'application/pdf' && file.content) {
                result.content.push({
                    type: 'input_file',
                    file_id: file._openaiFileId,
                    size: file.size,
                    key: result._key + '-file-' + file.name
                });
            }
        });
    }
    return result;
}

const formatStreamHistory = (streamHistory) => {
    return streamHistory.map(message => formatMessage(message));
}

const Message = {
    getMessageKey,
    areMessagesEqual,
    appendMessageIfNotExists,
    updateOrAppendMessage,
    formatMessage,
    formatStreamHistory
};

export {
    readFileContent,
    StreamingAgentService,
    Message,
    Context,
    Constants
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