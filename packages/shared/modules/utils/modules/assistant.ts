/** Template for Apex -> Einstein LLM **/
export * from './templates/assistant';

type ThreadMessage = Record<string, unknown>;

export const storeThread = async (threadId: string, messages: ThreadMessage[]): Promise<void> => {
    localStorage.setItem(`assistant-thread-${threadId}`, JSON.stringify(messages));
};

export const getThread = async (threadId?: string): Promise<ThreadMessage[]> => {
    var messages: ThreadMessage[] = [];
    if (threadId) {
        const messageText = localStorage.getItem(`assistant-thread-${threadId}`);
        if (messageText && messageText != '') {
            messages = JSON.parse(messageText);
        }
    }
    return messages;
};

export const getThreadList = async (): Promise<string[]> => {
    const threadsText = localStorage.getItem(`assistant-threads`);
    var threads: string[] = [];
    if (threadsText && threadsText != '') {
        threads = JSON.parse(threadsText);
    }
    //console.log('threads',threads)
    return threads;
};

export const setThreadList = async (threads: string[]): Promise<void> => {
    localStorage.setItem(`assistant-threads`, JSON.stringify(threads));
};

export const upsertThreadList = async (threadId: string): Promise<void> => {
    const threads = new Set(await getThreadList());
    threads.add(threadId);
    localStorage.setItem(`assistant-threads`, JSON.stringify([...threads]));
};

export const deleteThreadList = async (threadId: string): Promise<void> => {
    const threads = new Set(await getThreadList());
    threads.delete(threadId);
    localStorage.setItem(`assistant-threads`, JSON.stringify([...threads]));
};

export const GLOBAL_EINSTEIN = 'global_einstein';
