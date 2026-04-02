# Metadata

Navigate and inspect metadata types and records.

## When to use

- User wants to explore metadata types, list records of a type, get record details, or describe an SObject (fields, types).
- Use **metadata_list_types** then **metadata_list_records** then **metadata_get_record** for drill-down.
- Use **metadata_describe_object** for SObject schema (fields, types).

## When NOT to use

- Do not use for running SOQL (use SOQL tools).
- Use for schema/metadata exploration only, not for querying record data via SOQL.

## Tools

| Tool | Purpose |
|------|---------|
| metadata_navigate | Go to Metadata Explorer app |
| metadata_open_tab | Open metadata tab by ID |
| metadata_list_types | List available metadata types in org |
| metadata_list_records | List records for a metadata type (sobject) |
| metadata_get_record | Get details/files for a record (sobject, recordId) |
| metadata_describe_object | Describe SObject (fields, types) |
