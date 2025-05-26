// integrationMatrix.js
import { PLATFORM, getCurrentPlatform } from './platformService';

const matrix = {
    [PLATFORM.WEB]: ['OAUTH', 'USERNAME', 'REDIRECT', 'SESSION'],
    [PLATFORM.CHROME]: ['OAUTH', 'USERNAME', 'REDIRECT', 'SESSION'],
    [PLATFORM.ELECTRON]: ['OAUTH', 'USERNAME', 'SFDX', 'SESSION'],
};

export function getSupportedCredentialTypes() {
    return matrix[getCurrentPlatform()];
}

export function isCredentialTypeSupported(type) {
    return getSupportedCredentialTypes().includes(type);
}

export default matrix;
