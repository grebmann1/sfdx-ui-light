---
title: Installation
---

# Installation

## Prerequisites

- Node.js `22.14`
- npm
- Salesforce credentials for OAuth flows

## Install and run

```bash
git clone https://github.com/grebmann1/sf-toolkit-web.git
cd sf-toolkit-web
npm install
```

Start the web tool:

```bash
npm run start:dev:web
```

## Open key surfaces

- Website: `/welcome`
- Docs: `/docs`
- App: `/app`

## Environment variables

Create a `.env` file in project root:

```bash
CLIENT_SECRET='YOUR_CLIENT_SECRET'
CLIENT_ID='YOUR_CLIENT_ID'
```

Optional values include `PORT`, `REDIRECT_URI`, `DOC_VERSION`, and `PROXY_URL`.

## After installation

- Follow [Quickstart](./quickstart) to run your first flows.
- Use [Common workflows](../workflows/common-tasks) for day-to-day usage patterns.
- If you want to help, see [How to contribute](../contributing/how-to-contribute).
