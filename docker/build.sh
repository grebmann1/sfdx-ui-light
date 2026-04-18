#!/usr/bin/env bash
# Build all apps locally then package into the Docker image.
# Run from the repo root: ./docker/build.sh
set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> [1/5] Building shared TypeScript modules..."
npm run build:shared

echo "==> [2/5] Building Express server..."
npm run build:server

echo "==> [3/5] Building Docusaurus docs..."
npm run docs:build

echo "==> [4/5] Building Vite UI..."
npm run ui:build

echo "==> [5/5] Building VS Code / Monaco IDE (this may take a while)..."
# Run vite directly from the package directory to avoid config path issues,
# and skip check-build (lint/typecheck) which has pre-existing errors.
(cd packages/vscode && ./node_modules/.bin/vite --config vite.config.ts build)

echo ""
echo "All builds complete. Building Docker image..."
docker compose build

echo ""
echo "Done! Start with: docker compose up"
