import * as oauth from './oauth';
import * as usernamePassword from './usernamePassword';
import * as session from './session';

export default {
    OAUTH: oauth,
    USERNAME: usernamePassword,
    SESSION: session,
};

export const OAUTH_TYPES = {
    OAUTH: 'OAUTH',
    USERNAME: 'USERNAME',
    SESSION: 'SESSION',
    REDIRECT: 'REDIRECT',
};
