# Temporary iframe bridge content

This folder is a temporary home for code that runs inside the iframe and talks to the parent
`fullApp` bridge.

## Why this exists

- Parent side (`packages/lwc/app/vscode/fullApp`) owns IndexedDB and exposes a safe RPC bridge.
- Parent side also owns Salesforce connection/session state and exposes curated JSForce RPC methods.
- Iframe side (this folder) uses these bridges for filesystem + Salesforce operations.
- Later, this folder can be migrated to the final iframe application package.

## Files

- `bridge/iframeFsBridgeContract.ts`: protocol constants and shared message shapes.
- `bridge/bootstrapIframeBridge.ts`: window-level handshake and `MessagePort` acquisition.
- `bridge/iframeFsBridgeClient.ts`: RPC client for filesystem methods.
- `bridge/iframeWorkspaceProvider.ts`: VSCode-like filesystem provider backed by the bridge.
- `bridge/registerIframeWorkspaceProvider.ts`: one-step helper to register the provider.
- `bridge/iframeJsforceBridgeContract.ts`: protocol constants and method allowlist for JSForce.
- `bridge/bootstrapIframeJsforceBridge.ts`: window-level JSForce bridge handshake.
- `bridge/iframeJsforceBridgeClient.ts`: typed JSForce RPC client wrappers.

## Quick setup in iframe app

1. Ensure iframe URL has:
    - `fsBridge=1`
    - `bridgeProtocolVersion=1`
    - `jsforceBridge=1`
    - `jsforceBridgeProtocolVersion=1`
    - `bridgeParentOrigin=<parent-origin>`
2. In your iframe bootstrap, register the provider:

```ts
import * as vscode from 'vscode';
import { registerFileSystemOverlay } from '@codingame/monaco-vscode-files-service-override';
import { registerIframeWorkspaceProvider } from './bridge/registerIframeWorkspaceProvider';
import { connectIframeJsforceBridgeClient } from './bridge/iframeJsforceBridgeClient';

await registerIframeWorkspaceProvider({
    vscode,
    registerFileSystemOverlay,
    priority: 1,
});

const jsforceBridge = await connectIframeJsforceBridgeClient();
const status = await jsforceBridge.getConnectionStatus();
if (status.connected) {
    const queryResult = await jsforceBridge.executeSoql({
        query: 'SELECT Id, Name FROM Account LIMIT 10',
    });
    console.log(queryResult.records);
}

const hostEvents = jsforceBridge.onHostEvent(event => {
    if (event.eventName === 'banner.action') {
        console.log('Banner action event:', event.payload);
    }
});
```

3. The provider reads `workspaceRoot` sent by the parent host bridge during handshake.

## Notes

- This bridge is designed for cross-origin iframe development (`localhost` iframe).
- The parent validates origin/source before transferring the communication port.
- Paths are constrained to the parent workspace root.
- JSForce operations run through host-owned auth/session recovery helpers.
- Parent banner actions are pushed to iframe via JSForce bridge `bridgeEvent` messages.
