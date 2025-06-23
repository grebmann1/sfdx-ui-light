import { LightningElement, api,track } from 'lwc';
import { guid } from 'shared/utils';
export default class Header extends LightningElement {

    @track _headerList = [];

    @api 
    set header(value) {
        this.headerList = this.parseHeaderStringToRows(value);
    }
    get header() {
        return this.formattedHeaders;
    }

    @api
    get headerList() {
        return this._headerList;
    }
    set headerList(value) {
        this._headerList = value;
        this.ensureLastHeaderIsEmpty();
        this.syncHeaderRows();
    }

    ensureLastHeaderIsEmpty() {
        if (this._headerList.length === 0 || this.isHeaderEmpty(this._headerList[this._headerList.length - 1])) {
            return;
        }
        this._headerList = [...this._headerList, { key: '', value: '', checked: true }];
    }

    isHeaderEmpty(header) {
        return !header.key && !header.value;
    }

    isTemplateRow(header) {
        return this.isHeaderEmpty(header) && this._headerList.indexOf(header) === this._headerList.length - 1;
    }

    /** Event Handlers **/

    disableEvent = (event) => {
        event.stopPropagation();
        event.preventDefault();
    };

    handleChange(event) {
        const value = event.detail.value;
        const row = parseInt(event.target.dataset.index, 10);
        const field = event.target.dataset.field;
        let headerLine = { ...this._headerList[row] };
        headerLine[field] = value;
guid
        // Create a new array to trigger reactivity
        const newHeaders = [...this._headerList];
        newHeaders[row] = headerLine;
        this._headerList = newHeaders;
        this.ensureLastHeaderIsEmpty();
        this.dispatchEvent(new CustomEvent('change', { detail: { value: this.header } }));
    }

    handleDelete(event) {
        const index = parseInt(event.target.dataset.index, 10);
        this._headerList = [...this._headerList.filter((_, idx) => idx !== index)];
        this.dispatchEvent(new CustomEvent('change', { detail: { value: this.header } }));
    }

    handleKeyChange(event) {
        const value = event.detail.value;
        const row = parseInt(event.target.dataset.index, 10);
        let headerLine = { ...this._headerList[row] };
        headerLine.key = value;

        // Create a new array to trigger reactivity
        const newHeaders = [...this._headerList];
        newHeaders[row] = headerLine;
        this._headerList = newHeaders;
        this.dispatchEvent(new CustomEvent('change', { detail: { value: this.header } }));
    }

    handleKeyInput(event) {
        const value = event.target.value;
        const row = parseInt(event.target.dataset.index, 10);
        let headerLine = { ...this._headerList[row] };
        headerLine.key = value;

        // Filter suggestions based on input
        headerLine.filteredSuggestions = this.headerKeyOptions.filter(option =>
            option.label.toLowerCase().includes(value.toLowerCase())
        );
        headerLine.showSuggestions = headerLine.filteredSuggestions.length > 0;

        // Create a new array to trigger reactivity
        const newHeaders = [...this._headerList];
        newHeaders[row] = headerLine;
        this._headerList = newHeaders;
        this.dispatchEvent(new CustomEvent('change', { detail: { value: this.header } }));
    }

    handleSuggestionClick(event) {
        const value = event.target.dataset.value;
        const row = parseInt(event.target.dataset.index, 10);
        let headerLine = { ...this._headerList[row] };
        headerLine.key = value;
        headerLine.showSuggestions = false;

        // Create a new array to trigger reactivity
        const newHeaders = [...this._headerList];
        newHeaders[row] = headerLine;
        this._headerList = newHeaders;
        this.dispatchEvent(new CustomEvent('change', { detail: { value: this.header } }));
    }

    /** Getters **/

    get formattedHeaders() {
        return this.headerList
            .filter(row => row.key)
            .map(row => `${row.key} : ${row.value}`)
            .join('\n');
    }

    get computedHeaders() {
        return this.headerList.map((header, idx) => {
            return {
                ...header,
                index: idx,
                isDeleteEnabled: !this.isTemplateRow(header)
            };
        });
    }

    get headerKeyOptions() {
        return [
            { label: 'Accept', value: 'Accept' },
            { label: 'Accept-Encoding', value: 'Accept-Encoding' },
            { label: 'Accept-Language', value: 'Accept-Language' },
            { label: 'Access-Control-Allow-Headers', value: 'Access-Control-Allow-Headers' },
            { label: 'Access-Control-Allow-Methods', value: 'Access-Control-Allow-Methods' },
            { label: 'Access-Control-Allow-Origin', value: 'Access-Control-Allow-Origin' },
            { label: 'Access-Control-Expose-Headers', value: 'Access-Control-Expose-Headers' },
            { label: 'Authorization', value: 'Authorization' },
            { label: 'Cache-Control', value: 'Cache-Control' },
            { label: 'Connection', value: 'Connection' },
            { label: 'Content-Encoding', value: 'Content-Encoding' },
            { label: 'Content-Length', value: 'Content-Length' },
            { label: 'Content-Type', value: 'Content-Type' },
            { label: 'Cookie', value: 'Cookie' },
            { label: 'Date', value: 'Date' },
            { label: 'Expect', value: 'Expect' },
            { label: 'Forwarded', value: 'Forwarded' },
            { label: 'From', value: 'From' },
            { label: 'Host', value: 'Host' },
            { label: 'If-Match', value: 'If-Match' },
            { label: 'If-Modified-Since', value: 'If-Modified-Since' },
            { label: 'If-None-Match', value: 'If-None-Match' },
            { label: 'If-Range', value: 'If-Range' },
            { label: 'If-Unmodified-Since', value: 'If-Unmodified-Since' },
            { label: 'Max-Forwards', value: 'Max-Forwards' },
            { label: 'Origin-Trial', value: 'Origin-Trial' },
            { label: 'Pragma', value: 'Pragma' },
            { label: 'Proxy-Authorization', value: 'Proxy-Authorization' },
            { label: 'Range', value: 'Range' },
            { label: 'Referer', value: 'Referer' },
            { label: 'Referrer-Policy', value: 'Referrer-Policy' },
            { label: 'Sforce-Auto-Assign', value: 'Sforce-Auto-Assign' },
            { label: 'Sforce-Call-Options', value: 'Sforce-Call-Options' },
            { label: 'Sforce-Duplicate-Rule-Header', value: 'Sforce-Duplicate-Rule-Header' },
            { label: 'Sforce-Limit-Info', value: 'Sforce-Limit-Info' },
            { label: 'Sforce-Query-Options', value: 'Sforce-Query-Options' },
            { label: 'Sforce-Search-Options', value: 'Sforce-Search-Options' },
            { label: 'Sforce-Session-Id', value: 'Sforce-Session-Id' },
            { label: 'Sforce-Trigger-Disable', value: 'Sforce-Trigger-Disable' },
            { label: 'Sforce-Trigger-Enable', value: 'Sforce-Trigger-Enable' },
            { label: 'Sforce-Trigger-Old', value: 'Sforce-Trigger-Old' },
            { label: 'Sforce-Trigger-Size', value: 'Sforce-Trigger-Size' },
            { label: 'Sforce-Trigger-User', value: 'Sforce-Trigger-User' },
            { label: 'Strict-Transport-Security', value: 'Strict-Transport-Security' },
            { label: 'TE', value: 'TE' },
            { label: 'Transfer-Encoding', value: 'Transfer-Encoding' },
            { label: 'Upgrade', value: 'Upgrade' },
            { label: 'User-Agent', value: 'User-Agent' },
            { label: 'Vary', value: 'Vary' },
            { label: 'Via', value: 'Via' },
            { label: 'Warning', value: 'Warning' },
            { label: 'X-Content-Type-Options', value: 'X-Content-Type-Options' },
            { label: 'X-Powered-By', value: 'X-Powered-By' },
            { label: 'X-Request-Id', value: 'X-Request-Id' },
            { label: 'X-Robots-Tag', value: 'X-Robots-Tag' },
            { label: 'X-Sfdc-Edge-Cache', value: 'X-Sfdc-Edge-Cache' },
            { label: 'X-Sfdc-Request-Id', value: 'X-Sfdc-Request-Id' }
        ];
    }

    syncHeaderRows() {
        // Remove empty rows except the last one
        let rows = this._headerList.filter((row, i, arr) => row.key || row.value || i === arr.length - 1);
        // Always keep at least one empty row
        if (rows.length === 0 || rows[rows.length - 1].key || rows[rows.length - 1].value) {
            rows.push({ id: guid(), key: '', value: '' });
        }
        // Mark duplicates
        const keyCounts = rows.reduce((acc, row) => {
            if (row.key) acc[row.key.toLowerCase()] = (acc[row.key.toLowerCase()] || 0) + 1;
            return acc;
        }, {});
        rows = rows.map(row => ({ ...row, hasDuplicate: row.key && keyCounts[row.key.toLowerCase()] > 1 }));
        this._headerList = rows;
    }

    parseHeaderStringToRows(headerStr) {
        if (!headerStr) return [{ id: guid(), key: '', value: '' }];
        const lines = headerStr.split(/\r?\n/).filter(Boolean);
        const rows = lines.map(line => {
            const [key, ...rest] = line.split(':');
            return { id: guid(), key: key ? key.trim() : '', value: rest.join(':').trim() };
        });
        // Always at least one empty row
        if (rows.length === 0 || rows[rows.length - 1].key || rows[rows.length - 1].value) {
            rows.push({ id: guid(), key: '', value: '' });
        }
        return rows;
    }

}