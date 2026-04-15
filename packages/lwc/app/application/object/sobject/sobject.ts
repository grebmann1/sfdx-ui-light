import { api, wire, track } from 'lwc';
import ToolkitElement from 'core/toolkitElement';
import { NavigationContext, navigate } from 'lwr/navigation';
import { ensureMermaidLoaded } from 'shared/loader';
import { classSet, isEmpty, isNotUndefinedOrNull, isUndefinedOrNull } from 'shared/utils';
import LOGGER from 'shared/logger';
import Toast from 'lightning/toast';
/** Store */
import { store, SOBJECT } from 'core/store';
import { store as legacyStore, store_application } from 'shared/store';
import { getFieldTypeIcon, API_COLORS } from './constants';

const deepClone = (obj: Record<string, any>) => JSON.parse(JSON.stringify(obj));
type AnyRecord = Record<string, any>;

export default class Sobject extends ToolkitElement {
    _recordName: string | null = null;
    @wire(NavigationContext)
    navContext: any;

    isLoading = false;
    isNoRecord = false;

    @track fieldSearch = '';
    @track relationshipSearch = '';
    @track expandedFieldKey: string | null = null;
    relationshipTab = 'lookups';

    openSections = {
        availableApis: true,
        relationships: true,
        fields: true,
    };

    recordDetails: AnyRecord = {};
    selectedDetails: AnyRecord | null = null;
    extraSelectedDetails: { totalRecords: number | null } = { totalRecords: null };

    isDiagramDisplayed = false;

    @api
    objectRecords: AnyRecord[] = [];

    @api
    get recordName(): string | null {
        return this._recordName;
    }

    set recordName(value: string | null) {
        this._recordName = value;
        if (!isEmpty(value)) {
            this.loadSpecificRecord();
        }
    }

    connectedCallback() {
        this.loadFromCache();
    }

    /** Events */

    goToUrl = (e: any): void => {
        const redirectUrl = e.currentTarget.dataset.url;
        legacyStore.dispatch(store_application.navigate(redirectUrl));
    };

    handleFieldSearch = (e: any): void => {
        this.fieldSearch = (e.detail?.value || '').trim();
    };

    handleRelationshipSearch = (e: any): void => {
        this.relationshipSearch = (e.detail?.value || '').trim();
    };

    handleToggleFieldExpand = (e: any): void => {
        const key = e.currentTarget.dataset.key;
        this.expandedFieldKey = this.expandedFieldKey === key ? null : key;
    };

    handleCloseFieldDetail = (): void => {
        this.expandedFieldKey = null;
    };

    handleDisplayDiagram = (e: any): void => {
        this.isDiagramDisplayed = e.detail.checked;
        localStorage.setItem(`object-explorer-isDiagramDisplayed`, e.detail.checked);
    };

    handleRelationshipTabActive = (e: any): void => {
        const value = e.target?.value;
        if (!isEmpty(value)) {
            this.relationshipTab = value;
        }
    };

    handleToggleSection = (e: any): void => {
        const section = e.currentTarget?.dataset?.section;
        if (isEmpty(section)) return;
        this.openSections = {
            ...this.openSections,
            [section]: !this.openSections[section],
        };
    };

    handleCopyValue = async (e: any): Promise<void> => {
        const value = e.currentTarget?.dataset?.value;
        if (isEmpty(value)) return;
        try {
            await navigator.clipboard.writeText(value);
            Toast.show({ label: 'Copied to clipboard', variant: 'success' });
        } catch (err) {
            LOGGER.warn('Copy failed', err);
            Toast.show({ label: 'Copy failed', variant: 'error' });
        }
    };

    handleOpenQuery = () => {
        if (isUndefinedOrNull(this.selectedDetails?.name)) return;
        const query = `Select Id from ${this.selectedDetails.name}`;
        navigate(this.navContext, {
            type: 'application',
            state: { applicationName: 'soql', query },
        });
    };

    handleOpenRelatedSObject = (e: any): void => {
        const name = e.currentTarget?.dataset?.name;
        if (isEmpty(name)) return;
        this.openRelatedSObject(name);
    };

    openRelatedSObject(name: string): void {
        if (isEmpty(name)) return;
        navigate(this.navContext, {
            type: 'application',
            state: {
                applicationName: 'sobject',
                attribute1: name,
            },
        });
    }

    handleLookupTreeSelect(event: any): void {
        const item = event.detail?.item;
        if (item?.rawName) this.openRelatedSObject(item.rawName);
    }

    handleChildTreeSelect(event: any): void {
        const item = event.detail?.item;
        if (item?.rawName) this.openRelatedSObject(item.rawName);
    }

    handleFieldTreeSelect(event: any): void {
        const item = event.detail?.item;
        if (isEmpty(item?.rawName)) return;
        navigator.clipboard.writeText(item.rawName).then(
            () => Toast.show({ label: 'Copied to clipboard', variant: 'success' }),
            () => Toast.show({ label: 'Copy failed', variant: 'error' })
        );
    }

    loadSpecificRecord = async (): Promise<void> => {
        this.reset();
        this.isLoading = true;
        await this.describeSpecific(this.recordName);
        this.isLoading = false;
    };

    /** Methods  **/

    loadFromCache = async (): Promise<void> => {
        this.isDiagramDisplayed =
            localStorage.getItem(`object-explorer-isDiagramDisplayed`) === 'true';
    };

    reset = (): void => {
        this.isNoRecord = false;
        this.isLoading = false;
        this.fieldSearch = '';
        this.relationshipSearch = '';
        this.relationshipTab = 'lookups';
        this.openSections = {
            availableApis: true,
            relationships: true,
            fields: true,
        };
    };

    checkTotalRecords = async (): Promise<void> => {
        this.extraSelectedDetails = { totalRecords: 0 };
        try {
            const res = await this.connector.conn.query(
                `SELECT Count(Id) total FROM ${this.selectedDetails.name}`
            );
            const total = res?.records?.[0]?.total;
            // IMPORTANT: replace object to trigger re-render
            this.extraSelectedDetails = { ...this.extraSelectedDetails, totalRecords: total };
        } catch (e) {
            console.error('checkTotalRecords', e);
            this.extraSelectedDetails = { ...this.extraSelectedDetails, totalRecords: null };
        }
    };

    describeSpecific = async (name: string): Promise<void> => {
        try {
            const sobjectConfig = (
                await store.dispatch(
                    SOBJECT.describeSObject({
                        connector: this.connector.conn,
                        sObjectName: name,
                        useToolingApi: false,
                    })
                )
            ).payload;
            LOGGER.debug('sobjectConfig', sobjectConfig);
            this.selectedDetails = this.enrichSelectedDetails(deepClone(sobjectConfig.data));
            //console.log('this.selectedDetails',this.selectedDetails);
            this.checkTotalRecords();
            setTimeout(() => {
                this.buildUML();
            }, 100);
        } catch (e) {
            console.error(e);
            this.isNoRecord = true;
        }
    };

    enrichSelectedDetails = (data: AnyRecord): AnyRecord => {
        (data.fields || []).forEach(field => {
            const isFormula = field?.calculated === true;
            const isPicklist = field?.type === 'picklist' || field?.type === 'multipicklist';

            field._isFormula = isFormula;
            field._isPicklist = isPicklist;
            field._isRequired = field.nillable === false && field.createable === true && field.defaultedOnCreate !== true;
            field._hasExtra = isFormula || isPicklist || field.unique === true || field.externalId === true || !isEmpty(field.inlineHelpText);
            field._iconName = getFieldTypeIcon(field.type).replace('lucide:', '');

            // Type label
            field._type = isFormula ? `fx: ${field.type}` : field.type;

            // Formula helpers
            const formula = field?.calculatedFormula || '';
            field._formulaRaw = formula;
            field._formulaPreview = isEmpty(formula)
                ? ''
                : formula.length > 120
                  ? `${formula.slice(0, 120)}…`
                  : formula;

            // Picklist helpers
            const values = (field?.picklistValues || []).filter(x => x && x.active !== false);
            const labels = values.map(x => x.label || x.value).filter(x => !isEmpty(x));
            field._picklistValuesRaw = labels.join(', ');
            field._picklistCount = labels.length;
            field._picklistCountLabel = `${labels.length} value${labels.length === 1 ? '' : 's'}`;
            field._picklistValuesPreview =
                labels.length > 10
                    ? `${labels.slice(0, 10).join(', ')} …(+${labels.length - 10})`
                    : field._picklistValuesRaw;
        });
        return data;
    };

    checkIfPresent = (a: string, b: string): boolean => {
        return (a || '').toLowerCase().includes((b || '').toLowerCase());
    };

    buildUML = async (): Promise<void> => {
        if (!this.refs?.mermaid) return;
        const mermaid = await ensureMermaidLoaded();
        if (!mermaid) return;
        this.refs.mermaid.innerHTML = '';
        const source = this.selectedDetails.name;
        const result = ['classDiagram', 'direction LR', `class \`${source}\``];
        const interactions = [`click \`${source}\` call mermaidCallback()`];
        // Filter to take only fields with "Refer To"
        const references = this.selectedDetails.fields.filter(x => x.type === 'reference');
        references.forEach(field => {
            field.referenceTo.forEach(target => {
                result.push(
                    `\`${source}\` --> \`${target || 'Undefined'}\` : ${field.relationshipName}`
                );
            });
        });
        /*
        const relationships = this.selectedDetails.childRelationships.filter(x => !x.deprecatedAndHidden);
        relationships.forEach(item => {
            result.push(`\`${item.childSObject}\` --> \`${source}\` : ${item.field}`);
        });
        */
        //console.log('r',[].concat(result,interactions).join('\n'));
        const { svg, bindFunctions } = await mermaid.render(
            'graphDiv',
            [].concat(result, interactions).join('\n')
        );
        this.refs.mermaid.innerHTML = svg;
        if (bindFunctions) {
            bindFunctions(this.refs.mermaid);
        }
    };
    /** Getters **/

    get noRecordMessage() {
        return `${this.recordName} wasn't found in your metadata.`;
    }

    get filteredFields() {
        if (!this.isDetailDisplayed) return [];
        const search = (this.fieldSearch || '').trim();
        if (isEmpty(search)) return this.selectedDetails.fields || [];
        return (this.selectedDetails.fields || []).filter(
            x =>
                this.checkIfPresent(x.name, search) ||
                this.checkIfPresent(x.label, search) ||
                this.checkIfPresent(x._type, search)
        );
    }

    get filteredFieldsWithMeta() {
        const expandedKey = this.expandedFieldKey;
        return this.filteredFields.map(f => {
            const isExpanded = f.name === expandedKey;
            return {
                ...f,
                _isExpanded: isExpanded,
                _rowClass: isExpanded ? 'row-expanded' : '',
                _expandBtnClass: isExpanded ? 'extra-toggle-btn is-active' : 'extra-toggle-btn',
            };
        });
    }

    get expandedField(): AnyRecord | null {
        if (!this.expandedFieldKey || !this.selectedDetails) return null;
        return (this.selectedDetails.fields || []).find((f: AnyRecord) => f.name === this.expandedFieldKey) || null;
    }

    get expandedFieldCapabilities() {
        const f = this.expandedField;
        if (!f) return [];
        const caps = [];
        if (f.createable) caps.push({ key: 'createable', label: 'Createable', cls: 'cap-green' });
        if (f.updateable) caps.push({ key: 'updateable', label: 'Updateable', cls: 'cap-green' });
        if (f.filterable) caps.push({ key: 'filterable', label: 'Filterable', cls: 'cap-blue' });
        if (f.sortable) caps.push({ key: 'sortable', label: 'Sortable', cls: 'cap-blue' });
        if (f.groupable) caps.push({ key: 'groupable', label: 'Groupable', cls: 'cap-blue' });
        if (f.unique) caps.push({ key: 'unique', label: 'Unique', cls: 'cap-purple' });
        if (f.externalId) caps.push({ key: 'externalId', label: 'External ID', cls: 'cap-purple' });
        if (!f.nillable) caps.push({ key: 'notnull', label: 'Not Null', cls: 'cap-red' });
        return caps;
    }

    get expandedFieldHelpText(): string {
        return this.expandedField?.inlineHelpText || '';
    }

    get lookups() {
        if (!this.isDetailDisplayed) return [];
        const fields = this.selectedDetails.fields || [];
        const refs = fields.filter(f => f.type === 'reference' && f.referenceTo?.length > 0);
        return refs
            .map(f => {
                const target = f.referenceTo?.[0] || 'Unknown';
                return {
                    key: `${f.name}:${target}`,
                    label: f.label || f.name,
                    fieldName: f.name,
                    relationshipName: f.relationshipName || '',
                    target,
                };
            })
            .sort((a, b) => a.label.localeCompare(b.label));
    }

    get filteredLookups() {
        const search = (this.relationshipSearch || '').trim();
        if (isEmpty(search)) return this.lookups;
        return this.lookups.filter(
            x =>
                this.checkIfPresent(x.label, search) ||
                this.checkIfPresent(x.fieldName, search) ||
                this.checkIfPresent(x.relationshipName, search) ||
                this.checkIfPresent(x.target, search)
        );
    }

    get children() {
        if (!this.isDetailDisplayed) return [];
        return (this.selectedDetails.childRelationships || [])
            .filter(x => !isEmpty(x.relationshipName))
            .map(x => ({
                ...x,
                key: `${x.childSObject}:${x.relationshipName}:${x.field}`,
            }))
            .sort((a, b) => (a.relationshipName || '').localeCompare(b.relationshipName || ''));
    }

    get filteredChildren() {
        const search = (this.relationshipSearch || '').trim();
        if (isEmpty(search)) return this.children;
        return this.children.filter(
            x =>
                this.checkIfPresent(x.relationshipName, search) ||
                this.checkIfPresent(x.field, search) ||
                this.checkIfPresent(x.childSObject, search)
        );
    }

    get isDetailDisplayed() {
        return isNotUndefinedOrNull(this.selectedDetails);
    }

    get hasNoFields() {
        return this.filteredFields.length === 0;
    }

    get hasNoLookups() {
        return this.filteredLookups.length === 0;
    }

    get hasNoChildren() {
        return this.filteredChildren.length === 0;
    }

    get fieldsCount() {
        return (this.selectedDetails?.fields || []).length;
    }

    get relationshipsCount() {
        return this.lookups.length + this.children.length;
    }

    get availableApis() {
        if (!this.isDetailDisplayed) return [];
        const map = [
            { key: 'queryable', label: 'Queryable' },
            { key: 'searchable', label: 'Searchable' },
            { key: 'layoutable', label: 'Layoutable' },
            { key: 'retrieveable', label: 'Retrieveable' },
            { key: 'createable', label: 'Createable' },
            { key: 'updateable', label: 'Updateable' },
            { key: 'deletable', label: 'Deletable' },
        ];
        return map
            .filter(x => this.selectedDetails?.[x.key] === true)
            .map(x => ({
                ...x,
                colorClass: `api-badge ${API_COLORS[x.key] || 'badge-teal'}`,
            }));
    }

    get availableApisCount() {
        return this.availableApis.length;
    }

    get isAvailableApisOpen() {
        return this.openSections.availableApis === true;
    }

    get isRelationshipsOpen() {
        return this.openSections.relationships === true;
    }

    get isFieldsOpen() {
        return this.openSections.fields === true;
    }

    get availableApisSectionClass() {
        return classSet('slds-section')
            .add({ 'slds-is-open': this.isAvailableApisOpen })
            .toString();
    }

    get relationshipsSectionClass() {
        return classSet('slds-section slds-m-top_small')
            .add({ 'slds-is-open': this.isRelationshipsOpen })
            .toString();
    }

    get fieldsSectionClass() {
        return classSet('slds-section slds-m-top_small')
            .add({ 'slds-is-open': this.isFieldsOpen })
            .toString();
    }

    get availableApisChevronIcon() {
        return this.isAvailableApisOpen ? 'utility:chevrondown' : 'utility:chevronright';
    }

    get relationshipsChevronIcon() {
        return this.isRelationshipsOpen ? 'utility:chevrondown' : 'utility:chevronright';
    }

    get fieldsChevronIcon() {
        return this.isFieldsOpen ? 'utility:chevrondown' : 'utility:chevronright';
    }

    get keyPrefixFormatted() {
        return this.selectedDetails?.keyPrefix || 'N/A';
    }

    get keyPrefixCopyValue() {
        return this.selectedDetails?.keyPrefix || null;
    }

    get totalRecordsFormatted() {
        const total = this.extraSelectedDetails?.totalRecords;
        if (total === undefined || total === null) return '—';
        return `${total}`;
    }

    get objectKindLabel() {
        return this.selectedDetails?.custom ? 'CUSTOM' : 'STANDARD';
    }

    get fieldUrl() {
        return `/lightning/setup/ObjectManager/${this.selectedDetails.name}/FieldsAndRelationships/view`;
    }

    get recordTypeUrl() {
        return `/lightning/setup/ObjectManager/${this.selectedDetails.name}/RecordTypes/view`;
    }

    get setupUrl() {
        return `/lightning/setup/ObjectManager/${this.selectedDetails.name}/Details/view`;
    }

    get layoutsUrl() {
        return `/lightning/setup/ObjectManager/${this.selectedDetails.name}/PageLayouts/view`;
    }

    get listViewsUrl() {
        return `/lightning/setup/ObjectManager/${this.selectedDetails.name}/ListViews/view`;
    }

    get mermaidClass() {
        return classSet('mermaid')
            .add({
                'slds-hide': !this.isDiagramDisplayed,
            })
            .toString();
    }
}
