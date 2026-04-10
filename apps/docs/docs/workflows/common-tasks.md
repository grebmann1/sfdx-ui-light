---
title: Common Workflows
---

# Common Workflows

This page highlights frequent day-to-day flows for admins and developers.

## Org exploration

- Open `/app/org` to inspect org-level context.
- Use object and metadata views to discover model details.
- Validate shape changes before running scripts or data jobs.

## SOQL and data checks

- Use `/app/soql` for query authoring and quick validation.
- Start with small limits and add filters early.
- Save and share known-good queries with your team.

## Metadata tasks

- Use `/app/metadata` to browse and inspect metadata assets.
- Verify dependencies before changes.
- Keep a backup/export flow for risky operations.

## API testing

- Open `/app/api` and test with minimal payloads first.
- Validate response status and schema before moving to automation.
- Keep reusable request examples in your team docs.

## Release and operations

- Run `npm run check` before sharing large changes.
- Use `npm run build:web:all` to validate full website + app build.
- When debugging deployment issues, check docs at `/docs` and app logs together.
