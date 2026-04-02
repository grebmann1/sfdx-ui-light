// integrationMatrix.js
import { getCurrentPlatform } from './platformService';
import { OAUTH_TYPES } from './credentialStrategies/oauthTypes';

// String literals to avoid circular dependency (platformService → utils → integrationMatrix)
const matrix = {
    web: [OAUTH_TYPES.OAUTH, OAUTH_TYPES.USERNAME, OAUTH_TYPES.REDIRECT, OAUTH_TYPES.SESSION],
    chrome: [OAUTH_TYPES.OAUTH, OAUTH_TYPES.USERNAME, OAUTH_TYPES.REDIRECT, OAUTH_TYPES.SESSION],
    electron: [OAUTH_TYPES.OAUTH, OAUTH_TYPES.USERNAME, 'SFDX', OAUTH_TYPES.SESSION],
};

export function getSupportedCredentialTypes() {
    return matrix[getCurrentPlatform()];
}

export function isCredentialTypeSupported(type) {
    return getSupportedCredentialTypes().includes(type);
}

export default matrix;
