import {
    PermissionSet,Sobject,ObjectPermission,FieldPermission,PermissionGroups,
    Field,ApexClass,ApexPage,AppDefinition,Layout,RecordType,TabDefinition
} from "./mapping";

import { chunkPromises,chunkArray,isNotUndefinedOrNull,isUndefinedOrNull } from 'shared/utils';


export const loadMetadata_async = async (conn,callback) => {
    window.test = conn;

    let results_1 = await Promise.all([
        getPermissionSet(conn),
        getEntityDefinition(conn),
        getApexClass(conn),
        getApexPage(conn),
        getAppDefinition(conn),
        getLayouts(conn),
        getTabDefinitions(conn),
        getPermissionGroups(conn)
    ]);

    const {permissionSets,permissionSetProfileMapping} = results_1[0];
    const sobjects = results_1[1];
    const apexClasses = results_1[2];
    const apexPages  = results_1[3];
    const appDefinitions = results_1[4];
    const layouts = results_1[5];
    const tabDefinitions = results_1[6];
    const permissionGroups = results_1[7];

    let results_2 = await Promise.all([
        getUserPermissions(conn,permissionSets),
        setRecordTypes(conn,sobjects),
        setLayoutAssignments(conn,permissionSets,{permissionSetProfileMapping,layouts}),
    ]);

    const profileFields = results_2[0];

    let results_3 = await Promise.all([
        getSetupEntityAccess(conn,permissionSets,false,{apexClasses,apexPages,appDefinitions}),
        setObjectPermissions(conn,permissionSets),
        setPermissionSetTabSetting(conn,permissionSets,{tabDefinitions}),
    ]);

    const entityAccess = results_3[0];

    /** Map entity to Profile */
    // We do it here to reuse the method in async mode
    Object.keys(permissionSets).forEach(key => {
        permissionSets[key] = {
            ...permissionSets[key],
            ...entityAccess[key]
        }
    });


    const asyncLoading = async () => {
        /* This can be really slow */
        console.log('namespaceLoading');
        // Set Permissions
       let results_4 = await Promise.all([
            getSetupEntityAccess(conn,permissionSets,true,{apexClasses,apexPages,appDefinitions})
        ]);

        const entityAccess_namespace = results_4[0];
        console.log('asyncLoading -> callback');
        callback({entityAccess:entityAccess_namespace});

    }

    /** Execute Async call for background processing */
    asyncLoading();
    
    return {
        permissionSets,
        sobjects,
        apexClasses,
        apexPages,
        appDefinitions,
        profileFields,
        layouts,
        tabDefinitions,
        entityAccess,
        permissionGroups
    }
}


export const getPermissionSet = async (conn) => {
    
    const permissionSets = {};
    const permissionSetProfileMapping = {}

    let records_profiles = (await conn.query("SELECT Id,ProfileId,Profile.Name,Label,Name,License.Name,Type,Description,IsCustom,NamespacePrefix FROM permissionset")).records || [];
    console.log('records_profiles',records_profiles);    
    records_profiles.forEach(record => {
            permissionSets[record.Id] = new PermissionSet(record);
            if(isNotUndefinedOrNull(record.ProfileId)){
                permissionSetProfileMapping[record.ProfileId] = record.Id;
            }
        });

    let keys = Object.values(permissionSets).filter(x => x.type == 'Profile').map(x => x.profileId).join("','");
    let records_counter = (await conn.query("SELECT count(Id) total,ProfileId,IsActive FROM User WHERE profileId in ('" + keys + "') group by ProfileId ,IsActive")).records || [];
        records_counter.forEach(record => {
            if (record.IsActive) {
                permissionSets[permissionSetProfileMapping[record.ProfileId]].activeUserCount = record.total;
            } else {
                permissionSets[permissionSetProfileMapping[record.ProfileId]].inactiveUserCount = record.total;
            }
        });

    let records_counter2 = (await conn.query("SELECT count(Id) total,PermissionSetId,IsActive FROM PermissionSetAssignment group by PermissionSetId ,IsActive")).records || [];
        records_counter2.forEach(record => {
            if(permissionSets.hasOwnProperty(record.PermissionSetId)){
                if (record.IsActive) {
                    permissionSets[record.PermissionSetId].activeUserCount = record.total;
                } else {
                    permissionSets[record.PermissionSetId].inactiveUserCount = record.total;
                }
            }else{
                console.warn('Missing permission set : ',record.PermissionSetId);
            }
            
        });
        console.log('getPermissionSet',permissionSets);
    return {permissionSets,permissionSetProfileMapping};
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

async function getPermissionGroups(conn){
    console.log('getPermissionGroups');
    const permissionGroups = {};
    let query = conn.query('SELECT Description, DeveloperName,  Id, MasterLabel, NamespacePrefix, Status FROM PermissionSetGroup');
    let records = await query.run({ responseTarget:'Records',autoFetch : true, maxFetch : 10000 }) || [];
        records.forEach(record => {
            permissionGroups[record.Id] = new PermissionGroups(record);
        });

    let query_2 = conn.query('SELECT Id, PermissionSetGroupId, PermissionSetId FROM PermissionSetGroupComponent')
    let records2 = await query_2.run({ responseTarget:'Records',autoFetch : true, maxFetch : 10000 }) || [];
        records2.forEach(record => {
            permissionGroups[record.PermissionSetGroupId].members.push(record.PermissionSetId);
        });
    return permissionGroups;
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



const getEntityDefinition = async (conn) => {
    console.log('getEntityDefinition');
    const sobjects = {};
    let query = conn.query("select QualifiedApiName,Label from EntityDefinition where IsCustomizable=true and IsCompactLayoutable=true");
    let records = await query.run({ responseTarget:'Records',autoFetch : true, maxFetch : 100000 }) || [];
        records.forEach(record => sobjects[record.QualifiedApiName] = new Sobject(record.QualifiedApiName, record.Label));
    return sobjects;
}

const getTabDefinitions = async (conn) => {
    console.log('getTabDefinitions');
    const tabDefinitions = {};
    let records = (await conn.tooling.query("select Name, Label from TabDefinition")).records || [];
        records.forEach(record => {
            tabDefinitions[record.Name] = new TabDefinition(record);
        });
    return tabDefinitions;
}



const setRecordTypes = async (conn,sobjects) => {
    console.log('setRecordTypes');
    let records = (await conn.query("select Id, DeveloperName, Name, SobjectType from RecordType")).records || [];
        records.forEach(record => sobjects[record.SobjectType].recordTypes[record.Id] = new RecordType(record.Id, record.DeveloperName, record.Name));
}

const setLayoutAssignments = async (conn,permissionSets,{permissionSetProfileMapping,layouts}) => {
    console.log('setLayoutAssignments');
    let records = (await conn.tooling.query("select Profile.Id, LayoutId, RecordTypeId from ProfileLayout where Profile.Id != null")).records || [];
        records.forEach(record => {
            if (layouts[record.LayoutId]) {
                let layoutAssignmentKey = layouts[record.LayoutId].objectName+(record.RecordTypeId?`-${record.RecordTypeId}`:'');
                permissionSets[permissionSetProfileMapping[record.Profile.Id]].layoutAssigns[layoutAssignmentKey] = layouts[record.LayoutId];
            }
        });
}

const getUserPermissions = async (conn,permissionSets) => {
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
    let records_permissionSet = (await conn.query("SELECT FIELDS(STANDARD) FROM PermissionSet LIMIT 2000")).records || [];
        records_permissionSet.forEach(record => {
            if (permissionSets[record.Id]) {
                fieldKeys.forEach(key => {
                    permissionSets[record.Id].userPermissions.push({
                        enabled:record[key],
                        name:key,
                        label:profileFields[key].label
                    });
                });
            }
        });
    return profileFields;
}

const setObjectPermissions = async (conn,permissionSets) => {
    console.log('setObjectPermissions');

    let query = conn.query(`select ParentId,SobjectType,PermissionsCreate,PermissionsRead,PermissionsEdit,PermissionsDelete,PermissionsViewAllRecords,PermissionsModifyAllRecords from ObjectPermissions`);
         
    let records = await query.run({ responseTarget:'Records',autoFetch : true, maxFetch : 100000 }) || [];
        records.forEach(record => {
            if(permissionSets.hasOwnProperty(record.ParentId)){
                permissionSets[record.ParentId].objectPermissions.push(new ObjectPermission(
                    record.SobjectType,
                    record.PermissionsCreate,
                    record.PermissionsRead,
                    record.PermissionsEdit,
                    record.PermissionsDelete,
                    record.PermissionsViewAllRecords,
                    record.PermissionsModifyAllRecords
                ));
            }
        });
}

const setPermissionSetTabSetting = async (conn,permissionSets,{tabDefinitions}) => {
    console.log('setPermissionSetTabSetting');
    const fetchPermissionSetTabSetting = async (ids) => {
        let query = conn.query(`select ParentId, Name, Visibility from PermissionSetTabSetting where ParentId in ('${ids.join("','")}')`);
        return await query.run({ responseTarget:'Records',autoFetch : true, maxFetch : 100000 }) || [];
    }

    let chunk_parentIds = chunkArray(Object.values(permissionSets).map(x => x.id),5);

    let result = await chunkPromises(chunk_parentIds,4,fetchPermissionSetTabSetting);
    let records = result.flat();
        records.forEach(record => {
            permissionSets[record.ParentId].tabAccesses.push({visibility:record.Visibility,...tabDefinitions[record.Name]})
        });
}



const getSetupEntityAccess = async (conn,permissionSets,includeNamespacePrefix = false,{apexClasses,apexPages,appDefinitions}) => {
    console.log('getSetupEntityAccess');

    const fetchEntityAccess = async (ids) => {
        let query = conn.query(`SELECT ParentId, SetupEntityType, SetupEntityId FROM SetupEntityAccess WHERE SetupEntityId in ('${ids.join("','")}')`);
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
        if(!entityAccess.hasOwnProperty(record.ParentId)){
            entityAccess[record.ParentId] = {classAccesses:[],pageAccesses:[],appAccesses:[]}
        }
        switch(record.SetupEntityType){
            case 'ApexClass':
                entityAccess[record.ParentId].classAccesses.push(apexClasses[record.SetupEntityId]);
            break;

            case 'ApexPage':
                entityAccess[record.ParentId].pageAccesses.push(apexPages[record.SetupEntityId]);
            break;

            case 'TabSet': // name is TabSet for App Access 
                entityAccess[record.ParentId].appAccesses.push(appDefinitions[record.SetupEntityId]);
            break;
        }
    });

    return entityAccess;
}

export const setFieldDefinition = async (conn,targetObject) => {
    console.log('setFieldDefinition')
    let records_fieldDefinition = (await conn.tooling.query(`select EntityDefinitionId,MasterLabel,IsNillable, QualifiedApiName, DataType from FieldDefinition where EntityDefinition.QualifiedApiName ='${targetObject.name}'`)).records || [];

    targetObject.fields = {};

    records_fieldDefinition.forEach(record => {
        targetObject.fields[record.QualifiedApiName] = new Field(record.QualifiedApiName, record.MasterLabel, record.DataType, record.IsNillable);
    });
}

export const setFieldPermission = async (conn,permissionSets,{targetObject}) => {
    // Set field Definition
    await setFieldDefinition(conn,targetObject);

    let records_fieldPermissions = (await conn.query(`select ParentId, Field, SobjectType, PermissionsEdit, PermissionsRead from FieldPermissions where SobjectType ='${targetObject.name}'`)).records || [];
        records_fieldPermissions.forEach(record => {
            let fieldName = record.Field.replace(targetObject.name + '.', '');
            // profiles[profilesForPermissionSet[record.ParentId]].fieldPermissions[targetObject.name].push(new FieldPermission(record.SobjectType, fieldName, record.PermissionsRead, record.PermissionsEdit));
            permissionSets[record.ParentId].fieldPermissions[fieldName] = new FieldPermission(record.SobjectType, fieldName, record.PermissionsRead, record.PermissionsEdit);
        });
}