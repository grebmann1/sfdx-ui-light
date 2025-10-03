import { wire } from 'lwc';
import ToolkitElement from 'core/toolkitElement';
import { guid,isNotUndefinedOrNull, API as API_UTILS } from 'shared/utils';
import { store, API, APPLICATION, UI, QUERY, DOCUMENT,SELECTORS, APEX } from 'core/store';
import { store as legacyStore, store_application as legacyStore_application } from 'shared/store';
import { NavigationContext, navigate } from 'lwr/navigation';
import LOGGER from 'shared/logger';

export default class Electron extends ToolkitElement {

    @wire(NavigationContext)
    navContext;

    initialized = false;
    listener_on;
    
    connectedCallback() {        
        this.init();
    }


    formatTabId = (tabId) => {
        const { ui } = store.getState();
        if(isNotUndefinedOrNull(tabId)){
            const tabExists = ui.tabs.some(tab => tab.id === tabId);
            if(tabExists){
                return {tabId,isNewTab:false};
            }
        }
        return {tabId:guid(),isNewTab:true};
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

            this.handleSOQL(this.listener_on);
            this.handleRestAPI(this.listener_on);
            this.handleAnonymousApex(this.listener_on);

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

    handleSOQL = (listener) => {
        // Listen for @soql calls from main process
        listener('/soql/query', args => {
            const [payload,callBackChannel] = args;
            LOGGER.info('[Electron] @soql call args:', args);
            // Dispatch a SOQL/QUERY action (customize as needed)

            const {tabId,isNewTab} = this.formatTabId(payload.tabId);

            store.dispatch(async (dispatch, getState) => {
                const { application } = getState();
                if(application.isLoading) await this.waitForLoaded();

                // Navigate to the soql application
                navigate(this.navContext, { type: 'application', state: { applicationName: 'soql' } });
                // Update the tab
                if (isNewTab) {
                    await dispatch(UI.reduxSlice.actions.addTab({ tab: { id: tabId, body: payload.query } }));
                } else {
                    await dispatch(UI.reduxSlice.actions.selectionTab({ id: tabId }));
                }

                // If the tabId is provided, use it, otherwise use the current tab
                

                // Run the query
                const res = await dispatch(
                    QUERY.executeQuery({
                        connector: this.connector,
                        soql: payload.query,
                        tabId: tabId,
                        useToolingApi: false, // TODO: add tooling api support
                        includeDeletedRecords: false, // TODO: add include deleted records support
                    })
                );
                LOGGER.debug('Execute Query [res]', res);
                LOGGER.debug('Execute Query [payload]', res.payload);
                await dispatch(UI.reduxSlice.actions.selectionTab({ id: tabId }));
                let _output = res.payload;
                if(res.error){
                    _output = {
                        error: res.error,
                    };
                }
                Object.assign(_output, {
                    tabId: tabId,
                });
                LOGGER.debug('MCP Response [output]', _output);
                window.electron.send(callBackChannel, _output);
             });
        });

        // Listen for navigate-tab requests
        listener('/soql/navigate-tab', args => {
            const [payload,callBackChannel] = args;
            LOGGER.info('[Electron] @soql navigate-tab args:', args);
            // Dispatch a SOQL/QUERY action (customize as needed)
            navigate(this.navContext, { type: 'application', state: { applicationName: 'soql' } });
            const {tabId,isNewTab} = this.formatTabId(payload.tabId);
            let _output = {
                tabId: tabId,
            };
            if(!isNewTab){
                _output.status = 'success';
                store.dispatch(UI.reduxSlice.actions.selectionTab({ id: tabId }));
            }else{
                _output.status = 'error';
                _output.message = 'Tab not found';
            }

            window.electron.send(callBackChannel, _output);
        });

        // listen for fetch query from Saved List
        listener('/soql/queries', async args => {
            const [payload,callBackChannel] = args;
            LOGGER.info('[Electron] @soql queries args:', args);
            // Dispatch a SOQL/QUERY action (customize as needed)
            LOGGER.info('[Electron] @soql current alias:', this.alias);
            await store.dispatch(DOCUMENT.reduxSlices.QUERYFILE.actions.loadFromStorage({
                alias: this.alias,
            }));
            const { queryFiles } = store.getState();
            const entities = SELECTORS.queryFiles.selectAll({ queryFiles });
            // Taken from soql/app.js
            const queries = entities
                .filter(item => item.isGlobal || item.alias == this.alias)
                .map((item, index) => {
                    return item; // no mutation for now
                });
            LOGGER.info('[Electron] @soql saved queries:', queries);
            window.electron.send(callBackChannel, queries);
        });
    }

    handleAnonymousApex = (listener) => {
        listener('/apex/execute', args => {
            const [payload,callBackChannel] = args;
            const {alias, body} = payload;
            LOGGER.info('[Electron] @apex/executeAnonymous call args:', args);

            const {tabId,isNewTab} = this.formatTabId(payload.tabId);

            store.dispatch(async (dispatch, getState) => {
                const { application } = getState();
                if(application.isLoading) await this.waitForLoaded();

                // Navigate to the anonymous apex application
                navigate(this.navContext, { type: 'application', state: { applicationName: 'anonymousapex' } });

                // Update the tab
                if (isNewTab) {
                    await dispatch(APEX.reduxSlice.actions.addTab({ tab: { id: tabId, body } }));
                }else{
                    await dispatch(APEX.reduxSlice.actions.selectionTab({ id: tabId }));
                    await dispatch(APEX.reduxSlice.actions.updateBody({
                        body
                    }));
                }
                const apexPromise = store.dispatch(
                    APEX.executeApexAnonymous({
                        connector: this.connector,
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

                LOGGER.debug('Execute Apex [res]', res);
                LOGGER.debug('Execute Apex [payload]', res.payload);

                let _output = {
                    ...res.payload?.response || {},
                    tabId: tabId,
                };
                if(res.error){
                    _output.error = res.error;
                }
                window.electron.send(callBackChannel, _output);

            });
        });

        // listen for fetch query from Saved List
        listener('/apex/scripts', async args => {
            const [payload,callBackChannel] = args;
            LOGGER.info('[Electron] @apex/scripts queries args:', args);
            // Dispatch a SOQL/QUERY action (customize as needed)
            LOGGER.info('[Electron] @apex/scripts current alias:', this.alias);
            await store.dispatch(DOCUMENT.reduxSlices.APEXFILE.actions.loadFromStorage({
                alias: this.alias,
            }));
            const { apexFiles } = store.getState();
            const entities = SELECTORS.apexFiles.selectAll({ apexFiles });
            
            const scripts = entities
                .filter(item => item.isGlobal || item.alias == this.alias)
                .map((item, index) => {
                    return item; // no mutation for now
                });
            LOGGER.info('[Electron] @apex/scripts saved scripts:', scripts);
            window.electron.send(callBackChannel, scripts);
        });
    }

    handleRestAPI = (listener) => {
        listener('/api/execute', args => {
            const [payload,callBackChannel] = args;
            const { alias, method,headers,endpoint,body } = payload;
            LOGGER.info('[Electron] @api/execute call args:', args);

            

            const {tabId,isNewTab} = this.formatTabId(payload.tabId);

            store.dispatch(async (dispatch, getState) => {
                const { application } = getState();
                if(application.isLoading) await this.waitForLoaded();

                // Navigate to the api application
                navigate(this.navContext, { type: 'application', state: { applicationName: 'api' } });

                const headers = Object.keys((payload.headers || {})).map(key => `${key}: ${payload.headers[key]}`).join('\n') || API_UTILS.DEFAULT.HEADER;

                const {request,error} = API_UTILS.formatApiRequest({
                    endpoint: payload.endpoint,
                    method: payload.method,
                    body: payload.body,
                    header: headers, // as a string
                    connector: this.connector,
                });
                LOGGER.log('Execute API [payload]',payload);
                LOGGER.log('Execute API [request]',request);
                LOGGER.log('Execute API [error]',error);
                LOGGER.log('Execute API [tabId]',tabId);
                // Navigate to the soql application
                
                // Update the tab
                if (isNewTab) {
                    const tab = API_UTILS.generateDefaultTab(this.currentApiVersion,tabId);
                    tab.body = request.body;
                    tab.header = headers;
                    tab.method = request.method;
                    tab.endpoint = request.endpoint;
                    tab.fileId = null;
                    await dispatch(API.reduxSlice.actions.addTab({ tab }));
                } else {
                    await dispatch(API.reduxSlice.actions.selectionTab({ id: tabId }));
                    await dispatch(API.reduxSlice.actions.updateRequest({
                        header: headers,
                        method: request.method,
                        endpoint: request.endpoint,
                        body: request.body,
                        tabId: tabId,
                    }));
                }

                

                // Run the API request
                const apiPromise = store.dispatch(
                    API.executeApiRequest({
                        connector: this.connector,
                        request:{
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
                // TODO : Investigate if this shouldn't be done in the reducer
                store.dispatch(
                    API.reduxSlice.actions.setAbortingPromise({
                        tabId,
                        promise: apiPromise,
                    })
                );
                const res = await apiPromise;

                await dispatch(UI.reduxSlice.actions.selectionTab({ id: tabId }));

                LOGGER.debug('Execute API [res]', res);
                LOGGER.debug('Execute API [payload]', res.payload);

                let _output = {
                    ...res.payload?.response || {},
                    tabId: tabId,
                };
                console.log('Execute API [_output]', _output);
                if(res.error){
                    _output.error = res.error;
                }
                LOGGER.debug('MCP Response [output]', _output);
                window.electron.send(callBackChannel, _output);
             });
        });

        listener('/api/scripts', args => {
            const [payload,callBackChannel] = args;
            LOGGER.info('[Electron] @api/scripts call args:', args);
            const {apiFiles} = store.getState();
            const entities = SELECTORS.apiFiles.selectAll({ apiFiles });
            LOGGER.info('[Electron] @api/scripts entities:', entities);
            const apiFilesFiltered = entities.filter(item => item.isGlobal || item.alias == this.alias);
            LOGGER.info('[Electron] @api/scripts apiFilesFiltered:', apiFilesFiltered);
            window.electron.send(callBackChannel, apiFilesFiltered);
        });
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