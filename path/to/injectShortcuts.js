/**
 * Injects shortcuts into the Salesforce UI
 * Updated to use the cacheManager singleton and include additional shortcuts
 */
export async function injectShortcuts() {
    // Use cacheManager to get configuration
    const shortcutEnabled = await cacheManager.getConfigValue('shortcut_injection_enabled');
    const shortcutRecordId = await cacheManager.getConfigValue('shortcut_recordid');
    
    // Don't proceed if shortcuts are disabled
    if (!shortcutEnabled) {
        console.log('Salesforce Toolkit: Shortcuts are disabled');
        return;
    }

    console.log('Salesforce Toolkit: Injecting shortcuts');
    
    // Create a container for our shortcuts if it doesn't exist
    let shortcutContainer = document.getElementById('sfext-shortcut-container');
    if (!shortcutContainer) {
        shortcutContainer = document.createElement('div');
        shortcutContainer.id = 'sfext-shortcut-container';
        shortcutContainer.className = 'sfext-shortcut-container';
        document.body.appendChild(shortcutContainer);
    }
    
    // Clear any existing shortcuts
    shortcutContainer.innerHTML = '';
    
    // Define all shortcuts
    const shortcuts = [
        {
            id: 'record-shortcut',
            label: 'Go to Record',
            icon: 'utility:record',
            action: () => {
                if (shortcutRecordId) {
                    const baseUrl = window.location.origin;
                    window.open(`${baseUrl}/${shortcutRecordId}`, '_blank');
                } else {
                    alert('No record ID configured in Salesforce Toolkit settings.');
                }
            },
            visible: !!shortcutRecordId
        },
        {
            id: 'org-overview',
            label: 'Org Overview',
            icon: 'utility:company',
            action: () => {
                // Extract org ID from URL or other source
                const orgId = getOrgIdFromUrl();
                if (orgId) {
                    const baseUrl = window.location.origin;
                    window.open(`${baseUrl}/lightning/setup/CompanyProfileInfo/home`, '_blank');
                } else {
                    alert('Could not determine organization ID.');
                }
            },
            visible: true
        },
        {
            id: 'soql-explorer',
            label: 'SOQL Explorer',
            icon: 'utility:database',
            action: () => {
                const baseUrl = window.location.origin;
                window.open(`${baseUrl}/lightning/setup/SOQLQueryPage/home`, '_blank');
            },
            visible: true
        },
        {
            id: 'apex-explorer',
            label: 'Apex Explorer',
            icon: 'utility:apex',
            action: () => {
                const baseUrl = window.location.origin;
                window.open(`${baseUrl}/lightning/setup/ApexClasses/home`, '_blank');
            },
            visible: true
        }
    ];
    
    // Create and append shortcuts
    shortcuts.forEach(shortcut => {
        if (shortcut.visible) {
            const shortcutElement = createShortcutElement(shortcut);
            shortcutContainer.appendChild(shortcutElement);
        }
    });
    
    // Add styles
    addShortcutStyles();
}

/**
 * Helper function to create a shortcut element
 * @param {Object} shortcut - Shortcut configuration
 * @returns {HTMLElement} Shortcut button element
 */
function createShortcutElement(shortcut) {
    const button = document.createElement('button');
    button.id = shortcut.id;
    button.className = 'sfext-shortcut-button';
    button.title = shortcut.label;
    button.onclick = shortcut.action;
    
    const icon = document.createElement('span');
    icon.className = `slds-icon_container slds-icon-${shortcut.icon.split(':')[0]}-${shortcut.icon.split(':')[1]}`;
    
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'slds-icon slds-icon_small');
    
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', `/assets/icons/${shortcut.icon.replace(':', '/')}.svg#icon`);
    
    svg.appendChild(use);
    icon.appendChild(svg);
    button.appendChild(icon);
    
    return button;
}

/**
 * Helper function to add styles for shortcuts
 */
function addShortcutStyles() {
    // Only add styles if they don't already exist
    if (!document.getElementById('sfext-shortcut-styles')) {
        const style = document.createElement('style');
        style.id = 'sfext-shortcut-styles';
        style.textContent = `
            .sfext-shortcut-container {
                position: fixed;
                bottom: 20px;
                right: 20px;
                display: flex;
                flex-direction: column;
                gap: 10px;
                z-index: 9999;
            }
            
            .sfext-shortcut-button {
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
            
            .sfext-shortcut-button:hover {
                transform: scale(1.1);
                background-color: #005fb2;
            }
            
            .sfext-shortcut-button .slds-icon {
                fill: white;
            }
        `;
        document.head.appendChild(style);
    }
}

/**
 * Helper function to extract org ID from URL
 * @returns {string|null} Organization ID or null if not found
 */
function getOrgIdFromUrl() {
    // This is a placeholder - implement the actual logic to extract org ID
    // Typically, it would be part of the URL or available in Lightning globally
    const url = window.location.href;
    const match = url.match(/\/(\w{15}|\w{18})\//);
    return match ? match[1] : null;
} 