import LOGGER from 'shared/logger';
import { isNotUndefinedOrNull } from 'shared/utils';

import { getConfigurations } from './platformService';

export const getExistingHostMap = configurations => {
    const hostMap = new Map();
    configurations.forEach(config => {
        let hostname = null;
        if (isNotUndefinedOrNull(config.instanceUrl)) {
            hostname = new URL(config.instanceUrl).hostname;
        } else if (isNotUndefinedOrNull(config.redirectUrl)) {
            hostname = new URL(config.redirectUrl).hostname;
        }
        if (hostname) {
            hostMap.set(hostname, config);
        }
    });
    return hostMap;
};

export const getMatchingConfiguration = async connection => {
    const hostMap = getExistingHostMap(await getConfigurations());
    try {
        const hostname = new URL(connection.instanceUrl).hostname;
        if (hostMap.has(hostname)) {
            return hostMap.get(hostname);
        }
        return null;
    } catch (e) {
        LOGGER.error('getMatchingConfiguration issue: ', e);
        return null;
    }
};
