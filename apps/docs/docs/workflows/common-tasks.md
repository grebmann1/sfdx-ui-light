---
title: Common Workflows
---

# Common Workflows

This page highlights frequent day-to-day flows for admins and developers.

## Session prep checklist

- Confirm you are connected to the intended org (sandbox vs production).
- Verify auth/session state before running metadata or data operations.
- Start with read-only checks before any write/deploy workflow.

## Org exploration

1. Open `/app/org` to inspect org identity, API context, and available capabilities.
2. Use object and metadata explorers to review schema before writing queries or scripts.
3. Validate object/field shape changes before running deployment or data jobs.

## SOQL and data checks

1. Use `/app/soql` for query authoring and fast validation.
2. Start with small limits (`LIMIT 10`) and add selective filters early.
3. Confirm row counts and field coverage before reusing a query in automation.
4. Save/share known-good query templates with your team.

## Metadata tasks

1. Use `/app/metadata` to browse metadata types and members.
2. Verify dependencies and impacted components before deploying changes.
3. Keep a retrieve/export backup flow for risky operations.
4. Prefer smaller deployment batches to reduce rollback complexity.

## API testing

1. Open `/app/api` and run lightweight `GET` checks first.
2. Validate status codes and response schema before trying mutating requests.
3. For `POST`/`PATCH`, start with minimal payloads and expand incrementally.
4. Keep reusable request examples in shared team docs or runbooks.

## Embedded VS Code workflow

- Open the VS Code-style workbench when you need extension-style commands and project navigation.
- Use metadata/org-browser/SOQL extension surfaces for integrated workflows in one shell.
- Check [VS Code extension parity](../vscode/extension-parity) for current capability coverage.

## Release and operations

- Run `npm run check` before sharing changes.
- Run `npm run build:web:all` for a full website + app build signal.
- Use `npm run start:prod:web` when you need production-like local verification.
- When debugging deployment issues, inspect docs (`/docs`) and runtime logs together.
