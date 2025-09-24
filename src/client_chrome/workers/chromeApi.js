// chromeApi.js - Chrome tab/window/group interaction handlers for background.js
import { compressImage, createErrorResponse, createSuccessResponse, toNumber, toNumberArray } from './utils/utils.js';
import LOGGER from '../../client/lwc/modules/shared/logger/logger.js';

// Helper to coerce string IDs to numbers


export async function handleChromeOpenTab(args) {
    try {
        LOGGER.log('--> handleChromeOpenTab',args);
        const {url, windowId} = args;
        const tab = await chrome.tabs.create({ url, ...(windowId && { windowId }) });
        return createSuccessResponse(`Tab opened successfully in window ${windowId || 'current'}, tabId: ${tab.id}`);
    } catch (error) {
        LOGGER.error('--> chrome_open_tab error', error);
        return createErrorResponse(
            `chrome_open_tab error: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
        );
    }
}

export async function handleChromeNavigateTab(args) {
    try {
        const { tabId } = args;
        const tab = await chrome.tabs.get(tabId);
        await chrome.tabs.update(tab.id, { active: true });
        await chrome.windows.update(tab.windowId, { focused: true });
    } catch (error) {
        LOGGER.error('--> chrome_navigate_tab error', error);
        return createErrorResponse(
            `chrome_navigate_tab error: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
        );
    }
}

export async function handleChromeListTabs(args) {
    try {
        const tabs = await chrome.tabs.query({});
        return createSuccessResponse(`Tabs listed successfully, ${tabs.length} tabs found : Tabs : ${JSON.stringify(tabs)}`);
    } catch (error) {
        LOGGER.error('--> chrome_list_tabs error', error);
        return createErrorResponse(
            `chrome_list_tabs error: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
        );
    }
}

export async function handleChromeListTabGroups(args) {
    try {
        if (chrome.tabGroups && chrome.tabGroups.query) {
            const groups = await chrome.tabGroups.query({});
            return createSuccessResponse(`Tab groups listed successfully, ${groups.length} groups found : Groups : ${JSON.stringify(groups)}`);
        }
        throw new Error('Tab groups API not supported.');
    } catch (error) {
        LOGGER.error('--> chrome_list_tab_groups error', error);
        return createErrorResponse(
            `chrome_list_tab_groups error: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
        );
    }
}

export async function handleChromeGroupTabs(args) {
    try {
        const { tabIds, windowId, title, color } = args;
        LOGGER.log('--> handleChromeGroupTabs',args);
        const moveTabsAndGroup = async (tabIds, windowId, groupName) => {
            if (windowId) {
                const movedTabs = await chrome.tabs.move(tabIds, { windowId: toNumber(windowId), index: -1 });
                const groupId = await chrome.tabs.group({ tabIds, windowId: toNumber(windowId) });
                // Set the group's title and color
                await chrome.tabGroups.update(groupId, {
                    title,
                    color
                });
                return createSuccessResponse(`Tabs grouped successfully in window ${windowId}, groupId: ${groupId}`);
            } else {
                const groupId = await chrome.tabs.group({ tabIds });
                // Set the group's title and color
                await chrome.tabGroups.update(groupId, {
                    ...(title && { title }),
                    ...(color && { color })
                });
                return createSuccessResponse(`Tabs grouped successfully in group ${groupId}`);
            }
        };
        return await moveTabsAndGroup(tabIds, windowId);
    } catch (e) {
        LOGGER.error('Error grouping tabs',e);
        return createErrorResponse(e.message);
    }
}

export async function handleChromeGetWindows(args) {
    try {
        const windows = await chrome.windows.getAll({ populate: true });
        return createSuccessResponse(`Windows listed successfully, ${windows.length} windows found : Windows : ${JSON.stringify(windows)}`);
    } catch (error) {
        LOGGER.error('--> chrome_get_windows error', error);
        return createErrorResponse(
            `chrome_get_windows error: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
        );
    }
}

export async function handleChromeUngroupTabs(args) {
    try {
        const { tabIds } = args;
        await chrome.tabs.ungroup(tabIds);
        return createSuccessResponse(`Tabs ungrouped successfully, tabIds: ${tabIds}`);
    } catch (error) {
        LOGGER.error('--> chrome_ungroup_tabs error', error);
        return createErrorResponse(
            `chrome_ungroup_tabs error: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
        );
    }
}

export async function handleChromeCloseTabs(args) {
    try {
        const { tabIds } = args;
        await chrome.tabs.remove(tabIds);
        return createSuccessResponse(`Tabs closed successfully, tabIds: ${tabIds}`);
    } catch (error) {
        LOGGER.error('--> chrome_close_tabs error', error);
        return createErrorResponse(
            `chrome_close_tabs error: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
        );
    }
}

export async function handleChromeUpdateTab(args) {
    try {
        const { tabId, updateProps = {} } = args;
        const allowedProps = ['url', 'active', 'highlighted', 'muted', 'openerTabId', 'pinned', 'autoDiscardable'];
        for (const key of allowedProps) {
            if (Object.prototype.hasOwnProperty.call(updateProps, key)) {
                updateProps[key] = args.updateProps[key];
                if (['openerTabId'].includes(key)) updateProps[key] = toNumber(updateProps[key]);
            }
        }
        const tab = await chrome.tabs.update(tabId, updateProps);
        return createSuccessResponse(`Tab updated successfully, tabId: ${tabId}, tab: ${JSON.stringify(tab)}`);
    } catch (error) {
        LOGGER.error('--> chrome_update_tab error', error);
        return createErrorResponse(
            `chrome_update_tab error: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
        );
    }
}

export async function handleChromeCreateWindow(args) {
    try {
        let win;
        const { tabIds } = args;
        if (tabIds && tabIds.length > 0) {
            win = await chrome.windows.create({ tabId: tabIds[0] });
            if (tabIds.length > 1) {
                await chrome.tabs.move(tabIds.slice(1), { windowId: win.id, index: -1 });
            }
        } else {
            win = await chrome.windows.create();
        }
        return createSuccessResponse(`Window created successfully, windowId: ${win.id}`);
    } catch (error) {
        LOGGER.error('--> chrome_create_window error', error);
        return createErrorResponse(
            `chrome_create_window error: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
        );
    }
}

export async function handleChromeGetTab(args) {
    try {
        const { tabId } = args;
        const tab = await chrome.tabs.get(tabId);
        return createSuccessResponse(`Tab retrieved successfully, tabId: ${tabId}, tab: ${JSON.stringify(tab)}`);
    } catch (error) {
        LOGGER.error('--> chrome_get_tab error', error);
        return createErrorResponse(
            `chrome_get_tab error: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
        );
    }
}

export async function handleChromeGetTabGroup(args) {
    try {
        const { groupId } = args;
        const group = await chrome.tabGroups.get(groupId);
        return createSuccessResponse(`Tab group retrieved successfully, groupId: ${groupId}, group: ${JSON.stringify(group)}`);
    } catch (error) {
        LOGGER.error('--> chrome_get_tab_group error', error);
        return createErrorResponse(
            `chrome_get_tab_group error: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
        );
    }
}

export async function handleChromeUpdateTabGroup(args) {
    try {
        const { groupId, updateProps = {} } = args;
        const allowedProps = ['title', 'color'];
        for (const key of allowedProps) {
            if (Object.prototype.hasOwnProperty.call(updateProps, key)) {
                updateProps[key] = updateProps[key];
            }
        }
        const group = await chrome.tabGroups.update(groupId, updateProps);
        return createSuccessResponse(`Tab group updated successfully, groupId: ${groupId}, group: ${JSON.stringify(group)}`);
    } catch (error) {
        LOGGER.error('--> chrome_update_tab_group error', error);
        return createErrorResponse(
            `chrome_update_tab_group error: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
        );
    }
}

export async function handleChromeMoveTab(args) {
    try {
        const { tabId, index, windowId } = args;
        const moveProps = { index };
        if (windowId) moveProps.windowId = toNumber(windowId);
        const tab = await chrome.tabs.move(tabId, moveProps);
        return createSuccessResponse(`Tab moved successfully, tabId: ${tabId}, tab: ${JSON.stringify(tab)}`);
    } catch (error) {
        LOGGER.error('--> chrome_move_tab error', error);
        return createErrorResponse(
            `chrome_move_tab error: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
        );
    }
}

export async function handleChromeHighlightTabs(args) {
    try {
        const { tabIds, windowId } = args;
        const highlightInfo = { tabs: tabIds };
        if (windowId) highlightInfo.windowId = toNumber(windowId);
        const result = await chrome.tabs.highlight(highlightInfo);
        return createSuccessResponse(`Tabs highlighted successfully, tabIds: ${tabIds}, result: ${JSON.stringify(result)}`);
    } catch (error) {
        LOGGER.error('--> chrome_highlight_tabs error', error);
        return createErrorResponse(
            `chrome_highlight_tabs error: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
        );
    }
}

export async function handleChromeFocusWindow(args) {
    try {
        const { windowId } = args;
        const win = await chrome.windows.update(windowId, { focused: true });
        return createSuccessResponse(`Window focused successfully, windowId: ${windowId}, window: ${JSON.stringify(win)}`);
    } catch (error) {
        LOGGER.error('--> chrome_focus_window error', error);
        return createErrorResponse(
            `chrome_focus_window error: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
        );
    }
}

export async function handleChromeRemoveTabGroup(args) {
    try {
        const { groupId } = args;
        await chrome.tabGroups.ungroup(groupId);
        await chrome.tabGroups.remove(groupId);
        return createSuccessResponse(`Tab group removed successfully, groupId: ${groupId}`);
    } catch (error) {
        LOGGER.error('--> chrome_remove_tab_group error', error);
        return createErrorResponse(
            `chrome_remove_tab_group error: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
        );
    }
}

export async function handleChromeDuplicateTab(args) {
    try {
        const { tabId } = args;
        const tab = await chrome.tabs.duplicate(tabId);
        return createSuccessResponse(`Tab duplicated successfully, tabId: ${tabId}, tab: ${JSON.stringify(tab)}`);
    } catch (error) {
        LOGGER.error('--> chrome_duplicate_tab error', error);
        return createErrorResponse(
            `chrome_duplicate_tab error: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
        );
    }
}

export async function handleChromeReloadTabs(args) {
    try {
        const { tabIds } = args;
        for (const tabId of tabIds) {
            await chrome.tabs.reload(tabId);
        }
        return createSuccessResponse(`Tabs reloaded successfully, tabIds: ${tabIds}`);
    } catch (error) {
        LOGGER.error('--> chrome_reload_tabs error', error);
        return createErrorResponse(
            `chrome_reload_tabs error: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
        );
    }
}

export async function handleChromeScreenshot(args) {
    try {
        // Accepts tabId (optional), format (optional: 'png'|'jpeg'), quality (optional, for jpeg)
        const { format, quality } = args || {};
        const options = { format };
        if (format === 'jpeg' && typeof quality === 'number') {
            options.quality = quality;
        }
        LOGGER.log('--> chrome_screenshot options',options);
        // Get current tab
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]) {
            return createErrorResponse('No active tab found');
        }
        const tab = tabs[0];
        const imageUri = await chrome.tabs.captureVisibleTab(tab.windowId, options);
        const compressed = await compressImage(imageUri, {
            scale: 0.7, // Reduce dimensions by 30%
            quality: 0.8, // 80% quality for good balance
            format: 'image/jpeg', // JPEG for better compression
          });
          // Include base64 data in response (without prefix)
        //const base64Data = compressed.dataUrl.replace(/^data:image\/[^;]+;base64,/, '');
        return {
            content : [
                {
                    type: 'input_image',
                    image: compressed.dataUrl
                }
            ],
            isError: false
        }
    } catch (error) {
        LOGGER.error('--> chrome_screenshot error', error);
        return createErrorResponse(
            `chrome_screenshot error: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
        );
    }
}

const chromeActionHandlers = {
    chrome_screenshot: handleChromeScreenshot,
    chrome_open_tab: handleChromeOpenTab,
    chrome_navigate_tab: handleChromeNavigateTab,
    chrome_list_tabs: handleChromeListTabs,
    chrome_list_tab_groups: handleChromeListTabGroups,
    chrome_group_tabs: handleChromeGroupTabs,
    chrome_get_windows: handleChromeGetWindows,
    chrome_ungroup_tabs: handleChromeUngroupTabs,
    chrome_close_tabs: handleChromeCloseTabs,
    chrome_update_tab: handleChromeUpdateTab,
    chrome_create_window: handleChromeCreateWindow,
    chrome_get_tab: handleChromeGetTab,
    chrome_get_tab_group: handleChromeGetTabGroup,
    chrome_update_tab_group: handleChromeUpdateTabGroup,
    chrome_move_tab: handleChromeMoveTab,
    chrome_highlight_tabs: handleChromeHighlightTabs,
    chrome_focus_window: handleChromeFocusWindow,
    chrome_remove_tab_group: handleChromeRemoveTabGroup,
    chrome_duplicate_tab: handleChromeDuplicateTab,
    chrome_reload_tabs: handleChromeReloadTabs,
};

export async function handleChromeInteraction(message) {
    const handler = chromeActionHandlers[message.action];
    if (handler) {
        LOGGER.log('--> handleChromeInteraction',handler);
        if(handler.execute){
            return await handler.execute(message.args || message);
        }else{
            return await handler(message.args || message);
        }
    }
    return { status: 'error', message: 'Unknown chrome_* action' };
}
