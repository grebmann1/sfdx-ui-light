# Shortcut Generator

A tool to create and manage reusable shortcuts you can invoke from the Chrome extension overlay (Custom tab) and from within the Toolkit.

## Where to find
- Tools → Shortcut Generator
- Chrome Extension Overlay → Custom tab

## Shortcut types
- Link: store a direct URL.
- Expression: dynamic URL resolved at runtime. Supported placeholders:
  - `{recordId}`: current Salesforce record Id from the active tab
  - `{baseUrl}`: Salesforce instance base URL (e.g., https://myorg.my.salesforce.com)
  - `{origin}`: current page origin
- Record-based: builds a “New Record” URL with `defaultFieldValues`. Pick an Object and add field/value pairs; input adapts to field type (picklist, checkbox, date, number, text).

## Scope and persistence
- Saved items can be:
  - Global: available across all orgs
  - Org-specific: available only for the current org; also mirrored by domain for the Chrome extension
- Storage:
  - Internal storage (Saved list)
  - Extension config:
    - `shortcuts_global`: array of global shortcuts
    - `shortcuts_by_org`: map `{ alias: Shortcut[] }`
    - `shortcuts_by_domain`: map `{ domain: Shortcut[] }` (used by overlay)

## How to use
1. Choose a type (Link / Expression / Record-based).
2. For Record-based, pick an Object, then add one or more field/value pairs.
3. Name the shortcut and choose Global vs Org-specific.
4. Save. It appears in the left “Saved” panel grouped by scope.
5. In the overlay’s Custom tab, click a shortcut:
   - Link: opens the URL
   - Expression: evaluates placeholders then opens
   - Record: opens `/lightning/o/{Object}/new?defaultFieldValues=...`

## Notes
- URL encoding is handled automatically for query strings and default field values.
- Domain scoping improves reliability when alias isn’t available in the extension.


