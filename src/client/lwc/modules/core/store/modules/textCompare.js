import { createSlice } from '@reduxjs/toolkit';
import { isNotUndefinedOrNull } from 'shared/utils';

const SETTINGS_KEY = 'TEXTCOMPARE_SETTINGS_KEY';

const initialState = {
    leftText: '',
    rightText: '',
    ignoreWhitespace: false,
    ignoreCase: false,
};

function saveCacheSettings(alias, state) {
    try {
        if (isNotUndefinedOrNull(alias)) {
            localStorage.setItem(
                `${alias}-${SETTINGS_KEY}`,
                JSON.stringify({
                    leftText: state.leftText,
                    rightText: state.rightText,
                    ignoreWhitespace: state.ignoreWhitespace,
                    ignoreCase: state.ignoreCase,
                })
            );
        }
    } catch (e) {
        console.error('Failed to save Text Compare settings to localStorage', e);
    }
}

function loadCacheSettings(alias) {
    try {
        if (isNotUndefinedOrNull(alias)) {
            const configText = localStorage.getItem(`${alias}-${SETTINGS_KEY}`);
            if (configText) return JSON.parse(configText);
        }
    } catch (e) {
        console.error('Failed to load Text Compare settings from localStorage', e);
    }
    return null;
}

export const reduxSlice = createSlice({
    name: 'textCompare',
    initialState,
    reducers: {
        setLeftText(state, action) {
            const payload = action.payload;
            const value = typeof payload === 'object' && payload !== null ? payload.value : payload;
            const alias = typeof payload === 'object' && payload !== null ? payload.alias : undefined;
            state.leftText = value ?? '';
            saveCacheSettings(alias, state);
        },
        setRightText(state, action) {
            const payload = action.payload;
            const value = typeof payload === 'object' && payload !== null ? payload.value : payload;
            const alias = typeof payload === 'object' && payload !== null ? payload.alias : undefined;
            state.rightText = value ?? '';
            saveCacheSettings(alias, state);
        },
        setTexts(state, action) {
            const { left, right, alias } = action.payload || {};
            if (left !== undefined) state.leftText = left ?? '';
            if (right !== undefined) state.rightText = right ?? '';
            saveCacheSettings(alias, state);
        },
        swap(state, action) {
            const alias = action.payload?.alias;
            const tmp = state.leftText;
            state.leftText = state.rightText;
            state.rightText = tmp;
            saveCacheSettings(alias, state);
        },
        clear(state, action) {
            const alias = action.payload?.alias;
            state.leftText = '';
            state.rightText = '';
            saveCacheSettings(alias, state);
        },
        setOptions(state, action) {
            const { ignoreWhitespace, ignoreCase, alias } = action.payload || {};
            if (ignoreWhitespace !== undefined) state.ignoreWhitespace = !!ignoreWhitespace;
            if (ignoreCase !== undefined) state.ignoreCase = !!ignoreCase;
            saveCacheSettings(alias, state);
        },
        loadCacheSettings(state, action) {
            const { alias } = action.payload || {};
            const cached = loadCacheSettings(alias);
            if (cached) {
                if (cached.leftText !== undefined) state.leftText = cached.leftText;
                if (cached.rightText !== undefined) state.rightText = cached.rightText;
                if (cached.ignoreWhitespace !== undefined) state.ignoreWhitespace = cached.ignoreWhitespace;
                if (cached.ignoreCase !== undefined) state.ignoreCase = cached.ignoreCase;
            }
        },
    },
});
