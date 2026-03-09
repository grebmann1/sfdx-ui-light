import { wire, api } from 'lwc';
import ToolkitElement from 'core/toolkitElement';
import { getFlattenedFields } from '@jetstreamapp/soql-parser-js';
import { store, connectStore, SELECTORS, SOBJECT, UI } from 'core/store';
import { fullApiName, isSame, lowerCaseKey } from 'shared/utils';

export default class FieldsTree extends ToolkitElement {
    @api relationship;
    @api childrelation;
    @api rootlevel = 1;

    sobjectMeta;
    fieldsData = [];
    isLoading = false;
    selectedId = '';
    _keyword;
    _rawFields = [];
    loadedChildrenByFieldId = {};
    requestedExpandedRefs = {};
    loadingRefIds = [];

    @api
    get keyword() {
        return this._keyword;
    }
    set keyword(value) {
        this._keyword = value;
    }

    @api
    get sobject() {
        return this._sobject;
    }
    set sobject(value) {
        if (this._sobject !== value) {
            this._sobject = value;
            this.updateFieldTree();
        }
    }

    @wire(connectStore, { store })
    storeChange({ ui, application }) {
        const isCurrentApp = this.verifyIsActive(application?.currentApplication);
        if (!isCurrentApp) return;

        this.updateFieldTree();
    }

    updateFieldTree = () => {
        const { sobject, ui } = store.getState();

        const sobjectState = SELECTORS.sobject.selectById({ sobject }, lowerCaseKey(this.sobject));
        if (!sobjectState) return;

        this.isLoading = sobjectState.isFetching;
        if (sobjectState.data) {
            this.sobjectMeta = sobjectState.data;
        }
        this._updateFields(ui.query, ui.sort);
        this._updateLoadedChildren(sobject, ui?.query);
        this._updateLoadingRefIds(sobject);
    };

    _updateLoadingRefIds(sobjectState) {
        const loading = [];
        for (const [fieldId, ref] of Object.entries(this.requestedExpandedRefs)) {
            if (this.loadedChildrenByFieldId[fieldId]) continue;
            const sobjectData = SELECTORS.sobject.selectById(
                { sobject: sobjectState },
                lowerCaseKey(ref.relationshipSObjectName)
            );
            if (sobjectData?.isFetching) {
                loading.push(fieldId);
            }
        }
        this.loadingRefIds = loading;
    }

    connectedCallback() {
        const { describe } = store.getState();
        store.dispatch(
            SOBJECT.describeSObject({
                connector: this.connector.conn,
                sObjectName: this.sobject,
                useToolingApi: describe.nameMap[lowerCaseKey(this.sobject)]?.useToolingApi,
            })
        );
    }

    handleTreeSelect(event) {
        const item = event.detail?.item;
        if (!item?.rawName) return;
        const parts = item.rawName.split('.');
        const fieldName = parts.pop();
        const relationships = parts.length > 0 ? parts.join('.') : this.relationship;
        store.dispatch(
            UI.reduxSlice.actions.toggleField({
                fieldName,
                relationships: relationships || undefined,
                childRelationship: this.childrelation,
            })
        );
    }

    handleTreeToggle(event) {
        const item = event.detail?.item;
        if (!item?.isExpandable) return;
        const hasChildren = Array.isArray(item.children) && item.children.length > 0;
        if (hasChildren) return;
        this._loadChildrenForReference(item);
    }

    _loadChildrenForReference(item) {
        if (this.loadedChildrenByFieldId[item.id]) return;
        const { relationshipSObjectName, relationshipPath } = item;
        if (!relationshipSObjectName) return;
        this.requestedExpandedRefs = {
            ...this.requestedExpandedRefs,
            [item.id]: { relationshipSObjectName, relationshipPath },
        };
        if (!this.loadingRefIds.includes(item.id)) {
            this.loadingRefIds = [...this.loadingRefIds, item.id];
        }
        const { describe } = store.getState();
        store.dispatch(
            SOBJECT.describeSObject({
                connector: this.connector.conn,
                sObjectName: relationshipSObjectName,
                useToolingApi: describe.nameMap[lowerCaseKey(relationshipSObjectName)]?.useToolingApi,
            })
        );
    }

    _updateLoadedChildren(sobjectState, query) {
        const nextLoaded = { ...this.loadedChildrenByFieldId };
        const rootLevelNum = parseInt(this.rootlevel, 10);
        const maxLevel = 4 + rootLevelNum;
        const loadingIds = new Set();
        for (const [fieldId, ref] of Object.entries(this.requestedExpandedRefs)) {
            if (nextLoaded[fieldId]) continue;
            const sobjectData = SELECTORS.sobject.selectById(
                { sobject: sobjectState },
                lowerCaseKey(ref.relationshipSObjectName)
            );
            if (sobjectData?.isFetching) loadingIds.add(fieldId);
        }
        const entries = Object.entries(this.requestedExpandedRefs).sort(
            (a, b) => (b[1].relationshipPath?.length ?? 0) - (a[1].relationshipPath?.length ?? 0)
        );
        let updated = false;
        for (const [fieldId, ref] of entries) {
            const sobjectData = SELECTORS.sobject.selectById(
                { sobject: sobjectState },
                lowerCaseKey(ref.relationshipSObjectName)
            );
            if (!sobjectData?.data?.fields) continue;
            const relationshipPath = ref.relationshipPath;
            const level = relationshipPath.split('.').length + rootLevelNum;
            const selectedForPath = (query ? getFlattenedFields(query).map(f => fullApiName(f)) : [])
                .map(x => (x || '').toLowerCase())
                .filter(f => f.startsWith((relationshipPath + '.').toLowerCase()));
            const childFields = sobjectData.data.fields.map(field => {
                const childRawName = `${relationshipPath}.${field.name}`;
                const childId = lowerCaseKey(childRawName);
                const isRef = field.type === 'reference';
                const childLevel = level + 1;
                const canExpand = isRef && childLevel < maxLevel;
                const details = `${field.type.toUpperCase()} / ${field.label}`;
                const title = `${field.name} — ${details}`;
                const nestedLoaded =
                    nextLoaded[childId] ?? this.loadedChildrenByFieldId[childId];
                const childRelationshipPath = field.relationshipName
                    ? `${relationshipPath}.${field.relationshipName}`
                    : undefined;
                return {
                    id: childId,
                    name: field.name,
                    title,
                    rawName: childRawName,
                    icon: 'utility:number_input',
                    isActive: selectedForPath.includes(childId),
                    isExpandable: canExpand,
                    relationshipSObjectName: field.referenceTo?.[0],
                    relationshipPath: childRelationshipPath,
                    children: canExpand ? (nestedLoaded || []) : undefined,
                    isLoadingChildren: canExpand && loadingIds.has(childId),
                };
            });
            childFields.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
            nextLoaded[fieldId] = childFields;
            updated = true;
        }
        if (updated) {
            this.loadedChildrenByFieldId = nextLoaded;
        }
    }

    _updateFields(query, sort) {
        if (!this.sobjectMeta) return;
        const selectedFields = this._getSelectedFieldSuggestion(query).map(x =>
            (x || '').toLowerCase()
        );
        this._rawFields = this.sobjectMeta.fields.map(field => {
            return {
                ...field,
                details: `${field.type.toUpperCase()} / ${field.label}`,
                isActive: selectedFields.includes(
                    (this._getRawFieldName(field) || '').toLowerCase()
                ),
                ...this._generateRelationshipProperties(field),
            };
        });
        this._sortFields(sort);
        this.fieldsData = [...this._rawFields];
    }

    _getSelectedFieldSuggestion(query) {
        if (!query) return [];
        if (this.childrelation) {
            const subquery = query.fields.find(
                field =>
                    field.type === 'FieldSubquery' &&
                    isSame(field.subquery.relationshipName, this.childrelation)
            );
            if (!subquery) return [];
            return this._getFlattenedFields(subquery);
        }
        return this._getFlattenedFields(query);
    }

    _getRawFieldName(field) {
        let rawFieldName;
        if (this.relationship) {
            rawFieldName = `${this.relationship}.${field.name}`;
        } else {
            rawFieldName = field.name;
        }
        return fullApiName(rawFieldName);
    }

    _getRelationshipPath(field) {
        if (this.relationship) {
            return `${this.relationship}.${field.relationshipName}`;
        }
        return field.relationshipName;
    }

    _generateRelationshipProperties(field) {
        return {
            relationshipSObjectName:
                field.referenceTo && field.referenceTo.length > 0
                    ? field.referenceTo[0]
                    : undefined,
            relationshipPath: this._getRelationshipPath(field),
        };
    }

    _getFlattenedFields(query) {
        return getFlattenedFields(query).map(field => fullApiName(field));
    }

    _sortFields(sort) {
        if (sort) {
            const SORT_ORDER_PRE_NUMBER = {
                ASC: 1,
                DESC: -1,
            };
            const sortOrderPreNumber = SORT_ORDER_PRE_NUMBER[sort];
            this._rawFields.sort((prev, next) => {
                return (
                    (prev.name.toLowerCase() > next.name.toLowerCase() ? 1 : -1) *
                    sortOrderPreNumber
                );
            });
        }
    }

    get computedTree() {
        if (!this.fieldsData || !this.fieldsData.length) {
            return [];
        }
        const rootLevelNum = parseInt(this.rootlevel, 10);
        const maxLevel = 4 + rootLevelNum;
        return this.fieldsData.map(field => {
            const rawName = this._getRawFieldName(field);
            const id = lowerCaseKey(rawName);
            const title = field.details ? `${field.name} — ${field.details}` : field.name;
            const isRef = !!field.relationshipSObjectName;
            const level = this.relationship
                ? this.relationship.split('.').length + rootLevelNum
                : rootLevelNum;
            const canExpand = isRef && level < maxLevel;
            const children = canExpand
                ? (this.loadedChildrenByFieldId[id] || [])
                : undefined;
            return {
                id,
                name: field.name,
                title,
                rawName,
                icon: 'utility:number_input',
                isActive: !!field.isActive,
                isExpandable: canExpand,
                relationshipSObjectName: field.relationshipSObjectName,
                relationshipPath: field.relationshipPath,
                children,
                isLoadingChildren: canExpand && this.loadingRefIds.includes(id),
            };
        });
    }

    get fieldsSearchFields() {
        return ['name', 'title'];
    }

    get minSearchLength() {
        return 1;
    }

    get isNoFields() {
        return !this.computedTree.length;
    }
}
