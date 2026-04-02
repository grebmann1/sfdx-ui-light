import LOGGER from 'shared/logger';
import { Connector } from './connectorClass';
import type { ConnectorLike } from './connector';

import { OAUTH_TYPES } from './credentialStrategies/oauthTypes';
import { saveConfiguration } from './web';

export async function setRedirectCredential(
    { alias, redirectUrl }: { alias: string; redirectUrl: string },
    callback: () => void,
    callbackErrorHandler: (error: Error) => void
) {
    try {
        LOGGER.log('redirect_credential');
        const connector: ConnectorLike = await Connector.createConnector({
            alias,
            redirectUrl,
            credentialType: OAUTH_TYPES.REDIRECT,
        });
        LOGGER.log('connector', connector);
        await saveConfiguration(alias, connector.configuration);
        callback();
    } catch (e) {
        callbackErrorHandler(e);
    }
}
