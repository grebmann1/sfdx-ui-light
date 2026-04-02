import { LightningElement } from 'lwc';
import Toast from 'lightning/toast';
import { cacheManager, CACHE_CONFIG } from 'shared/cacheManager';
import { store, APPLICATION } from 'core/store';

const EMPLOYEE_AI_SETUP_URL = 'https://example.com/salesforce-employee-ai-setup';
const EMPLOYEE_OPENAI_PROXY_URL =
    'https://eng-ai-model-gateway.sfproxy.devx-preprod.aws-esvc1-useast2.aws.sfdc.cl';
const KEY_PATTERN = /^sk-[A-Za-z0-9]+$/;

export default class OnboardaiProvider extends LightningElement {
    selectedAudience = null;
    employeeKey = '';
    externalKey = '';

    get employeeSetupUrl() {
        return EMPLOYEE_AI_SETUP_URL;
    }

    get isEmployeeSelected() {
        return this.selectedAudience === 'employee';
    }

    get isExternalSelected() {
        return this.selectedAudience === 'external';
    }

    handleSelectEmployee = () => {
        this.selectedAudience = 'employee';
    };

    handleSelectExternal = () => {
        this.selectedAudience = 'external';
    };

    handleResetSelection = () => {
        this.selectedAudience = null;
    };

    handleEmployeeKeyChange = event => {
        this.employeeKey = event?.detail?.value?.trim() || '';
    };

    handleExternalKeyChange = event => {
        this.externalKey = event?.detail?.value?.trim() || '';
    };

    get isEmployeeKeyValid() {
        return KEY_PATTERN.test(this.employeeKey);
    }

    get isExternalKeyValid() {
        return KEY_PATTERN.test(this.externalKey);
    }

    handleInstallEmployeeKey = async () => {
        if (!this.isEmployeeKeyValid) return;
        await cacheManager.saveConfig({
            [CACHE_CONFIG.OPENAI_KEY.key]: this.employeeKey,
            [CACHE_CONFIG.OPENAI_URL.key]: EMPLOYEE_OPENAI_PROXY_URL,
        });
        store.dispatch(
            APPLICATION.reduxSlice.actions.updateOpenAIKey({
                openaiKey: this.employeeKey,
                openaiUrl: EMPLOYEE_OPENAI_PROXY_URL,
            })
        );
        Toast.show({ message: 'Employee key installed', variant: 'success' });
    };

    handleInstallExternalKey = async () => {
        if (!this.isExternalKeyValid) return;
        await cacheManager.saveConfig({
            [CACHE_CONFIG.OPENAI_KEY.key]: this.externalKey,
        });
        store.dispatch(
            APPLICATION.reduxSlice.actions.updateOpenAIKey({
                openaiKey: this.externalKey,
            })
        );
        Toast.show({ message: 'OpenAI key installed', variant: 'success' });
    };
}
