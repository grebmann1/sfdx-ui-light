import { store, UI, QUERY, DOCUMENT, SELECTORS } from 'core/store';
import { waitForLoaded, wrappedNavigate, formatTabId } from './utils';
import LOGGER from 'shared/logger';


// Execute a SOQL query and return the result
export async function executeSoqlQuery({ query, tabId }) {
    LOGGER.log('executeSoqlQuery');
    return await store.dispatch(async (dispatch, getState) => {
        const { application, ui } = getState();
        const { tabId: realTabId, isNewTab } = formatTabId(tabId,ui.tabs);
        if (application.isLoading) await waitForLoaded();
        await wrappedNavigate({ applicationName: 'soql' });
        if (isNewTab) {
            await dispatch(UI.reduxSlice.actions.addTab({ tab: { id: realTabId, body: query } }));
        } else {
            await dispatch(UI.reduxSlice.actions.selectionTab({ id: realTabId }));
            await dispatch(UI.reduxSlice.actions.updateSoql({
                connector: application.connector,
                soql: query,
                //isDraft: false,
            }));
        }
        LOGGER.log('ExecuteSoqlQuery - 1',query);
        const res = await dispatch(
            QUERY.executeQuery({
                connector:application.connector,
                soql: query,
                tabId: realTabId,
                useToolingApi: false,
                includeDeletedRecords: false,
            })
        );
        LOGGER.log('ExecuteSoqlQuery - 2',res);
        await dispatch(UI.reduxSlice.actions.selectionTab({ id: realTabId }));
        let _output = res.payload;
        if (res.error) {
            _output = { error: res.error };
        }
        Object.assign(_output, { tabId: realTabId });
        LOGGER.log('ExecuteSoqlQuery - 3',_output);
        return _output;
    });
}

export async function executeSoqlQueryIncognito({ query, useToolingApi, includeDeletedRecords }) {
    LOGGER.log('executeSoqlQueryIncognito',query,useToolingApi,includeDeletedRecords);
    return await store.dispatch(async (dispatch, getState) => {
        const { application, ui } = getState();
        const res = await dispatch(
            QUERY.executeQueryIncognito({
                connector:application.connector,
                soql: query,
                useToolingApi,
                includeDeletedRecords,
            })
        );
        let _output = res.payload;
        if (res.error) {
            _output = { error: res.error };
        }
        LOGGER.log('ExecuteSoqlQueryIncognito - 1',_output);
        return _output;
    });
}


export async function displaySoqlTab({ tabId }) {  
    LOGGER.log('displaySoqlTab',tabId);
    return await store.dispatch(async (dispatch, getState) => {
        await dispatch(UI.reduxSlice.actions.selectionTab({ id: tabId }));
    });
}

// Fetch saved SOQL queries for the current alias
export async function fetchSoqlSavedQueries({ alias }) {
    await store.dispatch(DOCUMENT.reduxSlices.QUERYFILE.actions.loadFromStorage({ alias }));
    const { queryFiles } = store.getState();
    const entities = SELECTORS.queryFiles.selectAll({ queryFiles });
    return entities.filter(item => item.isGlobal || item.alias === alias);
}