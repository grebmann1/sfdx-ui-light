import connection_app from 'connection/app';
import doc_app from 'doc/app';
import home_app from 'home/app';
import release_app from 'release/app';
import sarif_app from 'sarif/app';
import settings_app from 'settings/app';
import smartinput_app from 'smartinput/app';
import textCompare_app from 'textCompare/app';
// Modules coming from the applications !!!
// We shouldn't add "Tools" here, but in the applications folder !!!
import { APPLICATION_APP_MAPPING, APPLICATION_MENU_GROUPS } from 'skeleton/registry';

const i18n = {
    HOME: 'home',
    EXPLORER: 'explorer',
    DEVELOPER: 'developer',
    DATA: 'data',
    UTILITY: 'utility',
    CONNECTION: 'connection',
    DOCUMENTATION: 'documentation',
    EXTRA: 'extra',
};

const BASE_APP_MAPPING = {
    'home/app': {
        module: home_app,
        isFullHeight: false,
        label: 'Home',
        isElectronOnly: false,
        isOfflineAvailable: true,
        isTabVisible: false,
        type: i18n.HOME,
        menuIcon: 'utility:home',
        path: 'home',
    },
    'connection/app': {
        module: connection_app,
        isFullHeight: false,
        label: 'Salesforce Connections',
        isElectronOnly: false,
        isOfflineAvailable: true,
        isTabVisible: false,
        type: i18n.CONNECTION,
        menuIcon: 'utility:salesforce1',
        menuLabel: 'Connections',
        path: 'connections',
    },
    'sarif/app': {
        module: sarif_app,
        isFullHeight: false,
    },
    'doc/app': {
        module: doc_app,
        isFullHeight: true,
        isDeletable: true,
        isElectronOnly: false,
        isOfflineAvailable: true,
        isMenuVisible: true,
        isTabVisible: true,
        label: 'Documentation',
        type: i18n.DOCUMENTATION,
        description: 'Search through the Salesforce Documentation',
        menuIcon: 'utility:knowledge_base',
        quickActionIcon: 'standard:article',
        shortName: 'Doc.',
        path: 'documentation',
    },
    'smartinput/app': {
        module: smartinput_app,
        isFullHeight: true,
        isDeletable: true,
        isElectronOnly: false,
        isOfflineAvailable: true,
        isChromeOnly: true,
        isMenuVisible: true,
        isTabVisible: true,
        label: 'Smart Input',
        type: i18n.UTILITY,
        description: 'Smart Input',
        quickActionIcon: 'utility:magicwand',
        shortName: 'Smart Input',
        path: 'smartinput',
    },
    'textCompare/app': {
        module: textCompare_app,
        isFullHeight: true,
        isDeletable: true,
        isElectronOnly: false,
        isOfflineAvailable: true,
        isMenuVisible: true,
        isTabVisible: true,
        label: 'Text Compare',
        type: i18n.UTILITY,
        description: 'Compare two texts side-by-side.',
        quickActionIcon: 'utility:copy_to_clipboard',
        shortName: 'Diff',
        path: 'textcompare',
    },
    'settings/app': {
        module: settings_app,
        isFullHeight: true,
        isDeletable: true,
        isElectronOnly: false,
        isOfflineAvailable: true,
        isMenuVisible: true,
        isTabVisible: true,
        label: 'Settings',
        type: i18n.EXTRA,
        description: 'App settings.',
        menuIcon: 'utility:settings',
        quickActionIcon: 'standard:settings',
        shortName: 'SE',
        path: 'settings',
    },
    'release/app': {
        module: release_app,
        isFullHeight: true,
        isDeletable: true,
        isElectronOnly: false,
        isOfflineAvailable: true,
        isMenuVisible: true,
        isTabVisible: true,
        label: 'Release Notes',
        type: i18n.EXTRA,
        description: 'Review the changes.',
        menuIcon: 'utility:notebook',
        quickActionIcon: 'standard:entitlement',
        shortName: 'RN',
        path: 'release',
    },
};

const APP_MAPPING = {
    ...BASE_APP_MAPPING,
    ...APPLICATION_APP_MAPPING,
};

const APP_LIST = (() => {
    return Object.keys(APP_MAPPING).map(name => ({ name, ...APP_MAPPING[name] }));
})();

export {
    APP_LIST,
    APPLICATION_MENU_GROUPS,
};
