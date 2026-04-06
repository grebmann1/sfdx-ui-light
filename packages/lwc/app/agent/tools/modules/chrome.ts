import { z } from 'zod';
const { tool } = window.OpenAIAgentsBundle?.Agents || {};
import LOGGER from 'shared/logger';
import { CHROME_SCREENSHOT_FORMATS, CHROME_TOOL_DESCRIPTIONS } from '../constants';
//import { TOOL_NAMES, TOOL_SCHEMAS } from 'mcp/constants';

// Helper to send a message to the Chrome extension background script
async function sendChromeMessage(action, payload = {}) {
    return new Promise((resolve, reject) => {
        if (!window.chrome || !window.chrome.runtime || !window.chrome.runtime.sendMessage) {
            return resolve({ status: 'error', message: 'Chrome extension APIs not available.' });
        }
        window.chrome.runtime.sendMessage({ action, ...payload }, response => {
            if (window.chrome.runtime.lastError) {
                resolve({ status: 'error', message: window.chrome.runtime.lastError.message });
            } else {
                resolve(response);
            }
        });
    });
}

// Take a screenshot of the current screen
const chromeScreenshot = tool({
    name: 'chrome_screenshot',
    description: CHROME_TOOL_DESCRIPTIONS.screenshot,
    parameters: z.object({
        format: z.enum(CHROME_SCREENSHOT_FORMATS).optional().nullable().describe('Format of the screenshot'),
        quality: z.number().optional().nullable().describe('Quality of the screenshot (0-100)'),
    }),
    execute: async args => {
        const res = await sendChromeMessage('chrome_screenshot', args);
        LOGGER.log('--> chromeScreenshot', { args, res });
        return res;
    },
});

// Open a new browser tab
const chromeOpenTab = tool({
    name: 'chrome_open_tab',
    description: CHROME_TOOL_DESCRIPTIONS.openTab,
    parameters: z.object({
        url: z.string().describe('The URL to open in a new tab'),
        windowId: z
            .number()
            .optional()
            .nullable()
            .describe('Optional window ID to open the tab in'),
    }),
    execute: async args => {
        return await sendChromeMessage('chrome_open_tab', args);
    },
});

// Navigate to a specific tab by tabId
const chromeNavigateTab = tool({
    name: 'chrome_navigate_tab',
    description: CHROME_TOOL_DESCRIPTIONS.navigateTab,
    parameters: z.object({
        tabId: z.number().describe('The ID of the tab to navigate to'),
    }),
    execute: async args => {
        return await sendChromeMessage('chrome_navigate_tab', args);
    },
});

// Get a list of all open tabs
const chromeListTabs = tool({
    name: 'chrome_list_tabs',
    description: CHROME_TOOL_DESCRIPTIONS.listTabs,
    parameters: z.object({}),
    execute: async () => {
        return await sendChromeMessage('chrome_list_tabs');
    },
});

// Get a list of all tab groups
const chromeListTabGroups = tool({
    name: 'chrome_list_tab_groups',
    description: CHROME_TOOL_DESCRIPTIONS.listTabGroups,
    parameters: z.object({}),
    execute: async () => {
        return await sendChromeMessage('chrome_list_tab_groups');
    },
});

// Group tabs together and optionally move them to another window
const chromeGroupTabs = tool({
    name: 'chrome_group_tabs',
    description: CHROME_TOOL_DESCRIPTIONS.groupTabs,
    parameters: z.object({
        tabIds: z.array(z.number()).describe('Array of tab IDs to group'),
        windowId: z
            .string()
            .optional()
            .nullable()
            .describe('Optional window ID to move the group to'),
        title: z.string().optional().nullable().describe('Optional group title'),
        color: z.string().optional().nullable().describe('Optional group color'),
    }),
    execute: async args => {
        return await sendChromeMessage('chrome_group_tabs', args);
    },
});

// Get a list of all browser windows
const chromeGetWindows = tool({
    name: 'chrome_get_windows',
    description: CHROME_TOOL_DESCRIPTIONS.getWindows,
    parameters: z.object({}),
    execute: async () => {
        return await sendChromeMessage('chrome_get_windows');
    },
});

// Ungroup tabs
const chromeUngroupTabs = tool({
    name: 'chrome_ungroup_tabs',
    description: CHROME_TOOL_DESCRIPTIONS.ungroupTabs,
    parameters: z.object({
        tabIds: z.array(z.string()).describe('Array of tab IDs to ungroup'),
    }),
    execute: async args => {
        return await sendChromeMessage('chrome_ungroup_tabs', args);
    },
});

// Close tabs
const chromeCloseTabs = tool({
    name: 'chrome_close_tabs',
    description: CHROME_TOOL_DESCRIPTIONS.closeTabs,
    parameters: z.object({
        tabIds: z.array(z.number()).describe('Array of tab IDs to close'),
    }),
    execute: async args => {
        return await sendChromeMessage('chrome_close_tabs', args);
    },
});

// Update tab properties
const chromeUpdateTab = tool({
    name: 'chrome_update_tab',
    description: CHROME_TOOL_DESCRIPTIONS.updateTab,
    parameters: z.object({
        tabId: z.number().describe('Tab ID'),
        updateProps: z
            .object({
                url: z
                    .string()
                    .optional()
                    .nullable()
                    .describe('Navigate the tab to this URL (if provided)'),
                active: z
                    .boolean()
                    .optional()
                    .nullable()
                    .describe('Whether the tab should be active'),
                highlighted: z
                    .boolean()
                    .optional()
                    .nullable()
                    .describe('Whether the tab should be highlighted'),
                muted: z
                    .boolean()
                    .optional()
                    .nullable()
                    .describe('Whether the tab should be muted'),
                openerTabId: z
                    .string()
                    .optional()
                    .nullable()
                    .describe('ID of the tab that opened this tab'),
                pinned: z
                    .boolean()
                    .optional()
                    .nullable()
                    .describe('Whether the tab should be pinned'),
                autoDiscardable: z
                    .boolean()
                    .optional()
                    .nullable()
                    .describe('Whether the tab can be automatically discarded by Chrome'),
            })
            .describe('Properties to update on the tab'),
    }),
    execute: async args => {
        return await sendChromeMessage('chrome_update_tab', args);
    },
});

// Create new window
const chromeCreateWindow = tool({
    name: 'chrome_create_window',
    description: CHROME_TOOL_DESCRIPTIONS.createWindow,
    parameters: z.object({
        tabIds: z.array(z.number()).optional().nullable().describe('Tab IDs to move to new window'),
    }),
    execute: async args => {
        return await sendChromeMessage('chrome_create_window', args);
    },
});

// Get tab info by ID
const chromeGetTab = tool({
    name: 'chrome_get_tab',
    description: CHROME_TOOL_DESCRIPTIONS.getTab,
    parameters: z.object({
        tabId: z.number().describe('Tab ID'),
    }),
    execute: async args => {
        return await sendChromeMessage('chrome_get_tab', args);
    },
});

// Get/set tab group properties
const chromeGetTabGroup = tool({
    name: 'chrome_get_tab_group',
    description: CHROME_TOOL_DESCRIPTIONS.getTabGroup,
    parameters: z.object({
        groupId: z.number().describe('Tab group ID'),
    }),
    execute: async args => {
        return await sendChromeMessage('chrome_get_tab_group', args);
    },
});
const chromeUpdateTabGroup = tool({
    name: 'chrome_update_tab_group',
    description: CHROME_TOOL_DESCRIPTIONS.updateTabGroup,
    parameters: z.object({
        groupId: z.number().describe('Tab group ID'),
        updateProps: z
            .object({})
            .catchall(z.union([z.string(), z.number(), z.boolean()]))
            .describe('Properties to update'),
    }),
    execute: async args => {
        return await sendChromeMessage('chrome_update_tab_group', args);
    },
});

// Reorder tabs
const chromeMoveTab = tool({
    name: 'chrome_move_tab',
    description: CHROME_TOOL_DESCRIPTIONS.moveTab,
    parameters: z.object({
        tabId: z.number().describe('Tab ID'),
        index: z.number().describe('Target index'),
        windowId: z.number().optional().nullable().describe('Optional window ID'),
    }),
    execute: async args => {
        return await sendChromeMessage('chrome_move_tab', args);
    },
});

// Highlight tabs
const chromeHighlightTabs = tool({
    name: 'chrome_highlight_tabs',
    description: CHROME_TOOL_DESCRIPTIONS.highlightTabs,
    parameters: z.object({
        tabIds: z.array(z.string()).describe('Tab IDs to highlight'),
        windowId: z.number().optional().nullable().describe('Optional window ID'),
    }),
    execute: async args => {
        return await sendChromeMessage('chrome_highlight_tabs', args);
    },
});

// Focus window
const chromeFocusWindow = tool({
    name: 'chrome_focus_window',
    description: CHROME_TOOL_DESCRIPTIONS.focusWindow,
    parameters: z.object({
        windowId: z.number().describe('Window ID'),
    }),
    execute: async args => {
        return await sendChromeMessage('chrome_focus_window', args);
    },
});

// Remove tab group
const chromeRemoveTabGroup = tool({
    name: 'chrome_remove_tab_group',
    description: CHROME_TOOL_DESCRIPTIONS.removeTabGroup,
    parameters: z.object({
        groupId: z.number().describe('Tab group ID'),
    }),
    execute: async args => {
        return await sendChromeMessage('chrome_remove_tab_group', args);
    },
});

// Duplicate tab
const chromeDuplicateTab = tool({
    name: 'chrome_duplicate_tab',
    description: CHROME_TOOL_DESCRIPTIONS.duplicateTab,
    parameters: z.object({
        tabId: z.number().describe('Tab ID'),
    }),
    execute: async args => {
        return await sendChromeMessage('chrome_duplicate_tab', args);
    },
});

// Reload tabs
const chromeReloadTabs = tool({
    name: 'chrome_reload_tabs',
    description: CHROME_TOOL_DESCRIPTIONS.reloadTabs,
    parameters: z.object({
        tabIds: z.array(z.number()).describe('Tab IDs to reload'),
    }),
    execute: async args => {
        return await sendChromeMessage('chrome_reload_tabs', args);
    },
});

export const chromeTools = [
    chromeScreenshot,
    chromeOpenTab,
    chromeNavigateTab,
    chromeListTabs,
    chromeListTabGroups,
    chromeGroupTabs,
    chromeGetWindows,
    chromeUngroupTabs,
    chromeCloseTabs,
    chromeUpdateTab,
    chromeCreateWindow,
    chromeGetTab,
    chromeGetTabGroup,
    chromeUpdateTabGroup,
    chromeMoveTab,
    chromeHighlightTabs,
    chromeFocusWindow,
    chromeRemoveTabGroup,
    chromeDuplicateTab,
    chromeReloadTabs,
];
