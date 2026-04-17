# Heroku Deployment — Multi-Site Docker Image

This runbook deploys the single Docker image built by `./docker/build.sh` to **one Heroku app** serving four public subdomains:

| Subdomain                   | Served by                    | Backend                         |
| --------------------------- | ---------------------------- | ------------------------------- |
| `sf-toolkit.com` / `www`    | `nginx` → `dist/ui`          | Vite welcome SPA (static)       |
| `app.sf-toolkit.com`        | `nginx` → `127.0.0.1:3000`   | Express + LWR web app           |
| `doc.sf-toolkit.com`        | `nginx` → `dist/docs`        | Docusaurus (static)             |
| `vscode.sf-toolkit.com`     | `nginx` → `packages/vscode/dist` | Monaco / VS Code web IDE    |

All four domains share a single dyno. `nginx` inside the container dispatches by `Host` header — this is exactly what `docker/nginx.conf` already does on port `80`.

As a convenience, `sf-toolkit.com/app` (and any sub-path, e.g. `sf-toolkit.com/app/foo?x=1`) is `301`-redirected to `app.sf-toolkit.com` — `/app` is stripped, query string is preserved. See the `location ~ ^/app(/.*)?$` block on the `sf-toolkit.com` server in `docker/nginx.conf`.

---

## 1. Heroku constraints to keep in mind

Heroku routes **one public port per dyno** — the value of the `$PORT` env var it injects at boot. Everything else must be internal.

That means:

- `nginx` is the public front door and **must listen on `$PORT`** (not `80`, not `4000/5000/5173`).
- `packages/server` keeps listening on the internal fixed port `3000` (Express binding, not exposed).
- The internal-only nginx listeners on `4000 / 5000 / 5173` are dev/fallback paths and are **not reachable** from the internet on Heroku. They can stay in the config (harmless) or be removed.
- Heroku's router preserves the `Host` header, so subdomain-based routing in `nginx` works unchanged.

We deploy with the **Heroku Container Registry** (`heroku.yml` style). The Procfile is not used in container mode.

---

## 2. One-time code / config changes

### 2.1 Make nginx listen on `$PORT`

Heroku assigns `$PORT` at dyno start. Replace the public `listen 80;` in `docker/nginx.conf` with a templated value and substitute it at container start.

**Option A (recommended): `envsubst` at boot.**

1. Rename `docker/nginx.conf` → `docker/nginx.conf.template`.
2. In the template, change every public listener from:
   ```nginx
   listen 80;
   ```
   to:
   ```nginx
   listen ${PORT};
   ```
   (Leave the internal `4000 / 5000 / 5173` listeners alone, or delete them — they are not reachable on Heroku.)
3. Add `gettext` to the Dockerfile so `envsubst` is available:
   ```dockerfile
   RUN apk add --no-cache nginx supervisor gettext
   ```
4. Replace the `[program:nginx]` command in `docker/supervisord.conf` with a shell that renders the template first:
   ```ini
   command=/bin/sh -c "envsubst '$$PORT' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf && nginx -g 'daemon off;' -c /etc/nginx/nginx.conf"
   ```
5. In the Dockerfile, copy the template instead of the final config:
   ```dockerfile
   COPY docker/nginx.conf.template /etc/nginx/nginx.conf.template
   ```

**Local dev unchanged:** `docker-compose.yml` provides `PORT=80` (default from the `.env`) — set `PORT=80` in `.env` to keep the existing local behaviour.

### 2.2 Add `heroku.yml`

Create `heroku.yml` at the repo root:

```yaml
build:
    docker:
        web: Dockerfile
    config:
        NODE_ENV: production
run:
    web: supervisord -c /etc/supervisord.conf
```

Heroku will build the image from the repo context and run `supervisord` as the `web` dyno command. The `Procfile` is ignored in container mode and can stay for non-Heroku use.

### 2.3 Pre-build artefacts must be in the git tree — or build in CI

The current `Dockerfile` **packages pre-built artefacts** (`dist/web`, `dist/docs`, `dist/ui`, `packages/server/dist`, `packages/vscode/dist`). Two options:

- **Simplest:** commit the `dist/` outputs before `git push heroku main`. Not great hygiene but matches the existing flow.
- **Cleaner:** switch to a multi-stage Dockerfile that runs `npm run docker:prebuild` inside the builder stage, so `git push heroku main` on a clean tree produces a working image. Recommended before first real deploy.

Until the Dockerfile is multi-stage, **always run `npm run docker:prebuild` locally and commit `dist/` before pushing to Heroku**.

---

## 3. Heroku app provisioning

Run these once per environment (prod).

```bash
# Login
heroku login
heroku container:login

# Create the app in container stack
heroku create sf-toolkit --stack container --region us

# Enable ACM (free auto-managed SSL for custom domains)
heroku certs:auto:enable -a sf-toolkit

# Add all four public domains
heroku domains:add sf-toolkit.com          -a sf-toolkit
heroku domains:add www.sf-toolkit.com      -a sf-toolkit
heroku domains:add app.sf-toolkit.com      -a sf-toolkit
heroku domains:add doc.sf-toolkit.com      -a sf-toolkit
heroku domains:add vscode.sf-toolkit.com   -a sf-toolkit

# Inspect and copy the DNS targets Heroku assigns
heroku domains -a sf-toolkit
```

### 3.1 DNS records (at the registrar)

For each domain above, create a **CNAME** pointing to the Heroku DNS target shown by `heroku domains`. For the apex `sf-toolkit.com`, use an **ALIAS / ANAME** (or registrar flattening) if your DNS provider supports it; otherwise put the app behind a provider that does (Cloudflare, DNSimple, Route 53 alias, etc.).

Typical result:

| Record | Host                   | Target                                     |
| ------ | ---------------------- | ------------------------------------------ |
| ALIAS  | `sf-toolkit.com`       | `<whatever>.herokudns.com` (apex)          |
| CNAME  | `www`                  | `<whatever>.herokudns.com`                 |
| CNAME  | `app`                  | `<whatever>.herokudns.com`                 |
| CNAME  | `doc`                  | `<whatever>.herokudns.com`                 |
| CNAME  | `vscode`               | `<whatever>.herokudns.com`                 |

ACM issues certs automatically once DNS resolves.

---

## 4. Config vars (env)

The image reads `.env` at runtime via `dotenv/config`. On Heroku we set config vars instead — do **not** commit `.env.prod`.

Mirror the contents of `.env.prod` into Heroku config vars:

```bash
heroku config:set \
  NODE_ENV=production \
  PORT=3000 \
  WORKBENCH_BASE_URL=https://app.sf-toolkit.com \
  REDIRECT_URI=https://sf-toolkit.com/oauth2/callback \
  CLIENT_ID='...' \
  CLIENT_SECRET='...' \
  CHROME_ID='...' \
  OPENAI_KEY='...' \
  SALESFORCE_KEY='...' \
  SALESFORCE_KEY1='...' \
  OPENAI_GATE_ACCEPT_PLACEHOLDER=false \
  GOOGLE_CLIENT_ID_EXTENSION='...' \
  GOOGLE_CLIENT_ID_WEB='...' \
  GOOGLE_CLIENT_SECRET_WEB='...' \
  AI_RATE_LIMIT_DAILY=100 \
  -a sf-toolkit
```

> Important: `PORT=3000` here is the **internal** Express port used by Supervisor (see `docker/supervisord.conf`). Heroku **overrides** `$PORT` at dyno boot for the dyno process (which is `nginx`), so nginx will correctly listen on Heroku's assigned port. The Express child process is launched by supervisor with `environment=...,PORT="3000"` which takes precedence over the dyno `$PORT` — keep that line in `supervisord.conf`.

Verify:

```bash
heroku config -a sf-toolkit
```

---

## 5. Deployment

From a clean checkout of the branch you want to ship:

```bash
# 1. Build all artefacts locally (into dist/ and packages/*/dist)
npm run docker:prebuild

# 2. Commit dist outputs (until the Dockerfile is made multi-stage)
git add -f dist packages/server/dist packages/vscode/dist
git commit -m "chore(deploy): build artefacts for heroku"

# 3. Push to Heroku — triggers a container build on their side
git push heroku main
```

Alternative (push a pre-built image instead of letting Heroku build):

```bash
npm run docker:prebuild
heroku container:push web     -a sf-toolkit
heroku container:release web  -a sf-toolkit
```

Tail logs to confirm `nginx` and `server` both come up under supervisor:

```bash
heroku logs --tail -a sf-toolkit
```

You should see:

- `supervisord started with pid 1`
- `INFO spawned: 'server'` listening on `:3000`
- `INFO spawned: 'nginx'` listening on `$PORT`

---

## 6. Smoke tests

```bash
curl -I https://sf-toolkit.com
curl -I https://www.sf-toolkit.com
curl -I https://app.sf-toolkit.com
curl -I https://doc.sf-toolkit.com
curl -I https://vscode.sf-toolkit.com
```

All should return `200` (or `301/302` for SPA redirects). For `vscode.sf-toolkit.com`, also verify the COEP/COOP headers:

```bash
curl -I https://vscode.sf-toolkit.com | grep -i "cross-origin"
```

Expected:

```
cross-origin-embedder-policy: credentialless
cross-origin-opener-policy: same-origin
cross-origin-resource-policy: cross-origin
```

---

## 7. Rollback

```bash
heroku releases -a sf-toolkit
heroku rollback v<previous> -a sf-toolkit
```

---

## 8. Known follow-ups

- **Multi-stage Dockerfile** to move `npm run docker:prebuild` into the build, so `dist/` no longer needs to be committed.
- **Dyno sizing**: the image ships LWR + Docusaurus + Monaco assets and the Express server; start on `standard-1x`, scale up if memory pressure appears under LWR SSR load.
- **Health check**: add a lightweight `/healthz` in `packages/server/server-prod.ts` and a matching nginx location on each subdomain so Heroku's routing layer surfaces real failures instead of a black-box 503.
- **Preview / staging app**: duplicate the provisioning section under `sf-toolkit-staging` with different domains (e.g. `staging.sf-toolkit.com`) before shipping risky changes.
