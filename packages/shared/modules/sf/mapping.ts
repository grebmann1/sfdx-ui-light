export class Sobject {
    name: string;
    label: string;
    fields: Record<string, Field>;
    recordTypes: Record<string, RecordType>;

    constructor(name: string, label: string) {
        this.name = name;
        this.label = label;
        // field API Name => Field
        this.fields = {};
        // RecordType ID => RecordType
        this.recordTypes = {};
    }
}

export class RecordType {
    id: string;
    name: string;
    label: string;

    constructor(id: string, name: string, label: string) {
        this.id = id;
        this.name = name;
        this.label = label;
    }
}

export class Field {
    name: string;
    label: string;
    type: string;
    isNillable: boolean;

    constructor(name: string, label: string, type: string, isNillable: boolean) {
        this.name = name;
        this.label = label;
        this.type = type;
        this.isNillable = isNillable;
    }
}

export class UserPermission {
    name: string;
    label: string;
    enabled: boolean;

    constructor(name: string, label: string, enabled: boolean) {
        this.name = name;
        this.label = label;
        this.enabled = enabled;
    }
}

export class PermissionGroups {
    id: string;
    name: string;
    label: string;
    namespacePrefix?: string;
    members: string[];

    constructor(record: {
        Id: string;
        DeveloperName: string;
        MasterLabel: string;
        NamespacePrefix?: string;
    }) {
        this.id = record.Id;
        this.name = record.DeveloperName;
        this.label = record.MasterLabel;
        this.namespacePrefix = record.NamespacePrefix;
        this.members = [];
    }
}

export class PermissionSet {
    id: string;
    userLicense?: string;
    type: string;
    name: string;
    label: string;
    profileId?: string;
    description?: string;
    isCustom?: boolean;
    namespacePrefix?: string;
    userPermissions: UserPermission[];
    objectPermissions: ObjectPermission[];
    fieldPermissions: Record<string, FieldPermission>;
    classAccesses: ApexClass[];
    pageAccesses: ApexPage[];
    tabAccesses: Array<TabDefinition & { visibility?: string }>;
    appAccesses: AppDefinition[];
    layoutAssigns: LayoutAssignment[];
    activeUserCount: number;
    inactiveUserCount: number;
    users: User[];
    loginIpRanges: LoginIpRange[];

    constructor(record: {
        Id: string;
        License?: { Name?: string };
        Type: string;
        Profile?: { Name?: string; Label?: string };
        Name: string;
        Label: string;
        ProfileId?: string;
        Description?: string;
        IsCustom?: boolean;
        NamespacePrefix?: string;
    }) {
        this.id = record.Id;
        this.userLicense = record.License?.Name;
        this.type = record.Type;
        this.name = record.Profile?.Name || record.Name;
        this.label = record.Profile?.Label || record.Label;
        this.profileId = record.ProfileId;
        this.description = record.Description;
        this.isCustom = record.IsCustom;
        this.namespacePrefix = record.NamespacePrefix;

        // field API Name => boolean
        this.userPermissions = [];
        // object API Name => ObjectPermission
        this.objectPermissions = [];
        // field API Name => FieldPermission
        this.fieldPermissions = {};
        // class ID => ApexClass
        this.classAccesses = [];
        // page ID => ApexPage
        this.pageAccesses = [];
        // tab name => Visibility String(DefaultOn or DefaultOff)
        this.tabAccesses = [];
        // app ID => AppDefinition
        this.appAccesses = [];
        // Object API Name + RecordType ID => Layout
        this.layoutAssigns = [];

        this.activeUserCount = 0;

        this.inactiveUserCount = 0;

        this.users = [];

        this.loginIpRanges = [];
    }
}

export class User {
    id: string;
    name: string;
    username: string;
    isActive: boolean;

    constructor(id: string, name: string, username: string, isActive: boolean) {
        this.id = id;
        this.name = name;
        this.username = username;
        this.isActive = isActive;
    }
}

export class ObjectPermission {
    sobjectType: string;
    allowCreate: boolean;
    allowRead: boolean;
    allowEdit: boolean;
    allowDelete: boolean;
    viewAllRecords: boolean;
    modifyAllRecords: boolean;

    constructor(
        sobjectType: string,
        allowCreate: boolean,
        allowRead: boolean,
        allowEdit: boolean,
        allowDelete: boolean,
        viewAllRecords: boolean,
        modifyAllRecords: boolean
    ) {
        this.sobjectType = sobjectType;
        this.allowCreate = allowCreate;
        this.allowRead = allowRead;
        this.allowEdit = allowEdit;
        this.allowDelete = allowDelete;
        this.viewAllRecords = viewAllRecords;
        this.modifyAllRecords = modifyAllRecords;
    }
}

export class FieldPermission {
    sObjectName: string;
    fieldName: string;
    allowRead: boolean;
    allowEdit: boolean;

    constructor(sObjectName: string, fieldName: string, allowRead: boolean, allowEdit: boolean) {
        this.sObjectName = sObjectName;
        this.fieldName = fieldName;
        this.allowRead = allowRead;
        this.allowEdit = allowEdit;
    }
}

export class LayoutAssignment {
    id: string;
    objectName: string;
    recordTypeId?: string;
    key: string;

    constructor(id: string, objectName: string, recordTypeId?: string) {
        this.id = id;
        this.objectName = objectName;
        this.recordTypeId = recordTypeId;
        this.key = recordTypeId ? `${objectName}-${recordTypeId}` : objectName;
    }
}

export class ApexPage {
    id: string;
    name: string;
    label: string;
    namespacePrefix?: string;

    constructor(record: {
        Id: string;
        Name: string;
        MasterLabel: string;
        NamespacePrefix?: string;
    }) {
        this.id = record.Id;
        this.name = record.Name;
        this.label = record.MasterLabel;
        this.namespacePrefix = record.NamespacePrefix;
    }
}

export class ApexClass {
    id: string;
    name: string;
    namespacePrefix?: string;

    constructor(record: { Id: string; Name: string; NamespacePrefix?: string }) {
        this.id = record.Id;
        this.name = record.Name;
        this.namespacePrefix = record.NamespacePrefix;
    }
}

export class TabDefinition {
    name: string;
    label: string;

    constructor(record: { Name: string; Label: string }) {
        this.name = record.Name;
        this.label = record.Label;
    }
}

export class AppDefinition {
    id: string;
    name: string;
    label: string;
    namespacePrefix?: string;

    constructor(record: {
        Id: string;
        Name: string;
        Label: string;
        NamespacePrefix?: string;
    }) {
        this.id = record.Id;
        this.name = record.Name;
        this.label = record.Label;
        this.namespacePrefix = record.NamespacePrefix;
    }
}

export class LoginIpRange {
    startIp: string;
    endIp: string;
    description?: string;

    constructor(startIp: string, endIp: string, description?: string) {
        this.startIp = startIp;
        this.endIp = endIp;
        this.description = description;
    }
}

export class Layout {
    id: string;
    name: string;
    objectName: string;
    objectLabel: string;

    constructor(id: string, name: string, objectName: string, objectLabel: string) {
        this.id = id;
        this.name = name;
        this.objectName = objectName;
        this.objectLabel = objectLabel;
    }
}
