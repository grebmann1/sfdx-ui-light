# OSS LWC Specialist (reference)

Use this file only when you need more detail than `SKILL.md` provides.

## Repo-specific notes

- **LWC build**: Rollup uses `@lwc/rollup-plugin` with `enableDynamicComponents: true` and a `modules` list that includes:
  - `src/client/lwc/modules`
  - `src/client/lwc/components`
  - application module dirs under `src/client/lwc/applications/**`
  - optional `lightning-base-components`
- **Namespace imports**: Rollup builds alias entries so imports like `shared/utils` resolve to `src/client/lwc/modules/shared/utils/utils.js` (and similar).

### Creating a new OSS LWC module/component

1. Pick the correct root:
   - Shared modules: `src/client/lwc/modules/<namespace>/<component>/`
   - App-scoped components: `src/client/lwc/applications/<area>/<app>/...`
2. Use the standard naming convention:
   - `<component>.js`
   - `<component>.html`
   - `<component>.css` (optional)
3. Keep exports/internal API consistent with neighboring components.

## LWC reactivity patterns (OSS)

- **Objects/arrays**: update immutably.

  Prefer:
  - `this.items = [...this.items, newItem]`
  - `this.state = { ...this.state, loading: true }`

  Avoid:
  - `this.items.push(newItem)`
  - mutating nested fields without changing the top-level reference

- **Template getters**: keep them cheap and deterministic; avoid network calls, parsing, sorting, and deep clones.

## Template + DOM guidance

- Prefer conditional rendering (`if:true/if:false`) and `for:each` over manual DOM manipulation.
- If you must access DOM:
  - Do it in `renderedCallback()`
  - Cache refs that won’t change
  - Avoid `querySelector` inside tight loops

## Security checklist (OSS LWC)

- [ ] No `innerHTML`/`outerHTML`/`insertAdjacentHTML`.
- [ ] No `eval`/`new Function`/dynamic `<script>`.
- [ ] Treat connection/org/session data as secrets (no logs, no leaking into the DOM).
- [ ] Validate external inputs (query params, storage, API responses) before using them.
- [ ] Prefer setting text via template bindings rather than manual DOM updates.

## Performance checklist (OSS LWC)

- [ ] Avoid expensive work in getters referenced by the template.
- [ ] Debounce high-frequency handlers (scroll/resize/input) when appropriate.
- [ ] Offload CPU-heavy work to workers when it impacts UI responsiveness.
- [ ] Keep worker payloads small; transfer large buffers when applicable.
- [ ] Don’t re-create large arrays/objects unless needed; compute derived values on change boundaries.

## “Good defaults” for worker usage

- Use a worker when you see:
  - parsing large inputs (XML/JSON/CSV)
  - diffing/analysis across many lines/files
  - full-text indexing/search operations
- Ensure worker messages are structured-clone safe:
  - primitives, plain objects, arrays, `ArrayBuffer`/typed arrays
  - no DOM nodes, functions, class instances with methods

