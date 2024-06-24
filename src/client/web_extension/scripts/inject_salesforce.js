'use strict';
const buffer = {}
const runActionAfterTimeOut = (value, action,{timeout = 300} = {}) => {
    if (buffer._clearBufferId) {
        clearTimeout(buffer._clearBufferId);
    }
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    buffer._clearBufferId = setTimeout(() => {
        action(value);
    }, timeout);
}
const _showCopiedNotification = (copiedValue) => {
    // Create the notification element
    const notification = document.createElement('div');
        notification.className = 'sf-toolkit-notification';

    const sfToolkit = document.createElement('div');
        sfToolkit.className = 'sf-toolkit';
        sfToolkit.textContent = 'SF toolkit';

    const message = document.createElement('span');
        message.textContent = `${copiedValue} copied to clipboard`;

    // Append the logo and message to the notification
    notification.appendChild(sfToolkit);
    notification.appendChild(message);


    // Style the notification element
    const style = document.createElement('style');
        style.textContent = `
            .sf-toolkit-notification {
                position: fixed;
                bottom: 20px;
                left: 20px;
                padding: 10px;
                background-color: #0176d4;
                color: white;
                border-radius: 5px;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                z-index: 1000;
                display: none;
            }
            .sf-toolkit {
                display: block;
                position: absolute;
                top: -10px;
                left: calc(50% - 63px);
                background: #0176d4;
                padding-left: 3px;
                padding-right: 3px;
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
}

const injectShortCuts = async () => {
    const configuration = await chrome.storage.local.get(['shortcut_injection_enabled','shortcut_recordid']);

    if(!configuration.shortcut_injection_enabled) return;

    const hotkeys = await import(chrome.runtime.getURL("scripts/hotkeys.esm.js"));
    const utils = await import(chrome.runtime.getURL("scripts/utils.js"));


    console.log('### SF Toolkit - Shortcut Injection ###');

    /** Record Id Shortcut - Alpha - To modify to a generic version */
    if(configuration.hasOwnProperty('shortcut_recordid')){
        const combo = configuration['shortcut_recordid'].join('+');
        hotkeys.default(combo, function(event, handler){
            // Prevent the default refresh event under WINDOWS system
            event.preventDefault();
            const recordId = utils.getRecordId(window.location.href);
            if(!utils.isEmpty(recordId)){
                navigator.clipboard.writeText(recordId);
                _showCopiedNotification(recordId);
            }
        });
    }
    
}

const searchCustomElements = async (enable) => {
    console.log('searchCustomElements');
  

    // Style the notification element
    const style = document.createElement('style');
        style.textContent = `
            .sf-toolkit-custom-component-header {
                position: relative;
                border:2px solid #0176d4;
                display:inline-block;
            }
            .sf-toolkit-custom-component {
                position: absolute;
                top: 0px;
                left: 0px;
                padding: 10px;
                background-color: #0176d4;
                color: white;
                border-radius: 5px;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                z-index: 1000;
            }
        `;

    document.head.appendChild(style);

    // Get all elements in the DOM
    const allElements = document.getElementsByTagName('*');

    // Initialize an array to hold the custom components
    let customComponents = [];

    // Loop through all elements and check if the tag name starts with "c-"
    for (let i = 0; i < allElements.length; i++) {
        if (allElements[i].tagName.startsWith('C-')) {
            const element = allElements[i];
            customComponents.push(element);
            // Modify element
            element.classList.add('sf-toolkit-custom-component-header');

            // Inject component
            const sfToolkit = document.createElement('div');
                sfToolkit.className = 'sf-toolkit-custom-component';
                sfToolkit.textContent = 'SF toolkit';
            element.appendChild(sfToolkit);
        }
    }

    // Log the custom components to the console
    console.log('Custom components found:', customComponents);

}

const send = async (message) => {
    return await chrome.runtime.sendMessage(message);
    // Optional: do something with response
}


class LWC_CUSTOM {
    baseUrl;
    domObserver;
    styleElement;
    lwcElements = [];
    injectedElements = [];
    
    enable = () => {
        //console.log('enable');
        document.head.appendChild(this.createStyleElement());
        this.enableHighlightElements();
        this.observeDomChange(this.handleDomChange);
    }

    

    disable = () => {
        //console.log('disable');
        this.styleElement.remove();
        this.disableHighlightElements();
        if(this.domObserver){
            this.domObserver.disconnect();
        }
    }

    toggleFeature = (value) => {
        if(value === true){
            this.enable();
        }else{
            this.disable();
        }
    }

    observeDomChange = (callback) => {
        //console.log('observeDomChange');
        const targetNode = document;
        this.domObserver = new MutationObserver(callback);
        // Start observing the target node for configured mutations
        this.domObserver.observe(targetNode, { attributes: true, childList: true, subtree: true });
    }

    handleDomChange = (mutationList, observer) => {
        runActionAfterTimeOut(mutationList,async (newValue) => {
            //console.log('handleDomChange - process');
            this.enableHighlightElements();
        },{timeout:500});
    };

    createStyleElement = () => {
        const style = document.createElement('style');
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
    }

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
                && ! element.closest('.sf-toolkit-custom-component')
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
    }

    disableHighlightElements = () => {

        // Modified custom elements
        this.lwcElements.forEach(item => {
            item.classList.remove('sf-toolkit-custom-component-header');
        });

        // Injected Element
        this.injectedElements.forEach(item => {
            item.remove();
        })
    }

    /** Events */

    handleLinkClick = async (e) => {
        e.preventDefault();
        const developerName = (e.target.dataset.name.substring(2) || '').split('-').join('');
        const redirectUrl = `${this.baseUrl}&redirectUrl=${encodeURIComponent(`metadata?sobject=LightningComponentBundle&param1=${developerName}`)}`;
        window.open(redirectUrl,'_blank');
    }
}

class INJECTOR {
    lwc_custom_instance = new LWC_CUSTOM();

    init = () => {
        chrome.runtime.onMessage.addListener(this.handleMessage);
        this.injectCode();
        //this.lwc_custom_instance.toggleFeature(true);
    }


    injectCode = () => {
        injectShortCuts();
    }

    

    handleMessage = (request, sender, sendResponse) => {
        if(request.action === "lwc_highlight"){
            console.log('handleMessage',request);
            this.lwc_custom_instance.baseUrl = request.baseUrl;
            this.lwc_custom_instance.toggleFeature(request.value);
        }
    }
}


(async () => {
    const injectorInstance = new INJECTOR();
        injectorInstance.init();
    
})();

