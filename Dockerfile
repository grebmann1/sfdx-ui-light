# =============================================================================
# Workbench — single-image runtime
#
# This Dockerfile PACKAGES pre-built artifacts; it does NOT compile source.
# Run `npm run docker:prebuild` (or see docker/build.sh) before `docker build`
# to produce the required build outputs:
#   dist/web        — LWR web app
#   dist/docs       — Docusaurus docs
#   dist/ui         — Vite UI SPA
#   packages/server/dist — compiled Express server
#   packages/vscode/dist — compiled VS Code / Monaco IDE
# =============================================================================
FROM node:22-alpine

# nginx — static file server for docs / ui / vscode
# supervisor — manages nginx + node processes as PID 1
RUN apk add --no-cache nginx supervisor

WORKDIR /app

# ---------------------------------------------------------------------------
# Production Node.js dependencies for packages/server
# ---------------------------------------------------------------------------
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# ---------------------------------------------------------------------------
# Compiled Express server + its static assets
# ---------------------------------------------------------------------------
COPY packages/server/dist   packages/server/dist
COPY packages/server/assets packages/server/assets

# Root assets — server-prod.js reads ./assets/data/salesforce/*.json from CWD
COPY assets assets

# ---------------------------------------------------------------------------
# Pre-built static sites
# ---------------------------------------------------------------------------
# LWR web app  — served by Express at /
COPY dist/web   dist/web

# Docusaurus   — served by Express at /docs AND by nginx on port 4000
COPY dist/docs  dist/docs

# Vite UI SPA  — served by Express at /welcome AND by nginx on port 5000
COPY dist/ui    dist/ui

# VS Code / Monaco — served by nginx on port 5173 (requires COEP/COOP headers)
COPY packages/vscode/dist   packages/vscode/dist

# ---------------------------------------------------------------------------
# Process-manager and web-server configuration
# ---------------------------------------------------------------------------
COPY docker/supervisord.conf /etc/supervisord.conf
COPY docker/nginx.conf       /etc/nginx/nginx.conf

# ---------------------------------------------------------------------------
# Expose all service ports
#   3000 — packages/server  (Express: API + web app + /docs + /welcome)
#   4000 — apps/docs        (nginx static)
#   5000 — apps/ui          (nginx static)
#   5173 — packages/vscode  (nginx static + COEP/COOP headers)
# ---------------------------------------------------------------------------
EXPOSE 3000 4000 5000 5173

CMD ["supervisord", "-c", "/etc/supervisord.conf"]
