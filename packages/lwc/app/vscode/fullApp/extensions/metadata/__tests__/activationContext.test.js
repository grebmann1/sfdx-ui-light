/* eslint-env jest */
import { __testables } from '../core/activationContext.js';

describe('activationContext helpers', () => {
    it('disposes every disposable once', () => {
        const calls = [];
        __testables.disposeAll([
            { dispose: () => calls.push('a') },
            { dispose: () => calls.push('b') },
        ]);
        expect(calls).toEqual(['a', 'b']);
    });
});
