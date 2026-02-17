import { api, wire } from 'lwc';
import Toast from 'lightning/toast';
import ToolkitElement from 'core/toolkitElement';
import { store, UI } from 'core/store';
import { NavigationContext, navigate } from 'lwr/navigation';
import {
    isNotUndefinedOrNull,
    isUndefinedOrNull,
    runActionAfterTimeOut,
} from 'shared/utils';
import { store as legacyStore, store_application } from 'shared/store';

class ColumnCollector {
    columnMap = new Map();
    columns = [];
    records;

    constructor(records) {
        this.records = records;
    }

    collect() {
        this.records.forEach(record => {
            this._collectColumnMap(record);
        });
        this._collectColumns();
        return this.columns;
    }

    _collectColumnMap(record, relationships = []) {
        Object.keys(record).forEach(name => {
            if (name !== 'attributes') {
                let parentRelation = this.columnMap;
                relationships.forEach(relation => {
                    parentRelation = parentRelation.get(relation);
                });
                if (!parentRelation.has(name)) {
                    parentRelation.set(name, new Map());
                }
                const data = record[name];
                if (data instanceof Object) {
                    if (!data.totalSize) {
                        this._collectColumnMap(data, [...relationships, name]);
                    }
                }
            }
        });
    }

    _collectColumns(columnMap = this.columnMap, relationships = []) {
        for (let [name, data] of columnMap) {
            if (data.size) {
                this._collectColumns(data, [...relationships, name]);
            } else {
                this.columns.push([...relationships, name].join('.'));
            }
        }
    }
}

export default class OutputTable extends ToolkitElement {
    @wire(NavigationContext)
    navContext;

    isLoading = false;
    _columns;
    rows;
    _response;
    _nextRecordsUrl;
    _hasRendered = false;
    _tableSearch;
    _lastColumnsKey = '';
    _displayTableRunId = 0;
    _tabulatorCtor;
    _tabulatorImportPromise;

    @api tableInstance;
    @api childTitle;
    @api sobjectName;
    @api isChildTable = false;

    async ensureTabulator() {
        if (this._tabulatorCtor) return this._tabulatorCtor;
        if (!this._tabulatorImportPromise) {
            this._tabulatorImportPromise = import('tabulator-tables').then(mod => {
                return mod.TabulatorFull || mod.default || mod.Tabulator;
            });
        }
        this._tabulatorCtor = await this._tabulatorImportPromise;
        return this._tabulatorCtor;
    }

    @api
    set response(res) {
        this._response = res;
        this._nextRecordsUrl = res.nextRecordsUrl;
        const collector = new ColumnCollector(res.records);
        this._columns = collector.collect();
        this.displayTable();
    }
    get response() {
        return this._response;
    }

    renderedCallback() {
        if (!this._hasRendered) {
            this.displayTable();
            window.addEventListener('resize', this.tableResizeEvent);
        }
        this._hasRendered = true;
    }

    disconnectedCallback() {
        window.removeEventListener('resize', this.tableResizeEvent);
    }

    /** Methods */

    formatDataForTable = () => {
        const records = this._response?.records || [];
        return records.map(record => {
            const row = { ...record };
            delete row.attributes;
            row.__searchText = this._buildRowSearchText(row);
            return row;
        });
    };

    _buildRowSearchText(row) {
        try {
            return Object.values(row)
                .map(val => {
                    if (val == null) return '';
                    if (typeof val === 'object') {
                        try {
                            return JSON.stringify(val);
                        } catch (_e) {
                            return '';
                        }
                    }
                    return String(val);
                })
                .join(' ')
                .toLowerCase();
        } catch (_e) {
            return '';
        }
    };

    _escapeHtml(value) {
        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    _iconButtonHtml({ action, iconName, assistiveText, title }) {
        const safeTitle = this._escapeHtml(title || assistiveText || '');
        const safeText = this._escapeHtml(assistiveText || '');
        return `
            <button class="slds-button slds-button_icon slds-button_icon-bare sftk-cell-btn" type="button" data-action="${action}" title="${safeTitle}">
                <svg class="slds-button__icon" aria-hidden="true" focusable="false">
                    <use xlink:href="/assets/icons/utility-sprite/svg/symbols.svg#${iconName}"></use>
                </svg>
                <span class="slds-assistive-text">${safeText}</span>
            </button>
        `;
    }

    _formatChildRelationshipLabel(value) {
        const count = Array.isArray(value) ? value.length : (value?.totalSize || 0);
        return `${count} records`;
    }

    tabulatorCellFormatter = (cell) => {
        const value = cell.getValue();
        const field = cell.getColumn().getField();
        const rowData = cell.getRow().getData() || {};
        const recordId = rowData.Id;

        const isChildRelationship = value && typeof value === 'object';
        if (isChildRelationship) {
            const label = this._formatChildRelationshipLabel(value);
            return `
                <div class="sftk-cell">
                    <button class="slds-button slds-button_neutral sftk-cell-child" type="button" data-action="child" title="${this._escapeHtml(label)}">
                        ${this._escapeHtml(label)}
                    </button>
                </div>
            `;
        }

        const text = value == null ? '' : String(value);
        const isIdLike = /^[0-9A-Za-z]{18}$/.test(text);
        const isRecordIdField = field === 'Id';

        const valueHtml = isIdLike
            ? `<a href="#" class="sftk-cell-link" data-action="navigate" title="${this._escapeHtml(text)}">${this._escapeHtml(text)}</a>`
            : `<div class="slds-truncate sftk-cell-value" title="${this._escapeHtml(text)}">${this._escapeHtml(text)}</div>`;

        const actions = [];
        if (isRecordIdField && recordId) {
            actions.push(this._iconButtonHtml({ action: 'edit', iconName: 'edit', assistiveText: 'edit' }));
        }
        if (value != null && text !== '') {
            actions.push(this._iconButtonHtml({ action: 'copy', iconName: 'copy', assistiveText: 'copy' }));
        }

        return `
            <div class="sftk-cell">
                <div class="sftk-cell-main">${valueHtml}</div>
                <div class="sftk-cell-actions">${actions.join('')}</div>
            </div>
        `;
    };

    _handleCellClick = (e, cell) => {
        const actionEl = e?.target?.closest?.('[data-action]');
        const action = actionEl?.dataset?.action;
        if (!action) return;

        const value = cell.getValue();
        const field = cell.getColumn().getField();
        const rowData = cell.getRow().getData() || {};
        const recordId = rowData.Id;

        if (action === 'copy') {
            e.preventDefault();
            e.stopPropagation();
            navigator.clipboard.writeText(value == null ? '' : String(value));
            Toast.show({
                label: `${field} exported to your clipboard`,
                variant: 'success',
            });
            return;
        }

        if (action === 'edit') {
            e.preventDefault();
            e.stopPropagation();
            if (!recordId) return;
            navigate(this.navContext, {
                type: 'application',
                state: {
                    applicationName: 'recordviewer',
                    recordId,
                },
            });
            return;
        }

        if (action === 'navigate') {
            e.preventDefault();
            e.stopPropagation();
            if (value == null) return;
            legacyStore.dispatch(store_application.navigate(String(value)));
            return;
        }

        if (action === 'child') {
            e.preventDefault();
            e.stopPropagation();
            const base = {
                recordId,
                column: field,
            };
            let clonedValue = value;
            try {
                clonedValue = JSON.parse(JSON.stringify(value));
            } catch (_e) {}
            store.dispatch(
                UI.reduxSlice.actions.selectChildRelationship({
                    childRelationship: {
                        ...base,
                        ...(clonedValue && typeof clonedValue === 'object' ? clonedValue : {}),
                    },
                })
            );
        }
    };

    formatColumns = () => {
        const columns = this._columns.map(key => {
            return {
                title: key,
                field: key,
                maxWidth: 500,
                formatter: this.tabulatorCellFormatter,
                cellClick: this._handleCellClick,
            };
        });

        if (isNotUndefinedOrNull(this.childTitle)) {
            return [{ title: this.childTitle, columns: columns }];
        } else {
            return columns;
        }
    };

    tableResizeEvent = e => {
        //console.log('tableResizeEvent');
        this.tableResize(1);
    };

    @api
    tableResize = timeout => {
        runActionAfterTimeOut(
            null,
            param => {
                if (isUndefinedOrNull(this.tableInstance)) return;
                const height = this.template.querySelector('.output-panel').clientHeight;
                if (height > 0) {
                    this.tableInstance.setHeight(height);
                }
            },
            { timeout, key: 'soql.outputTable.resize' }
        );
    };

    displayTable = async () => {
        const runId = ++this._displayTableRunId;
        const columnsKey = Array.isArray(this._columns) ? this._columns.join('|') : '';
        const element = this.template.querySelector('.custom-table');
        const rowSelector = {
            headerSort: false,
            resizable: false,
            frozen: true,
            headerHozAlign: 'center',
            hozAlign: 'center',
            formatter: 'rowSelection',
            titleFormatter: 'rowSelection',
            cellClick: function (e, cell) {
                cell.getRow().toggleSelect();
            },
        };
        if (!element) return;
        this.isLoading = true;
        const data = this.formatDataForTable();
        const columns = this.formatColumns();

        if (this.tableInstance && this._lastColumnsKey === columnsKey) {
            this.tableInstance.replaceData(data);
            this.applyTableSearchFilter();
            this.isLoading = false;
            return;
        }

        const Tabulator = await this.ensureTabulator();
        if (!Tabulator || runId !== this._displayTableRunId) {
            return;
        }

        if (this.tableInstance) {
            this.tableInstance.destroy();
        }

        this._lastColumnsKey = columnsKey;
        this.tableInstance = new Tabulator(element, {
            height: '100%',
            data,
            autoResize: false,
            layout: 'fitDataFill',
            columns,
            columnHeaderVertAlign: 'middle',
            minHeight: 100,
            rowHeight: 28,
            rowHeader: this.isChildTable || data.length === 0 ? null : rowSelector,
            headerSortElement: function (column, dir) {
                const _arrowIcon = iconName =>
                    `<svg class="slds-icon slds-icon-text-default slds-is-sortable__icon " aria-hidden="true"><use xlink:href="/assets/icons/utility-sprite/svg/symbols.svg#${iconName}"></use></svg>`;
                switch (dir) {
                    case 'asc':
                        return _arrowIcon('arrowup');
                    case 'desc':
                        return _arrowIcon('arrowdown');
                    default:
                        return _arrowIcon('arrowdown');
                }
            },
        });
        this.tableInstance.on('tableBuilding', () => {
            //console.log('tableBuilding')
            this.isLoading = true;
        });
        this.tableInstance.on('tableBuilt', () => {
            this.isLoading = false;
            if (!this.isChildTable) {
                this.dispatchEvent(
                    new CustomEvent('tablebuilt', { bubbles: true, composed: true })
                );
            }
        });
        this.tableInstance.on('rowSelectionChanged', (data, rows, selected, deselected) => {
            this.dispatchEvent(
                new CustomEvent('rowselection', {
                    detail: {
                        rows: data,
                        isChildTable: this.isChildTable,
                    },
                    bubbles: true,
                    composed: true,
                })
            );
        });
        this.applyTableSearchFilter();
    };

    applyTableSearchFilter() {
        if (!this.tableInstance) return;
        const search = (this._tableSearch || '').toLowerCase();
        if (!search) {
            this.tableInstance.clearFilter();
            return;
        }
        this.tableInstance.setFilter((rowData) => {
            const text = rowData?.__searchText || '';
            return text.includes(search);
        });
    }

    _convertQueryResponse(res) {
        if (!res) return [];
        const startIdx = this._allRows ? this._allRows.length : 0;
        return res.records.map((record, rowIdx) => {
            const acutualRowIdx = startIdx + rowIdx;
            let row = {
                key: acutualRowIdx,
                values: [],
            };
            this.columns.forEach((column, valueIdx) => {
                const rawData = this._getFieldValue(column, record);
                let data = rawData;
                if (data && data.totalSize) {
                    data = `${data.totalSize} rows`;
                }
                row.values.push({
                    key: `${acutualRowIdx}-${valueIdx}`,
                    data,
                    rawData,
                    column,
                });
            });
            return row;
        });
    }

    _getFieldValue(column, record) {
        let value = record;
        column.split('.').forEach(name => {
            if (value) value = value[name];
        });
        return value;
    }

    /** Getters **/

    @api
    get columns() {
        return this._columns;
    }

    @api
    get tableSearch() {
        return this._tableSearch || '';
    }
    set tableSearch(val) {
        this._tableSearch = val || '';
        this.applyTableSearchFilter();
    }
}
