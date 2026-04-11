---
title: VS Code Extension Parity
---

# VS Code Extension Parity

This document inventories the user-facing functionality exposed by the embedded workbench extensions under `packages/lwc/app/vscode/fullApp/extensions` and compares it with the user-facing functionality available in the upstream Salesforce VS Code packages under `/Users/grebmann/Documents/salesforce/projects/vscode-extensions/salesforcedx-vscode/packages`.

## Scope

- Focus is on user-facing commands, views, walkthroughs, language support, testing/debugging surfaces, and notable workflows.
- Upstream infrastructure-only packages are intentionally excluded from the parity matrix.
- Status meanings:
  - `Present`: a clear local equivalent exists.
  - `Partial`: some of the workflow exists locally, but the upstream package is broader or richer.
  - `Missing`: no meaningful local equivalent was found.
  - `Local only`: provided by the embedded workbench but not by a comparable upstream package.

## Local Extension Inventory

| Local extension | Main surfaces | What it currently provides |
|---|---|---|
| `workbench-ai` | Default chat participant in panel/editor/terminal, language model provider, editor-context and editor-edit AI tools | Embedded agent experience for ask/edit/agent workflows inside the workbench. |
| `sf-metadata` | Salesforce panel, command palette commands, editor context sync, Explorer context manifest generation | Core metadata workflows: project sync, source status, pull remote changes, manifest retrieve/deploy, Metadata API actions, namespace report, output panel, API version management, open agent chat. |
| `sf-org-browser` | Activity bar container, org browser tree view, refresh/retrieve/collapse commands | Browse metadata types and members from the connected org and retrieve them into the workspace. |
| `sf-soql-workbench` | `Schema` tree view in the Salesforce panel, `.soql` language support, command palette commands, CodeLens in `.soql` files | Run SOQL and Tooling queries, open a scratch `.soql` file, browse schema, refresh schema cache, and get org-aware completions. |
| `sf-lwc` | Command palette commands, editor context actions, Explorer context scaffold action, status bar auto-deploy toggle | Generic JS/HTML/CSS editing, LWC snippets, LWC scaffolding, deploy/fetch/diff current file, deploy changed files, auto-deploy on save, LWC lint command. |
| `sf-apex` | Command palette commands, Apex language grammar, Apex CodeLens action | Execute anonymous Apex, run Apex tests, enable/open debug logs, basic Apex editor support. |
| `agentscript-extension` | `.agent` / `.afscript` language support | Agent Script syntax and browser language-server support. |
| `workbench-walkthrough` | Welcome walkthrough and open command | Embedded onboarding flow explaining org context, workbench limits, and suggested first steps. |

## Upstream Package Inventory

Only packages with meaningful end-user surfaces are included below.

| Upstream package | Main surfaces | What it provides | Include in parity |
|---|---|---|---|
| `salesforcedx-vscode` | Extension pack | Installs the main Salesforce extension bundle. | No |
| `salesforcedx-vscode-core` | Broad command palette surface, generators, source tracking, conflict workflows | Core Salesforce project/org workflows: manifest generation, deploy/retrieve/delete/diff, local/remote change views, package install, project create, assorted generators. | Yes |
| `salesforcedx-vscode-apex` | Apex language support, snippets, Apex LS restart | Apex authoring support centered on language services. | Yes |
| `salesforcedx-vscode-apex-log` | Commands for anonymous Apex, log retrieval, trace flags, generators | Anonymous Apex execution plus log and trace-flag workflows. | Yes |
| `salesforcedx-vscode-apex-debugger` | Debugger type and debugger commands | Interactive Apex debugging. | Yes |
| `salesforcedx-vscode-apex-replay-debugger` | Replay debugger commands, checkpoints view, debug launch configs | Log-based Apex replay debugging with checkpoints. | Yes |
| `salesforcedx-vscode-apex-testing` | VS Code Testing integration, test explorer, test suites, coverage/reporting | Rich Apex test management and UI. | Yes |
| `salesforcedx-vscode-lwc` | LWC language support, snippets, Jest test explorer, watch/debug test commands | LWC authoring plus Jest test workflows. | Yes |
| `salesforcedx-vscode-lightning` | Aura language support | Aura authoring support. | Yes |
| `salesforcedx-vscode-metadata` | Metadata-prefixed retrieve/deploy/delete/diff/source tracking surface | Alternate metadata-centric command surface overlapping with core. | Yes |
| `salesforcedx-vscode-org` | Org auth and lifecycle commands | Authorize orgs and Dev Hubs, create/delete/open orgs, display org details, set defaults, logout. | Yes |
| `salesforcedx-vscode-org-browser` | Org Browser tree view and retrieve actions | Dedicated org metadata browser and retrieve UI. | Yes |
| `salesforcedx-vscode-soql` | SOQL language support, SOQL Builder, query run/explain workflows, results UI | SOQL authoring and execution with visual builder and results surfaces. | Yes |
| `salesforcedx-vscode-visualforce` | Visualforce language support | Visualforce syntax, validation, and editor support. | Yes |

### Upstream Packages Excluded as Infrastructure

- `salesforcedx-vscode-services`
- `salesforcedx-vscode-services-types`
- `salesforcedx-vscode-i18n`
- `salesforcedx-utils`
- `salesforcedx-utils-vscode`
- `effect-ext-utils`
- `soql-common`
- `salesforcedx-apex-debugger`
- `salesforcedx-apex-replay-debugger`
- `salesforcedx-lwc-language-server`
- `salesforcedx-aura-language-server`
- `salesforcedx-lightning-lsp-common`
- `salesforcedx-visualforce-language-server`
- `salesforcedx-visualforce-markup-language-server`
- `playwright-vscode-ext`
- `salesforcedx-vscode-automation-tests`
- `eslint-local-rules`

## Package Mapping

| Local extension | Closest upstream package(s) | Notes |
|---|---|---|
| `sf-metadata` | `salesforcedx-vscode-core`, `salesforcedx-vscode-metadata`, part of `salesforcedx-vscode-org` | Local metadata extension combines core metadata operations plus some workbench-specific UX. |
| `sf-org-browser` | `salesforcedx-vscode-org-browser` | Very direct match. |
| `sf-soql-workbench` | `salesforcedx-vscode-soql` | Local implementation covers text-query workflows well but not the full Builder/results surface. |
| `sf-lwc` | `salesforcedx-vscode-lwc`, parts of `salesforcedx-vscode-core` | Local version focuses on scaffolding and source workflows, not LWC test tooling. |
| `sf-apex` | `salesforcedx-vscode-apex`, `salesforcedx-vscode-apex-log`, a small slice of `salesforcedx-vscode-apex-testing` | Local version is intentionally narrower than the full upstream Apex stack. |
| `workbench-ai` | None | Workbench-specific feature area. |
| `agentscript-extension` | None | Workbench-specific feature area. |
| `workbench-walkthrough` | No direct package equivalent | Upstream packages have targeted walkthroughs, but not a matching embedded-workbench welcome flow. |

## Feature Parity Matrix

| Capability area | Functionality | Local provider(s) | Local status | Upstream provider(s) | Gap or note |
|---|---|---|---|---|---|
| Workbench shell | Embedded AI chat participant with ask/edit/agent modes | `workbench-ai` | Local only | None | Unique to this workbench. |
| Workbench shell | Welcome walkthrough for embedded Salesforce workbench | `workbench-walkthrough` | Local only | No direct equivalent | Unique onboarding flow. |
| Workbench shell | Salesforce side panel with connection-aware actions | `sf-metadata`, `sf-soql-workbench` | Local only | No direct equivalent | Useful local UX shell that aggregates several commands. |
| Metadata and source | Set workspace API version | `sf-metadata` | Present | `salesforcedx-vscode-core` | Clear local equivalent exists. |
| Metadata and source | Sync project from org with fetch/update/delete behavior | `sf-metadata` | Present | `salesforcedx-vscode-core`, `salesforcedx-vscode-metadata` | Local workbench has an explicit sync flow. |
| Metadata and source | Source status / change visibility | `sf-metadata` | Present | `salesforcedx-vscode-core`, `salesforcedx-vscode-metadata` | Local source-status command exists. |
| Metadata and source | Pull remote changes with conflict handling | `sf-metadata` | Present | `salesforcedx-vscode-core`, `salesforcedx-vscode-metadata` | Local flow includes conflict prompts. |
| Metadata and source | Generate manifest file from source selection | `sf-metadata` | Present | `salesforcedx-vscode-core`, `salesforcedx-vscode-metadata` | Recently implemented locally. |
| Metadata and source | Retrieve source from `package.xml` | `sf-metadata` | Present | `salesforcedx-vscode-core`, `salesforcedx-vscode-metadata` | Local workbench supports Tooling API and Metadata API variants. |
| Metadata and source | Ad hoc Metadata API retrieve by type/member picker | `sf-metadata` | Present | `salesforcedx-vscode-core` | Local version has a useful picker workflow. |
| Metadata and source | Deploy source from `package.xml` | `sf-metadata` | Present | `salesforcedx-vscode-core`, `salesforcedx-vscode-metadata` | Local deploy and validate flows exist. |
| Metadata and source | Validate deploy without committing changes | `sf-metadata` | Present | `salesforcedx-vscode-core`, `salesforcedx-vscode-metadata` | Clear local equivalent exists. |
| Metadata and source | Diff local source against org source | `sf-lwc` | Present | `salesforcedx-vscode-core`, `salesforcedx-vscode-metadata` | Local diff is exposed for current files. |
| Metadata and source | Fetch current file from org | `sf-lwc` | Present | `salesforcedx-vscode-core`, `salesforcedx-vscode-metadata` | Local current-file fetch is in place. |
| Metadata and source | Deploy current file to org | `sf-lwc` | Present | `salesforcedx-vscode-core`, `salesforcedx-vscode-metadata` | Local current-file deploy is in place. |
| Metadata and source | Review and deploy changed files | `sf-lwc` | Present | `salesforcedx-vscode-core`, `salesforcedx-vscode-metadata` | Local flow is narrower but real. |
| Metadata and source | Auto-deploy on save | `sf-lwc` | Local only | No clear upstream equivalent | Workbench-specific convenience workflow. |
| Metadata and source | Delete source from org/project | None found | Missing | `salesforcedx-vscode-core`, `salesforcedx-vscode-metadata` | Clear upstream gap. |
| Metadata and source | Reset remote source tracking | None found | Missing | `salesforcedx-vscode-metadata` | Not surfaced locally. |
| Metadata and source | Package installation into org | None found | Missing | `salesforcedx-vscode-core` | No local equivalent found. |
| Metadata and source | Project creation / DX project scaffolding | None found | Missing | `salesforcedx-vscode-core` | Upstream project bootstrap is absent locally. |
| Metadata and source | Additional generators beyond LWC, such as Aura/Visualforce/analytics assets | None found | Missing | `salesforcedx-vscode-core` | Local scaffolding is currently limited. |
| Metadata and source | Namespace / managed-package report | `sf-metadata` | Local only | No clear upstream equivalent | Helpful local diagnostic workflow. |
| Metadata and source | Dependency / where-used lookup | `sf-metadata` | Local only | No clear upstream equivalent | Useful local analysis workflow. |
| Org browser | Dedicated org metadata browser view | `sf-org-browser`, legacy open command in `sf-metadata` | Present | `salesforcedx-vscode-org-browser` | Strong parity. |
| Org browser | Retrieve selected metadata directly from org browser nodes | `sf-org-browser` | Present | `salesforcedx-vscode-org-browser` | Strong parity. |
| SOQL and schema | SOQL language support for `.soql` files | `sf-soql-workbench` | Present | `salesforcedx-vscode-soql` | Local equivalent exists. |
| SOQL and schema | Org-aware SOQL completions | `sf-soql-workbench` | Present | `salesforcedx-vscode-soql` | Local equivalent exists. |
| SOQL and schema | Schema explorer tree with insert-at-cursor behavior | `sf-soql-workbench` | Partial | `salesforcedx-vscode-soql` | Local schema explorer is useful, but upstream also has richer Builder-driven discovery. |
| SOQL and schema | Run SOQL query from command palette or file | `sf-soql-workbench` | Present | `salesforcedx-vscode-soql` | Strong parity for text-query execution. |
| SOQL and schema | Run Tooling query | `sf-soql-workbench` | Partial | `salesforcedx-vscode-soql` | Local includes tooling-query execution; upstream emphasis is broader SOQL UX rather than explicit Tooling query parity. |
| SOQL and schema | SOQL scratch file | `sf-soql-workbench` | Present | `salesforcedx-vscode-soql` | Local equivalent exists. |
| SOQL and schema | Visual SOQL Builder UI | None found | Missing | `salesforcedx-vscode-soql` | Significant upstream workflow gap. |
| SOQL and schema | Query plan / explain plan workflows | None found | Missing | `salesforcedx-vscode-soql` | Significant upstream workflow gap. |
| SOQL and schema | Dedicated results viewer and export UX | Markdown/JSON/CSV file generation in `sf-soql-workbench` | Partial | `salesforcedx-vscode-soql` | Local output works, but it is not the richer upstream results UI. |
| Apex | Apex syntax/language support | `sf-apex` | Partial | `salesforcedx-vscode-apex` | Local provides grammar/basic editor behavior, not the full Apex language-service surface. |
| Apex | Execute anonymous Apex | `sf-apex` | Present | `salesforcedx-vscode-apex-log` | Strong parity for the basic workflow. |
| Apex | Run Apex tests | `sf-apex` | Partial | `salesforcedx-vscode-apex-testing` | Local can run tests and generate reports, but lacks the full upstream testing UI. |
| Apex | Debug-log retrieval and trace flag management | `sf-apex` | Present | `salesforcedx-vscode-apex-log` | Local equivalent exists for the main workflow. |
| Apex | Native Apex Test Explorer integration | None found | Missing | `salesforcedx-vscode-apex-testing` | Important upstream gap. |
| Apex | Apex test suites | None found | Missing | `salesforcedx-vscode-apex-testing` | Not implemented locally. |
| Apex | Coverage highlighting and richer Apex test result UI | Markdown report only in `sf-apex` | Partial | `salesforcedx-vscode-apex-testing` | Local reporting exists, but not the full coverage UI. |
| Apex | Interactive Apex debugger | None found | Missing | `salesforcedx-vscode-apex-debugger` | No local equivalent found. |
| Apex | Apex replay debugger with checkpoints | None found | Missing | `salesforcedx-vscode-apex-replay-debugger` | No local equivalent found. |
| LWC | LWC snippets | `sf-lwc` | Present | `salesforcedx-vscode-lwc` | Strong parity for snippets. |
| LWC | LWC component scaffolding | `sf-lwc` | Present | `salesforcedx-vscode-core`, `salesforcedx-vscode-lwc` | Local equivalent exists. |
| LWC | LWC-focused language-service support | Generic JS/HTML/CSS support in `sf-lwc` | Partial | `salesforcedx-vscode-lwc` | Local editing support is useful but lighter than the upstream LWC language service. |
| LWC | LWC Jest test explorer | None found | Missing | `salesforcedx-vscode-lwc` | Important upstream gap. |
| LWC | LWC Jest watch/debug commands | None found | Missing | `salesforcedx-vscode-lwc` | Important upstream gap. |
| Other UI frameworks | Aura language support | None found | Missing | `salesforcedx-vscode-lightning` | Clear upstream gap. |
| Other UI frameworks | Visualforce language support | None found | Missing | `salesforcedx-vscode-visualforce` | Clear upstream gap. |
| Org lifecycle | Authorize org / Dev Hub | None found | Missing | `salesforcedx-vscode-org` | Major upstream gap. |
| Org lifecycle | Login with access token | None found | Missing | `salesforcedx-vscode-org` | Major upstream gap. |
| Org lifecycle | Logout default or all orgs | None found | Missing | `salesforcedx-vscode-org` | Major upstream gap. |
| Org lifecycle | Create scratch org | None found | Missing | `salesforcedx-vscode-org` | Major upstream gap. |
| Org lifecycle | Open default org or display org details | None found | Missing | `salesforcedx-vscode-org` | Major upstream gap. |
| Org lifecycle | Delete org and clean auth list | None found | Missing | `salesforcedx-vscode-org` | Major upstream gap. |
| Org lifecycle | Set default org | None found | Missing | `salesforcedx-vscode-org` | Major upstream gap. |
| Workbench-only utilities | Install external VS Code extensions from Open VSX | `sf-metadata` | Local only | None | Workbench-specific helper. |
| Workbench-only utilities | Open embedded agent chat from Salesforce workflows | `sf-metadata` | Local only | None | Workbench-specific helper. |
| Workbench-only utilities | Agent Script language support | `agentscript-extension` | Local only | None | No comparable upstream package in the reviewed set. |

## High-Level Findings

- Strongest local coverage:
  - Core metadata sync, retrieve, deploy, manifest generation, and org browser workflows.
  - Basic SOQL execution and schema browsing.
  - Practical LWC source workflows such as scaffold, fetch, deploy, diff, and changed-file deploy.
  - Practical Apex workflows such as anonymous Apex, test execution, and debug-log retrieval.
- Biggest upstream gaps:
  - Full org lifecycle management from `salesforcedx-vscode-org`.
  - Apex debugger, replay debugger, checkpoints, and native Apex Testing UI.
  - LWC Jest test explorer, watch mode, and debug flows.
  - Aura and Visualforce editor support.
  - SOQL Builder, query plan, and richer results UX.
  - Broader project/generator flows from `salesforcedx-vscode-core`, especially delete-source, package install, project create, and additional generators.
- Biggest workbench-only strengths:
  - Embedded AI chat as a first-class workflow.
  - A single Salesforce panel that pulls together connection-aware actions.
  - Embedded-workbench onboarding and a few useful custom diagnostics such as namespace reporting and dependency lookup.
