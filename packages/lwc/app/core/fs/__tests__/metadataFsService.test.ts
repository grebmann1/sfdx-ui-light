import { __testables } from '../metadataFsService';

describe('metadataFsService helpers', () => {
    it('builds an alias root path for SFDX storage', () => {
        expect(__testables.getAliasRoot('My Org')).toBe('/workspace/orgs/My_Org');
    });

    it('returns null alias root when alias is missing', () => {
        expect(__testables.getAliasRoot('')).toBeNull();
    });

    it('builds package.xml with selected metadata types', () => {
        const xml = __testables.toPackageXml(['ApexClass', 'Flow'], '63.0');
        expect(xml).toContain('<name>ApexClass</name>');
        expect(xml).toContain('<name>Flow</name>');
        expect(xml).toContain('<version>63.0</version>');
    });
});
