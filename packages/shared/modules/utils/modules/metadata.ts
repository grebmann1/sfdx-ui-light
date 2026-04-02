type MetadataRecord = {
    DeveloperName?: string;
    MasterLabel?: string;
    Name?: string;
    Id?: string;
    NamespacePrefix?: string;
    ActiveVersion?: {
        ProcessType?: string;
        Status?: string;
    };
    ActiveVersionId?: string;
    Status?: string;
    VersionNumber?: string;
    [key: string]: unknown;
};

type MetadataBadge = {
    label: string;
    class: string;
};

type MetadataException = {
    isSearchable: boolean;
    name: string;
    label: string;
    key: string;
    isException: boolean;
    hasLvl2: boolean;
    lvl2Type?: string;
    queryObject: string;
    soapObject?: string;
    queryFields: string[];
    labelFunc: (value: MetadataRecord) => string;
    filterFunc?: (value: MetadataRecord | string) => string;
    field_id: string;
    selectDefaultFunc?: (value: MetadataRecord) => string;
    selectDefaultLabelFunc?: (value: MetadataRecord) => string;
    badgeFunc?: (value: MetadataRecord) => MetadataBadge;
    manualFilter?: (value: MetadataRecord) => boolean;
    compareFunc?: (a: MetadataRecord, b: MetadataRecord) => number;
};

export const formatName = (x: MetadataRecord): string => {
    const name = x.DeveloperName || x.MasterLabel || x.Name || x.Id;
    return x.NamespacePrefix ? `${x.NamespacePrefix}__${name}` : name;
};

export const METADATA_EXCLUDE_LIST: string[] = ['Flow'];

export const METADATA_EXCEPTION_LIST: MetadataException[] = [
    {
        isSearchable: true,
        name: 'Flow',
        label: 'Flow',
        key: 'Flow',
        isException: true,
        hasLvl2: true,
        lvl2Type: 'FlowVersion',
        queryObject: 'FlowDefinition',
        soapObject: 'Flow',
        queryFields: ['ActiveVersion.ProcessType', 'ActiveVersion.Status', 'ActiveVersionId'],
        labelFunc: formatName,
        filterFunc: x => " WHERE ActiveVersion.ProcessType <> 'Workflow'",
        field_id: 'Id',
        selectDefaultFunc: x => x.ActiveVersionId,
        selectDefaultLabelFunc: x => 'Active',
        badgeFunc: x => {
            return x.ActiveVersion?.Status
                ? {
                      label: 'Active',
                      class: 'slds-theme_success',
                  }
                : {
                      label: 'Inactive',
                      class: '',
                  };
        },
        manualFilter: x => {
            return x.ActiveVersion?.ProcessType !== 'Workflow';
        },
    },
    {
        isSearchable: true,
        name: 'WorkFlow',
        label: 'WorkFlow',
        key: 'WorkFlow',
        isException: true,
        hasLvl2: true,
        lvl2Type: 'FlowVersion',
        queryObject: 'FlowDefinition',
        soapObject: 'Flow',
        queryFields: ['ActiveVersion.ProcessType', 'ActiveVersion.Status', 'ActiveVersionId'],
        labelFunc: formatName,
        filterFunc: x => " WHERE ActiveVersion.ProcessType = 'Workflow'",
        field_id: 'Id',
        selectDefaultFunc: x => x.ActiveVersionId,
        selectDefaultLabelFunc: x => 'Active',
        badgeFunc: x => {
            return x.ActiveVersion?.Status
                ? {
                      label: 'Active',
                      class: 'slds-theme_success',
                  }
                : {
                      label: 'Inactive',
                      class: '',
                  };
        },
        manualFilter: x => {
            return x.ActiveVersion?.ProcessType === 'Workflow';
        },
    },
    {
        isSearchable: false,
        name: 'FlowVersion',
        label: 'FlowVersion',
        key: 'FlowVersion',
        isException: true,
        hasLvl2: false,
        queryObject: 'Flow',
        queryFields: ['ProcessType', 'Status', 'VersionNumber'],
        labelFunc: x => `Version ${x.VersionNumber}`,
        filterFunc: x => ` WHERE Definition.Id = '${x}'`,
        field_id: 'Id',
        badgeFunc: x => {
            return x.Status === 'Active'
                ? {
                      label: 'Active',
                      class: 'slds-theme_success',
                  }
                : {
                      label: x.Status,
                      class: '',
                  };
        },
        manualFilter: x => {
            return true;
        },
        compareFunc: (a, b) => (a.Status || '').localeCompare(b.Status),
    },
];
