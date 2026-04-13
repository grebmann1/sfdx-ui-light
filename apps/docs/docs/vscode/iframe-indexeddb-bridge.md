# Iframe IndexedDB + JSForce Bridge (localhost setup)

This bridge lets a cross-origin iframe (for example `http://localhost:3001`) use the parent app's
IndexedDB workspace filesystem and host-owned Salesforce JSForce operations.

## Parent side (extension host)

Implemented in:

- `packages/lwc/app/vscode/fullApp/fullApp.html`
- `packages/lwc/app/vscode/fullApp/fullApp.ts`
- `packages/lwc/app/vscode/fullApp/workbench/workspace/iframeFsBridgeHost.ts`
- `packages/lwc/app/vscode/fullApp/workbench/salesforce/iframeJsforceBridgeHost.ts`
- `packages/lwc/app/vscode/fullApp/workbench/salesforce/iframeJsforceBridgeRuntime.ts`

Behavior:

- The parent seeds/opens workspace filesystem with `getIndexedDbFileSystem`.
- The iframe sends `bridgeHello`.
- The parent validates `origin` and `source`, then transfers a `MessagePort`.
- Filesystem requests run only through a method whitelist (`stat`, `readdir`, `readFileBuffer`,
  `writeFile`, `mkdir`, `rm`, `mv`, `exists`).
- All paths are constrained to the active workspace root.
- JSForce requests run through a curated method allowlist:
    - `connection.getStatus`
    - `soql.execute` (`standard`, `tooling`, `queryAll`)
    - `apex.executeAnonymous`
    - `api.execute`
    - `apexTests.run`
    - `metadata.listTypes`
    - `metadata.list`
    - `metadata.retrieveViaMetadataApi`
    - `metadata.retrieveToolingTypes`
    - `schema.describeCustomObject`
- Salesforce auth/session handling stays centralized in host runtime wrappers.
- Banner actions are pushed to iframe over JSForce bridge `bridgeEvent` messages.

## Iframe side (temporary package)

Implemented in:

- `packages/lwc/app/vscode/tempForIframeContent/bridge/*`

Quick integration:

```ts
import * as vscode from 'vscode';
import { registerFileSystemOverlay } from '@codingame/monaco-vscode-files-service-override';
import { registerIframeWorkspaceProvider } from 'vscode/tempForIframeContent/bridge/registerIframeWorkspaceProvider';
import { connectIframeJsforceBridgeClient } from 'vscode/tempForIframeContent/bridge/iframeJsforceBridgeClient';

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

jsforceBridge.onHostEvent(event => {
    if (event.eventName === 'banner.action') {
        console.log('Host banner action:', event.payload);
    }
});
```

## URL flags

Parent app appends these query parameters to iframe URL:

- `fsBridge=1`
- `bridgeProtocolVersion=1`
- `jsforceBridge=1`
- `jsforceBridgeProtocolVersion=1`
- `bridgeParentOrigin=<parent-origin>`

## Troubleshooting

- **Handshake timeout**
    - confirm iframe origin matches `WORKBENCH_IFRAME_ORIGIN`
    - confirm iframe includes bridge bootstrap code and runs in a real iframe context
- **No file updates in explorer**
    - verify `fsEvent` messages are received and mapped to file change events
- **Permission error outside workspace**
    - expected behavior: bridge rejects paths outside workspace root
- **JSForce bridge returns `EAUTH`**
    - reconnect toolkit session in parent host, then retry iframe request
