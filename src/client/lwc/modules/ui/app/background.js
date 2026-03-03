import { isChromeExtension } from 'shared/utils';
import { navigate } from 'lwr/navigation';
import LOGGER from 'shared/logger';

/**
 * Background port communication helpers
 */

/**
 * Connect to Chrome background with identity
 * @param {Object} context - Component context with connector, navContext, _backgroundPort (mutable reference)
 * @returns {Object|null} - Background port or null (returns existing port if already connected)
 */
export function connectToBackgroundWithIdentity(context) {
    const { connector, navContext } = context;
    
    if (!isChromeExtension()) return null;
    
    // Return existing port if already connected
    if (context._backgroundPort) {
        return context._backgroundPort;
    }
    
    // Create new port
    const port = chrome.runtime.connect({ name: 'sf-toolkit-instance' });
    
    if (connector && connector.configuration) {
        port.postMessage({
            action: 'registerInstance',
            serverUrl: connector.conn.instanceUrl,
            alias: connector.configuration.alias,
            username: connector.configuration.username,
        });
    }
    
    port.onMessage.addListener((msg) => {
        LOGGER.log('[Instance] onMessage', msg);
        if (msg.action === 'redirectToUrl') {
            navigate(navContext, msg.navigation);
        }
    });
    
    port.onDisconnect.addListener(() => {
        // Update the context reference when disconnected
        if (context._backgroundPort === port) {
            context._backgroundPort = null;
        }
    });
    
    // Update context reference
    context._backgroundPort = port;
    return port;
}

/**
 * Disconnect from Chrome background
 * @param {Object} context - Component context with _backgroundPort
 */
export function disconnectFromBackground(context) {
    if (isChromeExtension() && context._backgroundPort) {
        context._backgroundPort.postMessage({ action: 'closeConnection' });
        context._backgroundPort = null;
    }
}
