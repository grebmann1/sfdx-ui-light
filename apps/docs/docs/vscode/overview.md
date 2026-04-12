---
title: VS Code Workflows
---

# VS Code Workflows

SF Toolkit includes a VS Code-style workbench experience for Salesforce tasks without leaving the app shell.

## Main workbench surfaces

- **Salesforce panel**: connection-aware commands for metadata/source workflows.
- **Org Browser**: browse and retrieve metadata directly from org structure.
- **SOQL workbench tooling**: run `.soql` queries and use schema-aware support.
- **LWC and Apex command surfaces**: scaffold, deploy/fetch current files, run selected workflows.
- **Embedded AI support**: use workbench-native AI tooling where available.

## Recommended workflow loop

1. Connect an org from the app.
2. Open the workbench-oriented tools from the app shell.
3. Run metadata/query tasks and review outputs before moving to write operations.
4. Iterate with smaller command batches to reduce recoverability risk.

## Coverage and parity notes

- The embedded workbench covers many day-to-day metadata and SOQL workflows.
- Some upstream Salesforce VS Code features are intentionally partial or not yet implemented.
- For a detailed matrix, see [VS Code Extension Parity](./extension-parity).

## Related pages

- [Installation](../getting-started/installation)
- [Common workflows](../workflows/common-tasks)
- [CLI usage](../cli/overview)
- [Troubleshooting](../troubleshooting/common-issues)
