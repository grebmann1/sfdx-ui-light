import '@webcomponents/custom-elements';
import '@lwc/synthetic-shadow';
import {createElement} from 'lwc';
import ViewsOverlay from 'views/overlay';
import test from 'feature/test';
import {isEmpty, runActionAfterTimeOut,redirectToUrlViaChrome,getRecordId,getSobject} from 'shared/utils';
import { CACHE_CONFIG,loadExtensionConfigFromCache } from 'shared/cacheManager';
import hotkeys from 'hotkeys-js';

const setChromeStorageAsStore = async () => {
    return {
        getItem: function(key, callback) {
            // Custom implementation here...
            return new Promise((resolve, reject) => {
                chrome.storage.local.get([key], function(result) {
                    const value = result[key];
                    if (callback) {
                        callback(value);
                    }
                    resolve(value);
                });
            });
        },
        removeItem: function(key, callback) {
            // Custom implementation here...
            return new Promise((resolve, reject) => {
                chrome.storage.local.remove(key, function() {
                    if (callback) {
                        callback();
                    }
                    resolve();
                });
            });
        },
        setItem: function(key, value, callback) {
            // Custom implementation here...
            return new Promise((resolve, reject) => {
                chrome.storage.local.set({ [key]: value }, function() {
                    if (callback) {
                        callback();
                    }
                    resolve();
                });
            });
        }
    }
};

const getCookieInfo = async () => {
    if(chrome.runtime){
        return await chrome.runtime.sendMessage({ action: 'fetchCookie', content:null});
    }
    return null;
}

const _showCopiedNotification = (copiedValue) => {
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

const injectShortCuts = async () => {
    // Use the new cacheManager instead of directly accessing chrome.storage
    const configuration = await loadExtensionConfigFromCache([
        CACHE_CONFIG.SHORTCUT_INJECTION_ENABLED.key,
        CACHE_CONFIG.SHORTCUT_RECORDID.key,
        CACHE_CONFIG.SHORTCUT_OVERVIEW.key,
        CACHE_CONFIG.SHORTCUT_SOQL.key,
        CACHE_CONFIG.SHORTCUT_APEX.key,
        CACHE_CONFIG.SHORTCUT_OPEN_PANEL.key
    ]);

    const shortcutEnabled = configuration[CACHE_CONFIG.SHORTCUT_INJECTION_ENABLED.key];
    const shortcutRecordId = configuration[CACHE_CONFIG.SHORTCUT_RECORDID.key];
    const shortcutOverview = configuration[CACHE_CONFIG.SHORTCUT_OVERVIEW.key];
    const shortcutSoql = configuration[CACHE_CONFIG.SHORTCUT_SOQL.key];
    const shortcutApex = configuration[CACHE_CONFIG.SHORTCUT_APEX.key];
    const shortcutOpenPanel = configuration[CACHE_CONFIG.SHORTCUT_OPEN_PANEL.key];

    if (!shortcutEnabled) return;

    console.log('### SF Toolkit - Shortcut Injection ###');
    
    // Create a container for our shortcuts if it doesn't exist
    let shortcutContainer = document.getElementById('sf-toolkit-shortcut-container');
    if (!shortcutContainer) {
        shortcutContainer = document.createElement('div');
        shortcutContainer.id = 'sf-toolkit-shortcut-container';
        shortcutContainer.className = 'sf-toolkit-shortcut-container';
        document.body.appendChild(shortcutContainer);
        
        // Add styles for the shortcut container and buttons
        const style = document.createElement('style');
        style.id = 'sf-toolkit-shortcut-styles';
        style.textContent = `
            .sf-toolkit-shortcut-container {
                position: fixed;
                bottom: 20px;
                right: 20px;
                display: flex;
                flex-direction: column;
                gap: 10px;
                z-index: 9999;
            }
            
            .sf-toolkit-shortcut-button {
                width: 45px;
                height: 45px;
                border-radius: 50%;
                background-color: #0070d2;
                border: none;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: transform 0.2s, background-color 0.2s;
            }
            
            .sf-toolkit-shortcut-button:hover {
                transform: scale(1.1);
                background-color: #005fb2;
            }
            
            .sf-toolkit-shortcut-button svg {
                width: 20px;
                height: 20px;
                fill: white;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Clear any existing shortcuts
    shortcutContainer.innerHTML = '';
    
    // Define all shortcuts
    const shortcuts = [
        {
            id: 'record-view',
            shortcut: shortcutRecordId,
            action: (event, handler) => {
                event.preventDefault();
                const recordId = getRecordId(window.location.href);
                if (!isEmpty(recordId)) {
                    navigator.clipboard.writeText(recordId);
                    _showCopiedNotification(recordId);
                }
            }
        },
        {
            id: 'open-panel',
            shortcut: shortcutOpenPanel,
            action: async (event, handler) => {
                event.preventDefault();
                await chrome.runtime.sendMessage({ action: 'open_side_panel', content:null});
            }
        },
        {
            id: 'org-overview',
            shortcut: shortcutOverview,
            action: async (event, handler) => {
                event.preventDefault();

                const cookieInfo = await getCookieInfo();
                const params = new URLSearchParams({
                    applicationName: 'home'
                });
                redirectToUrlViaChrome({
                    sessionId: cookieInfo.session,
                    serverUrl: `https://${cookieInfo.domain}`,
                    baseUrl: chrome.runtime.getURL('/views/app.html'),
                    redirectUrl:encodeURIComponent(params.toString())
                })
            }
        },
        {
            id: 'soql-explorer',
            shortcut: shortcutSoql,
            action: async (event, handler) => {
                event.preventDefault();
                const cookieInfo = await getCookieInfo();
                const sobject = getSobject(window.location.href);
                
                const params = new URLSearchParams({
                    applicationName: 'soql',
                });
                if(sobject){
                    console.log('sobject',sobject);
                    params.set('query',`SELECT Id FROM ${sobject}`);
                }

                

                redirectToUrlViaChrome({
                    sessionId: cookieInfo.session,
                    serverUrl: `https://${cookieInfo.domain}`,
                    baseUrl: chrome.runtime.getURL('/views/app.html'),
                    redirectUrl:encodeURIComponent(params.toString())
                })
            }
        },
        {
            id: 'apex-explorer',
            shortcut: shortcutApex,
            action: async (event, handler) => {
                event.preventDefault();
                const cookieInfo = await getCookieInfo();
                const params = new URLSearchParams({
                    applicationName: 'anonymousapex'
                });
                redirectToUrlViaChrome({
                    sessionId: cookieInfo.session,
                    serverUrl: `https://${cookieInfo.domain}`,
                    baseUrl: chrome.runtime.getURL('/views/app.html'),
                    redirectUrl:encodeURIComponent(params.toString())
                })
            }
        }
    ];

    shortcuts.forEach(shortcut => {
        hotkeys(shortcut.shortcut, shortcut.action);
    });
};


const injectOverlay = async () => {
    const isEnabled = (await chrome.storage.sync.get('overlayEnabled')).overlayEnabled;
    //console.log('injectOverlay',isEnabled);
    if(!isEnabled) return;

    // LWC
    const elm = createElement('views-overlay', {is: ViewsOverlay});
    Object.assign(elm, {variant:'overlay'});
    document.body.appendChild(elm);
};
/* TODO : Add prompt widget in the web page with vanila JS/HTML/CSS
const injectPromptWidget = async () => {
    const isEnabled = (await chrome.storage.sync.get('overlayEnabled')).overlayEnabled;
    //console.log('injectOverlay',isEnabled);
    if(!isEnabled) return;

    const elm = createElement('feature-test', {is: test});
    Object.assign(elm, {
        isMovable:true
    });
    document.body.appendChild(elm);

    hotkeys('cmd+k', function (event, handler) {
        // Prevent the default refresh event under WINDOWS system
        event.preventDefault();
        console.log('cmd+k');
        elm.display();
    });
};
*/

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

    toggleFeature = (value) => {
        if (value === true) {
            this.enable();
        } else {
            this.disable();
        }
    };

    observeDomChange = (callback) => {
        if (this.domObserver) return;
        //console.log('observeDomChange');
        const targetNode = document;
        this.domObserver = new MutationObserver(callback);
        // Start observing the target node for configured mutations
        this.domObserver.observe(targetNode, {attributes: true, childList: true, subtree: true});
    };

    handleDomChange = (mutationList, observer) => {
        runActionAfterTimeOut(mutationList, async (newValue) => {
            //console.log('handleDomChange - process');
            this.enableHighlightElements();
        }, {timeout: 500});
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
                element.tagName.startsWith('C-') && !element.classList.contains('sf-toolkit-custom-element')
            ) {
                element.classList.add('sf-toolkit-custom-element');
            }

        });

        // Loop through all elements and check if the tag name starts with "c-"
        document.querySelectorAll('.sf-toolkit-custom-element').forEach(element => {
            // For now, we only include the 1st lvl
            if (
                element.tagName.startsWith('C-')
                && !element.classList.contains('sf-toolkit-custom-component-header')
                && !element.closest('.sf-toolkit-custom-component')
            ) {

                _lwcElements.push(element);


                // Modify element
                element.classList.add('sf-toolkit-custom-component-header');

                // Inject component
                const sfToolkit_link = document.createElement('a');
                sfToolkit_link.href = "#";
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
        document.querySelectorAll('.sf-toolkit-custom-component-header')
            .forEach(item => {
                //console.log('item',item);
                item.classList.remove('sf-toolkit-custom-component-header');
                item.classList.remove('sf-toolkit-custom-element');
            });

        document.querySelectorAll('.sf-toolkit-custom-component')
            .forEach(item2 => {
                //console.log('item2',item2);
                item2.remove();
            })
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
        document.querySelectorAll('.sf-toolkit-style')
            .forEach(item => {
                item.remove();
            })
    };

    /** Events */

    handleLinkClick = async (e) => {
        e.preventDefault();
        const developerName = (e.target.dataset.name.substring(2) || '').split('-').join('');
        const params = new URLSearchParams({
            applicationName: 'metadata',
            sobject:'LightningComponentBundle',
            param1:developerName
        });
        redirectToUrlViaChrome({
            sessionId: this.config.sessionId,
            serverUrl: this.config.serverUrl,
            baseUrl: chrome.runtime.getURL('/views/app.html'),
            redirectUrl:encodeURIComponent(params.toString())
        })
    }
}

class INJECTOR {
    lwc_custom_instance = new LWC_CUSTOM();

    isValidPage = () => {
        return document.querySelector("body.sfdcBody, body.ApexCSIPage, #auraLoadingBox") || location.host.endsWith("visualforce.com");
    }

    init = () => {
        if(chrome.runtime)chrome.runtime.onMessage.addListener(this.handleMessage);
        if(this.isValidPage()){
            this.injectCode();
        }
        //this.lwc_custom_instance.toggleFeature(true);
    };


    injectCode = () => {
        injectShortCuts();
        injectOverlay();
        //injectPromptWidget();
    };


    handleMessage = (request, sender, sendResponse) => {
        if (request.action === "lwc_highlight") {
            //console.log('handleMessage',request);
            this.lwc_custom_instance.config = request.config;
            this.lwc_custom_instance.toggleFeature(request.value);
        }
    }
}


(async () => {
    window.defaultStore = await setChromeStorageAsStore(); // only for chrome extension
    const injectorInstance = new INJECTOR();
    injectorInstance.init();

})();

