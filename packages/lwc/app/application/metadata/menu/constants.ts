const METADATA_TYPE_ICONS: Record<string, string> = {
    apexclass: 'code-2',
    apextrigger: 'zap',
    lightningcomponentbundle: 'zap',
    auradefinitionbundle: 'component',
    flow: 'git-branch',
    workflow: 'git-branch',
    customobject: 'database',
    customfield: 'columns',
    custommetadata: 'table',
    customsetting: 'settings',
    permissionset: 'shield',
    permissionsetgroup: 'shield',
    profile: 'user',
    validationrule: 'check-circle',
    customlabel: 'tag',
    emailtemplate: 'mail',
    report: 'bar-chart-2',
    reporttype: 'bar-chart-2',
    dashboard: 'layout-dashboard',
    staticresource: 'file-archive',
    flexipage: 'layout',
    remotesitesetting: 'globe',
    connectedapp: 'plug',
    namedcredential: 'key',
    externalcredential: 'key',
    sharingrule: 'share-2',
    role: 'users',
    queue: 'list',
    group: 'users',
    layout: 'layout',
    compactlayout: 'layout',
    globalvaluesset: 'list',
    valueset: 'list',
    duplicaterule: 'copy',
    matchingrule: 'copy',
    assignmentrule: 'git-merge',
    autoresponserule: 'reply',
    escalationrule: 'arrow-up-circle',
    approvalprocess: 'check-square',
    territory: 'map',
    territory2: 'map',
    territory2rule: 'map',
    territory2type: 'map',
    certificate: 'award',
    customsite: 'globe',
    network: 'network',
    corswhitelistorigin: 'lock',
    csptrusteddomain: 'lock',
    lightningmessagechannel: 'radio',
    platformeventchannel: 'radio',
    platformeventchannelmember: 'radio',
    transactionSecurityPolicy: 'shield',
};

const DEFAULT_METADATA_TYPE_ICON = 'layers';

export function getMetadataTypeIcon(metadataType: string): string {
    const iconName =
        METADATA_TYPE_ICONS[(metadataType || '').toLowerCase()] || DEFAULT_METADATA_TYPE_ICON;
    return `lucide:${iconName}`;
}

export const METADATA_RECORD_ICON = 'lucide:file';
