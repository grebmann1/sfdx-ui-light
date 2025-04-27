import { api, track, wire } from 'lwc';
import {
    decodeError,
    isNotUndefinedOrNull,
    isUndefinedOrNull,
    guid,
    isEmpty,
    checkIfPresent,
    classSet,
    lowerCaseKey,
    isChromeExtension,
} from 'shared/utils';
import { ReplayExtension } from 'platformevent/utils';
import { connectStore, store, EVENT, SELECTORS, DOCUMENT } from 'core/store';
import Toast from 'lightning/toast';

import ToolkitElement from 'core/toolkitElement';
import EditorModal from 'platformevent/editorModal';
import LightningConfirm from 'lightning/confirm';

import lib from 'cometd';
import moment from 'moment';

const STATUS_NEW = 'New';
const STATUS_SUBSCRIBED = 'Subscribed';
const STATUS_UNSUBSCRIBED = 'Unsubscribed';
const STATUS_ERROR = 'Error';
const TYPE_MAPPING = {
    data: 'Change Data Capture',
    event: 'Platform Event',
    default: 'Other',
};

const cometd = new lib.CometD();
const DEFAULT_LAST_MESSAGE = 'Waiting for events';

export default class App extends ToolkitElement {
    isLoading = false;
    channelName; // = 'CCR_TaskNotification__e';
    replayId = -1;
    // Apex
    //apexScript = "System.debug('Hello World');"; // ='CCR_TaskNotification__e event = new CCR_TaskNotification__e();\n// Publish the event\nDatabase.SaveResult result = EventBus.publish(event);';
    isApexContainerDisplayed = false;
    isManualChannelDisplayed = false;
    isConnected = false;
    isCometDInitialized = false;
    isRecentToggled = false;

    @track recentChannels = [];
    @track eventObjects = [];

    // Used to store platformEvent records
    @track subscribedChannels = [];
    @track activeSubscriptions = {};
    currentChannel;
    currentChannelName;

    lastMessageFormatted = DEFAULT_LAST_MESSAGE;

    extensionInstance;

    /** */
    @track messagesDisplayed = []; //[{id:1712150227604,receivedDate:1712150227604,content:{channel:"/event/CCR_TaskNotification__e",data:{event:{EventApiName:"CCR_TaskNotification__e",EventUuid:"b2d74e15-07db-4856-81f2-aa65e904bb64",replayId:1499957}}}}];
    @track selectedEventItem; // = this.messagesDisplayed[0];

    /** Lookup */
    @track lookup_selectedEvents = [];
    @track lookup_errors = [];

    @wire(connectStore, { store })
    storeChange({ application, platformEvent, recents }) {
        const isCurrentApp = this.verifyIsActive(application.currentApplication);
        if (!isCurrentApp) return;

        this.currentChannelName = lowerCaseKey(platformEvent.currentChannel);

        if (this.currentChannelName) {
            const subscriptionState = SELECTORS.platformEvents.selectById(
                { platformEvent },
                this.currentChannelName
            );
            if (subscriptionState) {
                this.currentChannel = this.formatCurrentSubscription(subscriptionState);
                this.messagesDisplayed = subscriptionState.messages;
            } else {
                this.currentChannel = null;
            }
        }
        this.subscribedChannels = this.formatChannels(
            SELECTORS.platformEvents.selectAll({ platformEvent })
        );
        this.updateLastMessageFormatted();

        this.isRecentToggled = platformEvent.recentPanelToggled;

        if (recents && recents.platformEvents) {
            this.recentChannels = recents.platformEvents.map((item, index) => {
                return { id: `${index}`, content: item };
            });
        }
    }

    connectedCallback() {
        //this.loadCache();
        this.describeAll();
    }

    disconnectedCallback() {
        clearInterval(this._lastMessageInternal);
        if (cometd) {
            // Unsubscribe from the channel
            cometd.clearSubscriptions();
            // Disconnect from the CometD server
            cometd.disconnect();
        }
    }

    renderedCallback() {
        this._hasRendered = true;
        if (this._hasRendered && this.template.querySelector('slds-tabset')) {
            this.template.querySelector('slds-tabset').activeTabValue = this.currentChannelName;
        }
    }

    /** Events **/

    toggle_recent = () => {
        store.dispatch(
            EVENT.reduxSlice.actions.updateRecentPanel({
                value: !this.isRecentToggled,
                alias: this.alias,
            })
        );
    };

    toggle_apexEditor = e => {
        this.isApexContainerDisplayed = !this.isApexContainerDisplayed;
        if (this.isApexContainerDisplayed) {
            this.openEditorModal();
        }
    };

    handleEventSelection = e => {
        e.stopPropagation();
        e.preventDefault();
        //console.log('handleEventSelection',e.detail);
        this.selectedEventItem = null;
        this.selectedEventItem = e.detail.value;
        try {
            store.dispatch(
                EVENT.reduxSlice.actions.updateReadStatusOnSpecificMessage({
                    messageId: this.selectedEventItem.id,
                    channel: this.currentChannelName,
                })
            );
        } catch (e) {
            console.error('Issue update events', e);
        }
    };

    handleEmptyMessages = () => {
        // Reset message list
        this.selectedEventItem = null;
        store.dispatch(
            EVENT.reduxSlice.actions.cleanMessages({
                channel: this.currentChannelName,
            })
        );
    };

    manual_subscribeChannel = e => {
        const eventName = this.subscribe_lookup();
        const replayId = this.refs.replay.value;
        this._subscribeChannel(eventName, replayId);
    };

    recent_subscribeChannel = e => {
        const { id, content } = e.detail;
        this._subscribeChannel(content);
    };

    _subscribeChannel = (eventName, replayId) => {
        this.connectToCometD();
        if (this.activeSubscriptions.hasOwnProperty(lowerCaseKey(eventName))) {
            // Redirect (No Duplicate channels)
            store.dispatch(
                EVENT.reduxSlice.actions.updateChannel({
                    value: eventName,
                })
            );
        } else {
            try {
                this.cometdSubscribe(eventName, replayId);
            } catch (e) {
                console.error('Big Error', e);
            }
        }
    };

    fetchReplayId = channel => {
        const { platformEvent } = store.getState();
        const subscriptionState = SELECTORS.platformEvents.selectById(
            { platformEvent },
            lowerCaseKey(channel)
        );
        return subscriptionState?.replayId || -1;
    };

    /** Main Subscribing method to the CometD Server */
    cometdSubscribe = async (eventName, replayId) => {
        // First Reset the current displayed event
        this.selectedEventItem = null;

        const _formattedEventName = lowerCaseKey(eventName);
        const _replayId = replayId || -1;

        // Verify ReplayId
        const params = {
            theme: 'warning',
            label: 'Reprocessing all messages stored in the BUS',
            message: `Subscribing with the -2 option when a large number of event messages are stored can slow performance and consume your entire Publishing/Develivery allocation.`,
        };
        if (_replayId <= -2 && !(await LightningConfirm.open(params))) return;

        let { type, shortName } = this.extractInfoFromPath(eventName);

        store.dispatch(
            EVENT.reduxSlice.actions.createSubscription({
                channel: eventName,
                name: shortName,
                type,
                replayId: _replayId || -1,
                status: STATUS_NEW,
            })
        );

        // Subscribing
        this.activeSubscriptions[_formattedEventName] = cometd.subscribe(
            eventName,
            async message => {
                const item = {
                    id: message.data.event.replayId,
                    receivedDate: Date.now(),
                    content: message,
                };
                store.dispatch(
                    EVENT.reduxSlice.actions.upsertSubscriptionMessages({
                        messages: [item],
                        channel: _formattedEventName,
                    })
                );
            }
        );

        store.dispatch(
            EVENT.reduxSlice.actions.updateSubscriptionStatus({
                channel: _formattedEventName,
                status: STATUS_SUBSCRIBED,
            })
        );
        store.dispatch(
            DOCUMENT.reduxSlices.RECENT.actions.savePlatformEvents({
                channel: eventName,
                alias: this.alias,
            })
        );

        // Reset Lookups and replayId
        this.lookup_selectedEvents = [];
        this.refs.replay.value = -1;
    };

    subscribe_lookup = () => {
        if (this.lookup_selectedEvents.length == 0) return null;

        const apiName = this.lookup_selectedEvents[0].id;
        //console.log('apiName',apiName);
        const eventName = apiName.endsWith('__e') ? `/event/${apiName}` : `/data/${apiName}`;
        return eventName;
    };

    handleChannelSelection = name => {
        store.dispatch(
            EVENT.reduxSlice.actions.updateChannel({
                value: lowerCaseKey(name),
            })
        );
    };

    handleRecentChannelSelection = e => {
        this.connectToCometD();
        const eventName = e.detail.value;
        if (!this.activeSubscriptions.hasOwnProperty(eventName)) {
            this.cometdSubscribe(eventName);
        }
    };

    handleChannelDeletion = name => {
        const _channelToDelete = this.activeSubscriptions[name];
        if (_channelToDelete) {
            // fast ui update
            delete this.activeSubscriptions[name];
            store.dispatch(
                EVENT.reduxSlice.actions.deleteSubscription({
                    channel: name,
                })
            );
            //this.subscribedChannels = this.subscribedChannels.filter(x => x.id !== name);
            cometd.unsubscribe(_channelToDelete, null, () => {
                console.log('--> Unsubscribing <--');
            });
        } else if (!isEmpty(name)) {
            store.dispatch(
                EVENT.reduxSlice.actions.deleteSubscription({
                    channel: name,
                })
            );
        }

        /** Disconnect if empty */
        if (Object.keys(this.activeSubscriptions).length === 0) {
            cometd.disconnect(); // we disconnect !
        }
    };

    lookup_handleSearch = e => {
        const lookupElement = e.target;
        const keywords = e.detail.rawSearchTerm;
        const results = this.eventObjects
            .filter(x => checkIfPresent(x.name, keywords))
            .map(x => this.formatForLookup(x.name));
        lookupElement.setSearchResults(results);
    };

    lookup_handleSelectionChange = e => {
        const selection = this.template.querySelector('slds-lookup').getSelection();
        this.lookup_selectedEvents = selection;
    };

    /** Tabs */

    handleSelectTab = e => {
        const tabId = e.target.value;
        this.handleChannelSelection(tabId);
    };

    handleCloseTab = e => {
        const tabId = e.detail.value;
        this.handleChannelDeletion(tabId);
    };

    /** Methods  **/

    header_enableAutoDate = () => {
        this.updateLastMessageFormatted();
        this._lastMessageInternal = setInterval(() => {
            this.updateLastMessageFormatted();
        }, 30000);
    };

    updateLastMessageFormatted = () => {
        this.lastMessageFormatted = this.currentChannel?.lastModifiedDate
            ? moment(this.currentChannel.lastModifiedDate).fromNow()
            : DEFAULT_LAST_MESSAGE;
    };

    formatChannels = items => {
        return items.map(x => ({
            ...x,
            counter: x.messages.length,
            counterDraft: x.messages.filter(x => !x.isRead).length,
        }));
    };

    extractInfoFromPath = path => {
        // Extra information from the event
        let type,
            shortName = '';
        const _splitted = path.split('/');
        if (_splitted.length == 3) {
            type = lowerCaseKey(_splitted[1]);
            shortName = _splitted[2];
        }
        return { type, shortName };
    };

    formatCurrentSubscription = state => {
        // Extra information from the event
        return {
            ...state,
            formattedType: TYPE_MAPPING.hasOwnProperty(state.type)
                ? TYPE_MAPPING[state.type]
                : TYPE_MAPPING['default'],
            counter: state.messages.length,
            badgeClass:
                state.status == STATUS_SUBSCRIBED
                    ? 'slds-theme_success'
                    : (state.status == STATUS_ERROR ? 'slds-theme_error' : 'slds-badge') +
                      ' slds-float_right',
        };
    };

    connectToCometD = () => {
        if (this.isConnected) return;
        if (!this.isCometDInitialized) {
            this.initializeCometD();
        }
        cometd.handshake(status => {
            if (!status.successful) {
                console.error('Error during handshake', status);
            } else {
                this.isConnected = true;
            }
        });
    };

    initializeCometD = () => {
        this.isCometDInitialized = true;

        const config = {
            url: `${this.connector.conn.instanceUrl}/cometd/${this.connector.conn.version}/`,
            requestHeaders: {
                Authorization: `Bearer ${this.connector.conn.accessToken}`,
            },
            appendMessageTypeToURL: false,
            advice: {
                timeout: 29000,
            },
        };

        if (!isChromeExtension()) {
            config.requestHeaders = {
                ...config.requestHeaders,
                'salesforceproxy-endpoint': config.url,
            };
            config.url = `${'/cometd/'}${guid()}`;
        }

        cometd.configure(config);
        cometd.websocketEnabled = false;
        cometd.registerExtension('ReplayExtension', new ReplayExtension(this.fetchReplayId));

        // Add a listener for disconnection & error events
        cometd.addListener('/meta/subscribe', message => {
            if (!message.successful) {
                store.dispatch(
                    EVENT.reduxSlice.actions.updateSubscriptionStatus({
                        channel: message.subscription,
                        status: STATUS_ERROR,
                    })
                );
                Toast.show({
                    label: `Issue during subscription`,
                    message: message.error || 'Unknown Error',
                    variant: 'warning',
                    mode: 'dismissible',
                });
            }
        });
        cometd.addListener('/meta/disconnect', message => {
            this.isConnected = false;
        });
    };

    openEditorModal = () => {
        EditorModal.open({
            title: 'Anonymous Apex',
        }).then(async data => {
            this.isApexContainerDisplayed = false;
        });
    };

    formatForLookup = item => {
        return {
            id: item,
            title: item,
        };
    };

    load_toolingGlobal = async () => {
        let result = await this.connector.conn.describeGlobal();
        return result?.sobjects || [];
    };

    describeAll = async () => {
        this.isLoading = true;
        try {
            const records = (await this.load_toolingGlobal()) || [];
            this.eventObjects = records.filter(
                x => x.name.endsWith('ChangeEvent') || x.name.endsWith('__e')
            );
        } catch (e) {
            console.error(e);
        }
        this.isLoading = false;
    };

    /** Getters */

    get pageClass() {
        //Overwrite
        return super.pageClass + ' slds-p-around_small';
    }

    get isSubscribeDisabled() {
        return (
            isUndefinedOrNull(this.lookup_selectedEvents) || this.lookup_selectedEvents.length == 0
        );
    }

    get isCurrentChannelDisplayed() {
        return isNotUndefinedOrNull(this.currentChannel);
    }

    get rightSlotClass() {
        return classSet('slds-full-height slds-full-width')
            .add({
                'apex-illustration': !this.isLogDisplayed,
            })
            .toString();
    }

    get isEventViewerDisplayed() {
        return isNotUndefinedOrNull(this.selectedEventItem);
    }
}
