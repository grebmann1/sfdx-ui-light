import { wire, api } from 'lwc';
import ToolkitElement from 'core/toolkitElement';
import { getFlattenedFields } from '@jetstreamapp/soql-parser-js';
import { store, connectStore, SELECTORS, SOBJECT, UI } from 'core/store';
import { fullApiName, isSame, lowerCaseKey } from 'shared/utils';

const ROOT_LEVEL = 2;
const MAX_LEVEL = 4 + ROOT_LEVEL;

export default class RelationshipsTree extends ToolkitElement {
    @api sobject;

    sobjectMeta;
    relationshipsData = [];
    selectedId = '';
    _keyword;
    _rawRelationships = [];
    loadedChildrenByRelationshipId = {};
    requestedExpandedRefs = {};
    loadingRefIds = [];

    @api
    get keyword() {
        return this._keyword;
    }
    set keyword(value) {
        this._keyword = value;
    }

    @wire(connectStore, { store })
    storeChange({ application, sobject, ui }) {
        const isCurrentApp = this.verifyIsActive(application?.currentApplication);
        if (!isCurrentApp) return;

        const sobjectState = SELECTORS.sobject.selectById(
            { sobject },
            (this.sobject || '').toLowerCase()
        );
        if (!sobjectState) return;
        if (sobjectState.data) {
            this.sobjectMeta = sobjectState.data;
        }
        this._updateRelationships(ui?.query);
        this._updateLoadedChildren(sobject, ui?.query);
        this._updateLoadingRefIds(sobject);
    }

    _updateRelationships(query) {
        if (!this.sobjectMeta) return;
        const selectedRelationships = (query ? this._getFlattenedFields(query) : []).map(x =>
            (x || '').toLowerCase()
        );
        this._rawRelationships = (this.sobjectMeta.childRelationships || []).map(relation => ({
            ...relation,
            itemLabel: `${relation.relationshipName} / ${relation.childSObject}`,
            details: relation.childSObject,
            isActive: selectedRelationships.includes(
                (fullApiName(relation.relationshipName) || '').toLowerCase()
            ),
        }));
        this.relationshipsData = [...this._rawRelationships];
    }

    _getFlattenedFields(query) {
        return getFlattenedFields(query).map(field => fullApiName(field));
    }

    handleTreeSelect(event) {
        const item = event.detail?.item;
        if (!item?.rawName) return;
        if (item.rawName.includes('.')) {
            const [relationshipName, fieldName] = item.rawName.split('.');
            store.dispatch(
                UI.reduxSlice.actions.toggleField({
                    fieldName,
                    relationships: undefined,
                    childRelationship: relationshipName,
                })
            );
        } else {
            store.dispatch(
                UI.reduxSlice.actions.toggleRelationship({ relationshipName: item.rawName })
            );
        }
    }

    handleTreeToggle(event) {
        const item = event.detail?.item;
        if (!item?.isExpandable) return;
        const hasChildren = Array.isArray(item.children) && item.children.length > 0;
        if (hasChildren) return;
        this._loadChildrenForRelationship(item);
    }

    _loadChildrenForRelationship(item) {
        if (this.loadedChildrenByRelationshipId[item.id]) return;
        const { childSObject, relationshipName } = item;
        if (!childSObject) return;
        this.requestedExpandedRefs = {
            ...this.requestedExpandedRefs,
            [item.id]: { childSObject, relationshipName },
        };
        if (!this.loadingRefIds.includes(item.id)) {
            this.loadingRefIds = [...this.loadingRefIds, item.id];
        }
        const { describe } = store.getState();
        store.dispatch(
            SOBJECT.describeSObject({
                connector: this.connector.conn,
                sObjectName: childSObject,
                useToolingApi: describe.nameMap[lowerCaseKey(childSObject)]?.useToolingApi,
            })
        );
    }

    _updateLoadedChildren(sobjectState, query) {
        const nextLoaded = { ...this.loadedChildrenByRelationshipId };
        const loadingIds = new Set();
        for (const [relId, ref] of Object.entries(this.requestedExpandedRefs)) {
            if (nextLoaded[relId]) continue;
            const sobjectData = SELECTORS.sobject.selectById(
                { sobject: sobjectState },
                lowerCaseKey(ref.childSObject)
            );
            if (sobjectData?.isFetching) loadingIds.add(relId);
        }
        let updated = false;
        for (const [relId, ref] of Object.entries(this.requestedExpandedRefs)) {
            const sobjectData = SELECTORS.sobject.selectById(
                { sobject: sobjectState },
                lowerCaseKey(ref.childSObject)
            );
            if (!sobjectData?.data?.fields) continue;
            const relationshipName = ref.relationshipName;
            const selectedForSubquery = (
                query
                    ? (() => {
                          const subquery = query.fields.find(
                              field =>
                                  field.type === 'FieldSubquery' &&
                                  isSame(field.subquery?.relationshipName, relationshipName)
                          );
                          return subquery
                              ? getFlattenedFields(subquery.subquery).map(f => fullApiName(f))
                              : [];
                      })()
                    : []
            )
                .map(x => (x || '').toLowerCase());
            const childFields = sobjectData.data.fields.map(field => {
                const childRawName = `${relationshipName}.${field.name}`;
                const childId = lowerCaseKey(childRawName);
                const details = `${field.type.toUpperCase()} / ${field.label}`;
                const title = `${field.name} — ${details}`;
                return {
                    id: childId,
                    name: field.name,
                    title,
                    rawName: childRawName,
                    icon: 'utility:number_input',
                    isActive: selectedForSubquery.includes(childId),
                    isExpandable: false,
                    children: undefined,
                };
            });
            childFields.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
            nextLoaded[relId] = childFields;
            updated = true;
        }
        if (updated) {
            this.loadedChildrenByRelationshipId = nextLoaded;
        }
    }

    _updateLoadingRefIds(sobjectState) {
        const loading = [];
        for (const [relId, ref] of Object.entries(this.requestedExpandedRefs)) {
            if (this.loadedChildrenByRelationshipId[relId]) continue;
            const sobjectData = SELECTORS.sobject.selectById(
                { sobject: sobjectState },
                lowerCaseKey(ref.childSObject)
            );
            if (sobjectData?.isFetching) loading.push(relId);
        }
        this.loadingRefIds = loading;
    }

    get computedTree() {
        if (!this.relationshipsData || !this.relationshipsData.length) return [];
        return this.relationshipsData
            .filter(r => r.relationshipName)
            .map(relation => {
                const id = lowerCaseKey(relation.relationshipName);
                const title = relation.details
                    ? `${relation.relationshipName} — ${relation.details}`
                    : relation.relationshipName;
                const children = this.loadedChildrenByRelationshipId[id] || [];
                return {
                    id,
                    name: relation.itemLabel,
                    title,
                    rawName: relation.relationshipName,
                    icon: 'utility:record_lookup',
                    isActive: !!relation.isActive,
                    isExpandable: true,
                    childSObject: relation.childSObject,
                    relationshipName: relation.relationshipName,
                    children,
                    isLoadingChildren: this.loadingRefIds.includes(id),
                };
            });
    }

    get relationshipsSearchFields() {
        return ['name', 'title'];
    }

    get minSearchLength() {
        return 1;
    }

    get isNoRelationships() {
        return !this.computedTree.length;
    }
}
