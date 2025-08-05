import { store, APEX, DOCUMENT, SELECTORS } from 'core/store';
import { waitForLoaded, wrappedNavigate, formatTabId } from './utils';

// Execute anonymous Apex and return the result


export async function executeAnonymousApex({ tabId }) {
    return await store.dispatch(async (dispatch, getState) => {
        const { application } = getState();


        if (application.isLoading) await waitForLoaded();
        await wrappedNavigate({ applicationName: 'anonymousapex' });
        // We are setting the current tab to the one we want to execute
        await dispatch(APEX.reduxSlice.actions.selectionTab({ id: tabId }));
        // fetch the body from the current tab
        const body = getState().apex?.currentTab?.body;
        const apexPromise = store.dispatch(
            APEX.executeApexAnonymous({
                connector:application.connector,
                body,
                tabId,
                createdDate: Date.now(),
            })
        );
        store.dispatch(
            APEX.reduxSlice.actions.setAbortingPromise({
                tabId,
                promise: apexPromise,
            })
        );
        const res = await apexPromise;
        await dispatch(APEX.reduxSlice.actions.selectionTab({ id: tabId }));
        let _output = { ...res.payload?.response || {}, tabId };
        if (res.error) {
            _output.error = res.error;
        }
        return _output;
    });
}

// Create or update an Apex tab for editing code (does not execute)
export async function editApexTab({ body, tabId }) {
    
    return await store.dispatch(async (dispatch, getState) => {
        const { application, apex } = getState();
        const { tabId: realTabId, isNewTab } = formatTabId(tabId,apex.tabs);
        if (application.isLoading) await waitForLoaded();
        await wrappedNavigate({ applicationName: 'anonymousapex' });
        if (isNewTab) {
            await dispatch(APEX.reduxSlice.actions.addTab({ tab: { id: realTabId, body } }));
        } else {
            await dispatch(APEX.reduxSlice.actions.selectionTab({ id: realTabId }));
            await dispatch(APEX.reduxSlice.actions.updateBody({ body }));
        }
        // No execution, just editing/creating the tab
        return { tabId: realTabId, body };
    });
}

// Fetch saved Apex scripts for the current alias
export async function fetchApexSavedScripts({ alias }) {
    await store.dispatch(DOCUMENT.reduxSlices.APEXFILE.actions.loadFromStorage({ alias }));
    const { apexFiles } = store.getState();
    const entities = SELECTORS.apexFiles.selectAll({ apexFiles });
    return entities.filter(item => item.isGlobal || item.alias === alias);
}