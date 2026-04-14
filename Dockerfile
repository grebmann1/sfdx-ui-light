# =============================================================================
# Stage 1: Builder
# Installs all dependencies and builds all 4 apps.
# =============================================================================
FROM node:22-alpine AS builder

# Native module build tools (required by some npm deps)
RUN apk add --no-cache python3 make g++ git

WORKDIR /app

# ---------------------------------------------------------------------------
# Copy package manifests first to maximise layer cache reuse.
# Re-run npm install only when a package*.json changes.
# ---------------------------------------------------------------------------
COPY package.json package-lock.json ./
COPY apps/ui/package.json apps/ui/package-lock.json* apps/ui/
COPY apps/docs/package.json apps/docs/package-lock.json* apps/docs/
COPY packages/vscode/package.json packages/vscode/package-lock.json* packages/vscode/

# Root install — skip postinstall to avoid pulling in the Electron desktop app.
# The required LWR namespace patch is applied manually below.
RUN npm ci --ignore-scripts

# Sub-package installs (these have their own node_modules)
RUN npm --prefix apps/ui install
RUN npm --prefix apps/docs install
RUN npm --prefix packages/vscode install

# ---------------------------------------------------------------------------
# Copy the full source tree (respects .dockerignore)
# ---------------------------------------------------------------------------
COPY . .

# Apply the LWR HMR namespace patch that the root postinstall would normally run
RUN node tools/scripts/patch_lwr_hmr_namespace.mjs

# ---------------------------------------------------------------------------
# Build all apps in dependency order
# ---------------------------------------------------------------------------

# 1. Shared TypeScript modules (required by server + LWR web app)
RUN npm run build:shared

# 2. Express server (TypeScript → packages/server/dist/)
RUN npm run build:server

# 3. LWR web app (→ dist/web/). Needs generous memory for the LWR bundler.
RUN NODE_OPTIONS="--max-old-space-size=8192" npm run build:web

# 4. Docusaurus documentation site (→ dist/docs/)
RUN npm run docs:build

# 5. Vite UI SPA (→ dist/ui/)
RUN npm run ui:build

# 6. VS Code / Monaco web IDE (→ packages/vscode/dist/).
#    Skip lint+typecheck (check-build) to keep Docker builds fast.
RUN NODE_OPTIONS="--max-old-space-size=8192" \
    npm --prefix packages/vscode exec -- vite --config vite.config.ts build


# =============================================================================
# Stage 2: Runtime
# Minimal image with only production Node deps, built artifacts, and nginx.
# =============================================================================
FROM node:22-alpine

# nginx for static file serving; supervisor for multi-process management
RUN apk add --no-cache nginx supervisor

WORKDIR /app

# ---------------------------------------------------------------------------
# Install production Node.js dependencies for packages/server.
# Copy only the manifests so Docker can cache this layer independently.
# ---------------------------------------------------------------------------
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# ---------------------------------------------------------------------------
# Copy compiled server and its static assets
# ---------------------------------------------------------------------------
COPY --from=builder /app/packages/server/dist   packages/server/dist
COPY --from=builder /app/packages/server/assets packages/server/assets

# ---------------------------------------------------------------------------
# Copy built static sites
# ---------------------------------------------------------------------------
# LWR web app — served by Express at /
COPY --from=builder /app/dist/web   dist/web

# Docusaurus — served by Express at /docs AND by nginx on port 4000
COPY --from=builder /app/dist/docs  dist/docs

# Vite UI SPA — served by Express at /welcome AND by nginx on port 5000
COPY --from=builder /app/dist/ui    dist/ui

# VS Code / Monaco — served by nginx on port 5173 (requires COEP/COOP headers)
COPY --from=builder /app/packages/vscode/dist   packages/vscode/dist

# ---------------------------------------------------------------------------
# Process manager and web server configuration
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
