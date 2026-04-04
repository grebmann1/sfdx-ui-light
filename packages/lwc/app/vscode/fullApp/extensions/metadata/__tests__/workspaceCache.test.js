/* eslint-env jest */
import { __testables } from '../core/workspaceCache.js';

describe('workspaceCache helpers', () => {
    it('skips caching malformed nested lwc paths', () => {
        expect(
            __testables.looksLikeBadLwcPath(
                '/workspace/force-app/main/default/lwc/foo/lwc/foo/foo.js'
            )
        ).toBe(true);
        expect(
            __testables.shouldCachePath('/workspace/force-app/main/default/lwc/foo/lwc/foo/foo.js')
        ).toBe(false);
    });
});
