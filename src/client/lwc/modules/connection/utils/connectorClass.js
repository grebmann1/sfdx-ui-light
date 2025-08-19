import LOGGER from 'shared/logger';
import { saveConfiguration } from './web';
import { cacheManager, CACHE_ORG_DATA_TYPES, CACHE_SESSION_CONFIG } from 'shared/cacheManager';
import { OAUTH_TYPES } from './credentialStrategies/index';
import { store, APPLICATION } from 'core/store';
import {
    getConfiguration,
    extractName,
    normalizeConfiguration,
    extractConfigurationValuesFromConnection,
} from './utils';
import { isElectronApp } from 'shared/utils';
export class Connector {
    conn;
    configuration;

    constructor(configuration, conn) {
        this.configuration = configuration;
        this.conn = conn;
    }

    /** Methods */

    toPublic() {
        return {
            alias: this.configuration.alias,
            username: this.configuration.username,
            credentialType: this.configuration.credentialType,
            sessionId: this.conn?.accessToken,
            instanceUrl: this.conn?.instanceUrl,
            version: this.conn?.version,
        };
    }

    async generateAccessToken() {
        LOGGER.debug('--> generateAccessToken <--');
        try {
            this.resetError();
            return await this._refreshToken();
        } catch (e) {
            await this.handleError(e);
        }
        return null;
    }

    async _refreshToken() {
        if (!this.conn.refreshToken) {
            LOGGER.warn('refreshToken - no refreshToken');
            return null;
        }
        const jwt = await this.conn.oauth2.refreshToken(this.conn.refreshToken);
        return {
            ...jwt,
            frontDoorUrl: jwt.instance_url + '/secur/frontdoor.jsp?sid=' + jwt.access_token,
        };
    }

    async handleError(e) {
        LOGGER.error('Error handling error', e);
        Object.assign(this.configuration, {
            _hasError: true,
            _errorMessage: e.message,
        });

        if(!isElectronApp()){
            await saveConfiguration(this.configuration.alias, this.configuration);
        }

        
        store.dispatch(APPLICATION.reduxSlice.actions.stopLoading());
    }

    resetError() {
        this.configuration._hasError = false;
        this.configuration._errorMessage = null;
    }

    async _lightEnrichWithVersions(){
        try{
            const versions = await this.conn.request('/services/data/');

            let latestVersion = Array.isArray(versions)
                ? versions.sort((a, b) => b.version.localeCompare(a.version))[0]
                : undefined;

            // Enrich Connection
            Object.assign(this.conn, {
                version: latestVersion?.version || this.conn.version,
                _versions: versions,
            });
        }catch(e){
            LOGGER.error('Error enriching connector', e);
        }
    }

    async _enrichConnector() {
        try {
            this.resetError();

            let identity = undefined;
            let versions = undefined;
            // Only fetch identity if not USERNAME credential type
            if (this.configuration.credentialType === OAUTH_TYPES.USERNAME) {
                versions = await this.conn.request('/services/data/');
            } else {
                [identity, versions] = await Promise.all([
                    this.conn.identity(),
                    this.conn.request('/services/data/'),
                ]);
            }

            let latestVersion = Array.isArray(versions)
                ? versions.sort((a, b) => b.version.localeCompare(a.version))[0]
                : undefined;

            // Enrich Configuration
            Object.assign(this.configuration, {
                username: identity?.username || this.configuration.username,
                orgId: identity?.organization_id || this.configuration.orgId,
                userInfo: identity || this.configuration.userInfo,
                alias: this.configuration.alias || identity?.username,
                id: this.configuration.id || identity?.username,
            });

            // Load Session Settings
            const sessionSettings = await cacheManager.loadOrgData(
                this.configuration.alias,
                CACHE_ORG_DATA_TYPES.SESSION_SETTINGS
            );

            let currentVersion = latestVersion;
            if (sessionSettings && sessionSettings[CACHE_SESSION_CONFIG.API_VERSION.key]) {
                currentVersion =
                    versions.find(
                        x => x.version === sessionSettings[CACHE_SESSION_CONFIG.API_VERSION.key]
                    ) || latestVersion;
            }
            let callOptions = this.conn._callOptions || {};
            if (sessionSettings && sessionSettings[CACHE_SESSION_CONFIG.CLIENT_ID.key]) {
                callOptions.client = sessionSettings[CACHE_SESSION_CONFIG.CLIENT_ID.key];
            }
            // Enrich Connection
            Object.assign(this.conn, {
                alias: this.configuration.alias,
                version: currentVersion?.version,
                _versions: versions,
                _callOptions: callOptions,
            });

            // Always normalize configuration before returning
            this.configuration = normalizeConfiguration(this.configuration, true);
        } catch (e) {
            LOGGER.error('Error enriching connector', e);
            await this.handleError(e);
        }
    }

    /**
     * Static method to create a Connector instance from parameters (previously in connectionModel.js).
     */
    static async createConnector({
        alias,
        connection,
        configuration,
        redirectUrl,
        credentialType,
        isEnrichDisabled,
    }) {
        if (!configuration) {
            const { name, company } = extractName(alias);
            configuration = {
                id: alias,
                alias,
                company: company.toUpperCase(),
                name,
                credentialType,
                // Redirect URL
                redirectUrl,
            };
        }

        if (connection) {
            Object.assign(configuration, extractConfigurationValuesFromConnection(connection));
        }

        let connector = new Connector(configuration, connection);
        if (!isEnrichDisabled) {
            await connector._enrichConnector();
        }else{
            // to get the latest version
            await connector._lightEnrichWithVersions();
        }
        return connector;
    }

    /**
     * Static method to create a Connector instance by alias.
     * @param {string} alias - The alias of the connection configuration.
     * @returns {Promise<Connector>} - The created Connector instance.
     */
    static async fromAlias(alias) {
        const configuration = await getConfiguration(alias);
        if (!configuration) {
            throw new Error(`No configuration found for alias: ${alias}`);
        }
        LOGGER.debug('fromAlias', configuration);
        // createConnector will enrich and return a Connector instance
        return await Connector.createConnector({ alias, configuration });
    }

    /** Getters */

    get redirectUrl() {
        return this.configuration?.redirectUrl;
    }

    get isRedirect() {
        return this.redirectUrl && !this.conn;
    }

    get frontDoorUrl() {
        return this.isRedirect
            ? this.redirectUrl
            : this.conn.instanceUrl + '/secur/frontdoor.jsp?sid=' + this.conn.accessToken;
    }

    get hasError() {
        return this.configuration._hasError;
    }

    get errorMessage() {
        return this.configuration._errorMessage;
    }
}
