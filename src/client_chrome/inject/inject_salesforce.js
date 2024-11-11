import '@webcomponents/custom-elements';
import '@lwc/synthetic-shadow';
import {createElement} from 'lwc';
import ViewsOverlay from 'views/overlay';

import {getRecordId,redirectToUrlViaChrome} from 'extension/utils';
import {isEmpty, runActionAfterTimeOut} from 'shared/utils';
import hotkeys from 'hotkeys-js';


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
    const configuration = chrome.storage?await chrome.storage.local.get(['shortcut_injection_enabled', 'shortcut_recordid']):{};

    if (!configuration.shortcut_injection_enabled) return;


    console.log('### SF Toolkit - Shortcut Injection ###',);
    /** Record Id Shortcut - Alpha - To modify to a generic version */
    if (configuration.hasOwnProperty('shortcut_recordid')) {
        const combo = configuration['shortcut_recordid'].join('+');
        hotkeys(combo, function (event, handler) {
            // Prevent the default refresh event under WINDOWS system
            event.preventDefault();
            const recordId = getRecordId(window.location.href);
            if (!isEmpty(recordId)) {
                navigator.clipboard.writeText(recordId);
                _showCopiedNotification(recordId);
            }
        });
    }

};


const injectOverlay = async () => {
    const isEnabled = (await chrome.storage.sync.get('overlayEnabled')).overlayEnabled;
    console.log('injectOverlay',isEnabled);
    if(!isEnabled) return;

    // LWC
    const elm = createElement('views-overlay', {is: ViewsOverlay});
    Object.assign(elm, {variant:'overlay'});
    document.body.appendChild(elm);
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
        const redirectUrl = `${encodeURIComponent(`metadata?sobject=LightningComponentBundle&param1=${developerName}`)}`;
        redirectToUrlViaChrome({
            sessionId: config.sessionId,
            serverUrl: config.serverUrl,
            baseUrl: chrome.runtime.getURL('/views/app.html'),
            redirectUrl
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
    const injectorInstance = new INJECTOR();
    injectorInstance.init();

})();

