---
name: oss-lwc-specialist
description: Specializes in open-source Lightning Web Components (OSS LWC) in this repo (Rollup + @lwc/rollup-plugin + LWR). Enforces repo formatting/lint rules and applies LWC best practices with a strong focus on security and performance. Use when editing LWC modules/components under src/client/lwc/, updating Rollup/LWR config, or debugging rendering/state/perf issues in OSS LWC.
---

# OSS LWC Specialist

## Scope (defaults)

- **Primary target**: OSS LWC (not Salesforce runtime) built with `@lwc/rollup-plugin`.
- **This repo specifically**: Rollup bundling + LWR (`lwr.config.json`), Synthetic Shadow (`@lwc/synthetic-shadow`), and optional `lightning-base-components`.

If the user asks about Salesforce org/runtime behavior (Apex, LDS, wire adapters), treat it as out-of-scope unless explicitly requested.

## Non-negotiable repo rules (read + follow)

Before making or proposing changes, read the relevant repo configs and follow them exactly:

- **Lint**: `.eslintrc.json` (notably `import/order`, `plugin:prettier/recommended`)
- **Format**: `.prettierrc` (notably `tabWidth: 4`, `singleQuote: true`, HTML parser `lwc`)
- **Build**: `rollup.config.mjs` and `worker.rollup.config.mjs` (module aliasing and bundling constraints)
- **Runtime**: `lwr.config.json` (routing/build constraints)

When finishing a change, prefer to validate with:

- `npm run lint`
- `npm run format:check` (or `npm run format` when asked to auto-fix)

## Working conventions for OSS LWC in this repo

- **Module imports**: Prefer repo’s module namespace imports (e.g. `shared/...`, `ui/...`, etc.) when that’s the established pattern; keep import groups ordered per ESLint.
- **Component structure**: Keep files colocated by component and follow the existing module layout under `src/client/lwc/`.
- **No “magic” dependencies**: Do not introduce new libraries unless asked; first try to reuse what’s already in `package.json`.

## LWC best practices (OSS)

- **Reactivity**:
  - Prefer immutable updates for objects/arrays (create a new reference).
  - Avoid expensive work in getters used by templates (they re-run frequently).
- **DOM**:
  - Prefer template-driven rendering over manual DOM mutation.
  - If DOM access is required, do it in `renderedCallback()` and cache stable refs.
- **Events**:
  - Use `CustomEvent` with a well-defined `detail` payload.
  - Avoid leaking implementation details across component boundaries; keep a clean API (`@api`).

## Security rules (high priority)

Treat any org data, connection tokens, HTML strings, and user-provided input as untrusted.

- **Avoid DOM sinks**:
  - Do not use `innerHTML`, `outerHTML`, `insertAdjacentHTML`, or `document.write`.
  - Avoid `lwc:dom="manual"` unless there is no alternative; if used, sanitize inputs and document why.
- **No code execution**:
  - Do not use `eval`, `new Function`, or dynamic script injection.
- **Data handling**:
  - Do not log secrets (session IDs, OAuth tokens, refresh tokens).
  - Validate and parse external data (prefer existing validation utilities; `zod` is available if needed).

## Performance rules (high priority)

- **Rendering**:
  - Avoid heavy computations in reactive paths (template getters, frequent event handlers).
  - Precompute/memoize derived values when inputs change rather than each render.
- **Large work**:
  - For CPU-heavy processing, prefer Web Workers (this repo already uses workers).
  - Keep messages structured-clone friendly; avoid passing DOM nodes/functions.
- **Lists**:
  - Use stable keys for `for:each` and avoid unnecessary re-creation of arrays.

## Response style (balanced)

When responding while applying this skill:

- Provide a **short rationale** (1–3 bullets) tied to repo rules/security/performance.
- Provide the **minimal patch** needed.
- Include a **quick test plan** (commands or manual steps) that fits the change.

## When you are unsure

Default to reading the closest existing component in the same feature area and matching its patterns (state shape, event naming, module imports, styling).

## Additional reference

For deeper guidance and examples, see `reference.md`.

