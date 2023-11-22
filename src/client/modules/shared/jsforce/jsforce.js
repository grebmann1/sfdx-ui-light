export class JSForceConnector {
    alias
    isDebugMode
    method
    fake
    params
    toolingApiEnabled = false;
    isCacheEnabled = false

    constructor(alias,method = null,isDebugMode = false,params = null) {
        this.alias = alias;
        this.isDebugMode = isDebugMode;
        this.method = method;
        this.params = params;
    }

    handleDebugMode = (fake) => {
        if(this.isDebugMode && fake){
            return {res:fake};
        }
    }

    useToolingApi = () => {
        this.toolingApiEnabled = true;
        return this;
    }

    useCache = () => {
        this.isCacheEnabled = true;
        return this;
    }

    setFake = (fake) => {
        this.fake = fake;
        return this;
    }

    setParams = (params) => {
        this.params = params;
        return this;
    }

    run = async () => {
        if(!this.alias) throw new Error('Alias can\'t be empty !');
        if(!this.method) return null;
        this.handleDebugMode(this.fake);

        return await window.electron.ipcRenderer.invoke(`jsforce-${this.method}`,{
            ...this.params,
            ...{
                toolingApiEnabled:this.toolingApiEnabled,
                isCacheEnabled:this.isCacheEnabled,
                alias:this.alias
            }
        });
    }

}
