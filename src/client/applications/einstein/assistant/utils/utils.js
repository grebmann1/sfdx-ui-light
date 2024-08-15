
/** Template for Apex -> Einstein LLM **/
export * from './template';


export const storeThread = async (threadId,messages) => {
    localStorage.setItem(`assistant-thread-${threadId}`,JSON.stringify(messages));
}

export const getThread = async (threadId) => {
    var messages = [];
    if(threadId){
        const messageText = localStorage.getItem(`assistant-thread-${threadId}`);
        if(messageText && messageText != ''){
            messages = JSON.parse(messageText)
        }
    }
    return messages;
}

export const getThreadList = async () => {
    const threadsText = localStorage.getItem(`assistant-threads`);
    var threads = [];
    if(threadsText && threadsText != ''){
        threads = JSON.parse(threadsText)
    }
    //console.log('threads',threads)
    return threads;
}

export const setThreadList = async (threads) => {
    localStorage.setItem(`assistant-threads`,JSON.stringify(threads));
}

export const upsertThreadList = async (threadId) => {
    const threads = new Set(await getThreadList());
        threads.add(threadId)
    localStorage.setItem(`assistant-threads`,JSON.stringify([...threads]));
}

export const deleteThreadList = async (threadId) => {
    const threads = new Set(await getThreadList());
        threads.delete(threadId)
    localStorage.setItem(`assistant-threads`,JSON.stringify([...threads]));
}

export const GLOBAL_EINSTEIN = 'global_einstein';