import LightningModal from 'lightning/modal';
import { api } from 'lwc';
import { isEmpty, isUndefinedOrNull, isNotUndefinedOrNull } from 'shared/utils';
import Toast from 'lightning/toast';

export default class EditorModal extends LightningModal {
    @api alias;
    @api body;
    @api title;

    apexScript;
    isApexRunning = false;

    // error
    error_message;
    error_title;

    connectedCallback() {
        this.loadCache();
    }

    handleCloseClick() {
        //this.close('canceled');
        this.close();
    }

    closeModal() {
        this.close();
    }

    /* Methods */

    loadCache = async () => {
        try {
            let key = `${this.alias}-platformevent-script`;
            const _script = await window.defaultStore.getItem(key);
            if (!isEmpty(_script)) {
                this.apexScript = _script;
            }
        } catch (e) {
            console.error(e);
        }
    };

    resetError = () => {
        this.error_title = null;
        this.error_message = null;
    };

    /** events **/

    executeApex = e => {
        this.isApexRunning = true;
        this.resetError();
        this.refs.editor
            .executeApex(null)
            .then(res => {
                if (res.success) {
                    Toast.show({
                        label: 'Apex run : Success',
                        //message: 'Exported to your clipboard', // Message is hidden in small screen
                        variant: 'success',
                    });
                    this.close();
                } else {
                    this.error_title = 'Apex run : Failed';
                    this.error_message = res.exceptionMessage || res.compileProblem;
                }
                this.isApexRunning = false;
            })
            .catch(e => {
                console.error(e);
            });
    };

    handleMonacoLoaded = e => {
        //console.log('loaded');
        this.refs.editor.displayFiles('ApexClass', [
            {
                id: 'abc',
                path: 'abc',
                name: 'Script',
                apiVersion: 60,
                body: isEmpty(this.apexScript)
                    ? "Update [Select Id from Account limit 1];"
                    : this.apexScript,
                language: 'apex',
            },
        ]);
    };

    handleEditorChange = e => {
        //console.log('handleEditorChange',e.detail);
        this.apexScript = e.detail.value;
        let key = `${this.alias}-platformevent-script`;
        window.defaultStore.setItem(key, this.apexScript);
    };

    /** Getter **/

    get hasError() {
        return isNotUndefinedOrNull(this.error_message);
    }

    get isExecuteApexDisabled() {
        return isEmpty(this.apexScript) || this.isApexRunning;
    }
}
