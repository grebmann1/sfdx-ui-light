/* eslint-env jest */
import { __testables } from '../core/workspacePaths.js';

describe('workspacePaths helpers', () => {
    it('normalizes lwc resource paths from tooling api paths', () => {
        expect(
            __testables.normalizeLwcResourceRelPath(
                'accountCard',
                'lwc/accountCard/accountCard.js',
                'JS'
            )
        ).toBe('accountCard.js');
    });

    it('builds aura filenames from definition type', () => {
        expect(__testables.auraFilename('cmp', 'CONTROLLER', 'JS')).toBe('cmpController.js');
    });
});
