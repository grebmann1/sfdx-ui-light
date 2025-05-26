import * as oauth from './oauth';
import * as usernamePassword from './usernamePassword';
import * as sfdx from './sfdx';
import * as session from './session';

export default {
    OAUTH: oauth,
    USERNAME: usernamePassword,
    SFDX: sfdx,
    SESSION: session,
    //redirect: redirect,
};

export const OAUTH_TYPES = {
    OAUTH: 'OAUTH',
    USERNAME: 'USERNAME',
    SFDX: 'SFDX',
    SESSION: 'SESSION',
    REDIRECT: 'REDIRECT',
};