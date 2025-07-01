// notificationService.js
// TODO: Import actual Toast and Alert modules as needed
import LOGGER from 'shared/logger';
import Toast from 'lightning/toast';
import { ERROR, store } from 'core/store';

export function showToast({ label, message, variant = 'info' }) {
    // TODO: Implement toast logic
    Toast.show({
        label: label,
        message: message,
        variant: variant,
        mode: 'dismissible',
    });
    switch (variant) {
        case 'info':
            console.info(message);
            break;
        case 'error':
            console.error(message);
            break;
        case 'warning':
            console.warn(message);
            break;
        case 'success':
            console.info(message);
            break;
    }
}

export function showAlert({ message, theme = 'error', label = 'Error!' }) {
    // TODO: Implement alert logic
    console.log(`[Alert] ${theme}: ${label} - ${message}`);
}

export function handleError(error, context = '') {
    // Log error to global error store
    store.dispatch(ERROR.actions.addError(context || 'Error', error.stack || error.message || error));
    showToast({ label: context, message: error.message || error, variant: 'error' });
}
