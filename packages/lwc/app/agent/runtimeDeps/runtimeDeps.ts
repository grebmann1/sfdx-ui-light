import { createBashInstance } from 'core/bash';

const bashInstancesByConversationId = new Map();

export function getOrCreateBashInstanceForConversation(conversationId: string) {
    let bashInstance = bashInstancesByConversationId.get(conversationId);
    if (!bashInstance) {
        bashInstance = createBashInstance({
            enableFsDebug: true,
            skillsBaseUrl:
                typeof window !== 'undefined' && window.location?.origin
                    ? window.location.origin
                    : '',
        });
        bashInstancesByConversationId.set(conversationId, bashInstance);
    }
    return bashInstance;
}

export function cleanupBashInstanceForConversation(conversationId: string) {
    bashInstancesByConversationId.delete(conversationId);
}


