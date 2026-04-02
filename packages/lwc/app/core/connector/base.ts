import constant from 'core/constant';
import { isUndefinedOrNull, isEmpty } from 'shared/utils';

import { PLATFORM } from './platform';
import { OAUTH_TYPES } from './credentialStrategies/oauthTypes';

/** Legacy Functions/Methods **/

export const extractName = alias => {
    let nameArray = (alias || '').split('-');
    return {
        company: nameArray.length > 1 ? nameArray.shift() : '',
        name: nameArray.join('-'),
    };
};

export const extractConfig = config => {
    if (!config) return null;
    // Regular expression pattern to match the required parts
    const regex = /force:\/\/([^:]+)::([^@]+)@(.+)/;
    // Extracting variables using regex
    const matches = config.match(regex);
    if (matches && matches.length === 4) {
        // Destructuring matches to extract variables
        const [, clientId, refreshToken, instanceUrl] = matches;
        // Returning the extracted variables
        return { clientId, refreshToken, instanceUrl };
    }
    return null;
};

// --- Salesforce Domain Normalization Utility ---
/**
 * Normalizes Salesforce host/domain for various edge cases (local dev, workspace, setup, etc).
 * Based on getSalesforceURL from background.js
 */

export const STANDARD_LIGHTNING_DOMAIN_REGEX = {
    regex: /lightning(.*).force([.-])com/,
    replace: 'my$1.salesforce$2com',
};
export const SOMA_LOCAL_DOMAIN_REGEX = {
    regex: /lightning.localhost.soma.force/,
    replace: 'my.localhost.sfdcdev.salesforce',
};
export const SALESFORCE_SETUP_DOMAIN_REGEX = {
    regex: /salesforce-setup([.-])com/,
    replace: 'salesforce$1com',
};
export const WORKSPACE_NO_MY_DOMAIN_REGEX = {
    regex: /dev.lightning.force-com.(\w+)/,
    replace: '$1',
};

export const getSalesforceURL = origin => {
    let result = origin;
    if (origin.match(SOMA_LOCAL_DOMAIN_REGEX.regex)) {
        result = new URL(
            origin.replace(SOMA_LOCAL_DOMAIN_REGEX.regex, SOMA_LOCAL_DOMAIN_REGEX.replace)
        ).origin;
    } else if (origin.match(WORKSPACE_NO_MY_DOMAIN_REGEX.regex)) {
        result = new URL(
            origin.replace(WORKSPACE_NO_MY_DOMAIN_REGEX.regex, WORKSPACE_NO_MY_DOMAIN_REGEX.replace)
        ).origin;
    } else if (origin.match(STANDARD_LIGHTNING_DOMAIN_REGEX.regex)) {
        result = new URL(
            origin.replace(
                STANDARD_LIGHTNING_DOMAIN_REGEX.regex,
                STANDARD_LIGHTNING_DOMAIN_REGEX.replace
            )
        ).origin;
    } else if (origin.match(SALESFORCE_SETUP_DOMAIN_REGEX.regex)) {
        result = new URL(
            origin.replace(
                SALESFORCE_SETUP_DOMAIN_REGEX.regex,
                SALESFORCE_SETUP_DOMAIN_REGEX.replace
            )
        ).origin;
    }
    return result;
};

export function validateInputs(template, selector) {
    let isValid = true;
    let inputFields = template.querySelectorAll(selector);
    inputFields.forEach(inputField => {
        if (!inputField.checkValidity()) {
            inputField.reportValidity();
            isValid = false;
        }
    });
    return isValid;
}

export const normalizeConnection = (credentialType, rawData, platform, extra = {}) => {
    let params = {
        instanceUrl: rawData.instanceUrl,
        accessToken: rawData.accessToken,
        sessionId: rawData.sessionId,
        proxyUrl:
            extra.isProxyDisabled ||
            platform === PLATFORM.CHROME ||
            platform === PLATFORM.ELECTRON
                ? null
                : window.jsforceSettings?.proxyUrl, // For chrome extension, we run without proxy
        version: rawData.version || constant.apiVersion, // This might need to be refactored
        //logLevel:'DEBUG',
        logLevel: rawData.logLevel || null, //'DEBUG',
    };

    // Handle Refresh Token
    if (credentialType === OAUTH_TYPES.OAUTH) {
        params.refreshToken = rawData.refreshToken;
        params.oauth2 = {
            ...window.jsforceSettings,
            loginUrl: rawData.instanceUrl,
        };
    } else if (credentialType === OAUTH_TYPES.USERNAME) {
        params.loginUrl = rawData.instanceUrl;
        params.username = rawData.username;
    }
    return params;
};

export const normalizeConfiguration = (rawData, byPassValidation = false) => {
    // Validate required fields by credentialType
    if (isUndefinedOrNull(rawData._formatVersion)) {
        // Initialize format version (version null to 1)
        if (rawData.refreshToken) {
            rawData.credentialType = OAUTH_TYPES.OAUTH;
        } else if (rawData.redirectUrl) {
            rawData.credentialType = OAUTH_TYPES.REDIRECT;
        }
        rawData._formatVersion = 1;
    }
    //LOGGER.log('rawData',rawData);

    const type = rawData.credentialType;
    const missing = [];
    if (!type) missing.push('credentialType');
    if (!rawData.alias) missing.push('alias');
    if (type === OAUTH_TYPES.USERNAME) {
        if (!rawData.username) missing.push('username');
        if (!rawData.password) missing.push('password');
        if (!rawData.instanceUrl) missing.push('instanceUrl');
    } else if (type === OAUTH_TYPES.OAUTH) {
        //if (!rawData.accessToken) missing.push('accessToken');
        if (!rawData.refreshToken) missing.push('refreshToken');
        if (!rawData.instanceUrl) missing.push('instanceUrl');
    } else if (type === OAUTH_TYPES.SESSION) {
        if (!rawData.sessionId) missing.push('sessionId');
        if (!rawData.instanceUrl) missing.push('instanceUrl');
    } else if (type === OAUTH_TYPES.REDIRECT) {
        if (!rawData.redirectUrl) missing.push('redirectUrl');
    }
    if (missing.length > 0 && !byPassValidation) {
        throw new Error(
            `normalizeConfiguration: Missing required field(s) for ${type || 'unknown'}: ${missing.join(', ')}`
        );
    }
    // Ensure all required fields are present and shaped consistently
    let sfdxAuthUrl = rawData.sfdxAuthUrl;
    if (
        rawData.refreshToken &&
        rawData.instanceUrl &&
        window.jsforceSettings &&
        (isEmpty(rawData.sfdxAuthUrl) || !rawData.sfdxAuthUrl.includes(rawData.refreshToken))
    ) {
        // If the sfdxAuthUrl is already set, we don't need to generate a new one (only if the refreshToken is different)
        sfdxAuthUrl = `force://${window.jsforceSettings?.clientId}::${rawData.refreshToken}@${new URL(rawData.instanceUrl).host}`;
    }
    return {
        id: rawData.id || rawData.alias,
        credentialType: rawData.credentialType,
        alias: rawData.alias,
        username: rawData.username,
        password: rawData.password, // Not secured !!! Avoid using password
        instanceUrl: rawData.instanceUrl,
        loginUrl: rawData.loginUrl,
        redirectUrl: rawData.redirectUrl,
        accessToken: rawData.accessToken,
        refreshToken: rawData.refreshToken,
        sfdxAuthUrl,
        orgId: rawData.orgId,
        userInfo: rawData.userInfo || {},
        company: isEmpty(rawData.company) ? extractName(rawData.alias)?.company : rawData.company,
        name: isEmpty(rawData.name) ? extractName(rawData.alias)?.name : rawData.name,
        version: rawData.version,
        versionDetails: rawData.versionDetails,
        orgType: rawData.orgType,
        _hasError: rawData._hasError,
        _formatVersion: rawData._formatVersion || 1,
        _status: rawData._status || null,
        _statusClass: rawData._statusClass || null,
        _type: rawData._type || null,
        _typeClass: rawData._typeClass || null,
        // Add any other fields you want to preserve
    };
};

export const extractConfigurationValuesFromConnection = connection => {
    return {
        instanceUrl: connection.instanceUrl,
        loginUrl: connection.loginUrl,
        accessToken: connection.accessToken,
        refreshToken: connection.refreshToken,
        username: connection.username,
        password: connection.password,
        //version: connection.version,
        userInfo: connection.userInfo,
        orgId: connection.userInfo?.organization_id,
    };
};
