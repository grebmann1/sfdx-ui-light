import LightningModal from 'lightning/modal';
import { api } from 'lwc';
import Toast from 'lightning/toast';
import { isEmpty } from 'shared/utils';

const DEFAULT_PAYLOAD = '{\n  \n}\n';

export default class PublisherModal extends LightningModal {
    @api title;
    @api apiName;
    @api instanceUrl;
    @api accessToken;
    @api apiVersion;

    isPublishing = false;
    errorMessage = null;

    currentModel;

    handleMonacoLoaded = () => {
        this.currentModel = this.refs.editor.createModel({
            body: DEFAULT_PAYLOAD,
            language: 'json',
        });
        this.refs.editor.displayModel(this.currentModel);
    };

    handleCloseClick() {
        this.close();
    }

    get payloadText() {
        if (this.currentModel) return this.currentModel.getValue();
        return DEFAULT_PAYLOAD;
    }

    get hasError() {
        return !isEmpty(this.errorMessage);
    }

    get isPublishDisabled() {
        return this.isPublishing || isEmpty(this.apiName);
    }

    get apexSnippet() {
        try {
            const payload = JSON.parse(this.payloadText || '{}');
            const assignments = Object.entries(payload)
                .filter(([k, v]) => k && v !== undefined)
                .map(([k, v]) => `${k}=${this.toApexLiteral(v)}`)
                .join(', ');
            const body = assignments ? `(${assignments})` : '()';
            return [
                `${this.apiName} evt = new ${this.apiName}${body};`,
                'Database.SaveResult res = EventBus.publish(evt);',
                "System.debug('publish success=' + res.isSuccess());",
            ].join('\\n');
        } catch {
            return '/* Invalid JSON payload */';
        }
    }

    toApexLiteral(value) {
        if (value === null) return 'null';
        if (typeof value === 'number' || typeof value === 'boolean') return `${value}`;
        if (typeof value === 'string') {
            return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
        }
        // For objects/arrays, fall back to JSON string (user can adjust)
        return `'${JSON.stringify(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
    }

    copyApexSnippet = async () => {
        try {
            await navigator.clipboard.writeText(this.apexSnippet);
            Toast.show({ label: 'Copied', message: 'Apex snippet copied', variant: 'success' });
        } catch (e) {
            Toast.show({ label: 'Copy failed', message: e?.message || 'Unable to copy', variant: 'warning' });
        }
    };

    publish = async () => {
        this.isPublishing = true;
        this.errorMessage = null;
        try {
            const payload = JSON.parse(this.payloadText || '{}');
            const jsforce = window.jsforce;
            if (!jsforce) {
                throw new Error('jsforce not available');
            }
            const conn = new jsforce.Connection({
                instanceUrl: this.instanceUrl,
                accessToken: this.accessToken,
            });
            if (this.apiVersion) {
                conn.version = this.apiVersion;
            }
            const res = await conn.sobject(this.apiName).create(payload);
            if (res?.success) {
                Toast.show({ label: 'Published', message: `Event published (id=${res.id})`, variant: 'success' });
                this.close(res);
            } else {
                const msg = res?.errors?.join?.(', ') || 'Publish failed';
                this.errorMessage = msg;
            }
        } catch (e) {
            this.errorMessage = e?.message || 'Publish failed';
        } finally {
            this.isPublishing = false;
        }
    };
}

