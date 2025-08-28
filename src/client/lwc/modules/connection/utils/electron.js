import { isNotUndefinedOrNull, isEmpty, decodeError, classSet, runActionAfterTimeOut } from 'shared/utils';
import { extractName, extractConfig, OAUTH_TYPES } from './utils';
import LOGGER from 'shared/logger';
import { cacheManager, CACHE_ORG_DATA_TYPES } from 'shared/cacheManager';


const CONNECTION_ERRORS = [
    'JwtAuthError',
    'RefreshTokenAuthError'
];
const CONNECTION_WARNING = [
    'DomainNotFoundError'
];



export async function getConfiguration(alias) {
    const { res, error } = await window.electron.invoke('org-seeDetails', { alias });
    if (error) {
        throw decodeError(error);
    }

    const { name, company } = extractName(res.alias);
    const { refreshToken, instanceUrl } = res.sfdxAuthUrl ? extractConfig(res.sfdxAuthUrl) : {};

    return {
        ...res,
        id: res.alias,
        company,
        name,
        credentialType: res.credentialType || OAUTH_TYPES.OAUTH,
        instanceUrl: res.instanceUrl || instanceUrl,
        loginUrl: res.instanceUrl || instanceUrl,
        refreshToken: res.refreshToken || refreshToken,
    };
}

export async function renameConfiguration({ oldAlias, newAlias, username, credentialType }) {
    if (credentialType === OAUTH_TYPES.USERNAME) {
        let res = await window.electron.invoke('org-renameStoredOrg', {
            alias: oldAlias,
            newAlias: newAlias
        });
        if (res?.error) {
            throw decodeError(res.error);
        }
    } else {
        let res = await window.electron.invoke('org-setAlias', {
            alias: newAlias,
            username: username,
        });
        if (res?.error) {
            throw decodeError(res.error);
        }

        if (oldAlias !== 'Empty' || isNotUndefinedOrNull(oldAlias)) {
            let res2 = await window.electron.invoke('org-unsetAlias', {
                alias: oldAlias,
            });
            if (res2?.error) {
                throw decodeError(res2.error);
            }
        }
    }

}

export async function removeConfiguration({ alias, credentialType }) {
    // todo: need to be refactured
    if (credentialType === OAUTH_TYPES.USERNAME) {
        let res = await window.electron.invoke('org-removeStoredOrg', { alias });
        if (res?.error) {
            throw decodeError(res.error);
        }
    } else {
        let res = await window.electron.invoke('org-logout', { alias });
        if (res?.error) {
            throw decodeError(res.error);
        }
        let res1 = await window.electron.invoke('org-unsetAlias', { alias });
        if (res1?.error) {
            throw decodeError(res.error);
        }
    }


}

const getStatusClass = status => {
    if (CONNECTION_ERRORS.includes(status)) {
        return 'slds-text-color_error';
    } else if (CONNECTION_WARNING.includes(status)) {
        return 'slds-color-brand';
    }

    return 'slds-text-color_success slds-text-title_caps';
};

function normalizeOrgs(sfdxOrgs, storedOrgs) {
    let orgs = [].concat(
        sfdxOrgs.result.nonScratchOrgs.map(x => ({
            ...x,
            _status: x.connectedStatus,
            _type: x.isDevHub ? 'DevHub' : x.isSandbox ? 'Sandbox' : '',
        })),
        sfdxOrgs.result.scratchOrgs.map(x => ({
            ...x,
            _status: x.status,
            _type: 'Scratch',
        })),
        storedOrgs.map(x => ({
            ...x,
            _status: x.status,
            _type: 'Stored',
        }))
    );
    orgs = orgs.filter(x => isNotUndefinedOrNull(x.alias));
    orgs = orgs.map((item, index) => {
        let alias = item.alias || 'Empty';
        const { name, company } = extractName(alias);
        let _typeClass = classSet('')
            .add({
                'slds-color-brand': item._type === 'DevHub',
                'slds-color-orange-light': item._type === 'Sandbox',
                'slds-color-orange-dark': item._type === 'Scratch',
            })
            .toString();
        const config = extractConfig(item.sfdxAuthUrl);
        if (config) {
            item.instanceUrl = config.instanceUrl;
            item.loginUrl = config.instanceUrl;
            item.refreshToken = config.refreshToken;
        }
        return {
            ...item,
            ...{
                alias,
                id: `index-${index}`,
                company: company,
                name: name,
                credentialType: item.credentialType || OAUTH_TYPES.OAUTH,
                _typeClass,
                _statusClass: getStatusClass(item._status),
                _hasError: item._status == 'JwtAuthError',
                _isRedirect: !isEmpty(item.redirectUrl),
            },
        };
    });
    orgs = orgs.sort((a, b) => a.alias.localeCompare(b.alias));
    return orgs;
}

export async function getConfigurations({ sync = false } = {}) {
    const DATA_TYPE = CACHE_ORG_DATA_TYPES.ELECTRON_ORG_LIST;
    if (!sync) {       
        // Try to load from cache
        const cachedOrgs = await cacheManager.loadOrgData('electron', DATA_TYPE);
        if (cachedOrgs) {
            // ASYNC (background refresh)
            window.electron.invoke('org-getAllOrgs')
            .then(async ({ sfdxOrgs, storedOrgs }) => {
                const orgs = normalizeOrgs(sfdxOrgs, storedOrgs);
                await cacheManager.saveOrgData('electron', DATA_TYPE, orgs);
                dispatchEvent(new CustomEvent('electron-orgs-updated', { detail: { orgs } }));
            })
            .catch(() => {/* ignore background errors */ });
            // Return cached orgs
            return cachedOrgs;
        }
    }

    // If no cache, fetch fresh, update cache, and return (SYNC)
    const { sfdxOrgs, storedOrgs } = await window.electron.invoke('org-getAllOrgs');
    LOGGER.info('getConfigurations - electron - result', sfdxOrgs, storedOrgs);
    const orgs = normalizeOrgs(sfdxOrgs, storedOrgs);
    await cacheManager.saveOrgData('electron', DATA_TYPE, orgs);
    return orgs;
}
