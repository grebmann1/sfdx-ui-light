export class Sobject {
    constructor(name, label) {
        this.name = name;
        this.label = label;
        // field API Name => Field
        this.fields = {};
        // RecordType ID => RecordType
        this.recordTypes = {};
    }
}

export class RecordType {
    constructor(id, name, label) {
        this.id = id;
        this.name = name;
        this.label = label;
    }
}

export class Field {
    constructor(name, label, type, isNillable) {
        this.name = name;
        this.label = label;
        this.type = type;
        this.isNillable = isNillable;
    }
}

export class PermissionGroups{
    constructor(record){
        this.id = record.Id;
        this.name = record.DeveloperName;
        this.label = record.MasterLabel;
        this.namespacePrefix = record.NamespacePrefix;
        this.members = [];
    }
}

export class PermissionSet {
    constructor(record) {
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
        this.layoutAssigns = {};

        this.activeUserCount = 0;

        this.inactiveUserCount = 0;

        this.users = [];

        this.loginIpRanges = [];

    }
}

export class User {
    constructor(id, name, username, isActive) {
        this.id = name;
        this.name = name;
        this.username = username;
        this.isActive = isActive;
    }
}

export class ObjectPermission {
    constructor(sobjectType, allowCreate, allowRead, allowEdit, allowDelete, viewAllRecords, modifyAllRecords) {
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
    constructor(sObjectName, fieldName, allowRead, allowEdit) {
        this.sObjectName = sObjectName;
        this.fieldName = fieldName;
        this.allowRead = allowRead;
        this.allowEdit = allowEdit;
    }
}

export class ApexPage {
    constructor(record) {
        this.id = record.Id;
        this.name = record.Name;
        this.label = record.MasterLabel;
        this.namespacePrefix = record.NamespacePrefix;
    }
}

export class ApexClass {
    constructor(record) {
        this.id = record.Id;
        this.name = record.Name;
        this.namespacePrefix = record.NamespacePrefix;
    }
}

export class TabDefinition {
    constructor(record) {
        this.name = record.Name;
        this.label = record.Label;
    }
}

export class AppDefinition {
    constructor(record) {
        this.id = record.Id;
        this.name = record.Name;
        this.label = record.Label;
        this.namespacePrefix = record.NamespacePrefix;
    }
}

export class LoginIpRange {
    constructor(startIp, endIp, description) {
        this.startIp = startIp;
        this.endIp = endIp;
        this.description = description;
    }
}

export class Layout {
    constructor(id, name, objectName, objectLabel) {
        this.id = id;
        this.name = name;
        this.objectName = objectName;
        this.objectLabel = objectLabel;
    }
}