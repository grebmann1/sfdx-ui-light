import { api, track } from 'lwc';
import ToolkitElement from 'core/toolkitElement';
import {
    isEmpty,
    isElectronApp,
    classSet,
    isUndefinedOrNull,
    isNotUndefinedOrNull,
    runActionAfterTimeOut,
    formatFiles,
    sortObjectsByField,
    removeDuplicates,
} from 'shared/utils';

export default class StructureViewer extends ToolkitElement {
    @track _record;
    @track items = [];

    @api
    get record() {
        return this._record;
    }

    set record(value) {
        this._record = value;
        this.formatTree(value);
        //console.log('---> record', value);
    }

    /** Events **/

    expandAll = e => {
        var items = this.template.querySelectorAll('metadata-structure-viewer-item');
        for (var i = 0; i < items.length; i++) {
            items[i].expandAll();
        }
    };

    collapseAll = e => {
        var items = this.template.querySelectorAll('metadata-structure-viewer-item');
        for (var i = 0; i < items.length; i++) {
            items[i].collapseAll();
        }
    };

    /** Methods **/

    formatTree = record => {
        if (Array.isArray(record)) {
            this.items = record.map(x => ({
                key: x.Name || x.DeveloperName || x.MasterLabel || x.fullName,
                value: x,
            }));
        } else {
            const name =
                record.Name || record.DeveloperName || record.MasterLabel || record.fullName;
            this.items = [
                {
                    key: name,
                    value: record,
                },
            ];
        }
    };
}
