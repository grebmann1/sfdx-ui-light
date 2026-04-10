---
title: AI Agent Tools Overview
---

# AI Agent Tools Overview

The embedded workbench agent can use a set of VS Code-native tools while helping you in the app.

## Tool groups currently available

## 1) Active editor tools

- `getActiveEditorContext`
  - returns active file path, language, selection, selected text, and optional full text snapshot
- `applyActiveEditorEdit`
  - applies edits directly to the active editor and attempts to save

## 2) Workspace file tools

The agent can inspect and edit workspace files with path-aware tooling:

- `listWorkspaceDirectory`
- `globWorkspaceFiles`
- `grepWorkspaceFiles`
- `workspacePathExists`
- `statWorkspacePath`
- `readWorkspaceFile`
- `openWorkspaceFile`
- `showWorkspaceLines`
- `createWorkspaceFile`
- `editWorkspaceFile`
- `saveWorkspaceFile`
- `deleteWorkspaceFile`

## 3) Workbench bash tool

- `bash`
  - runs shell commands in the workbench sandbox
  - includes Salesforce-oriented command workflows used by the embedded shell service

## Safety and confirmations

- potentially destructive actions (for example, edits/deletes or shell commands) are designed to require confirmation
- path-sensitive tools include checks for workspace boundaries and file type validation
- large outputs are truncated to keep interactions stable

## Related docs

- [IndexedDB virtual file system](../storage/indexeddb-workspace)
- [Local data and privacy](../security/local-data-and-privacy)
