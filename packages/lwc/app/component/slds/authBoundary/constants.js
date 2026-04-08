export const MODAL_VARIANTS = {
    EXPIRED: 'expired',
    MISSING_SESSION: 'missing-session',
    RECONNECT_FAILED: 'reconnect-failed',
};

export const DEFAULT_TITLE = 'No Salesforce Connection';
export const DEFAULT_SUBTITLE = "It's required to be connected to an Org to use this feature";
export const EXPIRED_TITLE = 'Session Expired';
export const EXPIRED_SUBTITLE =
    'Your Salesforce session has expired. Reconnect from the toolkit to continue using this feature.';

export const MODAL_COPY = {
    [MODAL_VARIANTS.EXPIRED]: {
        heading: 'Session Expired',
        message: 'Your Salesforce session has expired.',
        details:
            'If auto-reconnect is available, we can try to restore the same org session for you. Otherwise, log out and reconnect manually.',
    },
    [MODAL_VARIANTS.MISSING_SESSION]: {
        heading: 'Reconnect Unavailable',
        message: 'No reusable Salesforce session was found in your open browser tabs.',
        details:
            'Open the same org in another tab if you want to retry auto-reconnect, or log out and reconnect manually.',
    },
    [MODAL_VARIANTS.RECONNECT_FAILED]: {
        heading: 'Reconnect Failed',
        message: 'We could not restore your Salesforce session automatically.',
        details: 'You can retry auto-reconnect or log out and reconnect manually.',
    },
};
