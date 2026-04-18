# =============================================================================
# Workbench — single-image runtime
#
# This Dockerfile PACKAGES pre-built artifacts; it does NOT compile source.
# Run `npm run docker:prebuild` (or see docker/build.sh) before `docker build`
# to produce the required build outputs:
#   dist/docs       — Docusaurus docs
#   dist/ui         — Vite UI SPA
#   packages/server/dist — compiled Express server
#   packages/vscode/dist — compiled VS Code / Monaco IDE
# =============================================================================
FROM node:22-alpine

# nginx     — static file server for docs / ui / vscode
# supervisor — manages nginx + node processes as PID 1
# gettext   — provides `envsubst`, used at container start to render the
#             nginx config template with the Heroku-assigned $PORT
RUN apk add --no-cache nginx supervisor gettext

WORKDIR /app

# ---------------------------------------------------------------------------
# Production Node.js dependencies for packages/server
# ---------------------------------------------------------------------------
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# ---------------------------------------------------------------------------
# Compiled Express server
# ---------------------------------------------------------------------------
COPY packages/server/dist   packages/server/dist

# Server runtime data — server-prod.js reads ./assets/server/data/salesforce/*.json from CWD
COPY assets/server assets/server

# ---------------------------------------------------------------------------
# Pre-built static sites
# ---------------------------------------------------------------------------
# Docusaurus   — served by nginx on port 4000
COPY dist/docs  dist/docs

# Vite UI SPA  — served by nginx on port 5000
COPY dist/ui    dist/ui

# VS Code / Monaco — served by nginx on port 5173 (requires COEP/COOP headers)
COPY packages/vscode/dist   packages/vscode/dist

# ---------------------------------------------------------------------------
# Process-manager and web-server configuration
# ---------------------------------------------------------------------------
COPY docker/supervisord.conf     /etc/supervisord.conf
# Template is rendered to /etc/nginx/nginx.conf at container start
# by the [program:nginx] command in supervisord.conf.
COPY docker/nginx.conf.template  /etc/nginx/nginx.conf.template

# ---------------------------------------------------------------------------
# Expose all service ports
#   3000 — packages/server  (Express: API, proxy, OAuth, LLM)
#   4000 — apps/docs        (nginx static — Docusaurus)
#   5000 — apps/ui          (nginx static — Vite SPA)
#   5173 — packages/vscode  (nginx static + COEP/COOP headers)
# ---------------------------------------------------------------------------
EXPOSE 3000 4000 5000 5173

CMD ["supervisord", "-c", "/etc/supervisord.conf"]
