---
title: Installation
---

# Installation

Workbench is available as a **Chrome extension** (recommended) and a **desktop app** (in development). For most users, the Chrome extension is the fastest path.

---

## Option 1 — Chrome Extension (recommended)

1. Open the [Chrome Web Store listing](https://chromewebstore.google.com/detail/salesforce-toolkit/konbmllgicfccombdckckakhnmejjoei?hl=en).
2. Click **Add to Chrome**.
3. Navigate to any Salesforce org — the Workbench overlay appears automatically.

No configuration required. OAuth happens through your active browser session.

---

## Option 2 — Self-hosted / Developer setup

Use this path if you want to run Workbench locally, contribute to the codebase, or host your own instance.

### Prerequisites

- Node.js `22.14` (required by the repo engine)
- npm (installed with Node.js)
- Salesforce connected app credentials (`CLIENT_ID`, `CLIENT_SECRET`)

```bash
node -v   # should be v22.14.x
npm -v
```

### Clone and install

```bash
git clone https://github.com/grebmann1/sfdx-ui-light.git
cd sfdx-ui-light
npm install
```

### Configure environment variables

Copy `.env.dev` or create a `.env` file at the project root:

```bash
CLIENT_SECRET='YOUR_CLIENT_SECRET'
CLIENT_ID='YOUR_CLIENT_ID'
PORT=3000
```

| Variable | Required | Purpose |
| --- | --- | --- |
| `CLIENT_ID` | Yes | Salesforce connected app consumer key. |
| `CLIENT_SECRET` | Yes | Salesforce connected app consumer secret. |
| `PORT` | No | Server port. Defaults to `3000`. |
| `REDIRECT_URI` | No | Overrides the OAuth callback URL. |
| `PROXY_URL` | No | Routes requests through a proxy endpoint. |

### Start local services

**Server + shared watcher only** (LWR app on port `3000`):

```bash
npm run start:dev:web
```

**Server + UI welcome page** (server on `3000`, Vite UI on `27100`):

```bash
npm run start:dev:ui
```

**Full site dev** (server on `3000`, Vite UI on `27100`, Docusaurus docs on `3001`):

```bash
npm run site:dev
```

### Local dev endpoints

| Surface | Dev URL | Notes |
| --- | --- | --- |
| Welcome / landing page | `http://localhost:27100` | Vite dev server |
| Main app | `http://localhost:27100/app` | Proxied from Vite → server |
| Server directly | `http://localhost:3000` | Express server |
| Docs | `http://localhost:3001` | Docusaurus dev server |

### Production-like run

To verify the full production build locally:

```bash
npm run start:prod:web
```

In production mode, everything is served from a single origin:

| Surface | URL |
| --- | --- |
| Welcome | `http://localhost:3000/welcome` |
| App | `http://localhost:3000/app` |
| Docs | `http://localhost:3000/docs` |

---

## After installation

- Follow [Quickstart](./quickstart) to verify your setup and run first flows.
- If something breaks, check [Troubleshooting](../troubleshooting/common-issues).
- To contribute, see [How to contribute](../contributing/how-to-contribute).
