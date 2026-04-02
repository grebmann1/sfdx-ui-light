import { LightningElement, wire, api } from 'lwc';
import Toast from 'lightning/toast';
import { isUndefinedOrNull, isNotUndefinedOrNull, classSet } from 'shared/utils';
import { chromeOpenInWindow } from 'extension/utils';
import moment from 'moment';

/** Store **/
import { BACKGROUNDJOB, ERROR, store, connectStore } from 'core/store';

export default class Footer extends LightningElement {
    @api version;

    isFooterDisplayed = true;

    connector;

    // Error panel state
    isErrorPanelOpen = false;
    selectedError = null;
    errors = [];
    filterText = '';

    // Job panel state
    isJobPanelOpen = false;
    selectedJob = null;
    jobs = [];
    jobFilterText = '';
    nowTick = Date.now();
    timerIntervalId;
    isJobActionRunning = false;

    connectedCallback() {
        this.timerIntervalId = window.setInterval(() => {
            this.nowTick = Date.now();
        }, 1000);
    }

    disconnectedCallback() {
        if (this.timerIntervalId) {
            window.clearInterval(this.timerIntervalId);
            this.timerIntervalId = null;
        }
    }

    @wire(connectStore, { store })
    applicationChange({ application, errors, backgroundJobs }) {
        // connector
        if (application.connector) {
            this.connector = null;
            this.connector = application.connector;
        }
        // errors from store
        if (errors) {
            this.errors = errors;
        }
        if (backgroundJobs) {
            this.jobs = backgroundJobs;
        }
    }

    /** Events **/

    handleCopyUsername = () => {
        navigator.clipboard.writeText(this.usernameFormatted);
        Toast.show({
            label: 'Username exported to your clipboard',
            variant: 'success',
        });
    };

    handleCopyAccessToken = () => {
        navigator.clipboard.writeText(this.accessTokenFormatted);
        Toast.show({
            label: 'Access Token exported to your clipboard',
            variant: 'success',
        });
    };

    handleUsernameClick = e => {
        e.preventDefault();
        const targetUrl = encodeURIComponent(
            `/${this.connector.configuration?.userInfo?.user_id}?noredirect=1&isUserEntityOverride=1`
        );
        chromeOpenInWindow(
            `${this.connector.configuration?.userInfo?.urls?.custom_domain}/lightning/setup/ManageUsers/page?address=${targetUrl}`,
            this.usernameFormatted,
            false
        );
    };

    handleErrorClick = () => {
        this.isErrorPanelOpen = !this.isErrorPanelOpen;
        this.isJobPanelOpen = false;
        this.selectedError = null;
    };

    handleErrorItemClick = event => {
        const errorId = event.currentTarget.dataset.id;
        if (this.selectedError && this.selectedError.id == errorId) {
            // Deselect if already selected
            this.selectedError = null;
        } else {
            this.selectedError = this.errors.find(e => e.id == errorId);
        }
    };

    handleClosePanel = () => {
        this.isErrorPanelOpen = false;
        this.isJobPanelOpen = false;
        this.selectedError = null;
        this.selectedJob = null;
    };

    handleFilterInput = event => {
        this.filterText = event.target.value;
    };

    handleClearErrors = () => {
        store.dispatch(ERROR.reduxSlice.actions.clearErrors());
        this.selectedError = null;
    };

    handleJobClick = () => {
        this.isJobPanelOpen = !this.isJobPanelOpen;
        this.isErrorPanelOpen = false;
        this.selectedJob = null;
    };

    handleJobItemClick = event => {
        const jobId = event.currentTarget.dataset.id;
        if (this.selectedJob && this.selectedJob.id == jobId) {
            this.selectedJob = null;
        } else {
            this.selectedJob = this.jobs.find(job => String(job.id) === String(jobId));
        }
    };

    handleJobFilterInput = event => {
        this.jobFilterText = event.target.value;
    };

    handleClearJobs = () => {
        store.dispatch(BACKGROUNDJOB.reduxSlice.actions.clearJobs());
        this.selectedJob = null;
    };

    handleJobActionClick = async event => {
        const actionId = event.currentTarget.dataset.actionId;
        const action = this.selectedJobActions.find(item => String(item.id) === String(actionId));
        if (!action || this.isJobActionRunning) {
            return;
        }

        this.isJobActionRunning = true;
        try {
            await this.executeJobAction(action);
        } catch (error) {
            Toast.show({
                label: error?.message || 'Unable to execute job action',
                variant: 'error',
            });
        } finally {
            this.isJobActionRunning = false;
        }
    };

    /** Getters **/

    get hasErrors() {
        return this.errors && this.errors.length > 0;
    }

    get selectedErrorSource() {
        return this.selectedError?.source || '';
    }

    get selectedJobSource() {
        return this.selectedJob?.source || '';
    }

    get selectedJobActions() {
        return Array.isArray(this.selectedJob?.actions) ? this.selectedJob.actions : [];
    }

    get hasSelectedJobActions() {
        return this.selectedJobActions.length > 0;
    }

    get latestErrorMessage() {
        return this.hasErrors ? this.errors[this.errors.length - 1].message : '';
    }

    get hasJobs() {
        return this.jobs && this.jobs.length > 0;
    }

    get latestJobMessage() {
        if (!this.hasJobs) return '';
        const latest = this.jobs
            .slice()
            .sort((a, b) => (b.updatedAt || b.startedAt || 0) - (a.updatedAt || a.startedAt || 0))[0];
        return this.formatJobSummary(latest);
    }

    get isConnectorDisplayed() {
        return isNotUndefinedOrNull(this.connector);
    }

    get usernameFormatted() {
        return isUndefinedOrNull(this.connector?.configuration?.username)
            ? ''
            : `${this.connector.configuration.username}`;
    }

    get accessTokenFormatted() {
        return isUndefinedOrNull(this.connector?.conn?.accessToken)
            ? ''
            : `${this.connector.conn.accessToken}`;
    }

    get versionFormatted() {
        return isNotUndefinedOrNull(this.version) ? this.version + ' / ' : '';
    }

    get salesforceVersionFormatted() {
        const version = this.connector?.conn?._versions?.find(
            x => x.version === this.connector.conn.version
        );
        return version ? `${version.label} (${version.version})` : 'Unknown';
    }

    get formattedErrorCount() {
        return this.errors.length > 0 ? `(${this.errors.length})` : '';
    }

    get filteredErrors() {
        let filtered = this.errors;
        if (this.filterText && this.filterText.trim()) {
            const search = this.filterText.trim().toLowerCase();
            filtered = filtered.filter(e => {
                const formattedTime = moment(e.time).format('YYYY-MM-DD HH:mm:ss');
                return (
                    (e.name && e.name.toLowerCase().includes(search)) ||
                    (e.message && e.message.toLowerCase().includes(search)) ||
                    (e.details && e.details.toLowerCase().includes(search)) ||
                    (e.source && e.source.toLowerCase().includes(search)) ||
                    (formattedTime && formattedTime.toLowerCase().includes(search))
                );
            });
        }
        // Show latest error first and add class for selection
        return filtered
            .slice()
            .reverse()
            .map(e => ({
                ...e,
                formattedTime: moment(e.time).format('YYYY-MM-DD HH:mm:ss'),
                selected: this.selectedError && e.id === this.selectedError.id,
                class: this.getErrorListItemClass(e),
            }));
    }

    get formattedJobCount() {
        return this.jobs.length > 0 ? `(${this.jobs.length})` : '';
    }

    get filteredJobs() {
        let filtered = this.jobs;
        if (this.jobFilterText && this.jobFilterText.trim()) {
            const search = this.jobFilterText.trim().toLowerCase();
            filtered = filtered.filter(job => {
                const formattedTime = moment(job.updatedAt || job.startedAt).format(
                    'YYYY-MM-DD HH:mm:ss'
                );
                return (
                    (job.label && job.label.toLowerCase().includes(search)) ||
                    (job.category && job.category.toLowerCase().includes(search)) ||
                    (job.status && job.status.toLowerCase().includes(search)) ||
                    (job.phase && job.phase.toLowerCase().includes(search)) ||
                    (job.message && job.message.toLowerCase().includes(search)) ||
                    (job.error && String(job.error).toLowerCase().includes(search)) ||
                    (formattedTime && formattedTime.toLowerCase().includes(search))
                );
            });
        }

        return filtered
            .slice()
            .sort((a, b) => (b.updatedAt || b.startedAt || 0) - (a.updatedAt || a.startedAt || 0))
            .map(job => ({
                ...job,
                formattedTime: moment(job.updatedAt || job.startedAt).format('YYYY-MM-DD HH:mm:ss'),
                shortTime: moment(job.updatedAt || job.startedAt).format('HH:mm:ss'),
                selected: this.selectedJob && String(job.id) === String(this.selectedJob.id),
                class: this.getJobListItemClass(job),
                categoryLabel: this.formatJobLabel(job.category),
                statusLabel: this.formatJobLabel(job.status),
                phaseLabel: this.formatJobLabel(job.phase),
                elapsedLabel: this.formatElapsedLabel(job),
                displayMessage: this.formatJobDisplayMessage(job),
            }));
    }

    get errorListClass() {
        return classSet('footer-error-list scrollable-error-list slds-flex-column')
            .add({
                'with-details': this.selectedError,
            })
            .toString();
    }

    get jobListClass() {
        return classSet('footer-job-list scrollable-job-list slds-flex-column')
            .add({
                'with-details': this.selectedJob,
            })
            .toString();
    }

    get selectedJobUpdatedAtFormatted() {
        if (!this.selectedJob) return '';
        return moment(this.selectedJob.updatedAt || this.selectedJob.startedAt).format(
            'YYYY-MM-DD HH:mm:ss'
        );
    }

    get selectedJobElapsedLabel() {
        return this.selectedJob ? this.formatElapsedLabel(this.selectedJob) : '';
    }

    getErrorListItemClass(error) {
        return (
            'footer-error-list-item' +
            (this.selectedError && error.id === this.selectedError.id ? ' slds-is-active' : '')
        );
    }

    getJobListItemClass(job) {
        return (
            'footer-job-list-item' +
            (this.selectedJob && String(job.id) === String(this.selectedJob.id)
                ? ' slds-is-active'
                : '')
        );
    }

    formatJobSummary(job) {
        if (!job) return '';
        const status = this.formatJobLabel(job.status);
        return `${this.getJobDisplayTitle(job)} ${status} ${this.formatElapsedLabel(job)}`;
    }

    formatJobDisplayMessage(job) {
        if (job.message && String(job.message).trim()) {
            return job.message;
        }
        if (job.error) {
            return String(job.error);
        }
        return this.formatJobSummary(job);
    }

    getJobDisplayTitle(job) {
        if (!job) return 'Background job';
        if (job.category === 'metadata') return 'Metadata sync';
        if (job.category === 'accessAnalyzer') return 'Access Analyzer';
        if (job.category === 'package') return job.label || 'Package job';
        return job.label || 'Background job';
    }

    formatJobLabel(value) {
        if (!value) return '';
        return String(value)
            .replace(/[_-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/\b\w/g, letter => letter.toUpperCase());
    }

    formatElapsedLabel(job) {
        const startedAt = Number(job?.startedAt || 0);
        if (!Number.isFinite(startedAt) || startedAt <= 0) {
            return '0s';
        }
        const isRunning = (job?.status || '').toLowerCase() === 'running';
        const stopAt = isRunning ? this.nowTick : Number(job?.endedAt || job?.updatedAt || this.nowTick);
        const elapsedSeconds = Math.max(0, Math.floor((stopAt - startedAt) / 1000));
        return `${elapsedSeconds}s`;
    }

    executeJobAction(action) {
        const handlers = {
            downloadBase64: payload => {
                if (!payload?.contentBase64) {
                    throw new Error('No file content available for download.');
                }
                const blob = this.base64ToBlob(
                    payload.contentBase64,
                    payload.mimeType || 'application/octet-stream'
                );
                this.downloadBlob(blob, payload.fileName || `job-${Date.now()}.bin`);
            },
        };

        const handler = handlers[action?.kind];
        if (!handler) {
            throw new Error(`Unsupported action: ${action?.kind || 'unknown'}`);
        }

        handler(action.payload || {});
        return Promise.resolve();
    }

    base64ToBlob(base64, mimeType) {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
    }

    downloadBlob(blob, filename) {
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    }
}
