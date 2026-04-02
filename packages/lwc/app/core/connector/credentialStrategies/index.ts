import * as oauth from './oauth';
import * as session from './session';
import * as usernamePassword from './usernamePassword';

import { OAUTH_TYPES } from './oauthTypes';

export default {
    OAUTH: oauth,
    USERNAME: usernamePassword,
    SESSION: session,
};

export { OAUTH_TYPES };
