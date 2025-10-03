import { api } from 'lwc';
import ToolkitElement from 'core/toolkitElement';

import {
    groupBy,
    runActionAfterTimeOut,
    isUndefinedOrNull,
    isNotUndefinedOrNull,
    getFromStorage
} from 'shared/utils';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import ModalProfileFilter from 'accessAnalyzer/modalProfileFilter';
import ModalPermissionSetFilter from 'accessAnalyzer/modalPermissionSetFilter';
import ModalUserSelector from 'slds/modalUserSelector';
//import ModalPermissionSelector from "slds/modalPermissionSelector";
import { getWorker } from 'core/worker';

import { setFieldPermission } from 'shared/sf';
import { fileFormatter } from 'accessAnalyzer/utils';
import { store, ERROR } from 'core/store';
import Analytics from 'shared/analytics';

const SVG_CHECKED =
    '<svg enable-background="new 0 0 24 24" height="14" width="14" viewBox="0 0 24 24" xml:space="preserve" lwc-1ctolp3d4fm=""><path fill="#2DC214" clip-rule="evenodd" d="M21.652,3.211c-0.293-0.295-0.77-0.295-1.061,0L9.41,14.34  c-0.293,0.297-0.771,0.297-1.062,0L3.449,9.351C3.304,9.203,3.114,9.13,2.923,9.129C2.73,9.128,2.534,9.201,2.387,9.351  l-2.165,1.946C0.078,11.445,0,11.63,0,11.823c0,0.194,0.078,0.397,0.223,0.544l4.94,5.184c0.292,0.296,0.771,0.776,1.062,1.07  l2.124,2.141c0.292,0.293,0.769,0.293,1.062,0l14.366-14.34c0.293-0.294,0.293-0.777,0-1.071L21.652,3.211z" fill-rule="evenodd" lwc-1ctolp3d4fm=""></path></svg>';
const SVG_UNCHECKED =
    '<svg enable-background="new 0 0 24 24" height="14" width="14" viewBox="0 0 24 24" xml:space="preserve" lwc-1ctolp3d4fm=""><path fill="#CE1515" d="M22.245,4.015c0.313,0.313,0.313,0.826,0,1.139l-6.276,6.27c-0.313,0.312-0.313,0.826,0,1.14l6.273,6.272  c0.313,0.313,0.313,0.826,0,1.14l-2.285,2.277c-0.314,0.312-0.828,0.312-1.142,0l-6.271-6.271c-0.313-0.313-0.828-0.313-1.141,0  l-6.276,6.267c-0.313,0.313-0.828,0.313-1.141,0l-2.282-2.28c-0.313-0.313-0.313-0.826,0-1.14l6.278-6.269  c0.313-0.312,0.313-0.826,0-1.14L1.709,5.147c-0.314-0.313-0.314-0.827,0-1.14l2.284-2.278C4.308,1.417,4.821,1.417,5.135,1.73  L11.405,8c0.314,0.314,0.828,0.314,1.141,0.001l6.276-6.267c0.312-0.312,0.826-0.312,1.141,0L22.245,4.015z" lwc-1ctolp3d4fm=""></path></svg>';
const CONFIG = [
    {
        metadataName: 'profileFields',
        permissionName: 'userPermissions',
        category: 'General Permissions',
        permissionFieldId: 'name',
        formatter: x => {
            return x.enabled;
        },
        report: ['FullView'],
        key: 'general',
    },
    {
        metadataName: 'sobjects',
        permissionName: 'objectPermissions',
        category: 'Object Permissions',
        permissionFieldId: 'sobjectType',
        subPermissions: [
            'allowRead',
            'allowCreate',
            'allowEdit',
            'allowDelete',
            'viewAllRecords',
            'modifyAllRecords',
        ],
        formatter: x => {
            const arr = [
                x.allowRead,
                x.allowCreate,
                x.allowEdit,
                x.allowDelete,
                x.viewAllRecords,
                x.modifyAllRecords,
            ];
            return arr.map(bool => (bool ? '1' : '0')).join('');
        },
        report: ['FullView', 'ObjectPermissions'],
        key: 'objects',
    },
    {
        metadataName: 'sobjects', // custom
        permissionName: 'layoutAssigns',
        category: 'Object Layouts',
        permissionFieldId: 'key',
        formatter: (x, metadata) => {
            if (isNotUndefinedOrNull(x) && isNotUndefinedOrNull(metadata)) {
                return metadata['layouts'][x.id].name;
            }
            return null;
            //const arr = [x.allowRead,x.allowCreate,x.allowEdit,x.allowDelete,x.viewAllRecords,x.modifyAllRecords];
            //return arr.map(bool => bool ? '1' : '0').join('');
        },
        key: 'layouts',
    },
    {
        metadataName: 'apexClasses',
        permissionName: 'classAccesses',
        category: 'Apex Class Permissions',
        permissionFieldId: 'name',
        formatter: x => {
            return true;
        },
        key: 'apex',
    },
    {
        metadataName: 'apexPages',
        permissionName: 'pageAccesses',
        category: 'Apex Page Permissions',
        permissionFieldId: 'name',
        formatter: x => {
            return true;
        },
        key: 'page',
    },
    {
        metadataName: 'appDefinitions',
        permissionName: 'appAccesses',
        category: 'App Settings',
        permissionFieldId: 'name',
        formatter: x => {
            return x.visibility === 'DefaultOn';
        },
        key: 'app',
    },
    {
        metadataName: 'tabDefinitions',
        permissionName: 'tabAccesses',
        category: 'Tab Settings',
        permissionFieldId: 'name',
        formatter: x => {
            return x.visibility === 'DefaultOn';
        },
        key: 'tab',
    },
];

const DIFF = {
    ALL: 'All',
    SIMILARITIES: 'Similarity',
    DIFFERENCE: 'Difference',
};

export default class App extends ToolkitElement {
    /* Metadata */
    metadata;
    permissionSets;

    /* Metadata Loaded */
    isMetadataReady = false;
    report = 'FullView';

    /* Filters */
    displayFilterContainer = false;
    filter_profiles = [];
    filter_permissionSets = [];
    filter_users = [];
    metadataFilter_value = Object.values(CONFIG).map(x => x.key); // Default select all
    namespaceFiltering_value = 'excluded';
    userLicenseFiltering_value = 'all';
    selectedObject;

    /* Compare */
    diff_value = DIFF.ALL;

    /* Matrix */
    greenTreshold = 5;
    _greenTreshold;
    orangeTreshold = 10;
    _orangeTreshold;

    isLoading = false;
    customLoadingMessage;
    customAdditionalMessage;

    set tableInstance(value) {
        this._tableInstance = value;
        if (isNotUndefinedOrNull(value)) {
            this._tableInstance.on('dataProcessed', () => {
                //console.log('dataProcessed');
                this.isLoading = false;
            });
        }
    }

    get tableInstance() {
        return this._tableInstance;
    }

    _isActive = false;
    @api
    get isActive() {
        return this._isActive;
    }
    set isActive(value) {
        this._isActive = value;
        if (this._isActive) {
            this.tableResize();
        }
    }

    worker;
    loadFromWebWorker = async () => {
        return new Promise((resolve, reject) => {
            this.worker = getWorker(this.connector.conn, 'accessAnalyzer.worker.js').instance; // Path to your worker.js file

            // Handle messages from the worker
            this.worker.onmessage = e => {
                const { type, status, value } = e.data;
                if (status === 'running') {
                    if (type === 'callback') {
                        // execute callback;
                        this.loadMetadata_withNameSpaceCallback(value);
                    } else if (type === 'message') {
                        this.updateLoadingMessage(value);
                    }
                } else if (status === 'finished') {
                    // Use the data returned by the worker
                    this.updateLoadingMessage('Generating the Table.');
                    resolve(value);
                    this.worker.terminate();
                    this.worker = null;
                } else if (status === 'error') {
                    reject(value);
                    store.dispatch(
                        ERROR.reduxSlice.actions.addError({
                            message: 'Error loading metadata',
                            details: value,
                        })
                    );
                    this.worker.terminate();
                    this.worker = null;
                }
            };
            // Send launch worker
            this.worker.postMessage({ action: 'run' });
        });
    };

    connectedCallback() {
        Analytics.trackAppOpen('accessAnalyzer', { alias: this.alias });
        this.loadCachedSettings();
        this.loadMetadata(false);
        window.addEventListener('resize', this.tableResize);
    }

    disconnectedCallback() {
        window.removeEventListener('resize', this.tableResize);
    }

    renderedCallback() {
        //console.log('Access Analyzer - renderedCallback');
    }

    tableResize = () => {
        if (!this._isActive) return;

        runActionAfterTimeOut(null, param => {
            if (isUndefinedOrNull(this.tableInstance)) return;

            this.tableInstance.setHeight(this.calculatedHeight);
        });
    };

    loadCachedSettings = () => {
        if (isNotUndefinedOrNull(this.connector.configuration.alias)) {
            this.filter_permissionSets = getFromStorage(
                localStorage.getItem(
                    `${this.connector.configuration.alias}-accessAnalyzer-filter_permissionSets`
                ),
                []
            );
            this.filter_profiles = getFromStorage(
                localStorage.getItem(
                    `${this.connector.configuration.alias}-accessAnalyzer-filter_profiles`
                ),
                []
            );
            this.greenTreshold = getFromStorage(
                localStorage.getItem(`global-accessAnalyzer-greenTreshold`),
                5
            );
            this.orangeTreshold = getFromStorage(
                localStorage.getItem(`global-accessAnalyzer-orangeTreshold`),
                10
            );
        }
    };

    loadMetadata_withNameSpaceCallback = async res => {
        const { entityAccess } = res;
        // Assign Entity Access
        Object.keys(this.permissionSets).forEach(key => {
            if (this.permissionSets.hasOwnProperty(key) && entityAccess.hasOwnProperty(key)) {
                this.permissionSets[key].classAccesses = this.permissionSets[
                    key
                ].classAccesses.concat(entityAccess[key].classAccesses);
                this.permissionSets[key].pageAccesses = this.permissionSets[
                    key
                ].pageAccesses.concat(entityAccess[key].pageAccesses);
                this.permissionSets[key].appAccesses = this.permissionSets[key].appAccesses.concat(
                    entityAccess[key].appAccesses
                );
            }
        });
        this.isMetadataReady = true;
        await this.cacheMetadata();
    };

    loadMetadata = async (refresh = false) => {
        // Only run when a connection is available
        if (!this.connector) return;

        this.isLoading = true;
        this.customLoadingMessage = 'Fetching Metadata from Salesforce. (1/3)';
        this.customAdditionalMessage = 'This request might take up to a few minutes.';
        var _metadata;
        try {
            //console.log('this.connector.configuration.alias', this.connector.configuration.alias);
            // Cache loading only for full mode
            if (isNotUndefinedOrNull(this.connector.configuration.alias)) {
                let key = `${this.connector.configuration.alias}-metadata`;
                _metadata = await window.defaultStore.getItem(key);
                if (
                    isUndefinedOrNull(_metadata?.createdDate) ||
                    Date.now() > _metadata.createdDate + 3 * 24 * 60 * 60 * 1000
                ) {
                    // 72h
                    refresh = true; // We force the refresh
                }
            }
            if (!_metadata || refresh) {
                _metadata = await this.loadFromWebWorker();
            }
        } catch (e) {
            console.error(e);
            _metadata = await this.loadFromWebWorker();
        }

        let { permissionSets, ...metadata } = _metadata;
        this.permissionSets = permissionSets;
        //console.log('this.permissionSets',this.permissionSets);
        //console.log('this.metadata',metadata);
        this.metadata = metadata;

        // Pre filter the permissionSets
        if (this.filter_profiles.length == 0) {
            this.filter_profiles = Object.values(this.permissionSets)
                .filter(
                    x =>
                        [
                            'Salesforce',
                            'Guest License',
                            'Salesforce Platform',
                            'Customer Community Plus',
                            'Customer Community Plus Login',
                            'Customer Community Login',
                            'Customer Community',
                        ].includes(x.userLicense) && x.type === 'Profile'
                )
                .map(x => x.id);
        }
        this.isLoading = false;
        this.customAdditionalMessage = null;
        this.displayReport();
    };

    updateLoadingMessage = message => {
        //console.log('updateLoadingMessage');
        this.customLoadingMessage = message;
    };

    /** Events  **/

    handleUndoTreshold = () => {
        this._greenTreshold = this.greenTreshold;
        this._orangeTreshold = this.orangeTreshold;
        this.orangeTreshold = 0;
        this.greenTreshold = 0;
        // reset
        window.setTimeout(() => {
            this.orangeTreshold = this._orangeTreshold;
            this.greenTreshold = this._greenTreshold;
            this._greenTreshold = null;
            this._orangeTreshold = null;
        }, 1);
    };

    handleApplyTreshold = () => {
        if (this._greenTreshold) {
            this.greenTreshold = this._greenTreshold;
            localStorage.setItem(
                `global-accessAnalyzer-greenTreshold`,
                JSON.stringify(this.greenTreshold)
            );
        }

        if (this._orangeTreshold) {
            this.orangeTreshold = this._orangeTreshold;
            localStorage.setItem(
                `global-accessAnalyzer-greenTreshold`,
                JSON.stringify(this.orangeTreshold)
            );
        }
        this.displayReport();
    };

    handleChangeGreenTreshold = e => {
        this._greenTreshold = e.detail.value;
    };

    handleChangeOrangeTreshold = e => {
        this._orangeTreshold = e.detail.value;
    };

    refreshMetadata = async () => {
        this.loadMetadata(true);
    };

    cacheMetadata = async () => {
        let key = `${this.connector.configuration.alias}-metadata`;
        await window.defaultStore.setItem(key, {
            ...this.metadata,
            permissionSets: this.permissionSets,
            createdDate: Date.now(),
        });
    };

    downloadCSV = async () => {
        if (this.tableInstance) {
            this.isLoading = true;
            await this.tableInstance.download(
                'csv',
                `${this.connector.configuration.orgId}_${this.report}.csv`
            );
            this.isLoading = false;
        }
    };

    downloadPDF = async () => {
        if (this.tableInstance) {
            this.isLoading = true;
            let filename = `${this.connector.configuration.orgId}_${this.report}.pdf`;
            await this.tableInstance.download(fileFormatter, filename, {
                useImage: true,
                title: this.report_options.find(x => x.value == this.report).label,
                filename,
                report: this.report,
                leftCellAlignement: this.report == 'Matrix' ? 1 : 2,
                greenTreshold: this.greenTreshold,
                orangeTreshold: this.orangeTreshold,
            });
            this.isLoading = false;
        }
    };

    report_handleChange = e => {
        this.report = e.detail.value;
        this.displayReport();
    };

    /** Getters **/

    get pageClass() {
        //Overwrite
        return super.pageClass + ' slds-p-around_small grid-container';
    }

    get loadingMessage() {
        return this.customLoadingMessage ? this.customLoadingMessage : 'Loading';
    }

    get isTresholdButtonDisplayed() {
        return (
            (isNotUndefinedOrNull(this._greenTreshold) &&
                this.greenTreshold != this._greenTreshold) ||
            (isNotUndefinedOrNull(this._orangeTreshold) &&
                this.orangeTreshold != this._orangeTreshold)
        );
    }

    get isUndoDisabled() {
        return (
            this.greenTreshold == this._greenTreshold && this.orangeTreshold == this._orangeTreshold
        );
    }

    get isFiltering_profiles() {
        return this.filter_profiles.length > 0;
    }

    get isFiltering_permissionSets() {
        return this.filter_permissionSets.length > 0;
    }

    get isFiltering_users() {
        return this.filter_users.length > 0;
    }

    get report_options() {
        return [
            { label: 'Full View', value: 'FullView' },
            { label: 'Matrix Diff Comparaison', value: 'Matrix' },
            { label: 'Permission Groups', value: 'PermissionGroups' },
            { label: 'Object Permissions', value: 'CustomObject' },
            { label: 'Field-Level Security', value: 'FieldLevelSecurity' },
        ];
    }

    get namespaceFiltering_options() {
        return [
            { label: 'Excluded', value: 'excluded' },
            { label: 'Included', value: 'included' },
        ];
    }

    get diff_options() {
        return [
            { label: DIFF.ALL, value: DIFF.ALL },
            { label: DIFF.DIFFERENCE, value: DIFF.DIFFERENCE },
            { label: DIFF.SIMILARITIES, value: DIFF.SIMILARITIES },
        ];
    }

    get userLicenseFiltering_options() {
        let options = [{ label: 'All', value: 'all' }];
        if (isNotUndefinedOrNull(this.permissionSets)) {
            options = options.concat(
                Object.keys(groupBy(Object.values(this.permissionSets), 'userLicense'))
                    .filter(x => x != 'undefined')
                    .map(x => ({ label: x, value: x }))
            );
        }
        return options;
    }

    get isDiffEnabled() {
        return this.diff_value === DIFF.DIFFERENCE;
    }

    get isSimilEnabled() {
        return this.diff_value === DIFF.SIMILARITIES;
    }

    get isRefreshDisabled() {
        return isUndefinedOrNull(this.connector); /*|| this.isLoading;*/
    }

    get isSObjectSelectorDisplayed() {
        return this.report === 'FieldLevelSecurity';
    }

    get isDiffCheckerDisplayed() {
        return this.report === 'FullView' || this.report === 'FieldLevelSecurity';
    }

    get isMetadataFilterDisplayed() {
        return this.report === 'Matrix';
    }

    get filteringVariant() {
        return this.displayFilterContainer ? 'brand' : 'neutral';
    }

    get filtering_variant() {
        return this.displayFilterContainer ? 'brand' : 'border-filled';
    }

    get profileFilteringVariant() {
        return this.isFiltering_profiles ? 'brand' : 'neutral';
    }

    get permissionSetsFilteringVariant() {
        return this.isFiltering_permissionSets ? 'brand' : 'neutral';
    }

    get namespaceFiltering_isExcluded() {
        return this.namespaceFiltering_value === 'excluded';
    }

    get sobject_options() {
        return Object.values(this.metadata.sobjects)
            .map(x => ({ label: `${x.label} (${x.name})`, value: x.name }))
            .sort((a, b) => a.value.localeCompare(b.value));
    }

    get selectedObjectName() {
        return this.selectedObject?.name;
    }

    get metadataFilter_options() {
        return Object.values(CONFIG).map(x => ({
            label: x.category,
            value: x.key,
        }));
    }

    get filteredPermissions() {
        return Object.values(this.permissionSets).filter(x => this.getBasicFilter(x));
    }

    get noDataAvailable() {
        if (this.isDiffEnabled) {
            return 'No Matching Data (Difference Enabled)';
        } else if (this.isSimilEnabled) {
            return 'No Matching Data (Similarity Enabled)';
        } else {
            return 'No Data available';
        }
    }

    get calculatedHeight() {
        return (
            this.template.querySelector('.grid-container').clientHeight -
            this.template.querySelector('builder-header').clientHeight
        );
    }

    sobject_handleChange = e => {
        this.isLoading = true;
        this.selectedObject = this.metadata.sobjects[e.detail.value];
        this.setFieldLevelSecurityReport(true);
    };

    metadataFilter_handleChange = e => {
        this.metadataFilter_value = e.detail.value;
        window.setTimeout(async () => {
            this.updateTable(this.calculateMatrixData());
        }, 1);
    };

    diff_handleChange = e => {
        this.diff_value = e.detail.value;
        this.updateTable(this.getDiffData(this.dataList));
    };

    updateTable = data => {
        if (!this.tableInstance) return;

        this.isLoading = true;
        window.setTimeout(async () => {
            // for DiffData, we don't store it, we just reprocess the dataList
            await this.tableInstance.replaceData(data);
        }, 10);
    };

    getDiffData = data => {
        //const constants = ['label','name','namespacePrefix','category','type','_children','api','isRequired'];
        if (this.isDiffEnabled) {
            return this._processDifference(data);
        } else if (this.isSimilEnabled) {
            return this._processSimiliraty(data);
        } else {
            return data;
        }
    };
    _processDifference = data => {
        const fields = this.filteredPermissions.map(x => x.id);
        return data.filter(row => {
            const toCompare = fields.reduce((acc, field) => {
                acc.add(row[field]);
                return acc;
            }, new Set());
            return toCompare.size > 1;
        });
    };

    _processSimiliraty = data => {
        const fields = this.filteredPermissions.map(x => x.id);
        return data.filter(row => {
            const toCompare = fields.reduce((acc, field) => {
                acc.add(row[field]);
                return acc;
            }, new Set());
            return toCompare.size == 1 && !toCompare.has(false) && !toCompare.has(undefined);
        });
    };

    filtering_handleClick = e => {
        this.displayFilterContainer = !this.displayFilterContainer;
    };

    profileFiltering_handleClick = e => {
        ModalProfileFilter.open({
            profiles: Object.values(this.permissionSets).filter(x => x.type === 'Profile'),
            currentConnection: this.connector.conn,
            selected: this.filter_profiles,
        }).then(res => {
            if (res?.action === 'applyFilter') {
                this.filter_profiles = res.filter || [];
                localStorage.setItem(
                    `${this.connector.configuration.alias}-accessAnalyzer-filter_profiles`,
                    JSON.stringify(this.filter_profiles)
                );
                this.displayReport();
            }
        });
    };

    userFiltering_handleClick = e => {
        ModalUserSelector.open({
            conn: this.connector.conn,
            size: 'full',
        }).then(res => {});
    };

    namespaceFiltering_handleChange = e => {
        this.namespaceFiltering_value = e.detail.value;
        this.displayReport(); // Reload the table
    };

    userLicenseFiltering_handleChange = e => {
        this.userLicenseFiltering_value = e.detail.value;
        this.displayReport(); // Reload the table
    };

    permissionSetsFiltering_handleClick = e => {
        ModalPermissionSetFilter.open({
            permissionSets: Object.values(this.permissionSets).filter(x => x.type !== 'Profile'),
            currentConnection: this.connector.conn,
            selected: this.filter_permissionSets,
        }).then(res => {
            if (res?.action === 'applyFilter') {
                this.filter_permissionSets = res.filter || [];
                localStorage.setItem(
                    `${this.connector.configuration.alias}-accessAnalyzer_filter_permissionSets`,
                    JSON.stringify(this.filter_permissionSets)
                );
                this.displayReport();
            }
        });
    };

    /** Tabulator */

    displayReportAsync = async () => {
        //this.isLoading = true;
        //this.customLoadingMessage = 'Gathering insights from the data cosmos';

        switch (this.report) {
            case 'CustomObject':
                await this.setCustomObjectReport();
                break;
            case 'FieldLevelSecurity':
                await this.setFieldLevelSecurityReport();
                break;
            case 'FullView':
                await this.setFullViewReport();
                break;
            case 'Matrix':
                await this.setMatrixReport();
                break;
            case 'PermissionGroups':
                await this.setPermissionGroupReport();
                break;
            default:
                //console.log('No Default Report');
                break;
        }
        //this.isLoading = false;
    };

    displayReport = () => {
        this.isLoading = true;
        this.customLoadingMessage = 'Generating report based on the metadata.';
        window.setTimeout(() => {
            if (this.tableInstance) {
                this.tableInstance.destroy();
            }
            this.displayReportAsync();
        }, 1);
    };

    /** Table Creation **/

    getBasicFilter = p => {
        return (
            (this.filter_profiles.includes(p.id) || this.filter_permissionSets.includes(p.id)) &&
            (this.userLicenseFiltering_value === 'all' ||
                this.userLicenseFiltering_value === p.userLicense)
        );
    };

    generateFullDataList = metadataFilter => {
        var dataList = [];
        // Row processing
        try {
            Object.values(CONFIG)
                .filter(
                    x =>
                        isUndefinedOrNull(metadataFilter) ||
                        (isNotUndefinedOrNull(metadataFilter) && metadataFilter.includes(x.key))
                )
                .forEach(configItem => {
                    Object.values(this.metadata[configItem.metadataName]) // sobjects.recordTypes
                        .filter(
                            x =>
                                (this.namespaceFiltering_isExcluded &&
                                    (x.namespacePrefix == null || x.namespacePrefix === '')) ||
                                !this.namespaceFiltering_isExcluded
                        )
                        .forEach(item => {
                            let data = {};
                            data['label'] = item.label || item.name;
                            data['name'] = item.name;
                            data['namespacePrefix'] = item.namespacePrefix || 'Default';
                            data['category'] = configItem.category;

                            this.filteredPermissions.forEach(permission => {
                                const permissionList = permission[configItem.permissionName];
                                let index = permissionList.findIndex(
                                    x => x[configItem.permissionFieldId] === item.name
                                );
                                if (index > -1) {
                                    data[permission.id] = configItem.formatter(
                                        permissionList[index],
                                        this.metadata
                                    ); // Want to keep empty if doesn't exist instead of false
                                }
                            });

                            if (configItem.key === 'layouts' && item?.recordTypes) {
                                // TODO: Check why we can have item.recordTypes === undefined
                                // Run special logic for layouts
                                const children = Object.values(item.recordTypes).map(recordType => {
                                    const permissionKey = `${item.name}-${recordType.id}`; // to be replaced in the SF method
                                    const subData = {
                                        name: `${data.name}.${recordType.name}`,
                                        label: recordType.label,
                                        category: data.category,
                                        namespacePrefix: data.namespacePrefix,
                                    };
                                    this.filteredPermissions.forEach(permission => {
                                        const permissionList =
                                            permission[configItem.permissionName];

                                        let index = permissionList.findIndex(
                                            x => x[configItem.permissionFieldId] === permissionKey
                                        );
                                        if (index > -1) {
                                            subData[permission.id] =
                                                this.metadata['layouts'][
                                                    permissionList[index].id
                                                ].name; // Want to keep empty if doesn't exist instead of false
                                        }
                                    });
                                    return subData;
                                });
                                if (children && children.length > 0) {
                                    data._children = children; // avoid empty record types
                                }
                            }

                            if (configItem.subPermissions) {
                                // Check the children
                                data._children = configItem.subPermissions.map(key => {
                                    const subData = {
                                        name: `${data.name}.${key}`,
                                        label: key,
                                        category: data.category,
                                        namespacePrefix: data.namespacePrefix,
                                    };
                                    this.filteredPermissions.forEach(permission => {
                                        const permissionList =
                                            permission[configItem.permissionName];
                                        let index = permissionList.findIndex(
                                            x => x[configItem.permissionFieldId] === item.name
                                        );
                                        if (index > -1) {
                                            subData[permission.id] = permissionList[index][key]; // Want to keep empty if doesn't exist instead of false
                                        }
                                    });
                                    return subData;
                                });
                            }

                            dataList.push(data);
                        });
                });
        } catch (e) {
            console.error('Issue in processing', e);
        }

        return dataList;
    };

    calculateMatrixData = () => {
        const _dataList = this.generateFullDataList(this.metadataFilter_value);
        // Create Matrix
        const matrix = {};
        this.filteredPermissions.forEach(perm1 => {
            matrix[perm1.id] = { name: perm1.name, id: perm1.id };
            this.filteredPermissions.forEach(perm2 => {
                matrix[perm1.id][perm2.id] = { perm1: perm1.id, perm2: perm2.id }; // difference aggregator
            });
        });
        /*_dataList.forEach((data,index) => {
            this.filteredPermissions.forEach(perm1 => {
                const toExclude = [];
                this.filteredPermissions.filter(perm2 => !toExclude.includes(perm2.id)).forEach(perm2 => {
                    if(data[perm1.id] != data[perm2.id]){
                        if(!matrix[perm1.id][perm2.id].hasOwnProperty(data.category)){
                            matrix[perm1.id][perm2.id][data.category] = 0
                            matrix[perm2.id][perm1.id][data.category] = 0 // reverse
                        }
                        matrix[perm1.id][perm2.id][data.category]++;
                        matrix[perm2.id][perm1.id][data.category]++; // reverse
                    }
                });
                toExclude.push(perm1.id);
            })
        });*/
        const toExclude = []; // Move outside the loop to avoid unnecessary reinitialization

        this.filteredPermissions.forEach((perm1, index1) => {
            _dataList.forEach(data => {
                if (!toExclude.includes(perm1.id)) {
                    // Check if perm1 is already excluded
                    this.filteredPermissions.slice(index1 + 1).forEach(perm2 => {
                        // Start from next index to avoid redundant comparisons
                        if (data[perm1.id] !== data[perm2.id]) {
                            // Check if perm2 is not excluded and values are different
                            if (!matrix[perm1.id][perm2.id].hasOwnProperty(data.category)) {
                                matrix[perm1.id][perm2.id][data.category] = 0;
                                matrix[perm2.id][perm1.id][data.category] = 0; // Reverse
                            }
                            matrix[perm1.id][perm2.id][data.category]++;
                            matrix[perm2.id][perm1.id][data.category]++; // Reverse
                        }
                    });
                }
            });
            toExclude.push(perm1.id); // Exclude perm1 after processing its comparisons
        });

        return Object.values(matrix).sort((a, b) => (a.name || '').localeCompare(b.name));
    };

    setMatrixReport = async metadataFilter => {
        //console.log('setMatrixReport');

        let colModel = [
            {
                title: 'Permission',
                field: 'name',
                resizable: true,
                headerHozAlign: 'center',
                resizable: true,
                responsive: 0,
                frozen: true,
                headerFilter: 'input',
            },
        ];

        // Columns processing
        this.filteredPermissions
            .sort((a, b) => (a.name || '').localeCompare(b.name))
            .forEach(permission => {
                colModel.push({
                    title: permission.name,
                    field: permission.id,
                    /*tooltip: (e,cell) => {
                        if(cell.getValue() && Object.keys(cell.getValue()).length > 0){
                            return `<ul>${Object.keys(cell.getValue()).map(key => `<li>${key}: ${cell.getValue()[key]}</li>`).join('')}</ul>`;
                        }
                    },*/
                    clickPopup: function (e, component, onRendered) {
                        if (component.getValue() && Object.keys(component.getValue()).length > 0) {
                            return `<ul>${Object.keys(component.getValue())
                                .filter(key => !['perm1', 'perm2'].includes(key))
                                .map(key => `<li>${key}: ${component.getValue()[key]}</li>`)
                                .join('')}</ul>`;
                        } else {
                            return 'No Difference';
                        }
                    },
                    headerHozAlign: 'center',
                    hozAlign: 'center',
                    headerWordWrap: true,
                    width: 80,
                    headerSort: false,
                    formatter: (cell, formatterParams, onRendered) => {
                        if (cell.getValue()) {
                            if (
                                isNotUndefinedOrNull(cell.getValue().perm1) &&
                                cell.getValue().perm1 == cell.getValue().perm2
                            ) {
                                // Cross mapping
                                cell.getElement().style.backgroundColor = '#747474';
                            } else {
                                const total = Object.values(cell.getValue())
                                    .filter(x => typeof x === 'number')
                                    .reduce((acc, item) => acc + item, 0);
                                if (total < this.greenTreshold) {
                                    cell.getElement().style.backgroundColor = '#669900';
                                } else if (total < this.orangeTreshold) {
                                    cell.getElement().style.backgroundColor = '#ff5d2d';
                                }
                                return total;
                            }
                        }
                    },
                });
            });

        this.dataList = this.calculateMatrixData(metadataFilter);
        //console.log('this.dataList',this.dataList);
        this.tableInstance = new Tabulator(this.template.querySelector('.custom-table'), {
            height: this.calculatedHeight,
            data: this.dataList,
            layout: 'fitDataFill',
            columns: colModel,
            columnHeaderVertAlign: 'middle',
            debugInvalidOptions: true,
            movableColumns: true,
            movableRows: true,
            maxHeight: '100%',
            placeholder: () => {
                return this.noDataAvailable;
            },
            rowFormatter: function (row) {
                if (row.getData().isCategory) {
                    row.getElement().style.backgroundColor = '#1c96ff';
                }
            },
        });
    };

    setFullViewReport = async metadataFilter => {
        //console.log('setFullViewReport');

        let colModel = [
            {
                title: 'Developer Name',
                field: 'name',
                minWidth: 200,
                resizable: true,
                frozen: true,
                headerHozAlign: 'center',
                responsive: 0,
                headerFilter: 'input',
            },
            {
                title: 'Label',
                field: 'label',
                minWidth: 200,
                resizable: true,
                headerHozAlign: 'center',
                tooltip: true,
                headerFilter: 'input',
            },
        ];

        // Columns processing
        this.filteredPermissions.forEach(permission => {
            let _typeIndex = colModel.findIndex(x => x.field === permission.userLicense);
            if (_typeIndex < 0) {
                /* Create User License */
                colModel.push({
                    title: permission.userLicense,
                    field: permission.userLicense,
                    columns: [],
                    headerHozAlign: 'center',
                    headerWordWrap: false,
                    variableHeight: true,
                    headerTooltip: permission.userLicense,
                    resizable: true,
                    minWidth: 120,
                });
                _typeIndex = colModel.length - 1;
            }

            colModel[_typeIndex].columns.push({
                title: permission.name,
                field: permission.id,
                tooltip: true,
                headerHozAlign: 'center',
                hozAlign: 'center',
                headerWordWrap: true,
                width: 80,
                headerSort: false,
                formatter: function (cell, formatterParams, onRendered) {
                    if (typeof cell.getValue() == 'boolean') {
                        return cell.getValue() ? SVG_CHECKED : SVG_UNCHECKED;
                    } else {
                        return cell.getValue();
                    }
                },
            });
        });

        // Diff Checker processing
        this.dataList = this.generateFullDataList(metadataFilter);
        const _dataList = this.getDiffData(this.dataList);

        this.tableInstance = new Tabulator(this.template.querySelector('.custom-table'), {
            height: this.calculatedHeight,
            data: _dataList,
            dataTree: true,
            dataTreeStartExpanded: true,
            selectable: true,
            layout: 'fitDataFill',
            columns: colModel,
            columnHeaderVertAlign: 'middle',
            debugInvalidOptions: true,
            groupBy: this.namespaceFiltering_isExcluded
                ? 'category'
                : ['category', 'namespacePrefix'],
            groupStartOpen: this.namespaceFiltering_isExcluded ? false : [false, true],
            maxHeight: '100%',
            placeholder: () => {
                return this.noDataAvailable;
            },
            rowFormatter: function (row) {
                if (row.getData().isCategory) {
                    row.getElement().style.backgroundColor = '#1c96ff';
                }
            },
        });
    };

    setFieldLevelSecurityReport = async updateData => {
        if (
            isUndefinedOrNull(this.selectedObject) &&
            Object.values(this.metadata.sobjects).length > 0
        ) {
            this.selectedObject = this.metadata.sobjects[this.sobject_options[0].value];
        }

        await setFieldPermission(this.connector.conn, this.permissionSets, {
            targetObject: this.selectedObject,
        });

        let dataList = [];
        let colModel = [
            {
                title: 'Developer Name',
                field: 'api',
                resizable: true,
                frozen: true,
                headerHozAlign: 'center',
                minWidth: 200,
                tooltip: true,
                headerFilter: 'input',
            },
            {
                title: 'Label',
                field: 'label',
                resizable: true,
                headerHozAlign: 'center',
                minWidth: 200,
                tooltip: true,
                headerFilter: 'input',
            },
            {
                title: 'Field Type',
                field: 'type',
                resizable: true,
                headerHozAlign: 'center',
                minWidth: 100,
                tooltip: true,
            },
            {
                title: 'Required',
                field: 'isRequired',
                resizable: true,
                headerHozAlign: 'center',
                minWidth: 20,
                hozAlign: 'center',
                formatter: 'tickCross',
                formatterParams: { allowEmpty: true },
            },
        ];

        this.filteredPermissions.forEach(permission => {
            let _typeIndex = colModel.findIndex(x => x.field === permission.userLicense);
            if (_typeIndex < 0) {
                /* Create User License */
                colModel.push({
                    title: permission.userLicense,
                    field: permission.userLicense,
                    columns: [],
                    headerHozAlign: 'center',
                    headerWordWrap: false,
                    variableHeight: true,
                    headerTooltip: permission.userLicense,
                    resizable: true,
                    minWidth: 120,
                });
                _typeIndex = colModel.length - 1;
            }

            colModel[_typeIndex].columns.push({
                title: permission.name,
                field: permission.id,
                headerHozAlign: 'center',
                hozAlign: 'center',
                headerWordWrap: true,
                width: 80,
                headerSort: false,
            });
        });

        Object.values(this.selectedObject.fields)
            .sort((a, b) => a.name.localeCompare(b.name))
            .filter(
                x =>
                    (this.namespaceFiltering_isExcluded &&
                        (x.namespacePrefix == null || x.namespacePrefix === '')) ||
                    !this.namespaceFiltering_isExcluded
            )
            .forEach(field => {
                let data = {};
                data['api'] = field.name;
                data['label'] = field.label;
                data['type'] = field.type;
                data['isRequired'] = !field.isNillable;

                this.filteredPermissions.forEach(permission => {
                    let fp = permission.fieldPermissions[field.name];

                    if (fp && fp.allowEdit) {
                        data[permission.id] = 'RW';
                    } else if (fp && fp.allowRead) {
                        data[permission.id] = 'R';
                    } else {
                        data[permission.id] = '';
                    }
                });

                dataList.push(data);
            });

        // Diff Checker processing
        this.dataList = dataList;
        const _dataList = this.getDiffData(dataList);
        if (updateData) {
            await this.tableInstance.replaceData(_dataList);
        } else {
            this.tableInstance = new Tabulator(this.template.querySelector('.custom-table'), {
                height: this.calculatedHeight,
                data: _dataList,
                selectable: true,
                layout: 'fitDataFill',
                columns: colModel,
                columnHeaderVertAlign: 'middle',
                debugInvalidOptions: true,
                groupBy: this.namespaceFiltering_isExcluded ? null : 'namespacePrefix',
                maxHeight: '100%',
                placeholder: () => {
                    return this.noDataAvailable;
                },
                rowFormatter: function (row) {
                    if (row.getData().isCategory) {
                        row.getElement().style.backgroundColor = '#1c96ff';
                    }
                },
            });
        }
    };

    setPermissionGroupReport = async () => {
        let permissionGroups = Object.values(this.metadata.permissionGroups);
        let dataList = [];

        let colModel = [
            {
                title: 'DeveloperName',
                field: 'name',
                headerHozAlign: 'center',
                resizable: true,
                frozen: true,
                tooltip: true,
                headerFilter: 'input',
            },
            {
                title: 'Permission',
                field: 'label',
                headerHozAlign: 'center',
                resizable: true,
                responsive: 0,
                headerFilter: 'input',
            },
            //{ title: 'Permission Groups',  frozen: true, headerHozAlign: "center", resizable: false, tooltip: true, columns: []},
        ];

        permissionGroups.forEach(permission => {
            colModel.push({
                title: permission.label,
                field: permission.id,
                headerHozAlign: 'center',
                hozAlign: 'center',
                headerWordWrap: true,
                width: 120,
                formatter: 'tickCross',
                formatterParams: { allowEmpty: true },
                headerSort: false,
            });
        });

        Object.values(this.permissionSets)
            .filter(x => ['Standard', 'Regular', 'Session'].includes(x.type))
            .filter(
                x =>
                    (this.namespaceFiltering_isExcluded &&
                        (x.namespacePrefix == null || x.namespacePrefix === '')) ||
                    !this.namespaceFiltering_isExcluded
            )
            .forEach(item => {
                let data = {};
                data['label'] = item.label || item.name;
                data['name'] = item.name;
                data['namespacePrefix'] = item.namespacePrefix || 'Default';

                permissionGroups.forEach(group => {
                    let index = group.members.findIndex(x => x === item.id);
                    if (index > -1) {
                        data[group.id] = true;
                    }
                });

                dataList.push(data);
            });

        this.tableInstance = new Tabulator(this.template.querySelector('.custom-table'), {
            height: this.calculatedHeight,
            data: dataList,
            selectable: true,
            layout: 'fitDataFill',
            columns: colModel,
            groupBy: 'namespacePrefix',
            columnHeaderVertAlign: 'middle',
            placeholder: 'No Data Available',
            groupStartOpen: function (value, count, data, group) {
                return value === 'Default';
            },
            downloadConfig: {
                rowGroups: false, //do not include row groups in downloaded table
            },
        });
    };

    setCustomObjectReport = async () => {
        let dataList = [];
        let colModel = [
            {
                title: 'Developer Name',
                field: 'name',
                headerHozAlign: 'center',
                resizable: false,
                frozen: true,
                tooltip: true,
                headerFilter: 'input',
            },
            {
                title: 'Label',
                field: 'label',
                headerHozAlign: 'center',
                resizable: false,
                responsive: 0,
                headerFilter: 'input',
            },
        ];

        this.filteredPermissions.forEach(permission => {
            let subCols = [
                {
                    title: 'Read',
                    field: permission.id + '_r',
                    minWidth: 28,
                    cssClass: 'vertical-title',
                    width: 40,
                    headerVertical: true,
                    resizable: false,
                    formatter: 'tickCross',
                    formatterParams: { allowEmpty: true },
                },
                {
                    title: 'Create',
                    field: permission.id + '_c',
                    minWidth: 28,
                    cssClass: 'vertical-title',
                    width: 40,
                    headerVertical: true,
                    resizable: false,
                    formatter: 'tickCross',
                    formatterParams: { allowEmpty: true },
                },
                {
                    title: 'Edit',
                    field: permission.id + '_u',
                    minWidth: 28,
                    cssClass: 'vertical-title',
                    width: 40,
                    headerVertical: true,
                    resizable: false,
                    formatter: 'tickCross',
                    formatterParams: { allowEmpty: true },
                },
                {
                    title: 'Delete',
                    field: permission.id + '_d',
                    minWidth: 28,
                    cssClass: 'vertical-title',
                    width: 40,
                    headerVertical: true,
                    resizable: false,
                    formatter: 'tickCross',
                    formatterParams: { allowEmpty: true },
                },
                {
                    title: 'All Read',
                    field: permission.id + '_ar',
                    minWidth: 28,
                    cssClass: 'vertical-title',
                    width: 40,
                    headerVertical: true,
                    resizable: false,
                    formatter: 'tickCross',
                    formatterParams: { allowEmpty: true },
                },
                {
                    title: 'All Edit',
                    field: permission.id + '_au',
                    minWidth: 28,
                    cssClass: 'vertical-title',
                    width: 40,
                    headerVertical: true,
                    resizable: false,
                    formatter: 'tickCross',
                    formatterParams: { allowEmpty: true },
                },
            ];

            colModel.push({
                title: permission.name,
                field: permission.id,
                columns: subCols,
                headerHozAlign: 'center',
                headerWordWrap: true,
                variableHeight: true,
                headerTooltip: permission.fullName,
                resizable: false,
            });
        });

        Object.values(this.metadata.sobjects)
            .sort((a, b) => a.name.localeCompare(b.name))
            .filter(
                x =>
                    (this.namespaceFiltering_isExcluded &&
                        (x.namespacePrefix == null || x.namespacePrefix === '')) ||
                    !this.namespaceFiltering_isExcluded
            )
            .forEach(sObject => {
                const data = {};
                data['label'] = sObject.label;
                data['name'] = sObject.name;
                data['namespacePrefix'] = sObject.namespacePrefix || 'Default';

                this.filteredPermissions.forEach(permission => {
                    const op = permission.objectPermissions.find(
                        x => x.sobjectType === sObject.name
                    );

                    data[permission.id + '_r'] = op && op.allowRead;
                    data[permission.id + '_c'] = op && op.allowCreate;
                    data[permission.id + '_u'] = op && op.allowEdit;
                    data[permission.id + '_d'] = op && op.allowDelete;
                    data[permission.id + '_ar'] = op && op.viewAllRecords;
                    data[permission.id + '_au'] = op && op.modifyAllRecords;
                });

                dataList.push(data);
            });

        this.tableInstance = new Tabulator(this.template.querySelector('.custom-table'), {
            height: this.calculatedHeight,
            data: dataList,
            selectable: true,
            layout: 'fitDataFill',
            columns: colModel,
            columnHeaderVertAlign: 'middle',
            debugInvalidOptions: true,
            groupBy: 'namespacePrefix',
            maxHeight: '100%',
            placeholder: 'No Data Available',
            rowFormatter: function (row) {
                if (row.getData().isCategory) {
                    row.getElement().style.backgroundColor = '#1c96ff';
                }
            },
        });
    };

    /** Filter Panel */

    handleCloseVerticalPanel = () => {
        this.displayFilterContainer = false;
    };
}
