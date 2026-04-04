/* eslint-env jest */
import { __testables } from '../commands/metadataApiCommands.js';

describe('metadataApiCommands helpers', () => {
    it('parses package.xml types and members', () => {
        const manifest = __testables.parsePackageXml(`
            <Package xmlns="http://soap.sforce.com/2006/04/metadata">
              <types>
                <members>MyClass</members>
                <members>MyOtherClass</members>
                <name>ApexClass</name>
              </types>
            </Package>
        `);
        expect(Array.from(manifest.keys())).toEqual(['ApexClass']);
        expect(Array.from(manifest.get('ApexClass'))).toEqual(['MyClass', 'MyOtherClass']);
    });
});
