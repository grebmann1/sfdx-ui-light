import { LightningElement, track, api } from 'lwc';
import { guid, isNotUndefinedOrNull, isEmpty } from 'shared/utils';
import { CACHE_CONFIG, loadSingleExtensionConfigFromCache, saveSingleExtensionConfigToCache, getOpenAIKeyFromCache } from 'shared/cacheManager';
import { isTextInputLike, positionFor, isMac } from './utils';
import { checkQuery } from 'slds/hashtagDropdown';
import LOGGER from 'shared/logger';
import { sanitizeCategories, sanitizeItems } from 'smartinput/utils';

const getDeepActiveElement = (doc = document) => {
    let activeElement = doc.activeElement;
    while (activeElement && activeElement.shadowRoot && activeElement.shadowRoot.activeElement) {
        activeElement = activeElement.shadowRoot.activeElement;
    }

    return activeElement;
}

export default class InputQuickPick extends LightningElement {
    // ===== State & Configuration =====
    @track isOpen = false;
    @track top = 0;
    @track left = 0;
    @track categories = [];
    @track categoryFilter = 'ALL';
    @track searchQuery = '';
    @track isLoading = false;
    @track isEnhanceEnabled = false;
    enabled = true;
    activeInput = null;
    lastFocusedEl = null;
    recentItems = [];
    // Hotkey cycling state for Recents
    recentHotkeyIndex = -1;
    recentHotkeyTarget = null;
    // Mirror
    @track pos = { relTop: 0, relLeft: 0, pageTop: 0, pageLeft: 0 };

    // Search input modeled like composer
    get value() {
        return this.searchQuery || '';
    }
    set value(v) {
        this.searchQuery = v || '';
    }


    // ===== Getters =====

    get showHashtagDropdown() {
        const q = (this.value || '').trim();
        return isNotUndefinedOrNull(checkQuery(q));
    }

    // ===== Lifecycle =====
    connectedCallback() {
        this.template.addEventListener('mousedown', this.onContainerMouseDown);
        this.template.addEventListener('focusin', this.onFocusIn);
        document.addEventListener('keydown', this.onKeyDown, true);
        document.addEventListener('mousedown', this.onDocumentMouseDown, true);
        this.loadConfig();
    }

    disconnectedCallback() {
        document.removeEventListener('keydown', this.onKeyDown, true);
        document.removeEventListener('mousedown', this.onDocumentMouseDown, true);
    }

    async loadConfig() {
        const isEnabled = await loadSingleExtensionConfigFromCache(CACHE_CONFIG.INPUT_QUICKPICK_ENABLED.key);
        this.enabled = isEnabled !== false;
        try {
            const key = await getOpenAIKeyFromCache();
            this.isEnhanceEnabled = !isEmpty(key);
        } catch (_) {
            this.isEnhanceEnabled = false;
        }
    }


    // ===== Keyboard Events =====
    onKeyDown = async e => {
        if (!this.enabled) return;

        const cmdPressed = isMac() ? e.metaKey : e.ctrlKey;
        // Cmd/Ctrl + ArrowUp/ArrowDown → cycle and apply values from Recents to the active input
        if (cmdPressed && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            const target = getDeepActiveElement(document);
            if (isTextInputLike(target)) {
                e.preventDefault();
                e.stopPropagation();
                const direction = (e.key === 'ArrowDown') ? 1 : -1;
                await this.applyRecentByHotkey(target, direction);
            }
            return;
        }
        if (cmdPressed && (e.key || '').toLowerCase() === 'k') {
            // If Quick Pick is already open, ignore Cmd/Ctrl+K to avoid re-opening on the internal textarea
            if (this.isOpen) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            const target = getDeepActiveElement(document);
            if (isTextInputLike(target)) {
                e.preventDefault();
                await this.openForTarget(target);
            }
            return;
        }

		// Cmd/Ctrl + Enter when Quick Pick is NOT open
		if (!this.isOpen && cmdPressed && e.key === 'Enter') {
			const target = getDeepActiveElement(document);
			if (isTextInputLike(target)) {
				e.preventDefault();
				e.stopPropagation();
				const content = (this.getCurrentValueFromTarget(target) || '').trim();
				if (content) {
					// Try exact REF match from cache first
					const matched = await this.findItemByRef(content);
					if (matched && (matched.value || '')) {
						this.applyValueToTarget(target, matched.value || '');
						return;
					}
					// Otherwise, process with AI and inject suggestion
					try {
						const resp = await chrome.runtime.sendMessage({ action: 'smartinput_enhance_single', prompt: content });
						const suggestion = (resp && resp.suggestion) || '';
						if (suggestion) {
							this.applyValueToTarget(target, suggestion);
							this.updateRecents({ id: guid(), value: suggestion });
						}
					} catch (err) {
						console.error('--> quick enhance (closed) error', err);
					}
				}
			}
			return;
		}

		if (!this.isOpen) return;

        const host = this.template && this.template.host;
        const path = (typeof e.composedPath === 'function') ? e.composedPath() : [];
        const inside = host && path.includes(host);

        if (cmdPressed && e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            if (this.isEnhanceEnabled && !this.isLoading) {
                await this.handleEnhance();
            }
            return;
        }

        if (e.key === 'Escape') {
            e.preventDefault();
            this.close();
            return;
        }
        if (this.showHashtagDropdown && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Tab')) {
            e.preventDefault();
            e.stopPropagation();
            const dd = this.template.querySelector('slds-hashtag-dropdown');
            if (dd) {
                if (e.key === 'ArrowDown') dd.highlightNext();
                else if (e.key === 'ArrowUp') dd.highlightPrev();
                else if (e.key === 'Enter' || e.key === 'Tab') dd.selectHighlighted();
            }
            return;
        }

        // Trap Tab navigation between Enhance button and Textarea when inside the component
        if (inside && e.key === 'Tab') {
            e.preventDefault();
            e.stopPropagation();

            const textarea = this.template.querySelector('.chat-textarea');
            const enhanceBtn = this.isEnhanceEnabled && !this.isLoading
                ? this.template.querySelector('.chat-input-actions-right .chat-btn')
                : null;
            const candidates = [textarea, enhanceBtn].filter(Boolean);

            if (candidates.length === 0) {
                return;
            }

            const current = this.lastFocusedEl;
            if (candidates.length === 1) {
                const next = candidates[0];
                if(next?.focus) next.focus();
                return;
            }

            const currentIndex = candidates.indexOf(current);
            const direction = e.shiftKey ? -1 : 1;
            const nextIndex = currentIndex >= 0
                ? (currentIndex + direction + candidates.length) % candidates.length
                : (direction > 0 ? 0 : candidates.length - 1);
            const next = candidates[nextIndex];
            if (next?.focus) next.focus();
            return;
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.applyValue((this.searchQuery || '').trim());
            return;
        }
    };


    // ===== Composer-style Input Handlers =====
    handleInput = (e) => {
        this.value = e.target.value;
        this.handleMeasure(e);
    };

    handleHashtagSelect = (e) => {
        e.stopPropagation();
        e.preventDefault();
        const item = e && e.detail && e.detail.item;
        if (!item) return;
        const current = this.value || '';
        const token = checkQuery(current);
        const replacement = item.value || '';
        let nextValue = current;
        let caretPos = null;
        if (token) {
            const idx = current.lastIndexOf(token);
            if (idx >= 0) {
                nextValue = current.slice(0, idx) + replacement + current.slice(idx + token.length);
                caretPos = idx + replacement.length;
            }
        } else {
            nextValue = replacement;
            caretPos = (replacement || '').length;
        }

        this.value = nextValue;
        const ta = this.template.querySelector('.chat-textarea');
        if (ta) {
            ta.value = nextValue || '';
            const pos = (typeof caretPos === 'number') ? caretPos : (ta.value || '').length;
            if (ta.setSelectionRange) {
                ta.setSelectionRange(pos, pos);
            }
            ta.focus();
        }
    };


    handleReset = () => {
        this.handleSearchReset();
    };

	handleEnhance = async () => {
		const value = (this.searchQuery || '').trim();
		if (!value) return;
		// Before calling AI, if the current input equals a REF, use it directly
		try {
			const matched = await this.findItemByRef(value);
			if (matched && (matched.value || '')) {
				this.applyValue(matched);
				return;
			}
		} catch (_) { /* ignore ref lookup errors and fallback to AI */ }
		try {
			this.isLoading = true;
			await this.handleSearchEnhance();
		} finally {
			this.isLoading = false;
		}
	};

    handleSave = async () => {
        await this.handleSearchInjectValue();
    };

    onDocumentMouseDown = e => {
        if (!this.isOpen) return;
        const host = this.template && this.template.host;
        const path = (typeof e.composedPath === 'function') ? e.composedPath() : [];
        const clickedInsideHost = host && path.includes(host);
        if (clickedInsideHost) return;
        // Keep open if clicking the original input target
        if (e.target === this.activeInput) return;
        this.close();
    };

    onContainerMouseDown = e => {
        // Allow focusing inner controls; just avoid unintended bubbling if needed
        e.stopPropagation();
    };

    onFocusIn = e => {
        this.lastFocusedEl = e.target;
    };

    // ===== Open / Close =====
    async openForTarget(target) {
        this.activeInput = target;
        // Prefill composer input with current target value
        this.value = this.getCurrentValueFromTarget(target);
        // Initialize items
        await this.loadSmartInputItems();
        await this.loadSavedCategoryFilter();
        this.isOpen = true;
        // Position after render for accurate size and focus search
        requestAnimationFrame(() => {
            const { top, left } = positionFor(target, this.template.querySelector('.sf-toolkit-quickpick'));
            this.top = top;
            this.left = left;
            const ta = this.template.querySelector('.chat-textarea');
            if (ta) {
                ta.focus();
                // Ensure textarea reflects current value and place cursor at end
                try {
                    ta.value = this.value || '';
                    const len = (ta.value || '').length;
                    if(ta.setSelectionRange) {
                        ta.setSelectionRange(len, len);
                    }
                } catch (_) { }
                this.lastFocusedEl = ta;
            }
        });
        // Inform side panel (if open) to switch to the Quick Pick view
        try {
            await chrome.runtime.sendMessage({
                action: 'broadcastMessageToSidePanel',
                content: { action: 'show_input_quickpick' },
            });
        } catch (e) {
            // ignore if not available
            console.error(e);
        }
    }

    close() {
        this.isOpen = false;
        this.activeInput = null;
    }

    // ===== Positioning & Apply Value =====

    async applyValue(valueOrItem) {
        if (!this.activeInput) return;
        const input = this.activeInput;
        input.focus();
        const val = typeof valueOrItem === 'string' ? valueOrItem : (valueOrItem?.value || '');
        input.value = val;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        const itemObj = typeof valueOrItem === 'string' ? { id: null, value: val } : valueOrItem;
        if (itemObj && (itemObj.value || itemObj.id)) this.updateRecents(itemObj);
        this.close();
    }

    // Allow external components (e.g., side panel via background → injected) to apply a value
    @api
    applyFromSidePanel(valueOrItem) {
        LOGGER.debug('applyFromSidePanel', valueOrItem);
        this.applyValue(valueOrItem);
    }

    // ===== DOM Helpers =====
    

    getCurrentValueFromTarget(target) {
        if (!target) return '';
        try {
            const tag = target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') {
                return (target.value || '').toString();
            }
            if (target.isContentEditable === true) {
                return (target.textContent || '').toString();
            }
            return (target.value || target.textContent || '').toString();
        } catch (_) {
            return '';
        }
    }

    async loadSavedCategoryFilter() {
        try {
            const saved = await loadSingleExtensionConfigFromCache(CACHE_CONFIG.INPUT_QUICKPICK_SELECTED_CATEGORY.key);
            const exists = saved && (saved === 'ALL' || (this.categories || []).some(c => c.id === saved));
            this.categoryFilter = exists ? saved : 'ALL';
        } catch (_) {
            this.categoryFilter = 'ALL';
        }
    }

    // ===== Search Actions =====
    handleSearchReset = () => {
        this.value = '';
        const ta = this.template.querySelector('.chat-textarea');
        if (ta) ta.value = '';
    };

    handleSearchInjectValue = async () => {
        const value = (this.searchQuery || '').trim();
        if (!value) return;
        // Create a recent-only entry; do not write to SMARTINPUT cache
        const recent = {
            id: guid(),
            value,
        };
        this.updateRecents(recent);
        this.handleSearchReset();
    };

    handleSearchEnhance = async () => {
        const value = (this.searchQuery || '').trim();
        if (!value) return;
        try {
            const resp = await chrome.runtime.sendMessage({ action: 'smartinput_enhance_single', prompt: value });
            const suggestion = (resp && resp.suggestion) || '';
            //console.log('--> suggestion', suggestion);
            if (suggestion) {
                this.applyValue(suggestion);
            }
        } catch (e) {
            console.error('--> handleSearchEnhance error', e);
        }
    };

    // ===== Recents =====
    async loadRecents() {
        const recents = await loadSingleExtensionConfigFromCache(CACHE_CONFIG.INPUT_QUICKPICK_RECENTS.key);
        if (Array.isArray(recents)) {
            this.recentItems = recents;
        }
        return this.recentItems;
    }

    async saveRecents() {
        const toSave = (this.recentItems || []).slice(0, 30);
        await saveSingleExtensionConfigToCache(CACHE_CONFIG.INPUT_QUICKPICK_RECENTS.key, toSave);
    }

    updateRecents(item) {
        if (!item) return;
        const key = item.id || `v:${(item.value || '').trim().toLowerCase()}`;
        const unique = [];
        const seen = new Set([key]);
        unique.push({
            id: item.id || null,
            value: item.value || '',
            ref: item.ref || '',
            categoryId: item.categoryId || null,
            categoryName: item.categoryName || null,
            categoryRef: item.categoryRef || null,
        });
        for (const it of this.recentItems || []) {
            const k = it.id || `v:${(it.value || '').trim().toLowerCase()}`;
            if (seen.has(k)) continue;
            seen.add(k);
            unique.push({
                id: it.id || null,
                value: it.value || '',
                ref: it.ref || '',
                categoryId: it.categoryId || null,
                categoryName: it.categoryName || null,
                categoryRef: it.categoryRef || null,
            });
            if (unique.length >= 30) break;
        }
        this.recentItems = unique;
        this.saveRecents();
    }

    // Apply a recent value to a target input without changing Recents order
    applyValueToTarget(target, value) {
        if (!target) return;
        try {
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                target.focus();
                target.value = value || '';
                if (typeof target.setSelectionRange === 'function') {
                    const len = (target.value || '').length;
                    target.setSelectionRange(len, len);
                }
                target.dispatchEvent(new Event('input', { bubbles: true }));
                target.dispatchEvent(new Event('change', { bubbles: true }));
                return;
            }
            if (target.isContentEditable === true) {
                target.focus();
                target.textContent = value || '';
                target.dispatchEvent(new Event('input', { bubbles: true }));
                return;
            }
            // Fallback
            target.focus?.();
        } catch (_) { }
    }

    async applyRecentByHotkey(target, direction) {
        const recents = await this.loadRecents();
        if (!Array.isArray(recents) || recents.length === 0) return;
        // Reset index when target changes
        if (this.recentHotkeyTarget !== target) {
            this.recentHotkeyTarget = target;
            this.recentHotkeyIndex = -1;
        }
        const next = ((this.recentHotkeyIndex ?? -1) + direction + recents.length) % recents.length;
        this.recentHotkeyIndex = next;
        const item = recents[next];
        const value = (item && item.value) || '';
        this.applyValueToTarget(target, value);
    }

    // Focus helpers
    getFocusableElements() {
        const nodes = [];
        const cat = this.template.querySelector('#sf-toolkit-category');
        if (cat) nodes.push(cat);
        const search = this.template.querySelector('.chat-textarea');
        if (search) nodes.push(search);
        const items = Array.from(this.template.querySelectorAll('.sf-toolkit-quickpick-item'));
        nodes.push(...items);
        const actions = Array.from(this.template.querySelectorAll('.chat-input-actions-right .chat-btn'));
        nodes.push(...actions);
        return nodes.filter(Boolean);
    }

    getAllItems = (categories) => {
        return categories.flatMap(c => [c, ...(c.items || [])]);
    }

    formatRef(ref) {
        return ref && ref.startsWith('#') ? `${ref.toUpperCase()}` : `#${ref.toUpperCase()}`;
    }

    formatItem(it) {
        return { ...it, label: it.value, parentId: it.parentId, ...(it.ref ? { ref: this.formatRef(it.ref) } : {}) };
    }

    formatCategory(c) {
        return { ...c, label: c.name, items: c.items.map(it => this.formatItem(it)) };
    }

	// Lookup: find item by REF in cached Smart Input data or Recents
	async findItemByRef(refInput) {
		const raw = (refInput || '').trim();
		if (!raw) return null;
		const normalized = this.formatRef(raw);
		try {
			// Search categories/items from cache
			const data = await loadSingleExtensionConfigFromCache(
				CACHE_CONFIG.INPUT_QUICKPICK_DATA.key,
				(d) => ({
					categories: sanitizeCategories(d?.categories).map(c => ({
						...c,
						...(c.items && { items: sanitizeItems(c.items) })
					}))
				})
			);
			const categories = data?.categories || [];
			for (const c of categories) {
				for (const it of c.items || []) {
					if (it?.ref && this.formatRef(it.ref) === normalized) {
						return { ...it, ref: this.formatRef(it.ref) };
					}
				}
			}
		} catch (_) { /* ignore and continue to search recents */ }

		// Search recents
		try {
			const recents = await this.loadRecents();
			for (const it of recents || []) {
				if (it?.ref && this.formatRef(it.ref) === normalized) {
					return it;
				}
			}
		} catch (_) { /* ignore */ }

		return null;
	}

    // New: Load Smart Input categories and items from cache
    async loadSmartInputItems() {
        const data = await loadSingleExtensionConfigFromCache(CACHE_CONFIG.INPUT_QUICKPICK_DATA.key,(data) => ({
            categories: sanitizeCategories(data?.categories).map(c => {
                return {
                    ...c,
                    ...(c.items && { items: sanitizeItems(c.items).map(it => this.formatItem(it)) })
                }
            }),
            activeCategoryId: data?.activeCategoryId
        }));

        // We manually remove the Recent category because it's not needed (Legacy code, not needed anymore)
        const categories = ((data?.categories) ?? []).map(c => this.formatCategory(c)).filter(c => c.name !== 'Recent');
        const recents = (await this.loadRecents()).map(it => this.formatItem(it));
        const allItems = this.getAllItems(categories);
        const favorites = allItems.filter(it => it.isFavorite);

        
        // Normalize
        
        this.categories = [
            { id: guid(), name: 'Recent', label: 'Recent', items: recents || [] },
            { id: guid(), name: 'Favorites', label: 'Favorites', items: favorites || [] },
            { id: guid(), name: 'Categories', label: 'Categories', items: categories || [] }
        ]
    }


    /** Mirror */

    handleMeasure = (evt) => {
        const input = evt.target; // native <input>
        const coords = this.getCaretCoordinates(input, {offsetTop: 10, offsetLeft: 0});
        this.pos = coords;
    };

    getCaretCoordinates(inputEl, {offsetTop = 0, offsetLeft = 0}) {
        const selectionStart = inputEl.selectionStart ?? 0;

        // Build a mirror that matches the input's text rendering
        const style = window.getComputedStyle(inputEl);
        const mirror = this.template.querySelector('.mirror');

        // Copy key text metrics and box model props that affect layout
        mirror.style.font = style.font;
        mirror.style.letterSpacing = style.letterSpacing;
        mirror.style.textTransform = style.textTransform;
        mirror.style.textIndent = style.textIndent;
        mirror.style.tabSize = style.tabSize;
        mirror.style.whiteSpace = 'pre'; // single-line input
        mirror.style.padding = style.padding;
        mirror.style.border = style.border;
        mirror.style.boxSizing = style.boxSizing;
        mirror.style.width = style.width;
        mirror.style.lineHeight = style.lineHeight;
        mirror.style.wordSpacing = style.wordSpacing;

        // Input value split at caret
        const before = inputEl.value.slice(0, selectionStart);
        const after = inputEl.value.slice(selectionStart) || ' ';
        mirror.textContent = before;

        // Marker span to locate the caret
        const span = document.createElement('span');
        span.textContent = after[0]; // at least one char for measurement
        mirror.appendChild(span);

        // Mirror has same left/top origin as the input element
        const inputRect = inputEl.getBoundingClientRect();
        const spanRect = span.getBoundingClientRect();
        const mirrorRect = mirror.getBoundingClientRect();

        // Relative to the input box:
        const relLeft = spanRect.left - mirrorRect.left;
        const relTop = spanRect.top - mirrorRect.top;

        // Absolute page coordinates:
        const pageLeft = inputRect.left + window.scrollX + relLeft + offsetLeft;
        const pageTop = inputRect.top + window.scrollY + relTop + offsetTop;

        // Cleanup span (keep mirror div for reuse)
        span.remove();

        return {
            relLeft: Math.round(relLeft),
            relTop: Math.round(relTop),
            pageLeft: Math.round(pageLeft),
            pageTop: Math.round(pageTop),
        };
    }

}


