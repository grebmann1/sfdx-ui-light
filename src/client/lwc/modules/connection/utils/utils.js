import constant from 'core/constant';
import { isUndefinedOrNull, isElectronApp, isEmpty } from 'shared/utils';

import { Connector } from './connectorClass';
import * as webInterface from './web';

import LOGGER from 'shared/logger';
export * from './chrome';
export * from './connectorClass';

/** Credential Strategies **/

import * as Oauth2 from './credentialStrategies/oauth';
import * as UsernamePassword from './credentialStrategies/usernamePassword';
import * as Sfdx from './credentialStrategies/sfdx';
import * as Session from './credentialStrategies/session';
import * as NotificationService from './notificationService';
import * as PlatformService from './platformService';
import * as IntegrationMatrix from './integrationMatrix';
import { OAUTH_TYPES as internalOAUTH_TYPES } from './credentialStrategies/index';

export const credentialStrategies = {
    OAUTH: Oauth2,
    USERNAME: UsernamePassword,
    SFDX: Sfdx,
    SESSION: Session,
};
export const OAUTH_TYPES = internalOAUTH_TYPES;

export const notificationService = NotificationService;

export const platformService = PlatformService;

export const integrationMatrix = IntegrationMatrix;

/** Legacy Functions/Methods **/

export const extractName = alias => {
    let nameArray = (alias || '').split('-');
    return {
        company: nameArray.length > 1 ? nameArray.shift() : '',
        name: nameArray.join('-'),
    };
};

export const extractConfig = config => {
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

// Legacy connect and getExistingSession functions removed. All connection logic now uses credential strategies.

export async function getConfiguration(alias) {
    return platformService.getConfiguration(alias);
}

export async function setConfigurations(params) {
    return platformService.setConfigurations(params);
}

export async function renameConfiguration(params) {
    return platformService.renameConfiguration(params);
}

export async function removeConfiguration(alias) {
    return platformService.removeConfiguration(alias);
}

export async function getConfigurations() {
    return platformService.getConfigurations();
}

export async function saveSession(value) {
    sessionStorage.setItem('currentConnection', JSON.stringify(value));
}

export async function removeSession() {
    sessionStorage.removeItem('currentConnection');
}

/** Session Connection **/

export async function setRedirectCredential(
    { alias, redirectUrl },
    callback,
    callbackErrorHandler
) {
    try {
        LOGGER.log('redirect_credential');
        const connector = await Connector.createConnector({
            alias,
            redirectUrl,
            credentialType: internalOAUTH_TYPES.REDIRECT,
        });
        LOGGER.log('connector', connector);
        await webInterface.saveConfiguration(alias, connector.configuration);
        callback();
    } catch (e) {
        callbackErrorHandler(e);
    }
}

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

export const processHost = origin => {
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
            extra.isProxyDisabled || platform === PlatformService.PLATFORM.CHROME
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
    }
    return params;
};

export const normalizeConfiguration = (rawData, byPassValidation = false) => {
    // Validate required fields by credentialType
    if (isUndefinedOrNull(rawData._formatVersion)) {
        // Initialize format version (version null to 1)
        if (rawData.refreshToken) {
            if (isElectronApp()) {
                rawData.credentialType = OAUTH_TYPES.SFDX;
            } else {
                rawData.credentialType = OAUTH_TYPES.OAUTH;
            }
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
    } else if (type === OAUTH_TYPES.SFDX) {
        if (!rawData.refreshToken) missing.push('refreshToken');
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
    if (rawData.refreshToken && rawData.instanceUrl) {
        // TODO : Might fail if the sfdxAuthUrl is already set !!!
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
        //_typeClass: rawData._typeClass,
        //_statusClass: rawData._statusClass,
        //_connectVariant: rawData._hasError ? 'brand-outline' : 'brand',
        //_connectLabel: rawData._hasError && rawData.credentialType !== OAUTH_TYPES.USERNAME ? 'Authorize' : 'Connect',
        //_connectAction: rawData._hasError && rawData.credentialType !== OAUTH_TYPES.USERNAME ? 'authorize' : 'login',
        //_isInjected: rawData._isInjected,
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
