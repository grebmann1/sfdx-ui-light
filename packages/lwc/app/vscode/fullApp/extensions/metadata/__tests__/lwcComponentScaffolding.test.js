/* eslint-env jest */
import { DEFAULT_SOURCE_API_VERSION } from '../../../workbench/sfdxProject.js';
import { __testables } from '../commands/lwcComponentScaffolding.js';

describe('lwcComponentScaffolding helpers', () => {
    it('accepts valid bundle names and rejects invalid ones', () => {
        expect(__testables.isValidBundleName('helloWorld')).toBe(true);
        expect(__testables.isValidBundleName('hello_world')).toBe(true);
        expect(__testables.isValidBundleName('HelloWorld')).toBe(false);
        expect(__testables.isValidBundleName('1hello')).toBe(false);
        expect(__testables.isValidBundleName('hello-world')).toBe(false);
    });

    it('builds a PascalCase class name from the bundle name', () => {
        expect(__testables.toComponentClassName('helloWorld')).toBe('HelloWorld');
        expect(__testables.toComponentClassName('hello_world')).toBe('HelloWorld');
    });

    it('creates the standard starter files', () => {
        const files = __testables.createComponentFiles('helloWorld');
        expect(Object.keys(files).sort()).toEqual([
            'helloWorld.html',
            'helloWorld.js',
            'helloWorld.js-meta.xml',
        ]);
        expect(files['helloWorld.js']).toContain('export default class HelloWorld');
        expect(files['helloWorld.js-meta.xml']).toContain(
            `<apiVersion>${DEFAULT_SOURCE_API_VERSION}</apiVersion>`
        );
        expect(files['helloWorld.js-meta.xml']).toContain('<isExposed>false</isExposed>');
    });

    it('uses the provided api version in starter metadata', () => {
        const files = __testables.createComponentFiles('helloWorld', '65.0');
        expect(files['helloWorld.js-meta.xml']).toContain('<apiVersion>65.0</apiVersion>');
    });
});
