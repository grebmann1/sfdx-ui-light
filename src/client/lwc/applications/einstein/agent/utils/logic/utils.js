import { store } from 'core/store';
import { store as legacyStore, store_application as legacyStore_application } from 'shared/store';
import LOGGER from 'shared/logger';
import { guid } from 'shared/utils';

export function formatTabId(tabId,tabs) {
    LOGGER.log('formatTabId',tabId,tabs);
    if (tabs.some(tab => tab.id === tabId)) {
        return { tabId, isNewTab: false };
    }
    return { tabId: guid(), isNewTab: true };
}

// Helper: waitForLoaded (copied from soqlLogic.js)
export function waitForLoaded() {
    return new Promise((resolve) => {
        const checkLoading = () => {
            const { application } = store.getState();
            if (!application.isLoading) {
                clearInterval(intervalId);
                resolve();
            }
        };
        checkLoading();
        const intervalId = setInterval(checkLoading, 1000);
    });
}

export function wrappedNavigate(payload) {
    let formattedPayload = `sftoolkit:${JSON.stringify({
        type: 'application',
        state: payload,
    })}`;
    LOGGER.log('wrappedNavigate',formattedPayload);
    return legacyStore.dispatch(legacyStore_application.navigate(formattedPayload));
}