import { LightningElement } from 'lwc';
import Toast from 'lightning/toast';
import {
    loadLlmProviderConfigMapFromCache,
    saveLlmProviderConfigMapToCache,
} from 'shared/cacheManager';
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
        const providerConfigs = await loadLlmProviderConfigMapFromCache();
        const nextProviderConfigs = {
            ...providerConfigs,
            openai: {
                ...providerConfigs.openai,
                apiKey: this.employeeKey,
                baseUrl: EMPLOYEE_OPENAI_PROXY_URL,
            },
            anthropic: {
                ...providerConfigs.anthropic,
                apiKey: this.employeeKey,
                baseUrl: EMPLOYEE_OPENAI_PROXY_URL,
            },
        };
        await saveLlmProviderConfigMapToCache(nextProviderConfigs);
        store.dispatch(
            APPLICATION.reduxSlice.actions.updateProviderConfigs({
                providerConfigs: nextProviderConfigs,
            })
        );
        Toast.show({ message: 'Employee key installed', variant: 'success' });
    };

    handleInstallExternalKey = async () => {
        if (!this.isExternalKeyValid) return;
        const providerConfigs = await loadLlmProviderConfigMapFromCache();
        const nextProviderConfigs = {
            ...providerConfigs,
            openai: {
                ...providerConfigs.openai,
                apiKey: this.externalKey,
            },
        };
        await saveLlmProviderConfigMapToCache(nextProviderConfigs);
        store.dispatch(
            APPLICATION.reduxSlice.actions.updateProviderConfigs({
                providerConfigs: nextProviderConfigs,
            })
        );
        Toast.show({ message: 'OpenAI key installed', variant: 'success' });
    };
}
