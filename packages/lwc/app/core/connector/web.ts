import { getConnectionsFromCache, saveConnectionsToCache } from 'shared/cacheManager';
import { isNotUndefinedOrNull, isEmpty } from 'shared/utils';

import { extractName, normalizeConfiguration } from './base';
import { OAUTH_TYPES } from './credentialStrategies/oauthTypes';

const formatConfigurationItem = item => {
    return item; // Keep for now
    /*const { accessToken,instanceUrl,loginUrl,refreshToken,version } = item;
    return { 
        accessToken,
        instanceUrl,
        loginUrl,
        refreshToken,
        //version
    };*/
};

const formatConfigurations = configurations => {
    return configurations.map(x => formatConfigurationItem(x));
};

export async function getConfiguration(alias) {
    let configurations = await getConnectionsFromCache();
    return configurations.find(x => x.alias === alias);
}

export async function saveConfiguration(alias, configuration) {
    if (configuration?.credentialType === OAUTH_TYPES.SESSION) {
        return;
    }
    let configurations = await getConnectionsFromCache();
    let index = configurations.findIndex(x => x.alias === alias);
    const existing = index >= 0 ? configurations[index] : null;
    const preferDefined = (nextValue, fallbackValue) =>
        isNotUndefinedOrNull(nextValue) ? nextValue : fallbackValue;
    const merged = existing
        ? {
              ...existing,
              ...configuration,
              id: preferDefined(configuration?.id, existing.id),
              alias: preferDefined(configuration?.alias, existing.alias),
              credentialType: preferDefined(configuration?.credentialType, existing.credentialType),
              username: preferDefined(configuration?.username, existing.username),
              orgId: preferDefined(configuration?.orgId, existing.orgId),
              userInfo: preferDefined(configuration?.userInfo, existing.userInfo),
              company: preferDefined(configuration?.company, existing.company),
              name: preferDefined(configuration?.name, existing.name),
              instanceUrl: preferDefined(configuration?.instanceUrl, existing.instanceUrl),
              loginUrl: preferDefined(configuration?.loginUrl, existing.loginUrl),
              redirectUrl: preferDefined(configuration?.redirectUrl, existing.redirectUrl),
              accessToken: preferDefined(configuration?.accessToken, existing.accessToken),
              refreshToken: preferDefined(configuration?.refreshToken, existing.refreshToken),
              sfdxAuthUrl: preferDefined(configuration?.sfdxAuthUrl, existing.sfdxAuthUrl),
              password: preferDefined(configuration?.password, existing.password),
          }
        : configuration;
    const normalized = normalizeConfiguration(merged); // Just in case
    if (index >= 0) {
        configurations[index] = normalized;
    } else {
        configurations.push(normalized);
    }
    // Order Connections
    configurations = configurations.sort((a, b) => a.alias.localeCompare(b.alias));

    await saveConnectionsToCache(formatConfigurations(configurations));
}

export async function setConfigurations(configurations) {
    const normalized = configurations.map(normalizeConfiguration);
    await saveConnectionsToCache(formatConfigurations(normalized));
}

export async function renameConfiguration({ oldAlias, newAlias, username, redirectUrl }) {
    let configurations = await getConnectionsFromCache();

    if (isEmpty(oldAlias) || isEmpty(newAlias)) {
        throw new Error('renameConfiguration: oldAlias and newAlias are required');
    }
    if (oldAlias === newAlias) return;

    const existing = configurations.find(c => c && c.alias === newAlias);
    if (existing) {
        throw new Error(`Alias already exists: ${newAlias}`);
    }

    let renamed = false;
    const { company, name } = extractName(newAlias);
    configurations.forEach(conn => {
        if (conn?.alias === oldAlias) {
            renamed = true;
            conn.alias = newAlias;
            conn.id = newAlias;
            conn.company = company;
            conn.name = name;
            if (isNotUndefinedOrNull(redirectUrl)) {
                conn.redirectUrl = redirectUrl;
            }
        }
    });

    if (!renamed) {
        throw new Error(`renameConfiguration: connection not found for alias ${oldAlias}`);
    }
    // Order configurations
    configurations = configurations.sort((a, b) =>
        String(a?.alias || '').localeCompare(String(b?.alias || ''))
    );

    await saveConnectionsToCache(formatConfigurations(configurations));
}

export async function removeConfiguration({ alias }) {
    let configurations = await getConnectionsFromCache();
    // Remove the alias
    configurations = configurations.filter(x => x.alias !== alias);

    await saveConnectionsToCache(formatConfigurations(configurations));
}

export async function getConfigurations() {
    let configurations = await getConnectionsFromCache();
    // Mapping
    configurations = configurations
        .filter(x => isNotUndefinedOrNull(x))
        .map(x => {
            let instanceUrl =
                x.instanceUrl && !x.instanceUrl.startsWith('http')
                    ? `https://${x.instanceUrl}`
                    : x.instanceUrl;
            let sfdxAuthUrl =
                x.refreshToken && x.instanceUrl && window.jsforceSettings
                    ? `force://${window.jsforceSettings?.clientId}::${x.refreshToken}@${
                          new URL(x.instanceUrl).host
                      }`
                    : null;
            let _isRedirect = !isEmpty(x.redirectUrl);

            return {
                ...x,
                ...{
                    instanceUrl,
                    sfdxAuthUrl,
                    _isRedirect,
                    _status: x._hasError ? 'OAuth Error' : 'Connected',
                    _statusClass: x._hasError
                        ? 'slds-text-color_error'
                        : 'slds-text-color_success slds-text-title_caps',
                },
            };
        });
    return configurations;
}
