import { hashText, pickRemoteStamp } from '../sourceTracking';

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

const sourceHash = hashText('public class Example {}');
assert(
    sourceHash === hashText('public class Example {}'),
    'hashText should be deterministic for identical file contents'
);
assert(
    sourceHash !== hashText('public class Example { Integer value; }'),
    'hashText should change when file contents change'
);

assert(
    pickRemoteStamp({
        SystemModstamp: '2026-04-11T10:00:00.000Z',
        LastModifiedDate: '2026-04-10T10:00:00.000Z',
    }) === '2026-04-11T10:00:00.000Z',
    'pickRemoteStamp should prefer SystemModstamp when available'
);
assert(
    pickRemoteStamp({ LastModifiedDate: '2026-04-10T10:00:00.000Z' }) ===
        '2026-04-10T10:00:00.000Z',
    'pickRemoteStamp should fall back to LastModifiedDate'
);
assert(pickRemoteStamp({}) === null, 'pickRemoteStamp should return null when no stamp exists');
