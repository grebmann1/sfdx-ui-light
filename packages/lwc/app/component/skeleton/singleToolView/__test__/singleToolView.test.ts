import { parseSingleToolBootstrapSeed } from '../singleToolViewHelpers.ts';

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

const defaultSeed = parseSingleToolBootstrapSeed('');
assert(
    defaultSeed.applicationName === 'api',
    'single tool bootstrap should default to API Explorer when no application is requested'
);

const explicitSeed = parseSingleToolBootstrapSeed(
    '?applicationName=API&alias=sandbox-dev&sessionId=session-token&serverUrl=https%3A%2F%2Fexample.my.salesforce.com&redirectUrl=%2Fhome'
);
assert(
    explicitSeed.applicationName === 'api',
    'single tool bootstrap should normalize application names to lowercase paths'
);
assert(explicitSeed.alias === 'sandbox-dev', 'single tool bootstrap should keep alias values');
assert(
    explicitSeed.sessionId === 'session-token' &&
        explicitSeed.serverUrl === 'https://example.my.salesforce.com',
    'single tool bootstrap should keep session credentials when provided'
);
assert(
    explicitSeed.redirectUrl === '/home',
    'single tool bootstrap should keep redirectUrl query params'
);
