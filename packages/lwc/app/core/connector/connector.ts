export type { ConnectorLike, ConnectionLike, ConnectorConfiguration } from 'shared/types/connector';

import * as Oauth2 from './credentialStrategies/oauth';
import * as Session from './credentialStrategies/session';
import * as UsernamePassword from './credentialStrategies/usernamePassword';
import { OAUTH_TYPES } from './credentialStrategies/oauthTypes';
import * as IntegrationMatrix from './integrationMatrix';
import * as NotificationService from './notificationService';
import * as PlatformService from './platformService';

export * from './chrome';
export * from './base';
export * from './backgroundSession';
export * from './connectionRegistry';
export { Connector } from './connectorClass';
export * from './redirectCredential';

export const credentialStrategies = {
    OAUTH: Oauth2,
    USERNAME: UsernamePassword,
    SESSION: Session,
};

export const notificationService = NotificationService;
export const platformService = PlatformService;
export const integrationMatrix = IntegrationMatrix;

export { OAUTH_TYPES };

export async function getConfiguration(alias) {
    return platformService.getConfiguration(alias);
}

export async function setConfigurations(params) {
    return platformService.setConfigurations(params);
}

export async function renameConfiguration(params) {
    return platformService.renameConfiguration(params);
}

export async function removeConfiguration(params) {
    return platformService.removeConfiguration(params);
}

export async function saveConfiguration(alias, configuration) {
    return platformService.saveConfiguration(alias, configuration);
}

export async function getConfigurations() {
    return platformService.getConfigurations();
}

export async function getPublicConfigurations() {
    const configurations = await getConfigurations();
    return configurations.map(x => ({
        id: x.alias,
        alias: x.alias,
        username: x.username,
        loginUrl: x.loginUrl,
        credentialType: x.credentialType,
        company: x.company,
        name: x.name,
        instanceUrl: x.instanceUrl,
    }));
}

export async function saveSession(value) {
    sessionStorage.setItem('currentConnection', JSON.stringify(value));
}

export async function removeSession() {
    sessionStorage.removeItem('currentConnection');
}
