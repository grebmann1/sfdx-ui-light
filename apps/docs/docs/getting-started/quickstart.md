---
title: Quickstart
---

# Quickstart

This guide gets you from clone to useful workflows in a few minutes.

## 1. Install and start local runtime

```bash
git clone https://github.com/grebmann1/sf-toolkit-web.git
cd sf-toolkit-web
npm install
npm run start:dev:web
```

If you want the welcome and docs sites in dev mode too:

```bash
npm run site:dev
```

## 2. Open the key pages and verify they load

- Website: `http://localhost:3000/welcome`
- Docs: `http://localhost:3000/docs`
- Main app: `http://localhost:3000/app`

## 3. Connect your Salesforce org (OAuth)

1. Open `/app`.
2. Open the org/connection area in the app shell.
3. Complete OAuth login.
4. Validate that org details and connected-user context load successfully.

## 4. Run your first SOQL check

1. Open the SOQL surface from the app menu.
2. Run a low-risk query:

```sql
SELECT Id, Name FROM Account LIMIT 10
```

3. Confirm rows render and pagination/export controls appear as expected.

## 5. Validate metadata and API workflows

- Open metadata tools and inspect at least one object or component type.
- Open API tools and run a minimal request first (for example, list available API versions).
- Confirm response payloads match the connected org and permissions.

## 6. Run a baseline quality check before sharing changes

```bash
npm run check
```

## Next steps

- Read [Common workflows](../workflows/common-tasks)
- Check [VS Code workflows](../vscode/overview)
- Use [Troubleshooting](../troubleshooting/common-issues) if something breaks
