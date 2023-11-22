import {
    Profile,Sobject,ObjectPermission,FieldPermission,
    Field,ApexClass,ApexPage,AppDefinition,Layout,RecordType,TabDefinition
} from "./mapping";

import { chunkPromises,chunkArray,isNotUndefinedOrNull,isUndefinedOrNull } from 'shared/utils';


export const loadMetadata_async = async (conn,callback) => {
    window.test = conn;

    let results_1 = await Promise.all([
        getProfiles(conn),
        getEntityDefinition(conn),
        getApexClass(conn),
        getApexPage(conn),
        getAppDefinition(conn),
        getLayouts(conn),
        getTabDefinitions(conn)
    ]);

    const profiles = results_1[0];
    const sobjects = results_1[1];
    const apexClasses = results_1[2];
    const apexPages  = results_1[3];
    const appDefinitions = results_1[4];
    const layouts = results_1[5];
    const tabDefinitions = results_1[6];

    let results_2 = await Promise.all([
        getPermissionSet(conn,profiles),
        getUserPermissions(conn,profiles),
        setRecordTypes(conn,sobjects),
        setLayoutAssignments(conn,profiles,layouts),
    ]);

    const profilesForPermissionSet = results_2[0];
    const profileFields = results_2[1];

    let results_3 = await Promise.all([
        getSetupEntityAccess(conn,profiles,false,{profilesForPermissionSet,apexClasses,apexPages,appDefinitions}),
        setObjectPermissions(conn,profiles,profilesForPermissionSet),
        setPermissionSetTabSetting(conn,profiles,profilesForPermissionSet,{tabDefinitions}),
    ]);

    const entityAccess = results_3[0];

    /** Map entity to Profile */
    // We do it here to reuse the method in async mode
    Object.keys(profiles).forEach(key => {
        profiles[key] = {
            ...profiles[key],
            ...entityAccess[key]
        }
    });


    const asyncLoading = async () => {
        /* This can be really slow */
        console.log('namespaceLoading');
        // Set Permissions
       let results_4 = await Promise.all([
            getSetupEntityAccess(conn,profiles,true,{profilesForPermissionSet,apexClasses,apexPages,appDefinitions})
        ]);

        const entityAccess_namespace = results_4[0];
        console.log('asyncLoading -> callback');
        callback({entityAccess:entityAccess_namespace});

    }

    /** Execute Async call for background processing */
    asyncLoading();
    
    return {
        profiles,
        sobjects,
        apexClasses,
        apexPages,
        appDefinitions,
        profilesForPermissionSet,
        profileFields,
        layouts,
        tabDefinitions,
        entityAccess
    }
}


/*
export const loadMetadata = async (conn) => {
    window.test = conn;

    let results_1 = await Promise.all([
        getProfiles(conn),
        getEntityDefinition(conn),
        getApexClass(conn),
        getApexPage(conn),
        getAppDefinition(conn)
    ]);

    const profiles = results_1[0];
    const sobjects = results_1[1];
    const apexClasses = results_1[2];
    const apexPages  = results_1[3];
    const appDefinitions = results_1[4];

    let results_2 = await Promise.all([
        getPermissionSet(conn,profiles),
        getUserPermissions(conn,profiles)
    ]);

    const profilesForPermissionSet = results_2[0];
    const profileFields = results_2[1];

    // Set Permissions
    await Promise.all([
        getObjectPermissions(conn,profiles,profilesForPermissionSet),
        getSetupEntityAccess(conn,profiles,profilesForPermissionSet,apexClasses,apexPages,appDefinitions)
    ]);

    return {
        profiles,
        sobjects,
        apexClasses,
        apexPages,
        appDefinitions,
        profilesForPermissionSet,
        profileFields
    }
}
*/
export const getProfiles = async (conn) => {
    console.log('getProfiles');
    const profiles = {};

    let records_profiles = (await conn.query("SELECT id,Name,UserLicense.MasterLabel FROM profile")).records || [];
        records_profiles.forEach(record => profiles[record.Id] = new Profile(record.Id, record.Name, record.UserLicense?.MasterLabel));

    let keys = "'" + Object.keys(profiles).join("','") + "'";
    let records_counter = (await conn.query("SELECT count(Id) total,ProfileId,IsActive FROM User WHERE profileId in (" + keys + ") group by ProfileId ,IsActive")).records || [];
        records_counter.forEach(record => {
            if (record.IsActive) {
                profiles[record.ProfileId].activeUserCount = record.total;
            } else {
                profiles[record.ProfileId].inactiveUserCount = record.total;
            }
        });
    return profiles;
}

async function getApexClass(conn) {
    console.log('getApexClass');
    const apexClasses = {};
    let query = conn.query("SELECT Id,Name,NamespacePrefix FROM ApexClass");
    let records = await query.run({ responseTarget:'Records',autoFetch : true, maxFetch : 10000 }) || [];
        records.forEach(record => {
            apexClasses[record.Id] = new ApexClass(record);
        });

    return apexClasses;
}

async function getApexPage(conn) {
    console.log('getApexPage');
    const  apexPages = {};
    let query = conn.query("SELECT Id,Name,MasterLabel FROM ApexPage");
    let records = await query.run({ responseTarget:'Records',autoFetch : true, maxFetch : 10000 }) || [];
        records.forEach(record => {
            apexPages[record.Id] = new ApexPage(record);
        });

    return apexPages;
}

async function getAppDefinition(conn){
    console.log('getAppDefinition');
    const  appDefinitions = {};

    let records = (await conn.tooling.query("select Id, DeveloperName,Label,NamespacePrefix FROM CustomApplication")).records || [];
    records.forEach(record => {
        record.Name = record.NamespacePrefix + '__' + record.DeveloperName;
        appDefinitions[record.Id] = new AppDefinition(record);
    });

    return appDefinitions;
}


async function getLayouts(conn){
    console.log('getLayouts');
    const  layouts = {};

    let records = (await conn.tooling.query("select Id, Name, EntityDefinition.QualifiedApiName, EntityDefinition.Label from Layout where EntityDefinition.IsCustomizable=true and EntityDefinition.IsCompactLayoutable=true")).records || [];
        records.forEach(record => {
            layouts[record.Id] = new Layout(record.Id, record.Name, record.EntityDefinition.QualifiedApiName, record.EntityDefinition.Label);
        });

    return layouts;
}


export const getPermissionSet = async (conn,profiles) => {
    const profilesForPermissionSet = {}
    console.log('getPermissionSet');
    let keys = "'" + Object.keys(profiles).join("','") + "'";
    let records = (await conn.query("SELECT Id,ProfileId FROM permissionset WHERE ProfileId in (" + keys + ")")).records || [];
        records.forEach(record => {
            profiles[record.ProfileId].permissionSetId = record.Id;
            profilesForPermissionSet[record.Id] = record.ProfileId;
        });
    return profilesForPermissionSet;
}

export const getEntityDefinition = async (conn) => {
    console.log('getEntityDefinition');
    const sobjects = {};
    let query = conn.query("select QualifiedApiName,Label from EntityDefinition where IsCustomizable=true and IsCompactLayoutable=true");
    let records = await query.run({ responseTarget:'Records',autoFetch : true, maxFetch : 100000 }) || [];
        records.forEach(record => sobjects[record.QualifiedApiName] = new Sobject(record.QualifiedApiName, record.Label));
    return sobjects;
}

export const getTabDefinitions = async (conn) => {
    console.log('getTabDefinitions');
    const tabDefinitions = {};
    let records = (await conn.tooling.query("select Name, Label from TabDefinition")).records || [];
        records.forEach(record => {
            tabDefinitions[record.Name] = new TabDefinition(record);
        });
    return tabDefinitions;
}



export const setRecordTypes = async (conn,sobjects) => {
    console.log('setRecordTypes');
    let records = (await conn.query("select Id, DeveloperName, Name, SobjectType from RecordType")).records || [];
        records.forEach(record => sobjects[record.SobjectType].recordTypes[record.Id] = new RecordType(record.Id, record.DeveloperName, record.Name));
}

export const setLayoutAssignments = async (conn,profiles,layouts) => {
    console.log('setLayoutAssignments');
    let records = (await conn.tooling.query("select Profile.Id, LayoutId, RecordTypeId from ProfileLayout where Profile.Id != null")).records || [];
        records.forEach(record => {
            if (layouts[record.LayoutId]) {
                let layoutAssignmentKey = layouts[record.LayoutId].objectName+(record.RecordTypeId?`-${record.RecordTypeId}`:'');
                profiles[record.Profile.Id].layoutAssigns[layoutAssignmentKey] = layouts[record.LayoutId];
            }
        });
}

export const getUserPermissions = async (conn,profiles) => {
    console.log('getUserPermissions');
    const profileFields = {};
    
    let permissionDescribe = await conn.sobject('PermissionSet').describe();
        permissionDescribe.fields.forEach( x => {
            if (x.name.startsWith('Permissions')) {
                profileFields[x.name] = {
                    name:x.name,
                    label:x.label
                }
            }
        });

    let fieldKeys = Object.keys(profileFields);
    let records_permissionSet = (await conn.query("SELECT FIELDS(STANDARD) FROM PermissionSet WHERE profileid != null LIMIT 2000")).records || [];
        records_permissionSet.forEach(record => {
            if (profiles[record.ProfileId]) {
                fieldKeys.forEach(key => {
                    profiles[record.ProfileId].userPermissions.push({
                        enabled:record[key],
                        name:key,
                        label:profileFields[key].label
                    });
                });
            }
        });
    return profileFields;
}

export const setObjectPermissions = async (conn,profiles,profilesForPermissionSet) => {
    console.log('setObjectPermissions');
    let keys = Object.values(profiles).map(x => x.permissionSetId).join("','");

    let query = conn.query(`select ParentId,SobjectType,PermissionsCreate,PermissionsRead,PermissionsEdit,PermissionsDelete,PermissionsViewAllRecords,PermissionsModifyAllRecords from ObjectPermissions where ParentId in ('${keys}')`);
         
    let records = await query.run({ responseTarget:'Records',autoFetch : true, maxFetch : 100000 }) || [];
        records.forEach(record => {
                let profileId = profilesForPermissionSet[record.ParentId];
                profiles[profileId].objectPermissions.push(new ObjectPermission(
                    record.SobjectType,
                    record.PermissionsCreate,
                    record.PermissionsRead,
                    record.PermissionsEdit,
                    record.PermissionsDelete,
                    record.PermissionsViewAllRecords,
                    record.PermissionsModifyAllRecords
                ));
        });
}

export const setPermissionSetTabSetting = async (conn,profiles,profilesForPermissionSet,{tabDefinitions}) => {
    console.log('setPermissionSetTabSetting');
    const fetchPermissionSetTabSetting = async (ids) => {
        let query = conn.query(`select ParentId, Name, Visibility from PermissionSetTabSetting where ParentId in ('${ids.join("','")}')`);
        return await query.run({ responseTarget:'Records',autoFetch : true, maxFetch : 100000 }) || [];
    }

    let chunk_parentIds = chunkArray(Object.values(profiles).map(x => x.permissionSetId),5);

    let result = await chunkPromises(chunk_parentIds,4,fetchPermissionSetTabSetting);
    let records = result.flat();
        records.forEach(record => {
            let profileId = profilesForPermissionSet[record.ParentId];
            profiles[profileId].tabAccesses.push({visibility:record.Visibility,...tabDefinitions[record.Name]})
        });
}



export const getSetupEntityAccess = async (conn,profiles,includeNamespacePrefix = false,{profilesForPermissionSet,apexClasses,apexPages,appDefinitions}) => {
    console.log('getSetupEntityAccess');
    let keys = Object.values(profiles).map(x => x.permissionSetId).join("','");

    const fetchEntityAccess = async (ids) => {
        let query = conn.query(`SELECT ParentId, SetupEntityType, SetupEntityId FROM SetupEntityAccess WHERE SetupEntityId in ('${ids.join("','")}') AND ParentId IN ('${keys}')`);
        return await query.run({ responseTarget:'Records',autoFetch : true, maxFetch : 100000 }) || [];
    }

    const filter_method = x => isUndefinedOrNull(x.namespacePrefix) && !includeNamespacePrefix || includeNamespacePrefix;

    const entityAccess = {}

    let chunk_apexClasses = chunkArray(Object.values(apexClasses).filter(filter_method).map(x => x.id),50);
    let chunk_apexPages = chunkArray(Object.values(apexPages).filter(filter_method).map(x => x.id),50);
    let chunk_appDefinitions = chunkArray(Object.values(appDefinitions).filter(filter_method).map(x => x.id),50);


    let results = await Promise.all([
        chunkPromises(chunk_apexClasses,4,fetchEntityAccess),
        chunkPromises(chunk_apexPages,4,fetchEntityAccess),
        chunkPromises(chunk_appDefinitions,4,fetchEntityAccess)
    ]);
    let records = results.flat().flat();
    console.log('records',records);

    records.forEach(record => {
        let profileId = profilesForPermissionSet[record.ParentId];
        if(!entityAccess.hasOwnProperty(profileId)){
            entityAccess[profileId] = {classAccesses:[],pageAccesses:[],appAccesses:[]}
        }
        switch(record.SetupEntityType){
            case 'ApexClass':
                entityAccess[profileId].classAccesses.push(apexClasses[record.SetupEntityId]);
            break;

            case 'ApexPage':
                entityAccess[profileId].pageAccesses.push(apexPages[record.SetupEntityId]);
            break;

            case 'TabSet': // name is TabSet for App Access 
                entityAccess[profileId].appAccesses.push(appDefinitions[record.SetupEntityId]);
            break;
        }
    });

    return entityAccess;
}

export const setFieldDefinition = async (conn,targetObject) => {
    console.log('setFieldDefinition')
    let records_fieldDefinition = (await conn.tooling.query(`select EntityDefinitionId,MasterLabel,IsNillable, QualifiedApiName, DataType from FieldDefinition where EntityDefinition.QualifiedApiName ='${targetObject.name}'`)).records || [];

    targetObject.fields = [];

    records_fieldDefinition.forEach(record => {
        targetObject.fields[record.QualifiedApiName] =
            new Field(record.QualifiedApiName, record.MasterLabel, record.DataType, record.IsNillable);
    });
}

export const setFieldPermission = async (conn,profiles,profilesForPermissionSet,targetObject) => {
    console.log('setFieldPermission');
    let keys = "'" + Object.values(profiles).map(x => x.permissionSetId).join("','") + "'";
    let records_fieldPermissions = (await conn.tooling.query(`select ParentId, Field, SobjectType, PermissionsEdit, PermissionsRead from FieldPermissions where SobjectType ='${targetObject.name}' and ParentId in (${keys})`)).records || [];
        records_fieldPermissions.forEach(record => {
            
            let fieldName = record.Field.replace(targetObject.name + '.', '');
            // profiles[profilesForPermissionSet[record.ParentId]].fieldPermissions[targetObject.name].push(new FieldPermission(record.SobjectType, fieldName, record.PermissionsRead, record.PermissionsEdit));
            profiles[profilesForPermissionSet[record.ParentId]].fieldPermissions.push(new FieldPermission(record.SobjectType, fieldName, record.PermissionsRead, record.PermissionsEdit));
        });
}