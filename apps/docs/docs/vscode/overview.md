---
title: VS Code Workflows
---

# VS Code Workflows

Workbench embeds a full VS Code workbench inside a sandboxed `<iframe>`. The workbench connects back to the parent app through typed `MessageChannel` bridges, giving it access to the virtual file system, the active Salesforce session, and the configured AI provider — without managing its own credentials.

## How it works

The parent LWC app (`vscode/fullApp`) owns the iframe and hosts three bridges:

| Bridge | What it gives VS Code |
|---|---|
| **FS Bridge** | Read/write access to the IndexedDB virtual file system |
| **Jsforce Bridge** | The active Salesforce session (SOQL, Apex, Metadata, Tooling API) |
| **AI Bridge** | Streaming LLM inference from the app's configured provider |

Each bridge uses a `MessageChannel` port-handshake: the iframe signals readiness, the parent transfers a `MessagePort`, and all subsequent RPC calls travel over that dedicated port. Neither side shares raw credentials — API keys and session tokens remain in the parent app.

For a deeper look at this design, see [Architecture overview](../architecture/overview).

## Main workbench surfaces

- **Salesforce panel**: connection-aware commands for metadata and source workflows.
- **Org Browser**: browse and retrieve metadata directly from the org structure.
- **SOQL workbench**: run `.soql` queries with schema-aware completions.
- **LWC and Apex surfaces**: scaffold components, deploy/retrieve files, run Apex.
- **Embedded AI agent**: workbench-native chat and tool-call experience backed by the AI bridge.

## Recommended workflow loop

1. Connect an org from the app.
2. Open the workbench panel from the app shell.
3. Run metadata/query tasks and review outputs before moving to write operations.
4. Iterate with smaller command batches to reduce recoverability risk.

## Coverage and parity notes

- The embedded workbench covers the most common day-to-day metadata and SOQL workflows.
- Some upstream Salesforce VS Code features are intentionally partial or not yet implemented.
- For a detailed feature matrix, see [VS Code Extension Parity](./extension-parity).

## Related pages

- [Architecture overview](../architecture/overview)
- [IndexedDB virtual file system](../storage/indexeddb-workspace)
- [AI Agent tools](../ai-agent/tools-overview)
- [Common workflows](../workflows/common-tasks)
- [Troubleshooting](../troubleshooting/common-issues)
