import { isNotUndefinedOrNull } from './validation';

/**
 * Environment detection utilities
 */

export const isElectronApp = (): boolean => {
    return isNotUndefinedOrNull(window.electron);
};

export const isChromeExtension = (): boolean => {
    try {
        if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
            // Check for Chrome and Chromium-based browsers
            return true;
        }
        if (typeof browser !== 'undefined' && browser.runtime?.id) {
            // Check for Firefox
            return true;
        }
    } catch (error) {
        console.error('Error detecting browser extension environment:', error);
    }
    return false; // Not a recognized browser extension
};

export const isMac = (): boolean => navigator.platform.toUpperCase().indexOf('MAC') >= 0;
