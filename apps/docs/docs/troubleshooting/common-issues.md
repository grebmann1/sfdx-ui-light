---
title: Common Issues
---

# Common Issues

## Website shows old content

- Run a clean build with `npm run build:web:all`.
- Restart the production server with `npm run start:prod:server`.

## LWR hot reload inconsistencies

```bash
rm -rf __lwr_cache__
npm run start:dev:web
```

## OAuth callback problems

- Verify `CLIENT_ID` and `CLIENT_SECRET` in `.env`.
- Ensure redirect URI matches your connected app configuration.
- Confirm `PORT` aligns with your local callback URL.

## Still blocked?

- Gather logs, route, and reproduction steps.
- Open an issue via [Reporting Issues and Requests](../contributing/reporting-issues).
