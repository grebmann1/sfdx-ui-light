import { api, track, wire } from 'lwc';
import { decodeError, isNotUndefinedOrNull, classSet, PLATFORM_EVENT } from 'shared/utils';
import ToolkitElement from 'core/toolkitElement';
import { connectStore, store, EVENT } from 'core/store';

const CHANNEL_PREFIXES = ['/event/', '/data/'];

export default class EventViewer extends ToolkitElement {
    isLoading = false;

    currentModel;
    viewerTab = PLATFORM_EVENT.VIEWER_TABS.DEFAULT;

    @track _item;

    schemaLoading = false;
    schemaError = null;
    schemaInfo = null;
    @track schemaFields = [];

    _schemaCache = new Map();

    @api
    get item() {
        return this._item;
    }
    set item(value) {
        this._item = value;
        if (this._hasRendered && this.refs.editor) {
            this.refs.editor.currentModel.setValue(this.content);
        }
        if (this.viewerTab === PLATFORM_EVENT.VIEWER_TABS.SCHEMA) {
            this.loadSchema();
        }
    }

    connectedCallback() {}

    renderedCallback() {
        this._hasRendered = true;

        if (this._hasRendered && this.template.querySelector('slds-tabset')) {
            this.template.querySelector('slds-tabset').activeTabValue = this.viewerTab;
        }
    }

    @wire(connectStore, { store })
    storeChange({ platformEvent }) {
        if (platformEvent) {
            this.viewerTab = platformEvent.viewerTab;
            if (this.viewerTab === PLATFORM_EVENT.VIEWER_TABS.SCHEMA) {
                this.loadSchema();
            }
        }
    }

    /** Events **/

    handleSelectTab(event) {
        store.dispatch(
            EVENT.reduxSlice.actions.updateViewerTab({
                value: event.target.value,
                alias: this.alias,
            })
        );
    }

    handleMonacoLoaded = () => {
        //this.isLoading = false;
        this.currentModel = this.refs.editor.createModel({
            body: this.content,
            language: 'json',
        });
        this.refs.editor.displayModel(this.currentModel);
    };

    /** Methods  **/

    getEventChannel() {
        const data = this._item?.content || this._item;
        return data?.channel || '';
    }

    inferApiNameFromChannel(channel) {
        if (!channel) return null;
        const prefix = CHANNEL_PREFIXES.find((p) => channel.startsWith(p));
        if (!prefix) return null;
        return channel.slice(prefix.length).split('?')[0] || null;
    }

    formatDescribeFields(describeResult) {
        const fields = describeResult?.fields || [];
        return fields
            .map((f) => ({
                name: f.name,
                label: f.label,
                type: f.type,
                length: f.length ?? '',
                nillable: f.nillable ? 'true' : 'false',
                referenceTo: Array.isArray(f.referenceTo) ? f.referenceTo.join(', ') : '',
                rowClass: f.name === 'ChangeEventHeader' ? 'slds-theme_shade' : '',
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    async loadSchema() {
        try {
            this.schemaError = null;
            this.schemaFields = [];
            this.schemaInfo = null;

            const channel = this.getEventChannel();
            const apiName = this.inferApiNameFromChannel(channel);
            if (!apiName) {
                this.schemaInfo = {
                    title: 'Schema not available',
                    subtitle:
                        channel && channel.startsWith('/topic/')
                            ? 'PushTopic messages don’t map to a single SObject describe. Use the JSON view and the PushTopic query definition.'
                            : 'Select an /event/* or /data/* message to view schema.',
                };
                return;
            }

            this.schemaLoading = true;
            const cacheKey = apiName;
            if (this._schemaCache.has(cacheKey)) {
                const cached = this._schemaCache.get(cacheKey);
                this.schemaInfo = cached.schemaInfo;
                this.schemaFields = cached.schemaFields;
                return;
            }

            const describeResult = await this.connector.conn.sobject(apiName).describe();
            const schemaFields = this.formatDescribeFields(describeResult);
            const schemaInfo = {
                title: `${describeResult?.label || apiName} (${apiName})`,
                subtitle: `Fields: ${schemaFields.length}${describeResult?.keyPrefix ? ` • KeyPrefix: ${describeResult.keyPrefix}` : ''}`,
            };

            this._schemaCache.set(cacheKey, { schemaInfo, schemaFields });
            this.schemaInfo = schemaInfo;
            this.schemaFields = schemaFields;
        } catch (e) {
            this.schemaError = decodeError(e)?.message || e?.message || 'Failed to load schema';
        } finally {
            this.schemaLoading = false;
        }
    }

    /** Getters */

    get content() {
        const data = this._item?.content || this._item;
        return JSON.stringify(data, null, 4);
    }

    get defaultContainerClass() {
        return classSet('viewer-panel slds-scrollable_y')
            .add({ 'slds-hide': !(this.viewerTab === PLATFORM_EVENT.VIEWER_TABS.DEFAULT) })
            .toString();
    }

    get customContainerClass() {
        return classSet('slds-full-height slds-scrollable_y')
            .add({ 'slds-hide': !(this.viewerTab === PLATFORM_EVENT.VIEWER_TABS.CUSTOM) })
            .toString();
    }

    get jsonContainerClass() {
        return classSet('viewer-panel slds-scrollable_y')
            .add({ 'slds-hide': !(this.viewerTab === PLATFORM_EVENT.VIEWER_TABS.JSON) })
            .toString();
    }

    get schemaContainerClass() {
        return classSet('viewer-panel')
            .add({ 'slds-hide': !(this.viewerTab === PLATFORM_EVENT.VIEWER_TABS.SCHEMA) })
            .toString();
    }

    get isSchemaLoading() {
        return this.schemaLoading === true;
    }

    get hasSchemaFields() {
        return Array.isArray(this.schemaFields) && this.schemaFields.length > 0;
    }
}
