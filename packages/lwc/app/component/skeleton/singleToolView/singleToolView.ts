import { api, LightningElement } from 'lwc';
import { isElectronApp } from 'shared/utils';

import { parseSingleToolBootstrapSeed } from './singleToolViewHelpers';

const DEFAULT_TOOL_PATH = 'api';

export default class SingleToolView extends LightningElement {
    @api variant = 'default';
    alias = null;
    applicationName = DEFAULT_TOOL_PATH;
    redirectUrl = null;
    serverUrl = null;
    sessionId = null;

    connectedCallback() {
        if (typeof window === 'undefined') {
            return;
        }
        const seed = parseSingleToolBootstrapSeed(window.location.search);
        this.applicationName = seed.applicationName;
        this.alias = seed.alias;
        if (isElectronApp()) {
            return;
        }
        this.sessionId = seed.sessionId;
        this.serverUrl = seed.serverUrl;
        this.redirectUrl = seed.redirectUrl;
    }
}
