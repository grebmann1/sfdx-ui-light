import LightningModal from 'lightning/modal';
import { api } from 'lwc';
import { isElectronApp } from 'shared/utils';

const application_mapping = [
    {
        id: 'accessAnalyzer',
        name: 'Access Analyzer',
        shortName: 'AA',
        component: 'accessAnalyzer/app',
        description: 'Analyze access provided by profiles and permission sets',
        isDeletable: true,
        isElectronOnly: false,
        type: 'metadata',
    },
    {
        id: 'metadata',
        name: 'Metadata Explorer',
        shortName: 'ME',
        component: 'metadata/app',
        description: 'Explorer Metadata from the Org',
        isDeletable: true,
        isElectronOnly: false,
        type: 'metadata',
    },
    {
        id: 'sobject',
        name: 'SObject Explorer',
        shortName: 'SE',
        component: 'object/app',
        description: 'Explorer SObjects from the Org',
        isDeletable: true,
        isElectronOnly: false,
        type: 'metadata',
    },
    {
        id: 'code',
        name: 'Anonymous Apex',
        shortName: 'AA',
        component: 'anonymousapex/app',
        description: 'Execute Anonymous Apex',
        isDeletable: true,
        isElectronOnly: true,
        type: 'code',
    },
    {
        id: 'doc',
        name: 'Documentation Explorer',
        shortName: 'DE',
        component: 'doc/app',
        description: 'Explore Salesforce Documentation',
        isDeletable: true,
        isElectronOnly: false,
        isOfflineAvailable: true,
        type: 'documentation',
    },
    {
        id: 'soql',
        name: 'SOQL Explorer',
        shortName: 'SE',
        component: 'soql/app',
        description: 'Build SOQL queries',
        isDeletable: true,
        isElectronOnly: false,
        isOfflineAvailable: false,
        type: 'code',
    },
];

export default class Launcher extends LightningModal {
    @api isUserLoggedIn;

    /** events **/
    selectApplication = e => {
        let application = application_mapping.find(x => x.id === e.currentTarget.dataset.key);
        if (application) {
            this.dispatchEvent(new CustomEvent('select', { detail: application }));
        }
    };

    /** getters */

    get applications() {
        if (isElectronApp()) return application_mapping;
        return application_mapping.filter(x => !x.isElectronOnly);
    }

    get metadataApplications() {
        return this.applications.filter(x => x.type === 'metadata');
    }

    get codeApplications() {
        return this.applications.filter(x => x.type === 'code');
    }

    get offlineApplications() {
        return this.applications.filter(x => x.isOfflineAvailable);
    }
}
