# Bridge Handoff Notes

This document records the temporary bridge-backed mocks introduced during the fullApp migration in `packages/vscode`.

## Runtime Injection Points

- Workbench bootstrap: `packages/vscode/src/sfWorkbench/startSalesforceWorkbench.ts`
  - Loads fullApp registrars and core services.
  - Shares the bridge-backed connection context before extension registration.
- JSForce bridge + mock fallback: `packages/vscode/src/sfWorkbench/bridgeConnection.ts`
  - Uses `connectIframeJsforceBridgeClient` when bridge mode is enabled.
  - Falls back to deterministic in-memory responses when the bridge is unavailable.
- Filesystem bridge registration: `packages/vscode/src/setup.common.ts`
  - Calls `registerIframeWorkspaceProvider` from `tempForIframeContent`.
  - Falls back to the local memory provider when iframe bridge is not available.

## Mocked Filesystem Contract

- Bridge client integration is delegated to:
  - `packages/lwc/app/vscode/tempForIframeContent/bridge/registerIframeWorkspaceProvider.ts`
  - `packages/lwc/app/vscode/tempForIframeContent/bridge/iframeWorkspaceProvider.ts`
- Local fallback keeps a seeded `/workspace` for startup.
- Future backend swap:
  1. Keep provider registration entrypoint in `setup.common.ts`.
  2. Replace iframe host implementation only; keep the client contract stable.

## Mocked JSForce Contract

- Bridge methods used by `bridgeConnection.ts`:
  - `connection.getStatus`
  - `soql.execute`
  - `apex.executeAnonymous`
  - `api.execute`
  - `apexTests.run`
  - `metadata.listTypes`
  - `metadata.list`
  - `metadata.retrieveViaMetadataApi`
  - `metadata.retrieveToolingTypes`
  - `schema.describeCustomObject`
- Fallback behavior:
  - deterministic empty SOQL/tooling payloads
  - synthetic metadata retrieve/deploy IDs
  - generated base64 zip for Metadata API retrieve checks

## Swap Plan For Real Backend

1. Keep `createBridgeConnectionContext` public contract unchanged.
2. Replace fallback implementations with real bridge-host handlers.
3. Preserve `refreshStatus()` semantics (connected/error/expired flags) so existing status and extension flows continue to work.
4. Keep `workspaceRoot` propagation in bridge status payloads to avoid path drift in metadata/sync workflows.
