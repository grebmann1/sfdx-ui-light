/* eslint-env jest */
import { __testables } from '../runtime/connectionRuntime.js';

describe('connectionRuntime helpers', () => {
    it('defaults to non-chrome environment in tests', () => {
        expect(__testables.isChromeExtensionEnv()).toBe(false);
    });
});
