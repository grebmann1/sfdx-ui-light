---
title: Quickstart
---

# Quickstart

This guide gets you from install to your first working session in a few minutes.

## Option A — Chrome Extension (fastest)

1. Install from the [Chrome Web Store](https://chromewebstore.google.com/detail/salesforce-toolkit/konbmllgicfccombdckckakhnmejjoei?hl=en).
2. Navigate to any Salesforce org.
3. The Workbench overlay appears — connect your org via OAuth.
4. Start exploring.

## Option B — Web App

1. Open [app.sf-toolkit.com](https://app.sf-toolkit.com).
2. Connect your org via OAuth.
3. You're ready.

---

## Option C — Local dev setup

### 1. Install and start

```bash
git clone https://github.com/grebmann1/sfdx-ui-light.git
cd sfdx-ui-light
npm install
npm run start:dev:ui
```

This starts the server on port `3000` and the Vite UI on port `27100`.

### 2. Open the key pages and verify they load

| Surface | URL |
| --- | --- |
| Welcome / landing page | `http://localhost:27100` |
| Main app | `http://localhost:27100/app` |
| Server | `http://localhost:3000` |

### 3. Connect your Salesforce org (OAuth)

1. Open `http://localhost:27100/app`.
2. Open the Connections area in the app shell.
3. Complete OAuth login with your connected app credentials.
4. Verify org details and the connected user context load correctly.

### 4. Run your first SOQL query

1. Open the SOQL surface from the app menu.
2. Run a low-risk query:

```sql
SELECT Id, Name FROM Account LIMIT 10
```

3. Confirm rows render and pagination/export controls appear.

### 5. Validate metadata and API workflows

- Open metadata tools and inspect at least one object or component type.
- Open API tools and run a minimal request (e.g. list available API versions).
- Confirm responses match the connected org and user permissions.

### 6. Run a baseline quality check

```bash
npm run check
```

---

## Next steps

- Check [VS Code integration](../vscode/overview) for the embedded editor
- Configure the [AI Agent](../ai-agent/setup)
- Use [Troubleshooting](../troubleshooting/common-issues) if something breaks
