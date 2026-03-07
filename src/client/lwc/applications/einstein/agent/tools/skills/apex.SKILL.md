# Apex

Edit and execute anonymous Apex with confirmation.

## When to use

- User wants to write, edit, run, or save anonymous Apex.
- Use **apex_edit** to create or edit code (no execution).
- Use **apex_execute** only after explicit user confirmation.
- Use **apex_saved_scripts** / **apex_save_script** to list or save scripts.

## When NOT to use

- Do not execute (apex_execute) without confirming with the user.
- Do not use for general Apex questions — answer from knowledge unless they ask to run something.
- Do not use for SOQL or REST API — use SOQL or API tools.

## Tools

| Tool | Purpose |
|------|---------|
| apex_navigate | Go to Apex Editor |
| apex_open_tab | Open or focus tab by ID |
| apex_edit | Create/edit script (no run) |
| apex_execute | Run script (only after confirmation) |
| apex_saved_scripts | List saved scripts for org/alias |
| apex_save_script | Save script (global or org-specific) |
| apex_get_current_tab | Get current tab content |
