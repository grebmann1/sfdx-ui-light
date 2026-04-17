# Heroku Deployment — Multi-Site Docker Image

This runbook deploys the single Docker image built by `./docker/build.sh` to **one Heroku app** serving four public subdomains:

| Subdomain                   | Served by                    | Backend                         |
| --------------------------- | ---------------------------- | ------------------------------- |
| `sf-toolkit.com` / `www`    | `nginx` → `dist/ui`          | Vite welcome SPA (static)       |
| `app.sf-toolkit.com`        | `nginx` → `127.0.0.1:3000`   | Express + LWR web app           |
| `doc.sf-toolkit.com`        | `nginx` → `dist/docs`        | Docusaurus (static)             |
| `vscode.sf-toolkit.com`     | `nginx` → `packages/vscode/dist` | Monaco / VS Code web IDE    |

All four domains share a single dyno. `nginx` inside the container dispatches by `Host` header — this is what `docker/nginx.conf.template` does on the platform-assigned `$PORT`.

As a convenience, `sf-toolkit.com/app` (and any sub-path, e.g. `sf-toolkit.com/app/foo?x=1`) is `301`-redirected to `app.sf-toolkit.com` — `/app` is stripped, query string is preserved. See the `location ~ ^/app(/.*)?$` block on the `sf-toolkit.com` server in `docker/nginx.conf.template`.

---

## 1. Heroku constraints to keep in mind

Heroku routes **one public port per dyno** — the value of the `$PORT` env var it injects at boot. Everything else must be internal.

That means:

- `nginx` is the public front door and **must listen on `$PORT`** (not `80`, not `4000/5000/5173`).
- `packages/server` keeps listening on the internal fixed port `3000` (Express binding, not exposed).
- The internal-only nginx listeners on `4000 / 5000 / 5173` are dev/fallback paths and are **not reachable** from the internet on Heroku. They can stay in the config (harmless) or be removed.
- Heroku's router preserves the `Host` header, so subdomain-based routing in `nginx` works unchanged.

We deploy with the **Heroku Container Registry** via `heroku container:push` — the image is built locally from the existing `Dockerfile` and pushed as a pre-built binary to Heroku. No `heroku.yml` is needed (that file only applies when Heroku builds the image on their side), and the `Procfile` is ignored in container mode.

---

## 2. One-time code / config changes

### 2.1 nginx listens on `$PORT` (already wired)

Heroku assigns `$PORT` at dyno start. The repo is already set up for it — here's how the pieces fit together so you can debug it later:

- **`docker/nginx.conf.template`** — every public listener uses `listen ${PORT};` instead of `listen 80;`. The internal fallback listeners on `4000 / 5000 / 5173` stay at fixed ports (they're unreachable on Heroku, but still useful for direct container-port access in `docker compose`).
- **`Dockerfile`** — installs `gettext` alongside `nginx` and `supervisor` (for the `envsubst` binary), and `COPY`s the template to `/etc/nginx/nginx.conf.template` instead of the final `.conf`.
- **`docker/supervisord.conf`** — the `[program:nginx]` command renders the template first, then execs nginx:
  ```ini
  command=/bin/sh -c "envsubst '$PORT' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf && exec nginx -g 'daemon off;' -c /etc/nginx/nginx.conf"
  ```
  The allow-list argument `'$PORT'` is important: `envsubst` with no arguments would also try to substitute nginx's own runtime variables (`$uri`, `$host`, `$request_uri`, …) and break the config.
- **`docker-compose.yml`** — sets `PORT=80` via `environment:` on the `app` service, so local `docker compose up` keeps exposing the nginx front door on port 80 regardless of what `.env` says (`.env` has `PORT=3000` for direct-run Express dev, which is the right value there).

### 2.2 No `heroku.yml` — `container:push` flow

We are **not** using `heroku.yml`. That file is only relevant when you want Heroku to build the Docker image from your git tree on every `git push heroku main`. That path requires a multi-stage Dockerfile that can compile all artefacts from a clean checkout, which is a bigger rewrite than this project needs today (LWR alone is ~2 min and the `dist/` outputs are `.gitignore`d by design — see `.gitignore` lines 17–30).

Instead we build the image locally with the existing `npm run docker:prebuild && docker compose build` flow, then push the resulting image to Heroku's Container Registry. Deployment commands are in §5.

If we later move to a multi-stage Dockerfile, we can revisit adding a `heroku.yml` at the repo root that looks like:

```yaml
# Kept here for reference only — NOT currently used.
build:
    docker:
        web: Dockerfile
run:
    web: supervisord -c /etc/supervisord.conf
```

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

Three commands from a clean checkout:

```bash
# 1. Build all static/server artefacts into dist/* and packages/*/dist.
#    Required because the Dockerfile only COPYs them — it does not compile.
npm run docker:prebuild

# 2. Build the image from the repo Dockerfile and push it to Heroku's
#    Container Registry. The CLI tags it as registry.heroku.com/sf-toolkit/web.
heroku container:push web -a sf-toolkit

# 3. Promote the pushed image to the active release.
heroku container:release web -a sf-toolkit
```

> `heroku container:push` runs `docker build` against the local `Dockerfile` — it does **not** reuse an image already tagged as `sf-toolkit:latest`. So don't run `docker compose build` before it; the push command builds once on its own.

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

- **Multi-stage Dockerfile + `heroku.yml`** to let Heroku build the image from git on each push (instead of us building locally and using `heroku container:push`). Worth doing once CI is involved so a teammate without Docker installed can still deploy.
- **Dyno sizing**: the image ships LWR + Docusaurus + Monaco assets and the Express server; start on `standard-1x`, scale up if memory pressure appears under LWR SSR load.
- **Health check**: add a lightweight `/healthz` in `packages/server/server-prod.ts` and a matching nginx location on each subdomain so Heroku's routing layer surfaces real failures instead of a black-box 503.
- **Preview / staging app**: duplicate the provisioning section under `sf-toolkit-staging` with different domains (e.g. `staging.sf-toolkit.com`) before shipping risky changes.
