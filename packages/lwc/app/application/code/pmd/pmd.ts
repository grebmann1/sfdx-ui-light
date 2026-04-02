import { api } from 'lwc';
import { decodeError, isNotUndefinedOrNull, isUndefinedOrNull } from 'shared/utils';
import ToolkitElement from 'core/toolkitElement';

export default class Pmd extends ToolkitElement {
    @api pmdPath: string | null = null;

    _projectPath: string | null = null;
    @api
    get projectPath(): string | null {
        return this._projectPath;
    }
    set projectPath(value: string | null) {
        this._projectPath = value;
        if (isNotUndefinedOrNull(value)) {
            this.checkIfPmdInstalled();
        }
    }

    connectedCallback() {}

    /** Methods  **/

    handleCopy = (): void => {
        navigator.clipboard.writeText(this.pmdPath);
    };

    checkIfPmdInstalled = async (): Promise<void> => {
        const { error, result } = await window.electron.invoke('code-isPmdInstalled', {
            projectPath: this.projectPath,
        });
        if (error) {
            throw decodeError(error);
        }
        console.info('checkIfPmdInstalled', { error, result });
        this.pmdPath = isNotUndefinedOrNull(result) ? `${result}/bin/pmd` : null;
    };

    installLatestPMD = async (): Promise<void> => {
        const { error, result } = await window.electron.invoke('code-installLatestPmd', {
            projectPath: this.projectPath,
        });
        if (error) {
            throw decodeError(error);
        }
        console.info('installLatestPMD', result);
        this.checkIfPmdInstalled();
    };

    /** Getters **/

    get pmdCommand() {
        return `${this.pmdPathFormatted} check -f summaryhtml -R ".sf-toolkit/pmd/rulesets/apex/quickstart.xml" -d "force-app/main/default/classes" -r ".sf-toolkit/pmd/reports/report.html"`;
    }

    get installPMDLabel() {
        return this.isPmdInstalled ? 'PMD Already Installed' : 'Install PMD in your project';
    }

    get isPmdInstalled() {
        return isNotUndefinedOrNull(this.pmdPath);
    }

    get isButtonDisabled() {
        return isUndefinedOrNull(this.projectPath) || this.isPmdInstalled;
    }

    get pmdPathFormatted() {
        return isUndefinedOrNull(this.pmdPath) ? 'pmd' : this.pmdPath;
    }
}
