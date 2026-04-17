---
title: Common Issues
---

# Common Issues

## Website shows old content

- Run a clean build with `npm run build:web:all`.
- Restart the production server with `npm run start:prod:server`.
- Hard-refresh the browser (`Cmd+Shift+R` / `Ctrl+Shift+R`) to bypass stale cached assets.

## LWR hot reload inconsistencies

```bash
rm -rf __lwr_cache__
npm run start:dev:web
```

If you run full-site dev, restart `npm run site:dev` after clearing the cache.

## Port already in use

The dev setup uses two ports:

| Port | Service |
| --- | --- |
| `3000` | Express server (app, API, OAuth) |
| `27100` | Vite UI dev server (welcome page) |

If startup fails because a port is occupied:

- Stop the conflicting process, or
- For the server: set a new `PORT` value in `.env` and restart.
- For the UI: update `server.port` in `apps/ui/vite.config.ts`.

## OAuth callback problems

- Verify `CLIENT_ID` and `CLIENT_SECRET` in `.env`.
- Ensure the redirect URI in your connected app matches `http://localhost:3000/oauth2/callback` (or your custom `REDIRECT_URI`).
- Confirm `PORT` aligns with your local callback URL.
- Re-authenticate after updating credentials or callback values.

## Check/lint fails unexpectedly

- Re-run `npm install` if dependencies changed recently.
- Run `npm run lint` first to isolate style/static issues.
- Run `npm run check` after fixes to validate all quality gates pass.

## Still blocked?

- Gather logs, the failing route, and reproduction steps.
- Open an issue via [Reporting Issues and Requests](../contributing/reporting-issues).
