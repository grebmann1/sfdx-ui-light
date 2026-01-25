import { api, wire, track } from 'lwc';
import ToolkitElement from 'core/toolkitElement';
import { store, connectStore, SELECTORS, DESCRIBE, SOBJECT, DOCUMENT, APPLICATION } from 'core/store';
import { CATEGORY_STORAGE } from 'builder/storagePanel';
import SaveModal from 'builder/saveModal';
import Toast from 'lightning/toast';
import { lowerCaseKey, isUndefinedOrNull, isNotUndefinedOrNull, guid } from 'shared/utils';
import Analytics from 'shared/analytics';
import { loadSingleExtensionConfigFromCache, saveExtensionConfigToCache, CACHE_CONFIG } from 'shared/cacheManager';

export default class App extends ToolkitElement {
    @api namespace;

    // UI state
    @track isLeftToggled = true;
    @track isRecentToggled = false;

    // Saved/Recent
    @track savedShortcuts = [];

    // Builder state
    @track shortcutName = '';
    @track isGlobal = true;
    @track mode = 'link'; // 'link' | 'expression' | 'record'
    @track linkValue = '';
    @track expressionValue = '';
    @track selectedSObject = null;
    @track pairs = []; // [{ fieldName, value, type }]

    // Describe cache
    _sobjectMeta = null;

    connectedCallback() {
        Analytics.trackAppOpen('shortcut', { alias: this.alias });
        // Load sobject globals (names/prefixes)
        store.dispatch(
            DESCRIBE.describeSObjects({
                connector: this.connector.conn,
            })
        );
        // Load saved shortcuts from storage
        store.dispatch(
            DOCUMENT.reduxSlices.SHORTCUTFILE.actions.loadFromStorage({
                alias: this.alias,
            })
        );
    }

    @wire(connectStore, { store })
    handleStoreChange({ application, describe, sobject, shortcutFiles }) {
        const isCurrentApp = this.verifyIsActive(application.currentApplication);
        if (!isCurrentApp) return;

        // Saved shortcuts (global + org)
        if (shortcutFiles) {
            const entities = SELECTORS.shortcutFiles.selectAll({ shortcutFiles });
            this.savedShortcuts = entities
                .filter(item => item.isGlobal || item.alias == this.alias)
                .map(i => i);
        }

        // Update current SObject meta when available
        if (this.selectedSObject) {
            const sobjectState = SELECTORS.sobject.selectById(
                { sobject },
                lowerCaseKey(this.selectedSObject)
            );
            this._sobjectMeta = sobjectState?.data || null;
        }
    }

    /** Events **/

    handleModeChange = e => {
        this.mode = e.detail.value;
    };

    handleNameChange = e => {
        this.shortcutName = e.target.value || '';
    };

    handleIsGlobalChange = e => {
        this.isGlobal = e.target.checked === true;
    };

    handleLinkChange = e => {
        this.linkValue = e.target.value || '';
    };

    handleExpressionChange = e => {
        this.expressionValue = e.target.value || '';
    };

    handleSObjectChange = e => {
        this.selectedSObject = e.detail.value || null;
        this.pairs = [];
        if (this.selectedSObject) {
            const { describe } = store.getState();
            store.dispatch(
                SOBJECT.describeSObject({
                    connector: this.connector.conn,
                    sObjectName: this.selectedSObject,
                    useToolingApi: describe.nameMap[lowerCaseKey(this.selectedSObject)]?.useToolingApi,
                })
            );
        }
    };

    handleAddPair = () => {
        if (!this._sobjectMeta) return;
        this.pairs = [
            ...this.pairs,
            {
                id: guid(),
                fieldName: null,
                type: null,
                value: null,
                picklistValues: null,
                isBoolean: false,
                isReference: false,
                isDate: false,
                isDateTime: false,
                isNumber: false,
                isText: true,
            },
        ];
    };

    handleRemovePair = e => {
        const { id } = e.currentTarget.dataset;
        this.pairs = this.pairs.filter(p => p.id !== id);
    };

    handleFieldChange = e => {
        const { id } = e.currentTarget.dataset;
        const fieldName = e.detail.value;
        const field = (this._sobjectMeta?.fields || []).find(f => f.name === fieldName);
        this.pairs = this.pairs.map(p => {
            if (p.id !== id) return p;
            const type = field?.type || null;
            return {
                ...p,
                fieldName,
                type,
                value: null,
                picklistValues: Array.isArray(field?.picklistValues)
                    ? field.picklistValues.filter(v => v.active).map(v => ({ value: v.value, label: v.label || v.value }))
                    : null,
                isBoolean: type === 'boolean',
                isReference: type === 'reference',
                isDate: type === 'date',
                isDateTime: type === 'datetime',
                isNumber: type === 'int' || type === 'double' || type === 'currency' || type === 'percent',
                isText: !['boolean', 'reference', 'date', 'datetime', 'int', 'double', 'currency', 'percent', 'picklist', 'multipicklist'].includes(type),
            };
        });
    };

    handleValueChange = e => {
        const { id } = e.currentTarget.dataset;
        const value = e.detail?.value ?? e.target?.value ?? null;
        this.pairs = this.pairs.map(p => (p.id === id ? { ...p, value } : p));
    };

    /** Save/Load **/

    handleSaveClick = () => {
        SaveModal.open({
            title: 'Save Shortcut',
            _file: null,
        }).then(async data => {
            if (isUndefinedOrNull(data)) return;
            const { name, isGlobal } = data;
            await this._saveShortcut(name, isGlobal);
            Toast.show({ label: 'Shortcut saved', variant: 'success' });
        });
    };

    _saveShortcut = async (name, isGlobal) => {
        const payload = {
            id: name,
            isGlobal,
            alias: this.alias,
            content: this._buildShortcutContent(),
            extra: {},
        };
        await store.dispatch(DOCUMENT.reduxSlices.SHORTCUTFILE.actions.upsertOne(payload));
        // Persist for extension consumption
        try {
            if (isGlobal) {
                const current =
                    (await loadSingleExtensionConfigFromCache(CACHE_CONFIG.SHORTCUTS_GLOBAL.key)) ||
                    [];
                const next = [
                    ...current.filter(item => item.id !== name),
                    { id: name, name, type: payload.content.type, content: payload.content },
                ];
                await saveExtensionConfigToCache({ [CACHE_CONFIG.SHORTCUTS_GLOBAL.key]: next });
            } else {
                const currentMap =
                    (await loadSingleExtensionConfigFromCache(CACHE_CONFIG.SHORTCUTS_BY_ORG.key)) ||
                    {};
                const list = Array.isArray(currentMap[this.alias]) ? currentMap[this.alias] : [];
                const nextList = [
                    ...list.filter(item => item.id !== name),
                    { id: name, name, type: payload.content.type, content: payload.content },
                ];
                const updated = { ...currentMap, [this.alias]: nextList };
                await saveExtensionConfigToCache({ [CACHE_CONFIG.SHORTCUTS_BY_ORG.key]: updated });

                // Also persist by domain (for the Chrome extension which may not know alias)
                const domain =
                    (() => {
                        try {
                            const url = new URL(this.connector?.conn?.instanceUrl || '');
                            return url.hostname;
                        } catch (e) {
                            return null;
                        }
                    })() || 'unknown';
                const byDomainMap =
                    (await loadSingleExtensionConfigFromCache(CACHE_CONFIG.SHORTCUTS_BY_DOMAIN.key)) ||
                    {};
                const domainList = Array.isArray(byDomainMap[domain]) ? byDomainMap[domain] : [];
                const nextDomainList = [
                    ...domainList.filter(item => item.id !== name),
                    { id: name, name, type: payload.content.type, content: payload.content },
                ];
                const updatedByDomain = { ...byDomainMap, [domain]: nextDomainList };
                await saveExtensionConfigToCache({
                    [CACHE_CONFIG.SHORTCUTS_BY_DOMAIN.key]: updatedByDomain,
                });
            }
        } catch (e) {
            // Non-blocking
            // eslint-disable-next-line no-console
            console.warn('Failed to persist shortcuts to cache', e);
        }
    };

    handleSelectItem = e => {
        e.stopPropagation();
        const { id, content, category } = e.detail;
        if (category === CATEGORY_STORAGE.SAVED) {
            this._loadShortcutContent(content);
        } else {
            console.warn(`${category} not supported !`);
        }
    };

    handleRemoveItem = e => {
        e.stopPropagation();
        const { id } = e.detail;
        store.dispatch(DOCUMENT.reduxSlices.SHORTCUTFILE.actions.removeOne(id));
    };

    _buildShortcutContent() {
        if (this.mode === 'link') {
            return {
                type: 'link',
                data: { url: (this.linkValue || '').trim() },
            };
        }
        if (this.mode === 'expression') {
            return {
                type: 'expression',
                data: { expression: (this.expressionValue || '').trim() },
            };
        }
        // record
        const entries = this.pairs
            .filter(p => p.fieldName && isNotUndefinedOrNull(p.value))
            .map(p => [p.fieldName, p.value]);
        const queryString = entries
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
            .join('&');
        return {
            type: 'record',
            data: {
                sobject: this.selectedSObject,
                params: entries,
                queryString,
            },
        };
    }

    _loadShortcutContent(content) {
        const type = content?.type || 'link';
        this.mode = type;
        if (type === 'link') {
            this.linkValue = content?.data?.url || '';
        } else if (type === 'expression') {
            this.expressionValue = content?.data?.expression || '';
        } else if (type === 'record') {
            this.selectedSObject = content?.data?.sobject || null;
            const pairs = Array.isArray(content?.data?.params) ? content.data.params : [];
            // Ensure the describe is loaded
            if (this.selectedSObject) {
                const { describe } = store.getState();
                store.dispatch(
                    SOBJECT.describeSObject({
                        connector: this.connector.conn,
                        sObjectName: this.selectedSObject,
                        useToolingApi: describe.nameMap[lowerCaseKey(this.selectedSObject)]?.useToolingApi,
                    })
                );
            }
            // Map pairs to UI structure
            this.pairs = pairs.map(([fieldName, value]) => ({
                id: guid(),
                fieldName,
                value,
                type: null,
                picklistValues: null,
                isBoolean: false,
                isReference: false,
                isDate: false,
                isDateTime: false,
                isNumber: false,
                isText: true,
            }));
        }
    }

    /** Getters **/

    get sobjectsOptions() {
        const { describe } = store.getState();
        const values = Object.values(describe.nameMap || {});
        return values
            .map(s => ({ value: s.name, label: `${s.name} • ${s.label}` }))
            .sort((a, b) => (a.label > b.label ? 1 : -1));
    }

    get fieldsOptions() {
        const fields = this._sobjectMeta?.fields || [];
        return fields.map(f => ({ value: f.name, label: `${f.name} • ${f.label}` }));
    }

    get isRecordMode() {
        return this.mode === 'record';
    }

    get isLinkMode() {
        return this.mode === 'link';
    }

    get isExpressionMode() {
        return this.mode === 'expression';
    }

    get modeOptions() {
        return [
            { label: 'Link', value: 'link' },
            { label: 'Expression', value: 'expression' },
            { label: 'Record-based', value: 'record' },
        ];
        }

    get generatedQueryString() {
        if (!this.isRecordMode) return '';
        const valid = this.pairs.filter(p => p.fieldName && isNotUndefinedOrNull(p.value));
        if (!valid.length) return '';
        return valid
            .map(p => `${encodeURIComponent(p.fieldName)}=${encodeURIComponent(p.value)}`)
            .join('&');
    }

    get pageClass() {
        return super.pageClass + ' slds-p-around_small';
    }
}


