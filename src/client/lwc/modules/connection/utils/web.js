import { getConnectionsFromCache, saveConnectionsToCache } from 'shared/cacheManager';
import { isUndefinedOrNull, isNotUndefinedOrNull, isEmpty } from 'shared/utils';
import { normalizeConfiguration } from './utils';

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

    // Switch Name
    configurations.forEach(conn => {
        if (conn.alias === oldAlias) {
            conn.alias = newAlias;
            conn.redirectUrl = redirectUrl;
        }
    });
    // Order configurations
    configurations = configurations.sort((a, b) => a.alias.localeCompare(b.alias));

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
                x.refreshToken && x.instanceUrl
                    ? `force://${window.jsforceSettings.clientId}::${x.refreshToken}@${
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
