import { track } from 'lwc';
import { decodeError, isNotUndefinedOrNull } from 'shared/utils';
import ToolkitElement from 'core/toolkitElement';
import Analytics from 'shared/analytics';

export default class App extends ToolkitElement {
    isLoading = false;
    loadingMessage = 'Loading Metadata';

    @track metadata: Record<string, any> | null = null;
    projectPath: string | null = null;
    initMetadataLoaded = false;

    connectedCallback() {
        Analytics.trackAppOpen('code', { alias: this.alias });
        //getConfig
        this.loadPathFromConfig();
    }

    /** Methods  **/

    loadPathFromConfig = async (): Promise<void> => {
        const { error, result } = await window.electron.invoke('code-getInitialConfig', {
            alias: this.connector.configuration.alias,
        });
        if (error) {
            throw decodeError(error);
        }
        //console.log('result',result);
        this.projectPath = result.projectPath;
        this.initMetadataLoaded = result.metadataLoaded || true; // For DEMO - TODO: Fix issue related to Metadata download

        /*if(isNotUndefinedOrNull(this.connector.configuration.alias)){
            const {error, result} = await window.electron.invoke('util-getConfig',{key:'projectPath',configName:this.connector.configuration.alias});
            if (error) {
                throw decodeError(error);
            }
            this.projectPath = result;
        }*/
    };

    savePathToConfig = async (): Promise<void> => {
        /*let {error, result} = await window.electron.invoke('util-setConfig',{key:'projectPath',value:this.projectPath,configName:this.connector.configuration.alias});
        if (error) {
            throw decodeError(error);
        }*/
    };

    selectProject = async (): Promise<void> => {
        /** Electron **/
        const { error, result } = await window.electron.invoke('code-createVSCodeProject', {
            defaultPath: this.projectPath,
        });
        if (error) {
            throw decodeError(error);
        }

        //console.log('test',error,result);
        this.projectPath = result?.projectPath || null;
        this.savePathToConfig();
    };

    refreshCode = async (): Promise<void> => {
        this.retrieveCode(true);
    };

    retrieveCode = async (isRefresh: boolean): Promise<void> => {
        //console.log('retrieveCode');
        this.isLoading = true;

        /** Electron **/
        const { error, result } = await window.electron.invoke('code-retrieveCode', {
            targetPath: this.projectPath,
            alias: this.connector.configuration.alias,
            refresh: isRefresh === true,
        });

        window.electron.listener_on('update-from-worker', (value: any) => {
            if (value.action === 'done') {
                this.metadata = value.data;
                window.electron.listener_off('update-from-worker');
            } else if (value.action === 'error') {
                throw decodeError(value.error);
            }
            this.isLoading = false;
        });

        if (error) {
            this.isLoading = false;
            throw decodeError(error);
        }
        if (!result.runInWorker) {
            this.metadata = result.res;
            this.isLoading = false;
        }
    };

    openVSCode = async (): Promise<void> => {
        window.electron.invoke('code-openVSCodeProject', { path: this.projectPath });
    };

    handleCopy = (): void => {
        navigator.clipboard.writeText(this.projectPath);
    };

    downloadCode = (): void => {
        window.electron.invoke('code-exportMetadata', {
            targetPath: this.projectPath,
            alias: this.connector.configuration.alias,
        });

        window.electron.listener_on('metadata', (value: any) => {
            if (value.action === 'done') {
                window.electron.listener_off('metadata');
            } else if (value.action === 'error') {
                throw decodeError(value.error);
            }
        });
    };

    /** Getters */

    get isPathDisplayed() {
        return isNotUndefinedOrNull(this.projectPath);
    }

    get isMetadataLoaded() {
        return this.initMetadataLoaded || isNotUndefinedOrNull(this.metadata);
    }

    get isVSCodeDisabled() {
        return this.isLoading || !isNotUndefinedOrNull(this.projectPath) || !this.isMetadataLoaded;
    }

    get isDownloadDisabled() {
        return this.isLoading || !isNotUndefinedOrNull(this.projectPath) || !this.isMetadataLoaded;
    }

    get isRetrieveDisplayed() {
        return !this.isMetadataLoaded;
    }
}
