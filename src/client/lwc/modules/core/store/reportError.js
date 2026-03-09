/**
 * Central API to report errors to the global store so they appear in the footer error panel.
 * Use this from LWC and app-level handlers; store modules can keep dispatching addError directly.
 */
import { getStore } from './storeRef';
import { ERROR } from './modules/index';

/**
 * Report an error to the global error store (footer).
 * @param {Error|string|{ message: string, details?: string }} error - Error instance, message string, or object with message/details
 * @param {{ details?: string, source?: string }} [options] - Optional details and source (e.g. 'connection', 'agent', 'soql')
 */
export function reportError(error, options = {}) {
    const store = getStore();
    if (!store) return;

    let payload;
    if (error instanceof Error) {
        payload = {
            message: error.message,
            details: options.details != null ? options.details : error.stack || '',
            source: options.source || '',
        };
    } else if (typeof error === 'string') {
        payload = {
            message: error,
            details: options.details || '',
            source: options.source || '',
        };
    } else if (error && typeof error === 'object') {
        payload = {
            message: error.message != null ? String(error.message) : 'Unknown error',
            details:
                options.details != null
                    ? options.details
                    : error.details != null
                      ? String(error.details)
                      : '',
            source:
                options.source != null
                    ? options.source
                    : error.source != null
                      ? String(error.source)
                      : '',
        };
    } else {
        payload = {
            message: 'Unknown error',
            details: options.details || '',
            source: options.source || '',
        };
    }

    store.dispatch(ERROR.reduxSlice.actions.addError(payload));
}
