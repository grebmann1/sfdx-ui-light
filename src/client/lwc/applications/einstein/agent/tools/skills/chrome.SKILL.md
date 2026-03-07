# Chrome

Browser automation (screenshots, tabs).

## When to use

- User asks "what do you see", "screenshot", or needs tab/window management (open tab, list tabs, close, group).
- Use **chrome_screenshot** when the user wants to see the current page or you need visual context.

## When NOT to use

- Do not use Chrome tools for org login, SOQL, Apex, or API — use Salesforce Toolkit tools.
- Prefer toolkit tools for any org or data action.

## Tools (summary)

- chrome_screenshot — Screenshot of current tab/window (triggers continuation).
- chrome_open_tab, chrome_navigate_tab, chrome_list_tabs, chrome_list_tab_groups.
- chrome_group_tabs, chrome_ungroup_tabs, chrome_close_tabs, chrome_update_tab.
- chrome_create_window, chrome_get_tab, chrome_get_tab_group, chrome_update_tab_group.
- chrome_move_tab, chrome_highlight_tabs, chrome_focus_window, chrome_remove_tab_group.
- chrome_duplicate_tab, chrome_reload_tabs.
