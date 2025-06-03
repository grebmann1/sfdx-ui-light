import { LightningElement, wire, api } from 'lwc';
import ToolkitElement from 'core/toolkitElement';
import { guid } from 'shared/utils';
import { store, API, APPLICATION, UI, QUERY } from 'core/store';
import { store as legacyStore, store_application as legacyStore_application } from 'shared/store';
import { NavigationContext, CurrentPageReference, navigate } from 'lwr/navigation';
import LOGGER from 'shared/logger';

export default class Electron extends ToolkitElement {

    @wire(NavigationContext)
    navContext;

    initialized = false;
    listener_on;
    
    connectedCallback() {        
        this.init();
    }


    init = () => {
        if (this.initialized) return;
        try {
            this.listener_on = window.electron.listener_on;
        } catch (e) {
            this.listener_on = undefined;
        }
        if (this.listener_on) 
            LOGGER.info('[Electron] init');{

            
            // Listen for @api calls from main process
            this.listener_on('electron-api-call', (event, payload) => {
                // Dispatch an API action (customize as needed)
                store.dispatch(API.reduxSlice.actions.someAction(payload));
                LOGGER.info('[Electron] @api call received and dispatched:', payload);
            });

            // Listen for @soql calls from main process
            this.listener_on('electron-soql-call', args => {
                const [payload,callBackChannel] = args;
                LOGGER.info('[Electron] @soql call args:', args);
                // Dispatch a SOQL/QUERY action (customize as needed)
                const _guid = guid();

                store.dispatch(async (dispatch, getState) => {
                    const { ui,application } = getState();
                    if(application.isLoading) await this.waitForLoaded();

                    const existingTab = ui.tabs.find(x => x.id === _guid);
                    // Navigate to the soql application
                    navigate(this.navContext, { type: 'application', state: { applicationName: 'soql' } });
                    // Update the tab
                    if (existingTab) {
                        await dispatch(UI.reduxSlice.actions.selectionTab(existingTab));
                    } else {
                        await dispatch(UI.reduxSlice.actions.addTab({ tab: { id: _guid, body: payload.query } }));
                    }

                    // Run the query
                    const res = await dispatch(
                        QUERY.executeQuery({
                            connector: this.connector,
                            soql: payload.query,
                            tabId: getState().ui.currentTab.id,
                            useToolingApi: false, // TODO: add tooling api support
                            includeDeletedRecords: false, // TODO: add include deleted records support
                        })
                    );

                    await dispatch(UI.reduxSlice.actions.selectionTab({ id: res.payload?.tabId }));

                    LOGGER.debug('MCP Response [payload]', res.payload);
                    window.electron.send(callBackChannel, res.payload);
                 });
            });

            // Listen for navigation requests
            this.listener_on('electron-navigate-to', async args => {
                const [payload,callBackChannel] = args;
                LOGGER.info('[Electron] @navigate-to call args:', args);
                // Dispatch a navigation action
                let formattedPayload = `sftoolkit:${JSON.stringify({
                    type: 'application',
                    state: { applicationName: payload.application },
                })}`;
                await legacyStore.dispatch(legacyStore_application.navigate(formattedPayload));
                window.electron.send(callBackChannel, payload);
            });

            // Listen for getSettings requests and reply with settings
            this.listener_on('electron-get-settings', (event) => {
                // Fetch settings from the store
                const settings = store.getState().application; // Adjust as needed
                LOGGER.info('[Electron] getSettings requested, sending:', settings);
                //this.ipcRenderer.send('electron-get-settings-response', settings);
            });
        }
        this.initialized = true;
    }

    sendToMain(channel, payload) {
        if (this.ipcRenderer) {
            //this.ipcRenderer.send(channel, payload);
        }
    }

    /**
     * Waits until the application is no longer loading.
     * Checks every second and resolves when loading is complete.
     * @returns {Promise<void>}
     */
    waitForLoaded() {
        return new Promise((resolve) => {
            const checkLoading = () => {
                const { application } = store.getState();
                if (!application.isLoading) {
                    clearInterval(intervalId);
                    resolve();
                }
            };
            checkLoading(); // Check immediately in case already loaded
            const intervalId = setInterval(checkLoading, 1000);
        });
    }
}