import { wire, api } from 'lwc';
import FeatureElement from 'element/featureElement';
import { getFlattenedFields } from 'soql-parser-js';
import {
    connectStore,
    store,
    toggleRelationship
} from 'soql/store';
import { isEmpty,fullApiName,isSame,escapeRegExp,isNotUndefinedOrNull } from 'shared/utils';

const PAGE_LIST_SIZE    = 70;
export default class RelationshipsTree extends FeatureElement {

    // sObject Name
    @api sobject;
    sobjectMeta;
    relationships = [];
    _keyword;
    _rawRelationships = [];
    _expandedRelationshipNames = {};
    _sobjectLabelMap;
    pageNumber = 1;

    @api
    get keyword() {
        return this._keyword;
    }
    set keyword(value) {
        if (this._keyword !== value) {
            this._keyword = value;
            this._filterRelationships();
        }
    }

    

    @wire(connectStore, { store })
    storeChange({ sobjects, sobject, ui }) {
        if (!this._sobjectLabelMap && sobjects.data) {
            //this._sobjectLabelMap = this._getSObjectLabelMap(sobjects.data);
            // Computation heavy !!!!!
        }
        const sobjectState = sobject[this.sobject];
        if (!sobjectState) return;
        if (sobjectState.data) {
            this.sobjectMeta = sobjectState.data;
        }
        this._updateRelationships(ui.query);
    }

    

    _getSObjectLabelMap(sobjectsData) {
        return sobjectsData.sobjects.reduce((result, sobj) => {
            return {
                ...result,
                [sobj.name]: sobj.label
            };
        }, {});
    }

    _updateRelationships(query) {
        if (!this.sobjectMeta) return;
        const selectedFields = query ? this._getFlattenedFields(query) : [];
        this._rawRelationships = this.sobjectMeta.childRelationships.map(
            relation => {
                return {
                    ...relation,
                    itemLabel: `${relation.relationshipName} / ${relation.childSObject}`,
                    details: `${relation.childSObject}`,//this._getRelationDetails(relation),
                    isActive: selectedFields.includes(
                        fullApiName(relation.relationshipName)
                    ),
                    isExpanded: false
                };
            }
        )
        this._filterRelationships();
    }

    _getRelationDetails(relation) {
        return `${relation.childSObject} / ${
            this._sobjectLabelMap[relation.childSObject]
        }`;
    }

    _filterRelationships() {
        let relationships;
        if (this.keyword) {
            const escapedKeyword = escapeRegExp(this.keyword);
            const keywordPattern = new RegExp(escapedKeyword, 'i');
            relationships = this._rawRelationships.filter(relation => {
                return keywordPattern.test(
                    `${relation.relationshipName} ${relation.childSObject}`
                );
            });
        } else {
            relationships = this._rawRelationships;
        }


        this.relationships = relationships.map(relation => {
            return {
                ...relation,
                isExpanded: !!this._expandedRelationshipNames[
                    relation.relationshipName
                ]
            };
        });
    }

    _getFlattenedFields(query) {
        return getFlattenedFields(query).map(field => fullApiName(field));
    }

    /** Events */

    selectRelationship(event) {
        const relationshipName = event.currentTarget.dataset.name;
        store.dispatch(toggleRelationship(relationshipName));
    }

    toggleChildRelationship(event) {
        const relationshipName = event.target.dataset.name;
        this._expandedRelationshipNames[relationshipName] = !this
            ._expandedRelationshipNames[relationshipName];
        this._filterRelationships();
    }


    handleScroll(event) {
        //console.log('handleScroll');
        const target = event.target;
        const scrollDiff = Math.abs(target.clientHeight - (target.scrollHeight - target.scrollTop));
        const isScrolledToBottom = scrollDiff < 5; //5px of buffer
        if (isScrolledToBottom) {
            // Fetch more data when user scrolls to the bottom
            this.pageNumber++;
        }
    }

    /** Getters */

    get isNoRelationships() {
        return !this.relationships || !this.relationships.length;
    }

    get virtualList(){
        // Best UX Improvement !!!!
        return this.relationships.filter(x => x.relationshipName).slice(0,this.pageNumber * PAGE_LIST_SIZE);
    }

}
