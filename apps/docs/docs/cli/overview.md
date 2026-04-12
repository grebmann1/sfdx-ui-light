---
title: CLI Usage
---

# CLI Usage

The repository exposes npm scripts for local runtime, build, and validation workflows.

## Development entry points

```bash
npm run start:dev:web
npm run site:dev
npm run start:dev:desktop
```

- `start:dev:web`: runs the main app/web runtime with shared watchers.
- `site:dev`: runs welcome site + docs + app together for full local site work.
- `start:dev:desktop`: launches desktop-specific dev workflow.

## Build and production-like commands

```bash
npm run build:web
npm run build:web:all
npm run start:prod:web
```

- `build:web`: builds shared/server/web application output.
- `build:web:all`: builds welcome site + docs + web app in one flow.
- `start:prod:web`: runs production-oriented build + server sequence.

## Website/docs-focused commands

```bash
npm run ui:dev
npm run docs:dev
npm run site:build
```

- `ui:dev`: starts the welcome website only.
- `docs:dev`: starts documentation site only.
- `site:build`: builds website and docs bundle outputs.

## Quality checks

```bash
npm run lint
npm run check
npm run validate
```

- `lint`: ESLint + Prettier check over configured source scopes.
- `check`: repo quality gate used before sharing changes.
- `validate`: wider validation pipeline including build targets.

## Practical daily loop

1. Run `npm run start:dev:web` (or `npm run site:dev` when editing docs/site UI).
2. Implement and verify the targeted workflow in the app.
3. Run `npm run check` before opening a PR.
4. Run `npm run build:web:all` for end-to-end web/docs confidence when needed.
