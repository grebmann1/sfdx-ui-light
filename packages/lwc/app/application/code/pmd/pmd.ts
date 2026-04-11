import { api } from 'lwc';
import { decodeError, isNotUndefinedOrNull, isUndefinedOrNull } from 'shared/utils';
import { getDesktopPmdInstallation, installDesktopLatestPmd } from 'core/electron/desktopBridge';
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
        const result = await getDesktopPmdInstallation(this.projectPath);
        console.info('checkIfPmdInstalled', result);
        this.pmdPath = isNotUndefinedOrNull(result?.executablePath) ? result.executablePath : null;
    };

    installLatestPMD = async (): Promise<void> => {
        try {
            await installDesktopLatestPmd(this.projectPath);
            await this.checkIfPmdInstalled();
        } catch (error) {
            throw decodeError(error);
        }
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
