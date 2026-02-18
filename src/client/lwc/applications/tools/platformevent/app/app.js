import { api, track, wire } from 'lwc';
import {
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
import { connectStore, store, EVENT, SELECTORS, DOCUMENT, ERROR } from 'core/store';
import Toast from 'lightning/toast';

import ToolkitElement from 'core/toolkitElement';
import EditorModal from 'platformevent/editorModal';
import PublisherModal from 'platformevent/publisherModal';
import LightningConfirm from 'lightning/confirm';
import Analytics from 'shared/analytics';

import lib from 'cometd';
import moment from 'moment';
import LOGGER from 'shared/logger';

const STATUS_NEW = 'New';
const STATUS_SUBSCRIBED = 'Subscribed';
//const STATUS_UNSUBSCRIBED = 'Unsubscribed';
const STATUS_ERROR = 'Error';
const TYPE_MAPPING = {
    data: 'Change Data Capture',
    event: 'Platform Event',
    topic: 'PushTopic',
    default: 'Other',
};

const cometd = new lib.CometD();
const DEFAULT_LAST_MESSAGE = 'Waiting for events';
const CHANNEL_PREFIXES = {
    event: '/event/',
    data: '/data/',
    topic: '/topic/',
    generic: '/',
    user: '/u/',
    systemTopic: '/systemTopic/',
};

export default class App extends ToolkitElement {
    isLoading = false;
    channelName; // = 'CCR_TaskNotification__e';
    replayId = -1;
    // Apex
    //apexScript = "System.debug('Hello World');"; // ='CCR_TaskNotification__e event = new CCR_TaskNotification__e();\n// Publish the event\nDatabase.SaveResult result = EventBus.publish(event);';
    isApexContainerDisplayed = false;
    isManualChannelDisplayed = false;
    manualChannelPrefix = CHANNEL_PREFIXES.event;
    manualChannelName = '';
    isConnected = false;
    isConnecting = false;
    isCometDInitialized = false;
    isRecentToggled = false;
    connectionStatus = 'Disconnected';
    _reconnectTimer;
    _reconnectAttempt = 0;

    @track recentChannels = [];
    @track eventObjects = [];
    @track pushTopics = [];

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
        Analytics.trackAppOpen('platformevent', { alias: this.alias });
        //this.loadCache();
        this.describeAll();
    }

    disconnectedCallback() {
        clearInterval(this._lastMessageInternal);
        if (this._reconnectTimer) {
            clearTimeout(this._reconnectTimer);
            this._reconnectTimer = null;
        }
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

    openPublisherModal = () => {
        if (!this.canPublishPlatformEvent) return;
        PublisherModal.open({
            title: 'Publish Platform Event',
            apiName: this.currentChannel?.name,
            instanceUrl: this.connector.conn.instanceUrl,
            accessToken: this.connector.conn.accessToken,
            apiVersion: this.connector.conn.version,
        }).catch(() => {});
    };

    handleEventSelection = e => {
        e.stopPropagation();
        e.preventDefault();
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
            LOGGER.error('Issue update events', e);
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

    toggle_manualInput = () => {
        this.isManualChannelDisplayed = !this.isManualChannelDisplayed;
    };

    handleManualChannelInput = (e) => {
        this.manualChannelName = e.target.value;
    };

    handleManualChannelPrefixChange = (e) => {
        this.manualChannelPrefix = e.detail.value;
    };

    manual_subscribeChannel = e => {
        let eventName;
        if (this.isManualChannelDisplayed) {
            const raw = (this.manualChannelName || '').trim();
            if (!raw) return;
            // Allow power users to paste the full channel path (/event/..., /data/..., /topic/..., /u/..., etc.)
            eventName = raw.startsWith('/') ? raw : `${this.manualChannelPrefix}${raw}`;
        } else {
            eventName = this.subscribe_lookup();
        }
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
                LOGGER.error('Big Error', e);
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
        this.activeSubscriptions[_formattedEventName] = this.subscribeToChannel(eventName, _formattedEventName);

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

        const selectedEvent = this.lookup_selectedEvents[0];
        return selectedEvent.channel;
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
                LOGGER.debug('--> Unsubscribing <--');
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
            .filter(x => checkIfPresent(x.name, keywords) || checkIfPresent(x.channel, keywords))
            .map(x => this.formatForLookup(x));
        lookupElement.setSearchResults(results);
    };

    lookup_handleSelectionChange = e => {
        const selection = this.template.querySelector('slds-lookup').getSelection();
        LOGGER.debug('lookup_handleSelectionChange', selection);
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
        if (this.isConnected || this.isConnecting) return;
        if (!this.isCometDInitialized) {
            this.initializeCometD();
        }
        this.isConnecting = true;
        this.connectionStatus = 'Connecting';
        cometd.handshake(status => {
            this.isConnecting = false;
            if (!status.successful) {
                LOGGER.error('Error during handshake', status);
                this.connectionStatus = 'Error';
                this.scheduleReconnect();
            } else {
                this.isConnected = true;
                this.connectionStatus = 'Connected';
                this._reconnectAttempt = 0;
                this.resubscribeAll();
            }
        });
    };

    subscribeToChannel = (eventName, formattedEventName) => {
        return cometd.subscribe(eventName, async message => {
            try {
                const replayId = message?.data?.event?.replayId;
                const item = {
                    id: replayId || Date.now(),
                    receivedDate: Date.now(),
                    content: message,
                };
                store.dispatch(
                    EVENT.reduxSlice.actions.upsertSubscriptionMessages({
                        messages: [item],
                        channel: formattedEventName,
                    })
                );
            } catch (e) {
                LOGGER.error('Failed to process incoming message', e);
            }
        });
    };

    resubscribeAll = () => {
        try {
            const { platformEvent } = store.getState();
            const subs = SELECTORS.platformEvents.selectAll({ platformEvent }) || [];
            subs.forEach((s) => {
                const channel = s.id; // stored id is lower-cased channel path
                if (this.activeSubscriptions[channel]) return;
                const originalChannel =
                    s.type === 'event'
                        ? `/event/${s.name}`
                        : (s.type === 'data'
                              ? `/data/${s.name}`
                              : (s.type === 'topic' ? `/topic/${s.name}` : s.id));
                const replayId = s.replayId ?? -1;
                // Attach replayId via ReplayExtension by ensuring fetchReplayId returns latest
                this.activeSubscriptions[channel] = this.subscribeToChannel(originalChannel, channel);
                store.dispatch(
                    EVENT.reduxSlice.actions.updateSubscriptionStatus({
                        channel,
                        status: STATUS_SUBSCRIBED,
                    })
                );
                // keep replayId in state (no-op here, but ensures fetchReplayId works)
                if (replayId !== undefined) {
                    // nothing to do; replayId already stored
                }
            });
        } catch (e) {
            LOGGER.error('resubscribeAll failed', e);
        }
    };

    scheduleReconnect = () => {
        if (this._reconnectTimer) return;
        const attempt = Math.min(this._reconnectAttempt, 6);
        const delayMs = Math.min(30000, 1000 * Math.pow(2, attempt));
        this._reconnectAttempt += 1;
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        this._reconnectTimer = setTimeout(() => {
            this._reconnectTimer = null;
            const { platformEvent } = store.getState();
            const subs = SELECTORS.platformEvents.selectAll({ platformEvent }) || [];
            if (subs.length > 0) {
                try {
                    cometd.disconnect();
                } catch (_e) {}
                this.isConnected = false;
                this.connectToCometD();
            }
        }, delayMs);
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
        cometd.addListener('/meta/handshake', message => {
            if (!message.successful) {
                this.connectionStatus = 'Error';
            }
        });
        cometd.addListener('/meta/connect', message => {
            if (!message.successful) {
                this.isConnected = false;
                this.connectionStatus = 'Disconnected';
                this.activeSubscriptions = {};
                this.scheduleReconnect();
            }
        });
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
                store.dispatch(
                    ERROR.reduxSlice.actions.addError({
                        message: 'Error during subscription',
                        details: message.error || 'Unknown Error',
                    })
                );
            }
        });
        cometd.addListener('/meta/disconnect', message => {
            this.isConnected = false;
            this.connectionStatus = 'Disconnected';
            this.activeSubscriptions = {};
            this.scheduleReconnect();
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
            id: item.name,
            title: item.name,
            subtitle: item.subtitle,
            icon: item.icon,
            channel: item.channel,
        };
    };

    load_toolingGlobal = async () => {
        let result = await this.connector.conn.describeGlobal();
        return result?.sobjects || [];
    };

    load_toolingPushTopics = async () => {
        try {
            const res = await this.connector.conn.tooling.query(
                'SELECT Id, Name, Query FROM PushTopic ORDER BY Name'
            );
            return res?.records || [];
        } catch (e) {
            // Many orgs don’t use PushTopics; tooling access may also be restricted.
            LOGGER.debug('PushTopic tooling query failed', e?.message);
            return [];
        }
    };

    describeAll = async () => {
        this.isLoading = true;
        try {
            const records = (await this.load_toolingGlobal()) || [];
            const platformEvents = records
                .filter(x => x.name.endsWith('__e'))
                .map(x => ({
                    name: x.name,
                    type: 'event',
                    subtitle: TYPE_MAPPING.event,
                    icon: 'standard:events',
                    channel: `${CHANNEL_PREFIXES.event}${x.name}`,
                }));

            const cdcEvents = records
                .filter(x => x.name.endsWith('ChangeEvent'))
                .map(x => ({
                    name: x.name,
                    type: 'data',
                    subtitle: TYPE_MAPPING.data,
                    icon: 'standard:data_integration_hub',
                    channel: `${CHANNEL_PREFIXES.data}${x.name}`,
                }));

            const pushTopics = (await this.load_toolingPushTopics()).map(pt => ({
                name: pt.Name,
                type: 'topic',
                subtitle: TYPE_MAPPING.topic,
                icon: 'standard:topic',
                channel: `${CHANNEL_PREFIXES.topic}${pt.Name}`,
                query: pt.Query,
            }));

            this.pushTopics = pushTopics;

            // Lookup source
            this.eventObjects = [...platformEvents, ...cdcEvents, ...pushTopics].sort((a, b) =>
                a.name.localeCompare(b.name)
            );
        } catch (e) {
            LOGGER.error(e);
            store.dispatch(
                ERROR.reduxSlice.actions.addError({
                    message: 'Error during describeAll',
                    details: e.message,
                })
            );
        }
        this.isLoading = false;
    };

    /** Getters */

    get pageClass() {
        //Overwrite
        return super.pageClass + ' slds-p-around_small';
    }

    get isSubscribeDisabled() {
        if (this.isManualChannelDisplayed) {
            return !this.manualChannelName || this.manualChannelName.trim() === '';
        }
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

    get manualIconName() {
        return this.isManualChannelDisplayed ? 'utility:search' : 'utility:edit';
    }
    get manualAltText() {
        return this.isManualChannelDisplayed ? 'Switch to Lookup' : 'Switch to Manual';
    }

    get manualPrefixOptions() {
        return [
            { label: '/event/ (Platform Events)', value: CHANNEL_PREFIXES.event },
            { label: '/data/ (CDC)', value: CHANNEL_PREFIXES.data },
            { label: '/topic/ (PushTopic)', value: CHANNEL_PREFIXES.topic },
            { label: '/u/ (Generic User Channel)', value: CHANNEL_PREFIXES.user },
            { label: '/systemTopic/ (System)', value: CHANNEL_PREFIXES.systemTopic },
            { label: '/ (Generic)', value: CHANNEL_PREFIXES.generic },
        ];
    }

    get canPublishPlatformEvent() {
        return (
            isNotUndefinedOrNull(this.currentChannel) &&
            this.currentChannel.type === 'event' &&
            (this.currentChannel.name || '').endsWith('__e')
        );
    }

    get isPublishDisabled() {
        return !this.canPublishPlatformEvent;
    }

    get connectionTooltip() {
        if (this.connectionStatus === 'Connected') return 'Connected to Streaming API (CometD)';
        if (this.connectionStatus === 'Connecting') return 'Connecting to Streaming API (CometD)…';
        if (this.connectionStatus === 'Error') return 'Connection error (will retry automatically)';
        return 'Disconnected (will retry automatically if you have subscriptions)';
    }

    get connectionPillClass() {
        const base = 'connection-pill';
        if (this.connectionStatus === 'Connected') return `${base} connection-pill_connected`;
        if (this.connectionStatus === 'Connecting') return `${base} connection-pill_connecting`;
        if (this.connectionStatus === 'Error') return `${base} connection-pill_error`;
        return `${base} connection-pill_disconnected`;
    }

    get connectionDotClass() {
        const base = 'connection-dot';
        if (this.connectionStatus === 'Connected') return `${base} connection-dot_connected`;
        if (this.connectionStatus === 'Connecting') return `${base} connection-dot_connecting`;
        if (this.connectionStatus === 'Error') return `${base} connection-dot_error`;
        return `${base} connection-dot_disconnected`;
    }
}
