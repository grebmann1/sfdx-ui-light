export default {
  "fullName": "Admin",
  "applicationVisibilities":[],
  "classAccesses": [
      {
        "apexClass": "AsyncIntegrationProcedureRESTService",
        "enabled": "true"
      },
      {
        "apexClass": "ChangePasswordController",
        "enabled": "true"
      }
  ],
  "custom": "false",
  "customMetadataTypeAccesses": [
      {
        "enabled": "true",
        "name": "QLabs__mdt"
      },
      {
        "enabled": "true",
        "name": "vbtapp__TrialforceSetupScript__mdt"
      },
      {
        "enabled": "true",
        "name": "vlocity_cmt__CpqMemberType__mdt"
      }
  ],
  "customSettingAccesses": [
      {
        "enabled": "true",
        "name": "vlocity_cmt__BillingDataTrim__c"
      },
      {
        "enabled": "true",
        "name": "vlocity_cmt__CardFrameworkConfiguration__c"
      },
      {
        "enabled": "true",
        "name": "vlocity_cmt__ContractDocumentAccessControl__c"
      }
  ],
  "fieldPermissions": [
      {
        "editable": "true",
        "field": "Account.AccountNumber",
        "readable": "true"
      },
      {
        "editable": "true",
        "field": "Account.AccountSource",
        "readable": "true"
      },
      {
        "editable": "true",
        "field": "Account.AnnualRevenue",
        "readable": "true"
      },
      {
        "editable": "true",
        "field": "Account.BillingAddress",
        "readable": "true"
      }
  ],
  "flowAccesses": [
      {
        "enabled": "false",
        "flow": "Schedule_a_Technician"
      },
      {
        "enabled": "false",
        "flow": "Update_Software"
      },
      {
        "enabled": "false",
        "flow": "accountOutreach"
      },
      {
        "enabled": "false",
        "flow": "customer_satisfaction"
      },
      {
        "enabled": "false",
        "flow": "net_promoter_score"
      }
  ],
  "layoutAssignments": [
      {
        "layout": "Account-Demo Account Layout"
      },
      {
        "layout": "Account-Demo Account Layout",
        "recordType": "Account.Company"
      },
      {
        "layout": "Account-Demo Account Layout",
        "recordType": "Account.vlocity_cmt__Advertiser"
      },
      {
        "layout": "Account-Demo Account Layout",
        "recordType": "Account.vlocity_cmt__Agency"
      }
  ],
  "loginIpRanges": {
      "endAddress": "255.255.255.255",
      "startAddress": "0.0.0.0"
  },
  "objectPermissions": [
      {
        "allowCreate": "true",
        "allowDelete": "true",
        "allowEdit": "true",
        "allowRead": "true",
        "modifyAllRecords": "true",
        "object": "AIInsightReason",
        "viewAllRecords": "true"
      },
      {
        "allowCreate": "true",
        "allowDelete": "true",
        "allowEdit": "true",
        "allowRead": "true",
        "modifyAllRecords": "true",
        "object": "AIRecordInsight",
        "viewAllRecords": "true"
      }
  ],
  "pageAccesses": [
      {
        "apexPage": "AnswersHome",
        "enabled": "true"
      },
      {
        "apexPage": "BandwidthExceeded",
        "enabled": "true"
      },
      {
        "apexPage": "ChangePassword",
        "enabled": "true"
      }
  ],
  "recordTypeVisibilities": [
      {
        "default": "true",
        "personAccountDefault": "true",
        "recordType": "Account.Company",
        "visible": "true"
      },
      {
        "default": "false",
        "recordType": "Account.vlocity_cmt__Advertiser",
        "visible": "false"
      }
  ],
  "tabVisibilities": [
      {
        "tab": "Demo_Config",
        "visibility": "DefaultOn"
      },
      {
        "tab": "Demo_Config__c",
        "visibility": "DefaultOn"
      }
  ],
  "userLicense": "Salesforce",
  "userPermissions": [
    {
      "enabled": "true",
      "name": "AIViewInsightObjects"
    },
    {
      "enabled": "true",
      "name": "ActivateContract"
    },
    {
      "enabled": "true",
      "name": "ActivateOrder"
    }
  ]
}