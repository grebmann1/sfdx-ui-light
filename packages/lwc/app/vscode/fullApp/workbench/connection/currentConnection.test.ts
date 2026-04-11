import {
    clearCurrentConnectionProvider,
    clearSharedCurrentConnectionContext,
    getCurrentConnection,
    getCurrentConnectionContext,
    shareCurrentConnectionContext,
} from './currentConnection.ts';

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

const sharedContext = {
    connector: {
        conn: {
            instanceUrl: 'https://example.my.salesforce.com',
            accessToken: 'token',
        },
    },
};

shareCurrentConnectionContext(() => sharedContext);

const resolvedContext = getCurrentConnectionContext();
assert(resolvedContext === sharedContext, 'shared context should return the same object reference');
assert(
    getCurrentConnection() === sharedContext,
    'legacy getCurrentConnection alias should resolve the same shared context object'
);

sharedContext.connector.conn.accessToken = 'updated-token';
assert(
    getCurrentConnectionContext()?.connector?.conn?.accessToken === 'updated-token',
    'reading the context again should expose live mutations on the shared connector object'
);

clearSharedCurrentConnectionContext();
assert(getCurrentConnectionContext() === null, 'clearing the shared context should remove it');

shareCurrentConnectionContext(() => sharedContext);
clearCurrentConnectionProvider();
assert(
    getCurrentConnectionContext() === null,
    'legacy clearCurrentConnectionProvider alias should also clear the shared context'
);
