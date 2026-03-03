import { createSlice } from '@reduxjs/toolkit';

/**
 * Shell/UI command slice - migrates legacy shared/store UI shell events
 * 
 * This slice handles:
 * - Menu state (expanded/collapsed, displayed/hidden)
 * - Agent chat state (expanded/collapsed)
 * - Transient commands (redirect, open) - these are set and consumed, then cleared
 * 
 * Note: Transient commands persist until consumed or overwritten, matching legacy behavior
 * where the state remains until the next action.
 */
const shellSlice = createSlice({
    name: 'shell',
    initialState: {
        // Menu state
        menuExpanded: true, // Default to expanded
        menuDisplayed: true, // Default to displayed
        menuSource: null, // Source of last menu action (for debugging)
        
        // Agent chat state
        agentChatExpanded: false,
        agentChatSource: null, // Source of last agent chat action
        
        // Transient commands (set, consumed, then cleared)
        redirectTo: null, // URL or navigation config to redirect to
        openTarget: null, // Target to open (application name)
        fakeNavigateTarget: null, // For fakeNavigate (used in some flows)
        fakeNavigateType: null, // Type for fakeNavigate (legacy compatibility)
    },
    reducers: {
        // Menu actions
        collapseMenu: (state, action) => {
            state.menuExpanded = false;
            state.menuSource = action.payload?.source || null;
        },
        expandMenu: (state, action) => {
            state.menuExpanded = true;
            state.menuSource = action.payload?.source || null;
        },
        hideMenu: (state) => {
            state.menuDisplayed = false;
        },
        showMenu: (state) => {
            state.menuDisplayed = true;
        },
        
        // Agent chat actions
        collapseAgentChat: (state, action) => {
            state.agentChatExpanded = false;
            state.agentChatSource = action.payload?.source || null;
        },
        expandAgentChat: (state, action) => {
            state.agentChatExpanded = true;
            state.agentChatSource = action.payload?.source || null;
        },
        
        // Transient command actions
        navigate: (state, action) => {
            // Set redirect target - consumer will process and optionally clear
            state.redirectTo = action.payload?.target || action.payload;
        },
        clearRedirect: (state) => {
            state.redirectTo = null;
        },
        open: (state, action) => {
            // Set open target - consumer will process and optionally clear
            state.openTarget = action.payload?.target || action.payload;
        },
        clearOpen: (state) => {
            state.openTarget = null;
        },
        fakeNavigate: (state, action) => {
            // Set fake navigate target - used in some flows
            // Legacy behavior: returns { type: 'FAKE_NAVIGATE', target: ... }
            // We store both for compatibility
            const target = action.payload?.target || action.payload;
            state.fakeNavigateTarget = target;
            state.fakeNavigateType = 'FAKE_NAVIGATE';
        },
        clearFakeNavigate: (state) => {
            state.fakeNavigateTarget = null;
            state.fakeNavigateType = null;
        },
    },
});

export const reduxSlice = shellSlice;
