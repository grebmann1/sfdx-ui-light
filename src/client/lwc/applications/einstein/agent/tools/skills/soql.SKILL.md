# SOQL

Run and display SOQL queries in the toolkit.

## When to use

- User wants to run a query, inspect data, or get records from the org.
- Use **soql_query** when the user should see the query and results in the Query Editor.
- Use **soql_query_incognito** when you only need the data to answer (no UI).
- Use **soql_saved_queries** to list saved queries for the current org/alias.
- Use **soql_display_tab** to bring a specific SOQL tab to the front.

## When NOT to use

- Do not call SOQL tools for conceptual questions (e.g. "What is SOQL?") — answer from knowledge.
- Do not use for REST API calls or Apex execution — use API or Apex tools.

## Tools

| Tool | Purpose |
|------|---------|
| soql_query | Display and execute in Query Editor (user sees query/result) |
| soql_query_incognito | Execute without UI (prefer when only data is needed) |
| soql_saved_queries | List saved queries for current org |
| soql_display_tab | Display a SOQL tab by ID |
