---
title: IndexedDB Virtual File System
---

# IndexedDB Virtual File System

The workbench uses a virtual file system backed by browser storage (IndexedDB) for workspace files in the embedded VS Code experience.

## How it works

- workspace file operations are routed through a custom file-system provider
- the provider is restricted to the active workspace root
- read/write/create/delete/rename operations are handled locally in the browser context

## Read-only protections

- the provider checks metadata (for example `.salesforce/tooling-map.json`) to enforce read-only paths
- writes, deletes, and renames can be blocked when paths are marked read-only

## What this means for your data

- virtual workspace files are retained locally on your machine (browser IndexedDB storage)
- this storage model supports offline-like editing and local persistence between sessions
- the workspace snapshot is not automatically uploaded as raw files to a remote SF Toolkit server

## Operational notes

- clearing site/browser data for the app origin can remove IndexedDB content
- use source control or exports for important long-term backups

## Related docs

- [AI Agent Tools Overview](../ai-agent/tools-overview)
- [Local data and privacy](../security/local-data-and-privacy)
