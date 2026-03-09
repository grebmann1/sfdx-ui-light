// integrationMatrix.js
import { getCurrentPlatform } from './platformService';

// String literals to avoid circular dependency (platformService → utils → integrationMatrix)
const matrix = {
    web: ['OAUTH', 'USERNAME', 'REDIRECT', 'SESSION'],
    chrome: ['OAUTH', 'USERNAME', 'REDIRECT', 'SESSION'],
    electron: ['OAUTH', 'USERNAME', 'SFDX', 'SESSION'],
};

export function getSupportedCredentialTypes() {
    return matrix[getCurrentPlatform()];
}

export function isCredentialTypeSupported(type) {
    return getSupportedCredentialTypes().includes(type);
}

export default matrix;
