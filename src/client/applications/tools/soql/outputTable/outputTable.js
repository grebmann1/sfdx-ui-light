import { api,createElement } from 'lwc';
import Toast from 'lightning/toast';
import ToolkitElement from 'core/toolkitElement';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { isObject,isNotUndefinedOrNull,isUndefinedOrNull,runActionAfterTimeOut } from 'shared/utils';
import outputCell from 'soql/outputCell';


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
    isLoading = false;
    _columns;
    rows;
    _response;
    _nextRecordsUrl;
    _hasRendered = false;

    @api tableInstance;
    @api childTitle;
    @api sobjectName;
    @api isChildTable = false;

    @api
    set response(res) {
        this._response = JSON.parse(JSON.stringify(res));
        this._nextRecordsUrl = res.nextRecordsUrl;
        const collector = new ColumnCollector(res.records);
        this._columns = collector.collect();
        this.displayTable();
    }
    get response() {
        return this._response;
    }

    renderedCallback(){
        if(!this._hasRendered){
            this.displayTable();
            window.addEventListener('resize',this.tableResizeEvent);
        }
        this._hasRendered = true;
    }

    disconnectedCallback(){
        window.removeEventListener('resize',this.tableResizeEvent);
    }


    /** Methods */

    formatDataForTable = () => {
        return this._response.records.map(x => {
            delete x.attributes;
            return x;
        })
    }

    formatColumns = () => {
        const columns = this._columns.map(key => {
            return {
                title: key, 
                field: key,
                formatter:this.formatterField_value // Bad performances !!
            }
        });

        if(isNotUndefinedOrNull(this.childTitle)){
            return [{title:this.childTitle,columns:columns}]
        }else{
            return columns;
        }
    }
    
    elementPool = [];
    formatterField_value = (cell, formatterParams, onRendered) => {
        //return `<div class="slds-truncate" title="Acme Partners">Acme Partners</div><lightning-button-icon class="slds-copy-clipboards" variant="bare"><button class="slds-button slds-button_icon slds-button_icon-bare" title="copy" type="button" part="button button-icon"><lightning-primitive-icon variant="bare" ><svg class="slds-button__icon" focusable="false" data-key="copy" aria-hidden="true" part="icon"><use xlink:href="/assets/icons/utility-sprite/svg/symbols.svg#copy"></use></svg></lightning-primitive-icon><span class="slds-assistive-text">copy</span></button></lightning-button-icon>`;
        const outputCellElement = createElement('soql-output-cell', {
            is: outputCell
        });
        let value = cell._cell.value;
        Object.assign(outputCellElement, {
            value,
            column:cell._cell.column.field,
            recordId:cell._cell.row.data.Id

        });
        return outputCellElement;
    }

    tableResizeEvent = (e) => {
        //console.log('tableResizeEvent');
        this.tableResize(1);
    }

    @api
    tableResize = (timeout) => {
        runActionAfterTimeOut(null,(param) => {
            if(isUndefinedOrNull(this.tableInstance)) return;
            const height = this.template.querySelector(".output-panel").clientHeight;
            if(height > 0){
                this.tableInstance.setHeight(height);
            }
        },timeout);
    }
    

    displayTable = () => {
        if(this.tableInstance){
            console.log('Need to destroy table !!!')
            this.tableInstance.destroy();
        }
        const element = this.template.querySelector(".custom-table");
        if(!element) return;
        this.isLoading = true;
        this.tableInstance = new Tabulator(element, {
            height: "100%",
            data: this.formatDataForTable(),
            autoResize:false,
            layout:"fitDataStretch",
            renderHorizontal:"virtual",
            columns: this.formatColumns(),
            //autoColumns:true,
            columnHeaderVertAlign: "middle",
            minHeight:100,
            //maxHeight:"100%",
            rowHeader:{
                headerSort:false, resizable: false, frozen:true, 
                headerHozAlign:"center", hozAlign:"center", 
                formatter:"rowSelection", 
                titleFormatter:"rowSelection", 
                cellClick:function(e, cell){
                    cell.getRow().toggleSelect();
                }
            },
        });
        this.tableInstance.on("tableBuilding", () => {
            console.log('tableBuilding')
            this.isLoading = true;
        });
        this.tableInstance.on("tableBuilt", () => {
            console.log('tableBuilt')
            this.isLoading = false;
        });
        this.tableInstance.on("rowSelectionChanged", (data, rows, selected, deselected) => {
            this.dispatchEvent(new CustomEvent("rowselection", { 
                detail:{
                    rows:data,
                    isChildTable:this.isChildTable
                },
                bubbles: true,composed: true 
            }));
        });

    }

    _convertQueryResponse(res) {
        if (!res) return [];
        const startIdx = this._allRows ? this._allRows.length : 0;
        return res.records.map((record, rowIdx) => {
            const acutualRowIdx = startIdx + rowIdx;
            let row = {
                key: acutualRowIdx,
                values: []
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
                    column
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
    get columns(){
        return this._columns;
    }
    

    
}
