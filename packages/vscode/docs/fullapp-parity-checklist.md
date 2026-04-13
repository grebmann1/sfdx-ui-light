# FullApp Extension Parity Checklist

This checklist freezes the expected extension registration order and the primary command/view surface that must load in the `packages/vscode` full-workbench runtime.

## Registration Order Contract

The runtime must register extensions in this exact sequence:

1. `sf-soql-workbench`
2. `sf-metadata`
3. `sf-org-browser`
4. `sf-apex`
5. `sf-lwc`
6. `agentscript-extension`
7. `workbench-ai`
8. `workbench-walkthrough`

Reference source: `packages/lwc/app/vscode/fullApp/workbench/orchestration/extensionRegistry.ts`.

## Command/View Surface Contract

- `sf-soql-workbench`
  - Commands: `sf.data.query.run`, `sf.data.query.openBuilder`, `sf.data.query.explain.document`
  - Views: `soql.schemaView`, query results data view
- `sf-metadata`
  - Commands: `salesforceMetadata.openSalesforcePanel`, `salesforceMetadata.syncWorkspace`, `salesforceMetadata.retrieveManifest`
  - Views: Salesforce activity container/panel and metadata actions
- `sf-org-browser`
  - Commands: refresh/retrieve/collapse org browser actions
  - Views: org browser tree in Salesforce container
- `sf-apex`
  - Commands: anonymous Apex run, Apex test run, debug log helpers
- `sf-lwc`
  - Commands: create component, deploy/fetch/diff current file, deploy changed files
- `agentscript-extension`
  - Language registration for `.agent` and `.afscript`
- `workbench-ai`
  - Commands: open agent chat and run workspace AI requests
  - Views: chat participant integration
- `workbench-walkthrough`
  - Commands: `workbench-walkthrough.open`
  - Views: welcome walkthrough registration

## Runtime Acceptance Checks

- Full workbench path is always selected (`entry.ts` -> `loader.ts` -> `main.workbench.ts`).
- `vscodeBundle` global is not required at startup.
- Connection context is sourced from the bridge runtime context.
- Filesystem bridge registration occurs through `registerIframeWorkspaceProvider` when bridge mode is enabled.
- JSForce bridge registration occurs through the `tempForIframeContent` client, with deterministic host fallbacks when bridge mode is unavailable.
