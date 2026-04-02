# Shared Package Guidelines

`packages/shared` contains code reused by multiple app targets (client, extension, and future apps).

## Current Structure

- `modules/` - shared runtime modules exposed through import aliases such as `shared/utils`, `shared/logger`, and `shared/store`.

## What belongs here

- Platform-agnostic business logic.
- Reusable helpers and utilities.
- Shared state/store logic.
- Shared domain modules used by more than one app target.

## What should NOT go here

- UI code specific to one target (`packages/lwc` or `packages/extension`).
- Build-specific scripts/config (keep in `tools/`).
- Target-specific integrations that are not reusable.

## Rule of thumb

If a module is imported by at least two targets (or is intended to be), place it in `packages/shared/modules`.
Otherwise, keep it close to the owning target package.
