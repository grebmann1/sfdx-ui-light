---
title: AI Agent Setup & Capabilities
---

# AI Agent Setup & Capabilities

SF Toolkit embeds an AI Agent directly into the Workbench. This page explains how to configure it and what it can do for you.

## Privacy first

**All AI interactions run entirely through the Chrome extension — no data ever passes through a SF Toolkit server.**

- Your Salesforce data, credentials, and file content are sent directly from your browser to the AI provider you configure (OpenAI, Anthropic, Gemini, etc.).
- SF Toolkit acts only as a local orchestration layer; it never proxies or logs your requests.
- You control which provider and model are used, and you can revoke access at any time by clearing your API key in settings.

---

## How to configure the AI provider

1. Open **SF Toolkit Workbench** in your browser.
2. Click the **Settings** icon in the left navigation bar.
3. Select the **AI** tab.
4. Choose your preferred provider (OpenAI, Anthropic, Gemini, Mistral, or Grok).
5. Paste your API key into the corresponding field.
6. Optionally override the base URL if you use a self-hosted or proxied endpoint.
7. Save — the agent becomes available immediately.

### Supported providers

| Provider | Models |
|---|---|
| **OpenAI** | GPT-4o, GPT-4o-mini, o1, o3-mini, and others |
| **Anthropic** | Claude 3.5 Sonnet, Claude 3 Opus, Haiku |
| **Google Gemini** | Gemini 1.5 Pro, Gemini 1.5 Flash |
| **Mistral** | Mistral Large, Mistral Nemo |
| **Grok (xAI)** | Grok-2 |

API keys are stored locally in your browser (Chrome extension storage) and never transmitted to SF Toolkit infrastructure.

---

## What the AI Agent can do

### Salesforce org operations

The agent can execute actions directly against your connected org:

- **Run SOQL queries** — write and execute SOQL in natural language; results are returned as a table.
- **Describe objects and fields** — explore the schema of any SObject, including field types, relationships, and picklist values.
- **Execute Anonymous Apex** — run Apex snippets to automate tasks or test logic on the fly.
- **Read and write metadata** — retrieve, inspect, and deploy metadata components such as Apex classes, Flows, Custom Fields, and Permission Sets.
- **Manage deployments** — trigger deploys, check source status, and review change sets.

### Virtual file system

The agent has full access to your **IndexedDB-backed virtual workspace** — a file system that lives inside your browser:

- List directories, glob files, and search file contents with grep.
- Read and write any file in the workspace (Apex, LWC, metadata XML, SOQL, etc.).
- Create, edit, and delete files with path-aware validation.
- Open files directly in the integrated VS Code editor.

This means the agent can scaffold components, patch Apex code, generate metadata, and commit changes — all without touching your local file system.

See [IndexedDB virtual workspace](../storage/indexeddb-workspace) for a full description of how the storage layer works.

### Browser navigation automation

The agent can drive the Workbench UI programmatically:

- Navigate to any page or tool within the Workbench (SOQL Explorer, Metadata Explorer, API Explorer, etc.).
- Trigger UI actions such as opening modals, switching tabs, or loading records.
- Chain multi-step workflows — for example: "query all Apex classes modified this week, open each in the editor, and add a `@SuppressWarnings` annotation".

### Shell and bash

A sandboxed bash tool lets the agent run shell commands within the Workbench environment:

- Run Salesforce CLI (`sf` / `sfdx`) commands.
- Execute scripts for data transformation, manifest generation, or CI-style checks.
- All destructive commands (file writes, deletions, shell execution) require explicit confirmation before they run.

---

## Safety and confirmations

The agent is designed to be transparent about side effects:

- **Confirmation prompts** appear before any write, deploy, delete, or shell command is executed.
- **Workspace boundaries** are enforced — the agent cannot access paths outside your configured workspace.
- **Large outputs** are automatically truncated to prevent runaway context usage.
- You can cancel any in-progress action at any time.

---

## Related docs

- [AI Agent Tools Overview](./tools-overview)
- [IndexedDB virtual workspace](../storage/indexeddb-workspace)
- [Local data and privacy](../security/local-data-and-privacy)
