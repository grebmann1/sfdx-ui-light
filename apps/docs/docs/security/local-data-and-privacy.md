---
title: Local Data and Privacy
---

# Local Data and Privacy

This section explains how Workbench handles local workspace data and network transfer behavior.

## Local retention by default for workspace files

- virtual workspace files used by the embedded workbench are stored in IndexedDB on your machine
- file operations performed through the virtual workspace remain local to your browser/app storage
- this design helps ensure your workspace content is retained locally

## No automatic raw workspace upload

- Workbench does not automatically transfer your full virtual file system contents to a central server as raw file dumps
- your local workspace state is intended to stay on your machine unless you explicitly export/share content

## When network traffic can happen

Network requests can still occur for explicit product features, for example:

- Salesforce API and org connectivity operations
- LLM provider calls when AI features are used
- optional external integrations you invoke directly

## Security guidance for users

- review prompts before submitting sensitive code/content to external AI models
- keep API keys and credentials in local environment/config storage only
- remove local browser/app storage when decommissioning a machine

## Related docs

- [IndexedDB Virtual File System](../storage/indexeddb-workspace)
- [Reporting Issues and Requests](../contributing/reporting-issues)
