import { api, wire } from 'lwc';
import ToolkitElement from 'core/toolkitElement';
import { NavigationContext, navigate } from 'lwr/navigation';
import { ensureMermaidLoaded } from 'shared/loader';
import { classSet, isEmpty, isNotUndefinedOrNull, isUndefinedOrNull } from 'shared/utils';
import LOGGER from 'shared/logger';
import Toast from 'lightning/toast';
/** Store */
import { store, SOBJECT } from 'core/store';
import { store as legacyStore, store_application } from 'shared/store';

const deepClone = obj => JSON.parse(JSON.stringify(obj));

export default class Sobject extends ToolkitElement {
    @wire(NavigationContext)
    navContext;

    isLoading = false;
    isNoRecord = false;

    fieldSearch = '';
    relationshipSearch = '';
    relationshipTab = 'lookups';

    page = 'code';

    openSections = {
        availableApis: true,
        relationships: true,
        fields: true,
    };

    recordDetails = {};
    selectedDetails;
    extraSelectedDetails = { totalRecords: null };

    isDiagramDisplayed = false;

    @api
    objectRecords = [];

    @api
    get recordName() {
        return this._recordName;
    }

    set recordName(value) {
        this._recordName = value;
        if (!isEmpty(value)) {
            this.loadSpecificRecord();
        }
    }

    connectedCallback() {
        this.loadFromCache();
    }

    /** Events */

    goToUrl = e => {
        const redirectUrl = e.currentTarget.dataset.url;
        legacyStore.dispatch(store_application.navigate(redirectUrl));
    };

    handleFieldSearch = (e) => {
        this.fieldSearch = (e.detail?.value || '').trim();
    };

    handleRelationshipSearch = (e) => {
        this.relationshipSearch = (e.detail?.value || '').trim();
    };

    handleDisplayDiagram = e => {
        this.isDiagramDisplayed = e.detail.checked;
        localStorage.setItem(`object-explorer-isDiagramDisplayed`, e.detail.checked);
    };

    handleRelationshipTabActive = (e) => {
        const value = e.target?.value;
        if (!isEmpty(value)) {
            this.relationshipTab = value;
        }
    };

    handlePageSelect = (e) => {
        const page = e.currentTarget?.dataset?.page;
        if (!isEmpty(page)) {
            this.page = page;
        }
    };

    handleToggleSection = (e) => {
        const section = e.currentTarget?.dataset?.section;
        if (isEmpty(section)) return;
        this.openSections = {
            ...this.openSections,
            [section]: !this.openSections[section],
        };
    };

    handleCopyValue = async (e) => {
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
        navigate(this.navContext, { type: 'application', state: { applicationName: 'soql', query } });
    };

    handleOpenRelatedSObject = (e) => {
        const name = e.currentTarget?.dataset?.name;
        if (isEmpty(name)) return;
        navigate(this.navContext, {
            type: 'application',
            state: {
                applicationName: 'sobject',
                attribute1: name,
            },
        });
    };

    loadSpecificRecord = async () => {
        this.reset();
        this.isLoading = true;
        await this.describeSpecific(this.recordName);
        this.isLoading = false;
    };

    /** Methods  **/

    loadFromCache = async () => {
        this.isDiagramDisplayed =
            localStorage.getItem(`object-explorer-isDiagramDisplayed`) === 'true';
    };

    reset = () => {
        this.isNoRecord = false;
        this.isLoading = false;
        this.fieldSearch = '';
        this.relationshipSearch = '';
        this.relationshipTab = 'lookups';
        this.page = 'code';
        this.openSections = {
            availableApis: true,
            relationships: true,
            fields: true,
        };
    };

    checkTotalRecords = async () => {
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

    describeSpecific = async name => {
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

    enrichSelectedDetails = (data) => {
        (data.fields || []).forEach((field) => {
            const isFormula = field?.calculated === true;
            const isPicklist = field?.type === 'picklist' || field?.type === 'multipicklist';

            field._isFormula = isFormula;
            field._isPicklist = isPicklist;

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
            const values = (field?.picklistValues || []).filter((x) => x && x.active !== false);
            const labels = values.map((x) => x.label || x.value).filter((x) => !isEmpty(x));
            field._picklistValuesRaw = labels.join(', ');
            field._picklistCount = labels.length;
            field._picklistCountLabel = `${labels.length} value${labels.length === 1 ? '' : 's'}`;
            field._picklistValuesPreview =
                labels.length > 10 ? `${labels.slice(0, 10).join(', ')} …(+${labels.length - 10})` : field._picklistValuesRaw;
        });
        return data;
    };

    checkIfPresent = (a, b) => {
        return (a || '').toLowerCase().includes((b || '').toLowerCase());
    };

    buildUML = async () => {
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
            (x) =>
                this.checkIfPresent(x.name, search) ||
                this.checkIfPresent(x.label, search) ||
                this.checkIfPresent(x._type, search)
        );
    }

    get lookups() {
        if (!this.isDetailDisplayed) return [];
        const fields = this.selectedDetails.fields || [];
        const refs = fields.filter((f) => f.type === 'reference' && f.referenceTo?.length > 0);
        return refs
            .map((f) => {
                const target = f.referenceTo?.[0] || 'Unknown';
                return {
                    key: `${f.name}:${target}`,
                    label: f.label || f.name,
                    fieldName: f.name,
                    target,
                };
            })
            .sort((a, b) => a.label.localeCompare(b.label));
    }

    get filteredLookups() {
        const search = (this.relationshipSearch || '').trim();
        if (isEmpty(search)) return this.lookups;
        return this.lookups.filter(
            (x) =>
                this.checkIfPresent(x.label, search) ||
                this.checkIfPresent(x.fieldName, search) ||
                this.checkIfPresent(x.target, search)
        );
    }

    get children() {
        if (!this.isDetailDisplayed) return [];
        return (this.selectedDetails.childRelationships || [])
            .filter((x) => !isEmpty(x.relationshipName))
            .map((x) => ({
                ...x,
                key: `${x.childSObject}:${x.relationshipName}:${x.field}`,
            }))
            .sort((a, b) => (a.relationshipName || '').localeCompare(b.relationshipName || ''));
    }

    get filteredChildren() {
        const search = (this.relationshipSearch || '').trim();
        if (isEmpty(search)) return this.children;
        return this.children.filter(
            (x) =>
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
        return map.filter((x) => this.selectedDetails?.[x.key] === true);
    }

    get availableApisCount() {
        return this.availableApis.length;
    }

    get isCodePage() {
        return this.page === 'code';
    }

    get codeButtonVariant() {
        return this.isCodePage ? 'brand' : 'neutral';
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
