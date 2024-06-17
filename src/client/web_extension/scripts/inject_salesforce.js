'use strict';

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





(async () => {
    injectShortCuts();
})();

