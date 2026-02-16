import { navigate } from 'lwr/navigation';
import { loadExtensionConfigFromCache, CACHE_CONFIG } from 'shared/cacheManager';
import hotkeys from 'hotkeys-js';

/**
 * Keyboard shortcuts initialization
 * @param {Object} context - Component context with navContext
 */
export async function initShortcuts(context) {
    const { navContext } = context;
    
    const configuration = await loadExtensionConfigFromCache([
        CACHE_CONFIG.SHORTCUT_INJECTION_ENABLED.key,
        CACHE_CONFIG.SHORTCUT_OVERVIEW.key,
        CACHE_CONFIG.SHORTCUT_SOQL.key,
        CACHE_CONFIG.SHORTCUT_APEX.key,
        CACHE_CONFIG.SHORTCUT_API.key,
        CACHE_CONFIG.SHORTCUT_DOCUMENTATION.key,
    ]);

    const shortcutEnabled = configuration[CACHE_CONFIG.SHORTCUT_INJECTION_ENABLED.key];
    const shortcutOverview = configuration[CACHE_CONFIG.SHORTCUT_OVERVIEW.key];
    const shortcutSoql = configuration[CACHE_CONFIG.SHORTCUT_SOQL.key];
    const shortcutApex = configuration[CACHE_CONFIG.SHORTCUT_APEX.key];
    const shortcutApi = configuration[CACHE_CONFIG.SHORTCUT_API.key];
    const shortcutDocumentation = configuration[CACHE_CONFIG.SHORTCUT_DOCUMENTATION.key];
    
    if (!shortcutEnabled) return;

    const shortcuts = [
        {
            id: 'org-overview',
            shortcut: shortcutOverview,
            action: async (event, handler) => {
                event.preventDefault();
                navigate(navContext, {
                    type: 'application',
                    state: { applicationName: 'home' },
                });
            },
        },
        {
            id: 'soql-explorer',
            shortcut: shortcutSoql,
            action: async (event, handler) => {
                event.preventDefault();
                navigate(navContext, {
                    type: 'application',
                    state: { applicationName: 'soql' },
                });
            },
        },
        {
            id: 'apex-explorer',
            shortcut: shortcutApex,
            action: async (event, handler) => {
                event.preventDefault();
                navigate(navContext, {
                    type: 'application',
                    state: { applicationName: 'anonymousapex' },
                });
            },
        },
        {
            id: 'api-explorer',
            shortcut: shortcutApi,
            action: async (event, handler) => {
                event.preventDefault();
                navigate(navContext, {
                    type: 'application',
                    state: { applicationName: 'api' },
                });
            },
        },
        {
            id: 'documentation',
            shortcut: shortcutDocumentation,
            action: async (event, handler) => {
                event.preventDefault();
                navigate(navContext, {
                    type: 'application',
                    state: { applicationName: 'documentation' },
                });
            },
        },
    ];

    shortcuts.forEach(shortcut => {
        hotkeys(shortcut.shortcut, shortcut.action);
    });
}
