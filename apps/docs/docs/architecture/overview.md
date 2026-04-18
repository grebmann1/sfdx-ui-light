---
title: Architecture Overview
---

# Architecture Overview

Workbench is a monorepo that builds the same core product across two deployment surfaces: a **browser extension** and an **Electron desktop app**. All surfaces share a common LWC frontend and TypeScript library.

## Monorepo layout

```
sf-toolkit-web/
├── apps/
│   ├── docs/          ← Docusaurus documentation site
│   └── ui/            ← Welcome / marketing site (Vite + React)
├── packages/
│   ├── lwc/           ← LWC OSS frontend (LWR + Rollup)
│   ├── vscode/        ← Embedded VS Code workbench runtime
│   ├── server/        ← Express + LWR Node server
│   ├── shared/        ← Cross-package TypeScript modules
│   ├── extension/     ← Chrome/browser extension entry
│   ├── desktop/       ← Electron desktop wrapper
│   └── workers/       ← Web workers (metadata, AI, access analyzer)
└── tools/
    └── build/         ← Rollup config files for all targets
```

## Core packages

### `packages/lwc` — LWC OSS frontend

The main browser UI, built with [Lightning Web Components (open source)](https://lwc.dev/), LWR, and Rollup. It contains every feature surface users interact with:

- **`app/application/`** — SOQL, metadata, API explorer, Apex runner, org browser, data import, code analyzer, platform events, record viewer, file explorer, packages
- **`app/agent/`** — AI agent UI: streaming chat, tool calls, reasoning, audio recording
- **`app/editor/`** — Monaco-based code editor, diff editor, file tree, SOQL editor
- **`app/core/`** — Salesforce connector session, IndexedDB file system, Redux store, i18n, worker bridge
- **`app/vscode/fullApp/`** — LWC component that owns the VS Code iframe and all bridge hosts
- **`web-extension/`** — Browser-extension-specific UI panels

The same `lwc` codebase compiles to all three surfaces. The Rollup build reads `BUNDLE_TARGET` to include or exclude surface-specific modules.

### `packages/vscode` — Embedded VS Code workbench

A standalone TypeScript project that runs **inside a sandboxed `<iframe>`**. It loads the VS Code web workbench along with custom Salesforce extensions and connects back to the parent LWC app via typed bridges.

Key areas under `src/workbench/`:

| Folder | Purpose |
|---|---|
| `bridge/` | Bridge runtime adapters that wire incoming RPC calls to VS Code internal APIs |
| `extensions/` | Salesforce VS Code extension activations (Apex, SOQL, LWC, AI, org browser, metadata) |
| `workspace/` | Workspace bootstrap and virtual file seeding |
| `connection/` | Salesforce connection management inside the workbench |

### `packages/server` — Express + LWR server

Serves the LWC SPA via LWR and exposes backend API routes:

- LLM proxy (routes AI inference to OpenAI, Anthropic, Google, xAI based on config)
- General Salesforce API proxy
- Documentation search

### `packages/shared` — Cross-package TypeScript library

Pure TypeScript compiled with `tsc` and imported by both `lwc` and `vscode`. It is the canonical location for cross-cutting concerns:

| Module | Purpose |
|---|---|
| `llm/` | LLM provider / model normalization |
| `cacheManager/` | LocalForage-based cache |
| `metadataApi/` | Salesforce Metadata API client helpers |
| `toolingApi/` | Salesforce Tooling API client helpers |
| `store/` | Redux store definitions |
| `utils/` | String, DOM, async, formatting, env detection utilities |
| `types/` | Shared TypeScript type definitions |

## Iframe + bridge architecture

The VS Code workbench runs in a sandboxed `<iframe>` served at its own origin. The parent LWC app communicates with it through three independent **`MessageChannel`-based bridges**, each with a typed contract file.

```
LWC fullApp (parent window)
  ├── IframeFsBridgeHost   ──── MessagePort ────▶  VS Code workbench (iframe)
  │     ↕ IndexedDB FS                                FileSystemProvider
  ├── IframeJsforceBridgeHost ─ MessagePort ────▶  JsforceBridgeRuntime
  │     ↕ jsforce session                              (SOQL, Apex, Metadata)
  └── IframeAiBridgeHost   ──── MessagePort ────▶  AiBridgeRuntime
        ↕ LLM provider SDK                             (streaming AI chat)
```

### Handshake protocol

All bridges use the same port-handshake flow:

1. The iframe detects bridge enablement via URL query params (`?fsBridge=1&jsforceBridge=1&aiBridge=1`).
2. The iframe sends `HELLO` messages to `window.parent` on a 450 ms retry until a timeout.
3. The parent creates a `MessageChannel` and transfers one `MessagePort` to the iframe.
4. The iframe starts the port, sends `READY`, and all subsequent communication uses the dedicated `MessagePort`.

### The three bridges

| Bridge | What it exposes to VS Code |
|---|---|
| **FS Bridge** | The IndexedDB virtual file system — VS Code registers a `FileSystemProvider` backed by IndexedDB via the bridge. All `stat`, `readdir`, `readFile`, `writeFile`, `mkdir`, `rm`, `mv` calls traverse the bridge. |
| **Jsforce Bridge** | The active Salesforce session — VS Code calls `soql.execute`, `apex.executeAnonymous`, `metadata.list`, `metadata.retrieve`, and similar methods without managing its own auth. |
| **AI Bridge** | The configured LLM provider — VS Code streams AI responses (text, reasoning, tool calls) back through the bridge without direct access to API keys. |

Each bridge has a matching `*Contract.ts` file that defines all message types, method names, and data shapes as TypeScript `const` assertions, giving compile-time safety across the iframe boundary.

## State management

The LWC frontend uses **Redux Toolkit** (`@reduxjs/toolkit`) for global state, with store definitions shared via `packages/shared/store`. LWC components access the store through a custom `ToolkitElement` base class and a `core/storeContext` context pattern.

## Build and deployment targets

| Target | Entry | Key build config |
|---|---|---|
| Browser extension | `packages/extension` | `tools/build/rollup.extension.mjs` |
| Electron desktop | `packages/desktop` | `tools/build/rollup.desktop.mjs` |
| Self-hosted server | `packages/server` + LWR | `tools/build/rollup.app.mjs` |

All targets consume the same compiled `packages/lwc` and `packages/shared` output.

## Related docs

- [VS Code workflows](../vscode/overview)
- [IndexedDB virtual file system](../storage/indexeddb-workspace)
- [AI Agent tools](../ai-agent/tools-overview)
- [CLI usage](../cli/overview)
