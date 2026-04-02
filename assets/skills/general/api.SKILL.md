# API

Run REST calls and manage saved API scripts.

## When to use

- User wants to run a REST call, inspect or edit request (endpoint, method, body, headers), or manage saved API scripts.
- Use **getApplicationContext** or **getTabs** to see current state before changing.
- Use **runRequest** (or equivalent) to execute the request.

## When NOT to use

- Do not use for SOQL or Apex; use those tools.
- For "call the API" in a generic sense, clarify which API (REST vs SOQL vs Apex) or use the right tool.

## Tools

- getTabs / selectTab — List and select API editor tabs.
- runRequest — Execute REST request (endpoint, method, body, headers).
- getApplicationContext — Current API editor state (tabs, body, method, endpoint).
- Update body, headers, variables, endpoint, method; saved scripts / OpenAPI as needed.
