---
title: Common Issues
---

# Common Issues

## Website shows old content

- Run a clean build with `npm run build:web:all`.
- Restart the production server with `npm run start:prod:server`.
- Hard-refresh the browser to bypass stale cached assets.

## LWR hot reload inconsistencies

```bash
rm -rf __lwr_cache__
npm run start:dev:web
```

If you run full-site dev, restart `npm run site:dev` after clearing cache.

## Port already in use

If local startup fails because port `3000` is occupied, either:

- stop the conflicting process, or
- set a new `PORT` value in `.env` and restart.

## OAuth callback problems

- Verify `CLIENT_ID` and `CLIENT_SECRET` in `.env`.
- Ensure redirect URI matches your connected app configuration.
- Confirm `PORT` aligns with your local callback URL.
- Re-authenticate after updating callback or credential values.

## Check/lint fails unexpectedly

- Re-run `npm install` if dependencies changed recently.
- Run `npm run lint` first to isolate style/static issues.
- Run `npm run check` after fixes to validate expected quality gates.

## Still blocked?

- Gather logs, route, and reproduction steps.
- Open an issue via [Reporting Issues and Requests](../contributing/reporting-issues).
