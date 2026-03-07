# Connections

List, connect, disconnect, or open Salesforce orgs.

## When to use

- User wants to list orgs, connect, disconnect, or open an org in the browser.
- Use **list_connections** first when user says "my orgs" or "which org".
- Use **connect_org** to log in (by alias or sessionId+instanceUrl); optional redirect to an app.
- Use **navigate_to_org** to open the org in the browser.

## When NOT to use

- Do not connect or disconnect without clear user intent.
- For "open org" in the toolkit UI, prefer connect_org with redirect; for opening in a browser tab, use navigate_to_org.

## Tools

| Tool | Purpose |
|------|---------|
| list_connections | List all org connections (aliases, usernames) |
| connect_org | Connect by alias or sessionId+instanceUrl; optional redirect |
| disconnect_org | Disconnect current org (remove session) |
| navigate_to_org | Open org in browser (alias or sessionId+instanceUrl) |
