import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { guid, isUndefinedOrNull, isNotUndefinedOrNull } from 'shared/utils';
import { CATEGORY_SYSTEM, CATEGORY_CUSTOM, CATEGORY_TYPE, sanitizeCategories, sanitizeItems } from 'smartinput/utils';
import { ERROR } from 'core/store';
import { CACHE_CONFIG, loadSingleExtensionConfigFromCache, saveSingleExtensionConfigToCache } from 'shared/cacheManager';
const DEFAULT_CATEGORY = { id: guid(), type: CATEGORY_SYSTEM, name: 'Default', items: [], createdAt: Date.now(), ref: 'A', isEditable: false, isSelectable: true, isItemsEditable: true };
//const RECENT_CATEGORY = { id: guid(), type: CATEGORY_SYSTEM, name: 'Recent', items: [], createdAt: Date.now(), ref: 'R', isEditable: false, isSelectable: false, isItemsEditable: false };

const initialState = {
    categories: [DEFAULT_CATEGORY],
    activeCategoryId: DEFAULT_CATEGORY.id,
    isLeftPanelOpen: false,
};

/** Methods */

function saveCacheSettings(state) {
    try {
        const { categories, activeCategoryId } = JSON.parse(JSON.stringify(state));
        saveSingleExtensionConfigToCache(CACHE_CONFIG.INPUT_QUICKPICK_DATA.key,{
            categories,
            activeCategoryId
        });
    } catch (e) {
        console.error('Failed to save CONFIG to localstorage', e);
    }
}

function loadCacheSettings(cachedConfig, state) { 
    try {
        const { categories, activeCategoryId } = cachedConfig;
        Object.assign(state, { 
            categories:sanitizeCategories(categories).map(c => ({
                ...c,
                ...(c.items && { items: sanitizeItems(c.items) })
            })),
            activeCategoryId
        });
    } catch (e) {
        console.error('Failed to load CONFIG from localstorage', e);
    }
} 

// Helpers for Category letter refs (A, B, ..., Z, AA, AB, ...)
function indexToLetters(index) {
    let result = '';
    let n = index;
    while (n >= 0) {
        result = String.fromCharCode((n % 26) + 65) + result;
        n = Math.floor(n / 26) - 1;
    }
    return result;
}

function lettersToIndex(letters) {
    if (!letters || typeof letters !== 'string') return -1;
    let n = 0;
    for (let i = 0; i < letters.length; i++) {
        const c = letters.charCodeAt(i) - 64; // A=1
        if (c < 1 || c > 26) return -1;
        n = n * 26 + c;
    }
    return n - 1; // zero-based
}

function getNextCategoryRef(categories) {
    const list = Array.isArray(categories) ? categories : [];
    let maxIndex = -1;
    for (const c of list) {
        const idx = lettersToIndex(c?.ref);
        if (idx > maxIndex) maxIndex = idx;
    }
    return indexToLetters(maxIndex + 1);
}

// Async: load cached settings from extension storage
export const loadCacheSettingsAsync = createAsyncThunk(
    'smartInput/loadCacheSettings',
    async (_, { dispatch, getState }) => {
        try {
            return await loadSingleExtensionConfigFromCache(CACHE_CONFIG.INPUT_QUICKPICK_DATA.key);
        } catch (e) {
            console.error('loadCacheSettings.rejected --> error', e);
            dispatch(
                ERROR.reduxSlice.actions.addError({
                    message: 'Failed to load CONFIG from localstorage',
                    details: e.message,
                })
            );
            return null;
        }
    }
);

export const reduxSlice = createSlice({
    name: 'smartInput',
    initialState,
    reducers: {
        setCategories(state, action) {
            state.categories = action.payload || [];
            saveCacheSettings(state);
        },
        setActiveCategoryId(state, action) {
            state.activeCategoryId = action.payload || null;
            saveCacheSettings(state);
        },
        toggleLeftPanel(state) {
            state.isLeftPanelOpen = !state.isLeftPanelOpen;
        },
        setLeftPanelOpen(state, action) {
            state.isLeftPanelOpen = !!action.payload;
        },
        addCategory(state, action) {
            const newCategory = action.payload;
            if (newCategory) {
                const ref = newCategory.ref && lettersToIndex(newCategory.ref) >= 0
                    ? newCategory.ref
                    : getNextCategoryRef(state.categories);
                const category = { 
                    ...newCategory, 
                    ref,
                    type: CATEGORY_CUSTOM
                };
                state.categories = [...(state.categories || []), category];
                state.activeCategoryId = category.id;
            }
            saveCacheSettings(state);
        },
        updateCategory(state, action) {
            const category = action.payload;
            state.categories = (state.categories || []).map(p => (p.id === category.id ? category : p));
            saveCacheSettings(state);
        },
        deleteItemOrCategory(state, action) {
            const id = action.payload;
            let flattenedCategories = flattenCategories(state.categories);
            const _toDelete = flattenedCategories.find(p => p.id === id);
            if(isUndefinedOrNull(_toDelete)) {
                return;
            }
            if(_toDelete._type === CATEGORY_TYPE.CATEGORY && _toDelete.type !== CATEGORY_SYSTEM) {
                flattenedCategories = flattenedCategories.filter(p => p.id !== id && p._parentId !== id);
            } else if (_toDelete._type === CATEGORY_TYPE.ITEM) {
                flattenedCategories = flattenedCategories.filter(p => p.id !== id);
            }
            const newCategories = unflattenCategories(flattenedCategories);
            state.categories = newCategories;
            if (state.activeCategoryId === id) {
                state.activeCategoryId = state.categories[0]?.id || null;
            }
            saveCacheSettings(state);
        },
        reset: () => initialState,
    },
    extraReducers: builder => {
        builder.addCase(loadCacheSettingsAsync.fulfilled, (state, action) => {
            const cachedConfig = action.payload;
            if(isNotUndefinedOrNull(cachedConfig)) {
                loadCacheSettings(cachedConfig, state);
            }
        });
    }
});

const flattenCategories = (categories) => {
    // [category1, item1 (with parentId: category1), item2 (with parentId: category1), category2, item3 (with parentId: category2), item4 (with parentId: category2)]
    const _createItem = (item, { parentId, type } = {}) => {
        return {
            ...item,
            ...(type && { _type: type }),
            ...(parentId && { _parentId: parentId }),
        };
    }
    const result = [];
    categories.forEach(category => {
        const { items, ...rest } = category;
        result.push(_createItem(rest, { type: CATEGORY_TYPE.CATEGORY }));
        (items || []).forEach(item => {
            result.push(_createItem(item, { parentId: category.id, type: CATEGORY_TYPE.ITEM }));
        });
    });
    return result;
}

const unflattenCategories = (flattenedCategories) => {
    const categories = new Map();
    flattenedCategories.forEach(item => {
        if(item._type === CATEGORY_TYPE.CATEGORY) {
            const { _type, ...category } = item;
            categories.set(item.id, category);
        } else {
            const { _parentId, _type, ...input } = item;
            categories.get(_parentId).items = [...(categories.get(_parentId).items || []), input];
        }
    });
    return Array.from(categories.values());
}



export const actions = reduxSlice.actions;