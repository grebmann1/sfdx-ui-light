import '@webcomponents/custom-elements';
import '@lwc/synthetic-shadow';
import { createElement } from 'lwc';
import {
    CACHE_CONFIG,
    chromeStore,
    cacheManager,
    loadSingleExtensionConfigFromCache,
} from 'shared/cacheManager';
import { runActionAfterTimeOut } from 'shared/utils';
import LOGGER from 'shared/logger';
import ViewsOverlay from 'views/overlay';
import InputQuickPick from 'feature/inputQuickPick';

const OVERLAY_DEBUG = true;
function debugLog(...args) {
    if (!OVERLAY_DEBUG) return;
    try {
        // eslint-disable-next-line no-console
        console.log('[SF-TOOLKIT][INJECT]', ...args);
    } catch (e) {}
}

const _showCopiedNotification = copiedValue => {
    // Create the notification element
    const notification = document.createElement('div');
    notification.className = 'sf-toolkit-notification-container';

    const sfToolkit = document.createElement('div');
    sfToolkit.className = 'sf-toolkit-notification-header';
    sfToolkit.textContent = 'SF toolkit';

    const message = document.createElement('span');
    message.textContent = `${copiedValue} copied to clipboard`;

    // Append the logo and message to the notification
    notification.appendChild(sfToolkit);
    notification.appendChild(message);

    // Style the notification element
    const style = document.createElement('style');
    style.textContent = `
            .sf-toolkit-notification-container {
                position: fixed;
                bottom: 20px;
                left: 20px;
                padding: 10px;
                background-color: #032d60;
                color: white;
                border-radius: 5px;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                z-index: 1000;
                display: none;
            }
            .sf-toolkit-notification-header {
                display: block;
                position: absolute;
                top: -10px;
                left: calc(50% - 63px);
                background: #032d60;
                padding-left: 10px;
                padding-right: 10px;
                border-radius: 5px;
                z-index: 1000;
                transform: translateX(50%);
            }
        `;
    document.head.appendChild(style);

    // Append the notification to the body
    document.body.appendChild(notification);

    // Show the notification
    notification.style.display = 'block';

    // Hide the notification after 1 second
    setTimeout(() => {
        notification.style.display = 'none';
        document.body.removeChild(notification);
        document.head.removeChild(style);
    }, 3000);
};

// Inject core CSS styles used by the injected UI
const injectCSS = () => {
    const head = document.head || document.getElementsByTagName('head')[0];
    if (!head) return;

    const safeAddStylesheet = (id, href) => {
        if (document.getElementById(id)) return;
        const link = document.createElement('link');
        link.id = id;
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = href;
        head.appendChild(link);
    };

    try {
        safeAddStylesheet(
            'sf-toolkit-slds-css',
            chrome.runtime.getURL('/styles/slds-sf-toolkit.css')
        );
        safeAddStylesheet(
            'sf-toolkit-extension-css',
            chrome.runtime.getURL('/styles/extension.css')
        );
        debugLog('injectCSS ok', {
            slds: !!document.getElementById('sf-toolkit-slds-css'),
            extension: !!document.getElementById('sf-toolkit-extension-css'),
        });
    } catch (e) {
        console.error('--> injectCSS error', e);
        debugLog('injectCSS error', e);
    }
};

// Overlay
let overlayInstance = null;
const injectOverlay = async () => {
    try {
        debugLog('injectOverlay called', {
            existing: !!overlayInstance,
            url: location.href,
        });
        const isEnabled = await loadSingleExtensionConfigFromCache(
            CACHE_CONFIG.OVERLAY_ENABLED.key
        );
        debugLog('overlay enabled?', isEnabled);
        if (!isEnabled) return;
        if (overlayInstance) return;

        // LWC
        overlayInstance = createElement('views-overlay', { is: ViewsOverlay });
        Object.assign(overlayInstance, { variant: 'overlay' });
        document.body.appendChild(overlayInstance);
        window.__sfToolkitOverlay = overlayInstance;
        debugLog('overlay appended', {
            tag: overlayInstance?.tagName,
            inDom: document.body.contains(overlayInstance),
        });
    } catch (e) {
        debugLog('injectOverlay error', e);
        console.error('[SF-TOOLKIT][INJECT] injectOverlay error', e);
    }
};

// (Shortcut injection removed)
// Input Quick Pick Component
let quickPickInstance = null;
const injectInputQuickPick = async () => {
    if (!quickPickInstance) {
        quickPickInstance = createElement('feature-input-quick-pick', { is: InputQuickPick });
        quickPickInstance.className = 'sf-toolkit';
        const isEnabled = await cacheManager.getConfigValue(
            CACHE_CONFIG.INPUT_QUICKPICK_ENABLED.key
        );
        //const recents = await loadSingleExtensionConfigFromCache(CACHE_CONFIG.INPUT_QUICKPICK_RECENTS.key);
        //const data = await loadSingleExtensionConfigFromCache(CACHE_CONFIG.INPUT_QUICKPICK_DATA.key);
        if (isEnabled) {
            document.body.appendChild(quickPickInstance);
        }
    }
};

class LWC_CUSTOM {
    config;
    domObserver;
    styleElement;
    lwcElements = [];
    injectedElements = [];

    enable = () => {
        //console.log('enable');
        document.head.appendChild(this.createStyleElement());
        this.enableHighlightElements();
        this.observeDomChange(this.handleDomChange);
    };

    disable = () => {
        //console.log('disable');
        if (this.domObserver) {
            this.domObserver.disconnect();
        }
        this.removeStyle();
        this.disableHighlightElements();
    };

    toggleFeature = value => {
        if (value === true) {
            this.enable();
        } else {
            this.disable();
        }
    };

    observeDomChange = callback => {
        if (this.domObserver) return;
        //console.log('observeDomChange');
        const targetNode = document;
        this.domObserver = new MutationObserver(callback);
        // Start observing the target node for configured mutations
        this.domObserver.observe(targetNode, { attributes: true, childList: true, subtree: true });
    };

    handleDomChange = (mutationList, observer) => {
        runActionAfterTimeOut(
            mutationList,
            async newValue => {
                //console.log('handleDomChange - process');
                this.enableHighlightElements();
            },
            { timeout: 500 }
        );
    };

    createStyleElement = () => {
        const style = document.createElement('style');
        style.className = 'sf-toolkit-style';
        style.textContent = `
                .sf-toolkit-custom-component-header {
                    position: relative;
                    border:2px solid #0176d4;
                    display:inline-block;
                }
                .sf-toolkit-custom-component {
                    position: absolute;
                    font-size:xx-small;
                    top: 0px;
                    left: 0px;
                    padding: 2px;
                    background-color: #0176d4;
                    color: white;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                    z-index: 1000;
                    display:none;
                }

                .sf-toolkit-custom-component a {
                    color: white;
                    padding:2px;
                }

                .sf-toolkit-custom-component-header:hover .sf-toolkit-custom-component {
                    display:block;
                }
            `;
        this.styleElement = style;
        return this.styleElement;
    };

    enableHighlightElements = () => {
        const allElements = document.getElementsByTagName('*');

        // Initialize an array to hold the custom components
        let _lwcElements = [];
        let _injectedElements = [];

        // Initial Loop to tag all custom elements :
        [...allElements].forEach(element => {
            if (
                element.tagName.startsWith('C-') &&
                !element.classList.contains('sf-toolkit-custom-element')
            ) {
                element.classList.add('sf-toolkit-custom-element');
            }
        });

        // Loop through all elements and check if the tag name starts with "c-"
        document.querySelectorAll('.sf-toolkit-custom-element').forEach(element => {
            // For now, we only include the 1st lvl
            if (
                element.tagName.startsWith('C-') &&
                !element.classList.contains('sf-toolkit-custom-component-header') &&
                !element.closest('.sf-toolkit-custom-component')
            ) {
                _lwcElements.push(element);

                // Modify element
                element.classList.add('sf-toolkit-custom-component-header');

                // Inject component
                const sfToolkit_link = document.createElement('a');
                sfToolkit_link.href = '#';
                sfToolkit_link.onclick = this.handleLinkClick;
                sfToolkit_link.dataset.name = element.tagName;
                sfToolkit_link.textContent = 'View/Edit';

                const sfToolkit = document.createElement('div');
                sfToolkit.className = 'sf-toolkit-custom-component';
                sfToolkit.textContent = `${element.tagName} - `;
                sfToolkit.appendChild(sfToolkit_link);
                element.appendChild(sfToolkit);
                _injectedElements.push(sfToolkit);
            }
        });
        this.lwcElements = _lwcElements;
        this.injectedElements = _injectedElements;
    };

    disableHighlightElements = () => {
        //console.log('disableHighlightElements');
        // disable this way in case the chrome extension was closed !
        document.querySelectorAll('.sf-toolkit-custom-component-header').forEach(item => {
            //console.log('item',item);
            item.classList.remove('sf-toolkit-custom-component-header');
            item.classList.remove('sf-toolkit-custom-element');
        });

        document.querySelectorAll('.sf-toolkit-custom-component').forEach(item2 => {
            //console.log('item2',item2);
            item2.remove();
        });
        /*
        // Modified custom elements
        this.lwcElements.forEach(item => {
            item.classList.remove('sf-toolkit-custom-component-header');
        });

        // Injected Element 
        this.injectedElements.forEach(item => {
            //console.log('item',item);
            item.remove();
        })*/
    };

    removeStyle = () => {
        document.querySelectorAll('.sf-toolkit-style').forEach(item => {
            item.remove();
        });
    };

    /** Events */

    handleLinkClick = async e => {
        e.preventDefault();
        const developerName = (e.target.dataset.name.substring(2) || '').split('-').join('');
        const params = new URLSearchParams({
            applicationName: 'metadata',
            sobject: 'LightningComponentBundle',
            param1: developerName,
        });
        if (injectorPort) {
            injectorPort.postMessage({
                action: 'redirectToUrl',
                sessionId: this.config.sessionId,
                serverUrl: this.config.serverUrl,
                baseUrl: chrome.runtime.getURL('/views/app.html'),
                redirectUrl: encodeURIComponent(params.toString()),
            });
        }
    };
}

function showOverlay() {
    if (!overlayInstance) {
        debugLog('showOverlay -> injecting');
        injectOverlay();
    } else {
        debugLog('showOverlay -> already injected');
    }
}

function hideOverlay() {
    if (overlayInstance) {
        debugLog('hideOverlay -> removing');
        overlayInstance.remove();
        overlayInstance = null;
    }
}

let injectorPort;
function connectToBackground() {
    injectorPort = chrome.runtime.connect({ name: 'sf-toolkit-injected' });
    debugLog('connected to background port sf-toolkit-injected');
    injectorPort.onDisconnect.addListener(() => {
        // Optionally handle disconnect in content script
        // e.g., cleanup, logging, etc.
        debugLog('background port disconnected');
    });
    injectorPort.onMessage.addListener(msg => {
        LOGGER.debug('injectorPort.onMessage', msg);
        debugLog('port message', msg?.action, msg);
        if (msg.action === 'toggleOverlay') {
            if (msg.enabled) {
                showOverlay();
            } else {
                hideOverlay();
            }
        } else if (msg.action === 'apply_input_value') {
            if (quickPickInstance && typeof quickPickInstance.applyFromSidePanel === 'function') {
                quickPickInstance.applyFromSidePanel(msg?.item?.value || '');
            }
        }
    });
}

class INJECTOR {
    lwc_custom_instance = new LWC_CUSTOM();

    isValidPage = () => {
        return (
            document.querySelector('body.sfdcBody, body.ApexCSIPage, #auraLoadingBox') ||
            location.host.endsWith('visualforce.com')
        );
    };

    init = async () => {
        if (chrome.runtime) chrome.runtime.onMessage.addListener(this.handleMessage);
        const isValid = this.isValidPage();
        debugLog('injector init', { isValid, host: location.host });
        if (isValid) {
            connectToBackground();
            this.injectCode();
        }
        /* 
        const cachedConfiguration = await cacheManager.loadConfig(
            Object.values(CACHE_CONFIG).map(x => x.key)
        );
        LOGGER.log('cachedConfiguration', cachedConfiguration); */
    };

    injectCode = () => {
        injectCSS();
        injectOverlay();
        injectInputQuickPick();
        //injectPromptWidget();
    };

    handleMessage = (request, sender, sendResponse) => {
        if (request.action === 'lwc_highlight') {
            //console.log('handleMessage',request);
            this.lwc_custom_instance.config = request.config;
            this.lwc_custom_instance.toggleFeature(request.value);
        }
    };
}

(async () => {
    window.defaultStore = await chromeStore('local'); // only for chrome extension
    window.settingsStore = await chromeStore('sync'); // only for chrome extension
    const injectorInstance = new INJECTOR();
    injectorInstance.init();
})();
