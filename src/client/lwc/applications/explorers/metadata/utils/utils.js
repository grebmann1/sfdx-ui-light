export const formatName = x => {
    const name = x.DeveloperName || x.MasterLabel || x.Name || x.Id;
    return x.NamespacePrefix ? `${x.NamespacePrefix}__${name}` : name;
};

export const METADATA_EXCLUDE_LIST = ['Flow'];

export const METADATA_EXCEPTION_LIST = [
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
