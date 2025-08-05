import { store, API, UI, DOCUMENT, SELECTORS } from 'core/store';
import { formatApiRequest, generateDefaultTab, DEFAULT as API_DEFAULT } from 'api/utils';
import { formatTabId, waitForLoaded, wrappedNavigate } from './utils';
import LOGGER from 'shared/logger';

// Execute an API request and return the result
export async function executeApiRequest({ tabId }) {
    
    return await store.dispatch(async (dispatch, getState) => {
        const { application } = getState();
        if (application.isLoading) await waitForLoaded();
        await wrappedNavigate({ applicationName: 'api' });
        
        await dispatch(API.reduxSlice.actions.selectionTab({ id: tabId }));

        const currentTab = getState().api.currentTab;
        LOGGER.log('currentTab',currentTab);

        const { request, error } = formatApiRequest({
            endpoint: currentTab.endpoint,
            method: currentTab.method,
            body: currentTab.body,
            header: currentTab.header,
            connector:application.connector,
        });

        const apiPromise = store.dispatch(
            API.executeApiRequest({
                connector:application.connector,
                request: {
                    endpoint: request.endpoint,
                    method: request.method,
                    body: request.body,
                    header: request.header,
                },
                formattedRequest: request,
                tabId: tabId,
                createdDate: Date.now(),
            })
        );
        store.dispatch(
            API.reduxSlice.actions.setAbortingPromise({
                tabId,
                promise: apiPromise,
            })
        );
        const res = await apiPromise;
        await dispatch(UI.reduxSlice.actions.selectionTab({ id: tabId }));
        let _output = { ...res.payload?.response || {}, tabId };
        if (res.error) {
            _output.error = res.error;
        }
        return _output;
    });
}

export async function editApiScript({ method, endpoint, body, headers, tabId, currentApiVersion }) {
    
    return await store.dispatch(async (dispatch, getState) => {
        try {
            LOGGER.log('editApiScript',{ method, endpoint, body, headers, tabId, currentApiVersion });
            const { application, api } = getState();
            const { tabId: realTabId, isNewTab } = formatTabId(tabId,api.tabs);
            if (application.isLoading) await waitForLoaded();
            await wrappedNavigate({ applicationName: 'api' });
            const headerString = headers ? Object.keys(headers).map(key => `${key}: ${headers[key]}`).join('\n') : API_DEFAULT.HEADER;
            const { request, error } = formatApiRequest({
                endpoint,
                method,
                body,
                header: headerString,
                connector:application.connector,
            });
            LOGGER.log('request',request);
            if (isNewTab) {
                const tab = generateDefaultTab(currentApiVersion, realTabId);
                tab.body = request.body;
                tab.header = headerString;
                tab.method = request.method;
                tab.endpoint = request.endpoint;
                tab.fileId = null;
                await dispatch(API.reduxSlice.actions.addTab({ tab }));
            } else {
                await dispatch(API.reduxSlice.actions.selectionTab({ id: realTabId }));
                await dispatch(API.reduxSlice.actions.updateRequest({
                    header: headerString,
                    method: request.method,
                    endpoint: request.endpoint,
                    body: request.body,
                    tabId: realTabId,
                }));
            }
            LOGGER.log('tabId',realTabId);
            return { tabId: realTabId };
        } catch (error) {
            LOGGER.error('editApiScript',error);
            return { error: error.message };
        }
    });
}

// Fetch saved API scripts for the current alias
export async function fetchApiSavedScripts({ alias }) {
    LOGGER.log('fetchApiSavedScripts',alias);
    await store.dispatch(DOCUMENT.reduxSlices.APIFILE.actions.loadFromStorage({ alias }));
    const { apiFiles } = store.getState();
    const entities = SELECTORS.apiFiles.selectAll({ apiFiles });
    return entities.filter(item => item.isGlobal || item.alias === alias);
}