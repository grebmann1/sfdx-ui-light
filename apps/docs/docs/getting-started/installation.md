---
title: Installation
---

# Installation

## Prerequisites

- Node.js `22.14` (required by the repo engine)
- npm (installed with Node.js)
- Salesforce connected app credentials for OAuth (`CLIENT_ID`, `CLIENT_SECRET`)

Validate your local toolchain before installing:

```bash
node -v
npm -v
```

## Install dependencies

```bash
git clone https://github.com/grebmann1/sf-toolkit-web.git
cd sf-toolkit-web
npm install
```

## Configure environment variables

Create a `.env` file in the project root:

```bash
CLIENT_SECRET='YOUR_CLIENT_SECRET'
CLIENT_ID='YOUR_CLIENT_ID'
```

Optional variables:

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | No | Overrides the default local server port. |
| `REDIRECT_URI` | No | Overrides OAuth callback URL used by the server. |
| `DOC_VERSION` | No | Pins a specific documentation version when applicable. |
| `PROXY_URL` | No | Routes requests through a proxy endpoint. |

## Start local services

Start the app server and watcher workflow:

```bash
npm run start:dev:web
```

If you also want the welcome site and docs site in dev mode:

```bash
npm run site:dev
```

## Open key surfaces

- Website: `http://localhost:3000/welcome`
- Docs: `http://localhost:3000/docs`
- App: `http://localhost:3000/app`

## Optional production-like run

To verify the production build + server flow locally:

```bash
npm run start:prod:web
```

## After installation

- Follow [Quickstart](./quickstart) to run your first flows.
- Use [Common workflows](../workflows/common-tasks) for day-to-day usage patterns.
- If you want to help, see [How to contribute](../contributing/how-to-contribute).
