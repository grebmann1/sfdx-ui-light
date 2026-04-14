export const DEFAULT_SOURCE_API_VERSION = '66.0';

export const WORKSPACE_TEMPLATE_FILES: Record<string, string> = {
    '.vscode/extensions.json': `{
  "recommendations": [],
  "unwantedRecommendations": []
}
`,
    'sfdx-project.json': `{
  "packageDirectories": [
    {
      "path": "force-app",
      "default": true
    }
  ],
  "name": "MyProject",
  "namespace": "",
  "sfdcLoginUrl": "https://login.salesforce.com",
  "sourceApiVersion": "${DEFAULT_SOURCE_API_VERSION}"
}
`,
    'README.md': `# Salesforce Workbench: Getting Started

Welcome to the embedded Salesforce workbench. This is a lightweight version of VS Code focused on browser-based Salesforce workflows.

## Before You Start

Review the org banner above the workbench so you know whether you are working in production, a sandbox, or an unclassified org context.

## What This Workspace Can Do

- Explore and sync Salesforce metadata into the Explorer
- Edit project files directly in the browser
- Run focused Salesforce commands from the command palette
- Use the built-in agent to help inspect, explain, and update workspace files

## How Do You Plan to Deploy Your Changes?

Do you want to deploy a set of changes, or create a self-contained application? Choose a [development model](https://developer.salesforce.com/tools/vscode/en/user-guide/development-models).

## Configure Your Salesforce DX Project

The \`sfdx-project.json\` file contains useful configuration information for your project. See [Salesforce DX Project Configuration](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_ws_config.htm) in the _Salesforce DX Developer Guide_ for details about this file.

## Read All About It

- [Salesforce Extensions Documentation](https://developer.salesforce.com/tools/vscode/)
- [Salesforce CLI Setup Guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_intro.htm)
- [Salesforce DX Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_intro.htm)
- [Salesforce CLI Command Reference](https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_reference.meta/sfdx_cli_reference/cli_reference.htm)
`,
    'manifest/package.xml': `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <version>${DEFAULT_SOURCE_API_VERSION}</version>
</Package>
`,
    'assets/apex/hello.apex': `// Use .apex files to store anonymous Apex.
// You can execute anonymous Apex in VS Code by selecting the
//     apex text and running the command:
//     SFDX: Execute Anonymous Apex with Currently Selected Text
// You can also execute the entire file by running the command:
//     SFDX: Execute Anonymous Apex with Editor Contents

string tempvar = 'Enter_your_name_here';
System.debug('Hello World!');
System.debug('My name is ' + tempvar);
`,
    'assets/soql/account.soql': `// Use .soql files to store SOQL queries.
// You can execute queries in VS Code by selecting the
//     query text and running the command:
//     SFDX: Execute SOQL Query with Currently Selected Text

SELECT Id, Name FROM Account
`,
};
