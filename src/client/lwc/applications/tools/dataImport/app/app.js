import { api, track, wire } from 'lwc';
import ToolkitElement from 'core/toolkitElement';
import Toast from 'lightning/toast';
import { connectStore, store, DESCRIBE } from 'core/store';
import { CSV, isEmpty, isUndefinedOrNull } from 'shared/utils';
import Analytics from 'shared/analytics';

const MODE = {
    REST: 'REST',
    BULK_V2: 'BULK_V2',
    BULK_V1: 'BULK_V1',
};

const ACTION = {
    INSERT: 'insert',
    UPDATE: 'update',
    UPSERT: 'upsert',
};

const DELIMITER = {
    COMMA: 'COMMA',
    SEMICOLON: 'SEMICOLON',
    TAB: 'TAB',
    PIPE: 'PIPE',
};

const DELIMITER_TO_CHAR = {
    [DELIMITER.COMMA]: ',',
    [DELIMITER.SEMICOLON]: ';',
    [DELIMITER.TAB]: '\t',
    [DELIMITER.PIPE]: '|',
};

const REST_MAX_BATCH_SIZE = 200;
const CSV_WARN_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const CSV_MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

export default class App extends ToolkitElement {
    @api namespace;

    // Active gating
    isActive = true;

    // Configure
    @track mode = MODE.REST;
    @track action = ACTION.INSERT;
    @track objectApiName = 'Account';
    @track externalIdFieldName = '';
    @track delimiterKey = DELIMITER.COMMA;
    @track restBatchSize = 200;

    // CSV
    @track csvFileName;
    @track csvError;
    csvText;
    csvHeaders = [];
    csvRows = []; // array of objects keyed by header

    // SObject describe
    sobjectDescribe;
    @track objectError;
    @track sobjectOptions = [];
    @track fieldNames = [];
    @track externalIdOptions = [];

    // Mapping
    @track mappingRows = []; // { key, csvHeader, targetField, error, inputId, inputClass }

    // Running
    isWorking = false;
    cancelRequested = false;
    lastRunMessage;
    lastRunMessageVariant = 'info';
    results = []; // row-level results, normalized
    lastRestPayload = null; // [{ rowIndex, record }]

    // Jobs
    @track jobs = [];
    @track jobsError;
    isJobsRefreshing = false;
    @track selectedJob;
    @track selectedJobDetails;
    lastCreatedJobId;

    // Failed results preview (Job Monitor)
    isFailedPreviewOpen = false;
    failedPreviewLoading = false;
    @track failedPreviewError;
    @track failedPreviewColumns = [];
    @track failedPreviewRows = [];
    failedPreviewRowLimit = 200;
    failedPreviewIsTruncated = false;
    failedPreviewRawIsTruncated = false;
    failedPreviewRawLimitChars = 1024 * 1024; // ~1MB
    failedPreviewRawText = '';
    failedPreviewEditorLoaded = false;
    failedPreviewEditorModel = null;

    connectedCallback() {
        Analytics.trackAppOpen('dataImport', { alias: this.alias });
        if (this.connector?.conn) {
            store.dispatch(
                DESCRIBE.describeSObjects({
                    connector: this.connector.conn,
                })
            );
            this.loadSObjectDescribe();
        }
    }

    @wire(connectStore, { store })
    storeChange({ application, describe }) {
        const isCurrentApp = this.verifyIsActive(application.currentApplication);
        this.isActive = isCurrentApp;
        if (!isCurrentApp) return;

        // Populate object datalist from describe
        if (describe?.nameMap) {
            const list = Object.values(describe.nameMap)
                .filter(x => !!x?.name)
                .map(x => ({ label: x.name, value: x.name }))
                .sort((a, b) => a.value.localeCompare(b.value));
            this.sobjectOptions = list;
        }
    }

    /** UI handlers */
    handleModeChange = e => {
        this.mode = e.detail?.value || e.target?.value;
        this._setInfo(`Mode set to ${this.modeLabel}.`);
    };

    handleActionChange = e => {
        this.action = e.detail?.value || e.target?.value;
        // Reset externalId selection if leaving upsert
        if (this.action !== ACTION.UPSERT) {
            this.externalIdFieldName = '';
        }
        this.validateMapping();
    };

    handleDelimiterChange = e => {
        this.delimiterKey = e.detail?.value || e.target?.value;
        if (this.csvText) {
            this.parseCsv(this.csvText);
        }
    };

    handleRestBatchSizeChange = e => {
        const value = Number(e.detail?.value ?? e.target?.value);
        this.restBatchSize =
            Number.isFinite(value) && value > 0
                ? Math.min(value, REST_MAX_BATCH_SIZE)
                : REST_MAX_BATCH_SIZE;
    };

    handleObjectInput = async e => {
        this.objectApiName = e.detail?.value ?? e.target?.value;
        await this.loadSObjectDescribe();
        this.validateMapping();
    };

    handleExternalIdChange = e => {
        this.externalIdFieldName = e.detail?.value || e.target?.value;
        this.validateMapping();
    };

    handleFileChange = async e => {
        this.csvError = null;
        const file = e.target?.files?.[0];
        if (!file) return;
        this.csvFileName = file.name;

        try {
            if (file.size > CSV_MAX_SIZE_BYTES) {
                const sizeMb = (file.size / 1024 / 1024).toFixed(1);
                const maxMb = (CSV_MAX_SIZE_BYTES / 1024 / 1024).toFixed(0);
                this.csvText = null;
                this.csvHeaders = [];
                this.csvRows = [];
                this.mappingRows = [];
                this.csvError = `CSV is too large (${sizeMb}MB). Max supported size is ${maxMb}MB. Split the file into smaller parts.`;
                return;
            }

            if (file.size > CSV_WARN_SIZE_BYTES) {
                const sizeMb = (file.size / 1024 / 1024).toFixed(1);
                Toast.show({
                    label: 'Large CSV file',
                    message: `This CSV is ${sizeMb}MB and may slow down the UI while parsing/mapping.`,
                    variant: 'warning',
                });
            }

            const text = await file.text();
            this.csvText = text;
            this.parseCsv(text);
        } catch (err) {
            this.csvError = err?.message || String(err);
        }
    };

    // Legacy: mapping input used to be a plain <input/> with a datalist. We now use slds-searchable-combobox.

    handleMappingChange = e => {
        const key = e.currentTarget?.dataset?.key;
        const value = e.detail?.value ?? '';
        const idx = this.mappingRows.findIndex(r => r.key === key);
        if (idx === -1) return;
        this.mappingRows[idx] = {
            ...this.mappingRows[idx],
            targetField: value,
        };
        this.validateMapping();
    };

    handleClearSingleMapping = e => {
        const key = e.currentTarget?.dataset?.key;
        const idx = this.mappingRows.findIndex(r => r.key === key);
        if (idx === -1) return;
        this.mappingRows[idx] = {
            ...this.mappingRows[idx],
            targetField: '',
            error: null,
            inputClass: 'slds-input',
        };
        this.validateMapping();
    };

    handleAutoMap = () => {
        this.autoMapFields();
        this.validateMapping();
    };

    handleClearMapping = () => {
        this.mappingRows = this.mappingRows.map(r => ({
            ...r,
            targetField: '',
            error: null,
            inputClass: 'slds-input',
        }));
        this.validateMapping();
    };

    handleRun = async () => {
        if (this.isWorking) return;
        const validation = this.validateBeforeRun();
        if (!validation.ok) {
            this._setError(validation.message);
            Toast.show({
                label: 'Cannot run import',
                message: validation.message,
                variant: 'error',
                mode: 'sticky',
            });
            return;
        }

        this.cancelRequested = false;
        this.isWorking = true;
        this.results = [];
        this.lastRunMessage = null;

        try {
            if (this.mode === MODE.REST) {
                await this.runRestImport();
            } else if (this.mode === MODE.BULK_V2) {
                await this.runBulkV2Import();
            } else {
                await this.runBulkV1Import();
            }
        } catch (e) {
            this._setError(e?.message || String(e));
        } finally {
            this.isWorking = false;
        }
    };

    handleCancel = async () => {
        if (!this.isWorking) return;
        this.cancelRequested = true;
        if (this.mode === MODE.BULK_V2 && this.lastCreatedJobId) {
            try {
                await this.abortBulkV2Job(this.lastCreatedJobId);
                this._setInfo(`Abort requested for job ${this.lastCreatedJobId}.`);
            } catch (e) {
                // ignore, already completed or not abortable
            }
        }
    };

    /** Jobs UI */
    handleRefreshJobs = async () => {
        await this.refreshJobs();
    };

    handleSelectJob = async e => {
        e.preventDefault?.();
        const id = e.currentTarget?.dataset?.id || e.target?.dataset?.id;
        if (!id) return;
        this.resetFailedPreview();
        this.selectedJob = this.jobs.find(j => j.id === id) || { id };
        await this.refreshSelectedJob();
    };

    handleRefreshSelectedJob = async () => {
        await this.refreshSelectedJob();
    };

    handleDownloadSuccess = async () => {
        if (!this.selectedJob?.id) return;
        await this.downloadBulkV2Results(this.selectedJob.id, 'successfulResults', 'successful');
    };

    handleDownloadFailed = async () => {
        if (!this.selectedJob?.id) return;
        await this.downloadBulkV2Results(this.selectedJob.id, 'failedResults', 'failed');
    };

    handlePreviewFailed = async () => {
        if (!this.selectedJob?.id) return;
        if (isUndefinedOrNull(this.connector?.conn)) return;

        const jobId = this.selectedJob.id;
        this.isFailedPreviewOpen = true;
        this.failedPreviewLoading = true;
        this.failedPreviewError = null;
        this.failedPreviewColumns = [];
        this.failedPreviewRows = [];
        this.failedPreviewIsTruncated = false;
        this.failedPreviewRawIsTruncated = false;
        this.failedPreviewRawText = '';
        this._updateFailedPreviewEditor('');

        try {
            const csv = await this.fetchBulkV2ResultsText(jobId, 'failedResults');
            const rawText = this._truncateFailedPreviewRaw(csv);
            this.failedPreviewRawText = rawText;
            this._updateFailedPreviewEditor(rawText);

            const text = String(csv || '');
            const trimmed = text.trimStart();
            if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                throw new Error(
                    'Failed results preview is not a CSV file (received JSON). Use “Download Failed” to inspect the full response.'
                );
            }

            // Let the parser auto-detect delimiter to avoid locale-specific CSV formats.
            const parsed = CSV.parseCsvText(text, { delimiter: '' });
            if (parsed?.error && !(parsed?.rows?.length || 0)) {
                const msg = String(parsed.error || 'Failed to parse CSV');
                if (msg.toLowerCase().includes('too many fields')) {
                    throw new Error(
                        'Failed to parse results CSV (malformed or unexpected delimiter). Use “Download Failed” for the full file.'
                    );
                }
                throw new Error(msg);
            }

            const { columns, rows, isTruncated } = this._buildFailedPreviewTable({
                jobId,
                headers: parsed?.headers || [],
                rows: parsed?.rows || [],
            });
            this.failedPreviewColumns = columns;
            this.failedPreviewRows = rows;
            this.failedPreviewIsTruncated = isTruncated;
        } catch (e) {
            this.failedPreviewError = e?.message || String(e);
        } finally {
            this.failedPreviewLoading = false;
        }
    };

    handleCloseFailedPreview = () => {
        this.resetFailedPreview();
    };

    handleFailedPreviewMonacoLoaded = () => {
        this.failedPreviewEditorLoaded = true;
        if (!this.refs?.failedPreviewEditor) return;

        try {
            this.failedPreviewEditorModel?.dispose?.();
        } catch (e) {
            // ignore
        }
        const model = this.refs.failedPreviewEditor.createModel({
            body: this.failedPreviewRawText || '',
            language: 'plaintext',
        });
        this.failedPreviewEditorModel = model;
        this.refs.failedPreviewEditor.displayModel(model);
    };

    handleDownloadUnprocessed = async () => {
        if (!this.selectedJob?.id) return;
        // Salesforce docs sometimes show `unprocessedrecords` (lowercase r)
        await this.downloadBulkV2Results(this.selectedJob.id, 'unprocessedrecords', 'unprocessed');
    };

    handleAbortSelectedJob = async () => {
        if (!this.selectedJob?.id) return;
        await this.abortBulkV2Job(this.selectedJob.id);
        await this.refreshSelectedJob();
        Toast.show({ label: 'Abort requested', variant: 'success' });
    };

    /** Results */
    handleDownloadResults = () => {
        const csv = this.buildResultsCsv();
        if (!csv) return;
        this.downloadText(`${this.objectApiName || 'results'}-import-results.csv`, csv, 'text/csv');
    };

    handleRetryFailed = async () => {
        if (this.isRetryFailedDisabled) return;
        const failedRowIndexes = (this.results || [])
            .filter(r => r && r.success === false)
            .map(r => (r.rowNumber || 0) - 1)
            .filter(i => i >= 0);
        if (!failedRowIndexes.length) return;

        this.cancelRequested = false;
        this.isWorking = true;
        this.lastRunMessage = null;
        try {
            await this.runRestImport({ onlyRowIndexes: new Set(failedRowIndexes) });
        } catch (e) {
            this._setError(e?.message || String(e));
        } finally {
            this.isWorking = false;
        }
    };

    /** CSV + mapping */
    parseCsv(text) {
        this.csvError = null;
        this.csvHeaders = [];
        this.csvRows = [];
        this.mappingRows = [];

        const delimiter = DELIMITER_TO_CHAR[this.delimiterKey] || ',';
        const parsed = CSV.parseCsvText(text, { delimiter });
        if (parsed.error) {
            this.csvError = parsed.error;
            return;
        }

        const headers = (parsed.headers || []).map(h => String(h || '').trim());
        const rows = Array.isArray(parsed.rows) ? parsed.rows : [];

        const emptyHeaders = headers.filter(h => !h);
        if (emptyHeaders.length) {
            this.csvError =
                'CSV header contains empty column name(s). Ensure the first row has a name for every column.';
            return;
        }

        const seen = new Set();
        const duplicates = new Set();
        for (const h of headers) {
            const key = h.toLowerCase();
            if (seen.has(key)) duplicates.add(h);
            else seen.add(key);
        }
        if (duplicates.size) {
            this.csvError = `CSV has duplicate column headers: ${Array.from(duplicates).join(
                ', '
            )}. Rename columns to make them unique.`;
            return;
        }

        this.csvHeaders = headers;
        this.csvRows = rows;

        this.mappingRows = this.csvHeaders.map((h, idx) => ({
            key: String(idx),
            csvHeader: h,
            targetField: '',
            error: null,
            inputId: `di-map-${idx}`,
            inputClass: 'slds-input',
            mappingWrapperClass: '',
        }));

        this.autoMapFields();
        this.validateMapping();
    }

    autoMapFields() {
        const fieldSet = new Set((this.fieldNames || []).map(f => f.toLowerCase()));
        this.mappingRows = this.mappingRows.map(r => {
            const candidate = (r.csvHeader || '').trim();
            const candidateLower = candidate.toLowerCase();
            // Avoid suggesting Id for insert/upsert (it commonly fails). Id is only relevant for Update.
            if (candidateLower === 'id' && this.action !== ACTION.UPDATE) {
                return r;
            }
            const mapped = fieldSet.has(candidateLower) ? candidate : r.targetField;
            return { ...r, targetField: mapped };
        });
    }

    validateMapping() {
        if (!this.mappingRows?.length) return;

        const descFields = Array.isArray(this.sobjectDescribe?.fields)
            ? this.sobjectDescribe.fields
            : [];
        const validFieldSet = new Set((this.fieldNames || []).map(f => f.toLowerCase()));
        const writeableFieldSet = new Set(
            descFields
                .filter(f => {
                    if (!f?.name) return false;
                    if (f.name === 'Id') return this.action === ACTION.UPDATE;
                    if (this.action === ACTION.INSERT) return f.createable === true;
                    if (this.action === ACTION.UPDATE) return f.updateable === true;
                    // UPSERT
                    return f.createable === true || f.updateable === true;
                })
                .map(f => f.name.toLowerCase())
        );

        const targetCounts = new Map();
        for (const r of this.mappingRows) {
            const target = (r.targetField || '').trim();
            if (!target) continue;
            const key = target.toLowerCase();
            targetCounts.set(key, (targetCounts.get(key) || 0) + 1);
        }
        const duplicateTargets = new Set(
            Array.from(targetCounts.entries())
                .filter(([, count]) => count > 1)
                .map(([key]) => key)
        );

        const updated = this.mappingRows.map(r => {
            const target = (r.targetField || '').trim();
            let error = null;
            if (target) {
                const targetLower = target.toLowerCase();
                // Relationship dot notation is allowed (Bulk + REST nested)
                const isRelationship = target.includes('.');
                if (!isRelationship && targetLower === 'id' && this.action !== ACTION.UPDATE) {
                    error = 'Id can only be used for Update';
                } else if (!isRelationship && !validFieldSet.has(targetLower)) {
                    error = 'Unknown field';
                } else if (!isRelationship && !writeableFieldSet.has(targetLower)) {
                    error = 'Field not writeable for this action';
                } else if (duplicateTargets.has(targetLower)) {
                    error = 'Duplicate mapping';
                }
            }
            return {
                ...r,
                error,
                inputClass: error ? 'slds-input slds-has-error' : 'slds-input',
                mappingWrapperClass: error ? 'slds-has-error' : '',
            };
        });
        this.mappingRows = updated;

        // Object error is driven by describe load
        // no toast spam; inline errors only
    }

    validateBeforeRun() {
        if (isUndefinedOrNull(this.connector?.conn)) {
            return { ok: false, message: 'No active Salesforce connection.' };
        }
        if (isEmpty(this.objectApiName)) {
            return { ok: false, message: 'Object is required.' };
        }
        if (this.objectError) {
            return { ok: false, message: this.objectError };
        }
        if (!this.csvRows?.length) {
            return { ok: false, message: 'CSV is empty or not loaded.' };
        }

        const mappingTargets = this.mappingRows
            .map(r => (r.targetField || '').trim())
            .filter(Boolean);
        if (!mappingTargets.length) {
            return { ok: false, message: 'No mapped fields. Map at least one CSV column.' };
        }

        const hasMappingErrors = this.mappingRows.some(r => !!r.error);
        if (hasMappingErrors) {
            return { ok: false, message: 'Fix mapping errors before running.' };
        }

        if (this.action === ACTION.UPDATE) {
            const hasId = mappingTargets.some(t => t.toLowerCase() === 'id');
            if (!hasId)
                return {
                    ok: false,
                    message: 'Update requires an Id column mapped to the Id field.',
                };
        }

        if (this.action === ACTION.UPSERT) {
            if (isEmpty(this.externalIdFieldName)) {
                return { ok: false, message: 'Upsert requires selecting an External ID field.' };
            }
            const hasExt = mappingTargets.some(
                t => t.toLowerCase() === this.externalIdFieldName.toLowerCase()
            );
            if (!hasExt) {
                return {
                    ok: false,
                    message: `Upsert requires a CSV column mapped to ${this.externalIdFieldName}.`,
                };
            }
        }

        return { ok: true };
    }

    /** Describe helpers */
    async loadSObjectDescribe() {
        this.objectError = null;
        this.fieldNames = [];
        this.externalIdOptions = [];
        this.sobjectDescribe = null;

        if (isUndefinedOrNull(this.connector?.conn) || isEmpty(this.objectApiName)) return;

        try {
            const desc = await this.connector.conn.sobject(this.objectApiName).describe();
            this.sobjectDescribe = desc;
            this.fieldNames = (desc?.fields || []).map(f => f.name).filter(Boolean);
            const externalIdFields = (desc?.fields || [])
                .filter(f => f.externalId === true)
                .map(f => ({ label: f.name, value: f.name }));
            this.externalIdOptions = externalIdFields;
        } catch (e) {
            this.objectError = e?.message || 'Failed to describe object';
        }
    }

    /** REST import */
    async runRestImport({ onlyRowIndexes } = {}) {
        this._setInfo('Running REST import...');
        // JSforce multi-record CRUD uses sObject collections/composite APIs (200 records/request).
        const batchSize = Math.min(
            Math.max(Number(this.restBatchSize) || REST_MAX_BATCH_SIZE, 1),
            REST_MAX_BATCH_SIZE
        );
        const payload = this.buildRecordsForRestPayload();
        this.lastRestPayload = payload;

        const selectedPayload = onlyRowIndexes
            ? payload.filter(p => onlyRowIndexes.has(p.rowIndex))
            : payload;

        const conn = this.connector.conn;
        const sobj = conn.sobject(this.objectApiName);

        const resultsMap = new Map((this.results || []).map(r => [r.rowNumber - 1, r]));
        const total = selectedPayload.length;

        for (let i = 0; i < selectedPayload.length; i += batchSize) {
            if (this.cancelRequested) break;
            const chunk = selectedPayload.slice(i, i + batchSize);
            const chunkRecords = chunk.map(x => x.record);
            let rets;
            if (this.action === ACTION.INSERT) {
                rets = await sobj.create(chunkRecords, { allOrNone: false });
            } else if (this.action === ACTION.UPDATE) {
                rets = await sobj.update(chunkRecords, { allOrNone: false });
            } else {
                rets = await sobj.upsert(chunkRecords, this.externalIdFieldName, {
                    allOrNone: false,
                });
            }
            const arr = Array.isArray(rets) ? rets : [rets];
            for (let c = 0; c < arr.length; c++) {
                const ret = arr[c];
                const originalRowIndex = chunk[c]?.rowIndex ?? i + c;
                resultsMap.set(originalRowIndex, this.normalizeRestResult(originalRowIndex, ret));
            }
            const processed = Math.min(i + chunk.length, total);
            this._setInfo(`Running REST import... ${processed}/${total} processed`);
        }

        const merged = Array.from(resultsMap.values()).sort((a, b) => a.rowNumber - b.rowNumber);
        this.results = merged;
        const { succeeded, failed } = this.countResults(merged);
        if (this.cancelRequested) {
            this._setWarning(`Import canceled. Succeeded: ${succeeded}, Failed: ${failed}.`);
        } else {
            this._setSuccess(`Import completed. Succeeded: ${succeeded}, Failed: ${failed}.`);
        }
    }

    buildRecordsForRestPayload() {
        const mapped = this.mappingRows
            .map(r => ({ csv: r.csvHeader, target: (r.targetField || '').trim() }))
            .filter(m => !!m.target);

        const payload = [];
        for (let i = 0; i < this.csvRows.length; i++) {
            const row = this.csvRows[i] || {};
            const record = {};
            for (const m of mapped) {
                const rawValue = row[m.csv];
                const value =
                    rawValue === undefined || rawValue === null || String(rawValue).trim() === ''
                        ? null
                        : rawValue;
                if (m.target.includes('.')) {
                    this.assignRelationshipField(record, m.target, value);
                } else {
                    record[m.target] = value;
                }
            }
            payload.push({ rowIndex: i, record });
        }
        return payload;
    }

    assignRelationshipField(targetRecord, dottedField, value) {
        // Supports e.g. Parent__r.External_ID__c → { Parent__r: { External_ID__c: value } }
        const parts = dottedField
            .split('.')
            .map(p => p.trim())
            .filter(Boolean);
        if (parts.length < 2) {
            targetRecord[dottedField] = value;
            return;
        }
        const rel = parts[0];
        const field = parts.slice(1).join('.');
        if (!targetRecord[rel] || typeof targetRecord[rel] !== 'object') {
            targetRecord[rel] = {};
        }
        targetRecord[rel][field] = value;
    }

    normalizeRestResult(rowIndex, ret) {
        const errors = Array.isArray(ret?.errors) ? ret.errors : [];
        return {
            rowNumber: rowIndex + 1,
            success: ret?.success === true,
            id: ret?.id || '',
            errors: errors
                .map(e => e?.message || e?.content || String(e))
                .filter(Boolean)
                .join('; '),
        };
    }

    /** Bulk v2 ingest */
    async runBulkV2Import() {
        this._setInfo('Starting Bulk v2 ingest job...');
        const version = this.connector.conn.version;
        const operation = this.action;
        const delimiter = this.bulkV2ColumnDelimiter;
        const csv = this.buildMappedCsv();

        const job = await this.connector.conn.request({
            method: 'POST',
            url: `/services/data/v${version}/jobs/ingest`,
            body: JSON.stringify({
                object: this.objectApiName,
                operation,
                contentType: 'CSV',
                lineEnding: 'LF',
                columnDelimiter: delimiter,
                ...(this.action === ACTION.UPSERT
                    ? { externalIdFieldName: this.externalIdFieldName }
                    : {}),
            }),
            headers: { 'Content-Type': 'application/json' },
        });

        this.lastCreatedJobId = job?.id;
        if (!job?.id) throw new Error('Bulk ingest job creation failed (no job id).');

        await this.connector.conn.request({
            method: 'PUT',
            url: `/services/data/v${version}/jobs/ingest/${job.id}/batches`,
            body: csv,
            headers: { 'Content-Type': 'text/csv' },
        });

        await this.connector.conn.request({
            method: 'PATCH',
            url: `/services/data/v${version}/jobs/ingest/${job.id}`,
            body: JSON.stringify({ state: 'UploadComplete' }),
            headers: { 'Content-Type': 'application/json' },
        });

        this._setInfo(`Job ${job.id} created. Polling...`);
        const { job: completed, stoppedReason } = await this.pollBulkV2Job(job.id);

        this.selectedJob = { id: job.id };
        this.selectedJobDetails = completed;
        const processed = completed?.numberRecordsProcessed ?? '';
        const failed = completed?.numberRecordsFailed ?? '';

        // Avoid banner updates if the user navigated away from the app.
        if (!this.isActive) return;

        const state = completed?.state;
        if (state === 'JobComplete') {
            this._setSuccess(`Bulk v2 job completed. Processed: ${processed}, Failed: ${failed}.`);
        } else if (state === 'Failed') {
            this._setError(`Bulk v2 job failed. Processed: ${processed}, Failed: ${failed}.`);
        } else if (state === 'Aborted') {
            this._setWarning(`Bulk v2 job aborted. Processed: ${processed}, Failed: ${failed}.`);
        } else if (stoppedReason === 'cancelRequested') {
            this._setWarning(
                `Cancel requested. Job state: ${state || 'Unknown'}. Processed: ${processed}, Failed: ${failed}.`
            );
        } else {
            this._setInfo(
                `Bulk v2 job state: ${state || 'Unknown'}. Processed: ${processed}, Failed: ${failed}.`
            );
        }
    }

    async pollBulkV2Job(jobId) {
        const version = this.connector.conn.version;
        const start = Date.now();
        const timeoutMs = 20 * 60 * 1000;
        let stoppedReason = null;
        // eslint-disable-next-line no-constant-condition
        while (true) {
            if (this.cancelRequested) {
                stoppedReason = 'cancelRequested';
                break;
            }
            if (!this.isActive) {
                stoppedReason = 'inactive';
                break;
            }
            const job = await this.connector.conn.request({
                method: 'GET',
                url: `/services/data/v${version}/jobs/ingest/${jobId}`,
            });
            const state = job?.state;
            if (['JobComplete', 'Failed', 'Aborted'].includes(state)) {
                return { job, stoppedReason: null };
            }
            if (Date.now() - start > timeoutMs) {
                throw new Error('Polling timed out. Job is still running.');
            }
            // Wait 2s between polls
            // eslint-disable-next-line no-await-in-loop
            await new Promise(r => setTimeout(r, 2000));
        }
        const job = await this.connector.conn.request({
            method: 'GET',
            url: `/services/data/v${version}/jobs/ingest/${jobId}`,
        });
        return { job, stoppedReason };
    }

    async abortBulkV2Job(jobId) {
        const version = this.connector.conn.version;
        await this.connector.conn.request({
            method: 'PATCH',
            url: `/services/data/v${version}/jobs/ingest/${jobId}`,
            body: JSON.stringify({ state: 'Aborted' }),
            headers: { 'Content-Type': 'application/json' },
        });
    }

    buildMappedCsv() {
        const delimiter = DELIMITER_TO_CHAR[this.delimiterKey] || ',';
        const mapped = this.mappingRows
            .map(r => ({ csv: r.csvHeader, target: (r.targetField || '').trim() }))
            .filter(m => !!m.target);
        const header = mapped.map(m => m.target).join(delimiter);
        const lines = this.csvRows.map(row => {
            return mapped
                .map(m => {
                    const v = row[m.csv];
                    return CSV.escapeCsvValue(delimiter, v);
                })
                .join(delimiter);
        });
        return `${header}\n${lines.join('\n')}`;
    }

    async fetchBulkV2ResultsText(jobId, endpointSuffix) {
        const version = this.connector.conn.version;
        const candidates = [
            endpointSuffix,
            endpointSuffix.toLowerCase(),
            endpointSuffix === 'unprocessedrecords' ? 'unprocessedRecords' : null,
        ].filter(Boolean);

        let text = null;
        let lastError = null;
        for (const suffix of candidates) {
            try {
                // eslint-disable-next-line no-await-in-loop
                text = await this.connector.conn.request({
                    method: 'GET',
                    url: `/services/data/v${version}/jobs/ingest/${jobId}/${suffix}`,
                    headers: { Accept: 'text/csv' },
                });
                break;
            } catch (e) {
                lastError = e;
            }
        }
        if (text == null) throw lastError || new Error('Failed downloading results.');

        // jsforce may parse response; ensure we stringify
        return typeof text === 'string' ? text : JSON.stringify(text, null, 2);
    }

    async downloadBulkV2Results(jobId, endpointSuffix, label) {
        const content = await this.fetchBulkV2ResultsText(jobId, endpointSuffix);
        this.downloadText(
            `${this.objectApiName || 'bulk'}-${jobId}-${label}.csv`,
            content,
            'text/csv'
        );
    }

    /** Bulk v1 */
    async runBulkV1Import() {
        // Minimal implementation using jsforce bulk wrapper
        this._setInfo('Running Bulk v1 import...');
        const csv = this.buildMappedCsv();
        const operation = this.action;
        const extId = this.externalIdFieldName;

        const bulk = this.connector.conn.bulk;
        if (!bulk) throw new Error('Bulk API v1 is not available on this connection.');

        const rets = await new Promise((resolve, reject) => {
            const options = operation === ACTION.UPSERT && extId ? { extIdField: extId } : {};
            const batch = bulk.load(this.objectApiName, operation, options, csv, (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
            batch.on('error', err => reject(err));
        });
        // Try to normalize as REST-like results
        const arr = Array.isArray(rets) ? rets : [];
        this.results = arr.map((r, idx) => ({
            rowNumber: idx + 1,
            success: r?.success === true || r?.success === 'true',
            id: r?.id || '',
            errors: Array.isArray(r?.errors)
                ? r.errors.map(e => e?.message || e?.statusCode || String(e)).join('; ')
                : r?.errors || '',
        }));
        const { succeeded, failed } = this.countResults(this.results);
        this._setSuccess(`Bulk v1 finished. Succeeded: ${succeeded}, Failed: ${failed}.`);
    }

    /** Job monitor */
    async refreshJobs() {
        if (this.isJobsRefreshing) return;
        if (isUndefinedOrNull(this.connector?.conn)) return;
        this.isJobsRefreshing = true;
        this.jobsError = null;
        try {
            const version = this.connector.conn.version;
            const first = await this.connector.conn.request({
                method: 'GET',
                url: `/services/data/v${version}/jobs/ingest`,
            });

            const records = Array.isArray(first) ? first : await this._fetchAllJobPages(first);
            this.jobs = records
                .map(j => ({
                    id: j.id,
                    object: j.object,
                    operation: j.operation,
                    state: j.state,
                    numberRecordsProcessed: j.numberRecordsProcessed,
                    numberRecordsFailed: j.numberRecordsFailed,
                    createdDate: j.createdDate,
                }))
                .sort((a, b) =>
                    String(b.createdDate || '').localeCompare(String(a.createdDate || ''))
                );
        } catch (e) {
            this.jobsError = e?.message || String(e);
        } finally {
            this.isJobsRefreshing = false;
        }
    }

    async _fetchAllJobPages(firstPage) {
        const records = [];
        let page = firstPage;
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const pageRecords = Array.isArray(page?.records)
                ? page.records
                : Array.isArray(page?.jobs)
                  ? page.jobs
                  : [];
            if (pageRecords.length) {
                records.push(...pageRecords);
            }
            const next = page?.nextRecordsUrl;
            if (!next) break;
            // eslint-disable-next-line no-await-in-loop
            page = await this.connector.conn.request({ method: 'GET', url: next });
        }
        return records;
    }

    async refreshSelectedJob() {
        if (!this.selectedJob?.id) return;
        try {
            const version = this.connector.conn.version;
            const detail = await this.connector.conn.request({
                method: 'GET',
                url: `/services/data/v${version}/jobs/ingest/${this.selectedJob.id}`,
            });
            this.selectedJobDetails = detail;
        } catch (e) {
            this.jobsError = e?.message || String(e);
        }
    }

    /** Results CSV */
    buildResultsCsv() {
        if (!this.results?.length) return '';
        const delimiter = ',';
        const header = ['RowNumber', 'Success', 'Id', 'Errors'].join(delimiter);
        const rows = this.results.map(r =>
            [
                r.rowNumber,
                r.success ? 'true' : 'false',
                CSV.escapeCsvValue(delimiter, r.id),
                CSV.escapeCsvValue(delimiter, r.errors),
            ].join(delimiter)
        );
        return `${header}\n${rows.join('\n')}`;
    }

    countResults(list) {
        let succeeded = 0;
        let failed = 0;
        for (const r of list || []) {
            if (r?.success) succeeded++;
            else failed++;
        }
        return { succeeded, failed };
    }

    /** Download utility */
    downloadText(name, text, contentType) {
        const blob = new Blob([text], { type: contentType || 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        // Delay revoke to avoid flaky downloads in some browsers (notably Safari/WebKit).
        setTimeout(() => {
            try {
                URL.revokeObjectURL(url);
            } finally {
                a.remove();
            }
        }, 1000);
    }

    /** Failed results preview helpers */
    resetFailedPreview() {
        this.isFailedPreviewOpen = false;
        this.failedPreviewLoading = false;
        this.failedPreviewError = null;
        this.failedPreviewColumns = [];
        this.failedPreviewRows = [];
        this.failedPreviewIsTruncated = false;
        this.failedPreviewRawIsTruncated = false;
        this.failedPreviewRawText = '';
        try {
            this.failedPreviewEditorModel?.dispose?.();
        } catch (e) {
            // ignore
        }
        this.failedPreviewEditorLoaded = false;
        this.failedPreviewEditorModel = null;
    }

    _truncateFailedPreviewRaw(text) {
        const raw = String(text || '');
        if (raw.length > this.failedPreviewRawLimitChars) {
            this.failedPreviewRawIsTruncated = true;
            return raw.slice(0, this.failedPreviewRawLimitChars);
        }
        this.failedPreviewRawIsTruncated = false;
        return raw;
    }

    _updateFailedPreviewEditor(text) {
        if (!this.failedPreviewEditorLoaded || !this.failedPreviewEditorModel) return;
        try {
            this.failedPreviewEditorModel.setValue(String(text || ''));
        } catch (e) {
            // non-blocking: editor may have been unmounted
        }
    }

    _buildFailedPreviewTable({ jobId, headers, rows }) {
        const normalizedHeaders = (headers || []).map(h => String(h));
        const lowerToOriginal = new Map(normalizedHeaders.map(h => [h.toLowerCase(), h]));

        const findHeader = (priorities, predicate) => {
            for (const p of priorities || []) {
                const h = lowerToOriginal.get(String(p).toLowerCase());
                if (h) return h;
            }
            if (typeof predicate === 'function') {
                const match = normalizedHeaders.find(h => predicate(h.toLowerCase()));
                if (match) return match;
            }
            return null;
        };

        const lineHeader = findHeader(
            ['sf__linenumber', 'linenumber', 'sf__rownumber', 'rownumber', 'row', 'rownumber'],
            h => h.includes('line')
        );
        const idHeader = findHeader(['sf__id', 'id'], h => h === 'sf__id' || h.endsWith('id'));
        const errorHeader = findHeader(
            ['sf__error', 'error', 'errormessage', 'sf__errormessage'],
            h => h.includes('error')
        );

        const used = new Set([lineHeader, idHeader, errorHeader].filter(Boolean));
        const extraHeaders = normalizedHeaders.filter(h => !used.has(h)).slice(0, 2);
        const extraKeys = extraHeaders.map((h, idx) => ({ header: h, key: `extra${idx}` }));

        const columns = [
            {
                label: 'Line',
                fieldName: 'lineNumber',
                type: 'number',
                initialWidth: 90,
            },
            ...(idHeader
                ? [
                      {
                          label: 'Id',
                          fieldName: 'recordId',
                          type: 'text',
                          initialWidth: 220,
                      },
                  ]
                : []),
            ...(errorHeader
                ? [
                      {
                          label: 'Error',
                          fieldName: 'error',
                          type: 'text',
                          wrapText: true,
                      },
                  ]
                : []),
            ...extraKeys.map(x => ({
                label: x.header,
                fieldName: x.key,
                type: 'text',
                wrapText: true,
            })),
        ];

        const inputRows = Array.isArray(rows) ? rows : [];
        const isTruncated = inputRows.length > this.failedPreviewRowLimit;
        const limited = inputRows.slice(0, this.failedPreviewRowLimit);
        const data = limited.map((r, idx) => {
            const lineNumberValue = lineHeader ? r?.[lineHeader] : null;
            const lineNumber = Number(lineNumberValue);
            const base = {
                key: `${jobId}-${idx}`,
                lineNumber: Number.isFinite(lineNumber) && lineNumber > 0 ? lineNumber : idx + 1,
                recordId: idHeader ? String(r?.[idHeader] || '') : '',
                error: errorHeader ? String(r?.[errorHeader] || '') : '',
            };
            for (const x of extraKeys) {
                base[x.key] = String(r?.[x.header] || '');
            }
            return base;
        });

        return { columns, rows: data, isTruncated };
    }

    /** Banner helpers */
    _setInfo(msg) {
        this.lastRunMessage = msg;
        this.lastRunMessageVariant = 'info';
    }
    _setSuccess(msg) {
        this.lastRunMessage = msg;
        this.lastRunMessageVariant = 'success';
    }
    _setWarning(msg) {
        this.lastRunMessage = msg;
        this.lastRunMessageVariant = 'warning';
    }
    _setError(msg) {
        this.lastRunMessage = msg;
        this.lastRunMessageVariant = 'error';
    }

    /** Getters */
    get pageClass() {
        return super.pageClass + ' slds-p-around_small data-import-root';
    }

    get modeOptions() {
        return [
            { label: 'REST (normal)', value: MODE.REST },
            { label: 'Bulk API 2.0 (Ingest)', value: MODE.BULK_V2 },
            { label: 'Bulk API 1.0 (classic)', value: MODE.BULK_V1 },
        ];
    }

    get actionOptions() {
        return [
            { label: 'Insert', value: ACTION.INSERT },
            { label: 'Update', value: ACTION.UPDATE },
            { label: 'Upsert', value: ACTION.UPSERT },
        ];
    }

    get delimiterOptions() {
        return [
            { label: 'Comma (,)', value: DELIMITER.COMMA },
            { label: 'Semicolon (;)', value: DELIMITER.SEMICOLON },
            { label: 'Tab (\\t)', value: DELIMITER.TAB },
            { label: 'Pipe (|)', value: DELIMITER.PIPE },
        ];
    }

    get modeLabel() {
        return this.modeOptions.find(o => o.value === this.mode)?.label || this.mode;
    }

    get showExternalId() {
        return this.action === ACTION.UPSERT;
    }

    get hasCsv() {
        return (this.csvHeaders?.length || 0) > 0 && (this.csvRows?.length || 0) > 0;
    }

    get csvRowCountFormatted() {
        return String(this.csvRows?.length || 0);
    }

    get mappingSummary() {
        const mapped = this.mappingRows.filter(r => (r.targetField || '').trim()).length;
        const total = this.mappingRows.length;
        return total ? `${mapped}/${total} mapped` : '';
    }

    get fieldMappingOptions() {
        const descFields = Array.isArray(this.sobjectDescribe?.fields)
            ? this.sobjectDescribe.fields
            : [];

        const isWriteable = f => {
            if (!f?.name) return false;
            if (f.name === 'Id') return this.action === ACTION.UPDATE;
            if (this.action === ACTION.INSERT) return f.createable === true;
            if (this.action === ACTION.UPDATE) return f.updateable === true;
            // UPSERT
            return f.createable === true || f.updateable === true;
        };

        return descFields
            .filter(isWriteable)
            .map(f => ({
                label: `${f.label || f.name} (${f.name})`,
                value: f.name,
            }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }

    get isRunDisabled() {
        return (
            this.isWorking ||
            !!this.objectError ||
            !this.hasCsv ||
            this.mappingRows.some(r => !!r.error) ||
            isEmpty(this.objectApiName)
        );
    }

    get isCancelDisabled() {
        return !this.isWorking;
    }

    get runButtonLabel() {
        if (this.isWorking) return 'Running...';
        return this.mode === MODE.REST
            ? 'Run (REST)'
            : this.mode === MODE.BULK_V2
              ? 'Run (Bulk v2)'
              : 'Run (Bulk v1)';
    }

    get resultsSummary() {
        if (!this.results?.length) return this.isWorking ? 'Running...' : 'No results yet';
        const { succeeded, failed } = this.countResults(this.results);
        return `Succeeded: ${succeeded} • Failed: ${failed}`;
    }

    get lastRunMessageClass() {
        const base = 'slds-text-body_small';
        if (this.lastRunMessageVariant === 'success') return `${base} slds-text-color_success`;
        if (this.lastRunMessageVariant === 'warning') return `${base} slds-text-color_warning`;
        if (this.lastRunMessageVariant === 'error') return `${base} slds-text-color_error`;
        return `${base} slds-text-color_weak`;
    }

    get hasResults() {
        return (this.results?.length || 0) > 0;
    }

    get isRetryFailedDisabled() {
        const hasFailed = (this.results || []).some(r => r && r.success === false);
        return this.isWorking || this.mode !== MODE.REST || !hasFailed;
    }

    get jobsCount() {
        return this.jobs?.length || 0;
    }

    get hasJobs() {
        return (this.jobs?.length || 0) > 0;
    }

    get isDownloadDisabled() {
        return isUndefinedOrNull(this.selectedJob?.id) || this.isJobsRefreshing;
    }

    get isPreviewFailedDisabled() {
        return this.isDownloadDisabled || this.failedPreviewLoading;
    }

    get isAbortDisabled() {
        const state = this.selectedJobDetails?.state;
        if (this.isJobsRefreshing) return true;
        // Abort generally only works in Open/UploadComplete/InProgress
        return !this.selectedJob?.id || ['JobComplete', 'Failed', 'Aborted'].includes(state);
    }

    get failedPreviewHasRows() {
        return (this.failedPreviewRows?.length || 0) > 0;
    }

    get bulkV2ColumnDelimiter() {
        switch (this.delimiterKey) {
            case DELIMITER.SEMICOLON:
                return 'SEMICOLON';
            case DELIMITER.TAB:
                return 'TAB';
            case DELIMITER.PIPE:
                return 'PIPE';
            default:
                return 'COMMA';
        }
    }
}
