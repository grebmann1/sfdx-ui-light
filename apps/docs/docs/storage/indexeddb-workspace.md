---
title: IndexedDB Virtual File System
---

# IndexedDB Virtual File System

The workbench uses a virtual file system backed by browser IndexedDB for all workspace files in the embedded VS Code experience. Files never touch disk — they live entirely in the browser storage of the app origin.

## How it works

The LWC app (`core/fs`) owns the IndexedDB store. The embedded VS Code workbench accesses it through the **FS Bridge**: a `MessageChannel`-based link where VS Code registers a custom `FileSystemProvider` that forwards every file operation (`stat`, `readdir`, `readFile`, `writeFile`, `mkdir`, `rm`, `mv`) to the parent app over the bridge port. The parent enforces workspace root boundaries before delegating to IndexedDB.

This design means VS Code has full file-system semantics (watchers, saves, diffs) without ever directly touching the database or the network.

## Read-only protections

- the provider checks metadata (for example `.salesforce/tooling-map.json`) to enforce read-only paths
- writes, deletes, and renames can be blocked when paths are marked read-only

## What this means for your data

- virtual workspace files are retained locally on your machine (browser IndexedDB storage)
- this storage model supports offline-like editing and local persistence between sessions
- the workspace snapshot is not automatically uploaded as raw files to a remote Workbench server

## Operational notes

- clearing site/browser data for the app origin can remove IndexedDB content
- use source control or exports for important long-term backups

## Related docs

- [Architecture overview](../architecture/overview)
- [AI Agent Tools Overview](../ai-agent/tools-overview)
- [Local data and privacy](../security/local-data-and-privacy)
