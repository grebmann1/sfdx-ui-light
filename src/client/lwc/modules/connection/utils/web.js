import { getConnectionsFromCache, saveConnectionsToCache } from 'shared/cacheManager';
import { isUndefinedOrNull, isNotUndefinedOrNull, isEmpty } from 'shared/utils';
import { extractName, normalizeConfiguration } from './utils';
import LOGGER from 'shared/logger';

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
    let configurations = await getConnectionsFromCache();
    let index = configurations.findIndex(x => x.alias === alias);
    const normalized = normalizeConfiguration(configuration); // Just in case
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

export async function removeConfiguration({alias}) {
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
