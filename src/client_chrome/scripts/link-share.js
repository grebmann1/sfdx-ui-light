// link-share.js: Build shareable URLs for link-action.html with base64-encoded payload

(function() {
    function safeJsonStringify(obj) {
        try { return JSON.stringify(obj); } catch { return '{}'; }
    }

    function base64EncodeUnicode(str) {
        // Ensure proper encoding for unicode
        return btoa(unescape(encodeURIComponent(str)));
    }

    function getExtensionId() {
        try { return chrome && chrome.runtime && chrome.runtime.id; } catch { return null; }
    }

    function buildEncodedPayload(settings, message, redirect) {
        const payload = {
            extId: getExtensionId(),
            settings,
            // message/redirect are used by the UI; not stored as settings in link-action
            message: message || undefined,
            redirect: redirect || undefined,
            v: 1,
        };
        const json = safeJsonStringify(payload);
        return base64EncodeUnicode(json);
    }

    function buildShareUrl(encoded) {
        const extId = getExtensionId();
        const base = extId ? `chrome-extension://${extId}` : location.origin;
        const path = '/views/link-action.html';
        const params = new URLSearchParams();
        // Keep existing base64 payload for backward compatibility
        if (encoded) params.set('data', encoded);
        return `${base}${path}?${params.toString()}`;
    }

    function collectSettings(container) {
        const rows = Array.from(container.querySelectorAll('.kv-row'));
        const settings = {};
        for (const row of rows) {
            const key = row.querySelector('.kv-key')?.value?.trim();
            const value = row.querySelector('.kv-value')?.value ?? '';
            if (key) {
                settings[key] = value;
            }
        }
        return settings;
    }

    function addRow(container) {
        const template = document.createElement('div');
        template.className = 'slds-grid slds-gutters kv-row';
        template.innerHTML = `
            <div class="slds-col slds-size_5-of-12">
                <input class="slds-input kv-key" type="text" placeholder="key" />
            </div>
            <div class="slds-col slds-size_5-of-12">
                <input class="slds-input kv-value" type="text" placeholder="value" />
            </div>
            <div class="slds-col slds-size_2-of-12 slds-align_absolute-center">
                <button class="slds-button slds-button_icon slds-button_icon-border-filled kv-remove" type="button" title="Remove" aria-label="Remove" data-action="remove-row">×</button>
            </div>
        `;
        container.appendChild(template);
        const input = template.querySelector('.kv-key');
        if (input) input.focus();
    }

    function init() {
        console.log('--> init');
        const kvContainer = document.getElementById('kvContainer');
        const addRowBtn = document.getElementById('addRow');
        const generateBtn = document.getElementById('generateBtn');
        const shareUrlEl = document.getElementById('shareUrl');
        const copyBtn = document.getElementById('copyBtn');
        const openLink = document.getElementById('openLink');
        const result = document.getElementById('result');
        const messageEl = document.getElementById('message');
        const redirectEl = document.getElementById('redirect');

        addRowBtn?.addEventListener('click', () => addRow(kvContainer));
        kvContainer?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action="remove-row"]');
            if (btn) {
                const row = btn.closest('.kv-row');
                if (row && kvContainer.contains(row)) kvContainer.removeChild(row);
            }
        });
        generateBtn?.addEventListener('click', () => {
            const settings = collectSettings(kvContainer);
            const message = messageEl?.value || '';
            const redirect = redirectEl?.value || '';
            const encoded = buildEncodedPayload(settings, message, redirect);
            const url = buildShareUrl(encoded);
            if (shareUrlEl) shareUrlEl.value = url;
            if (openLink) openLink.href = url;
            if (result) result.classList.remove('slds-hide');
            if (shareUrlEl) shareUrlEl.select();
        });
        copyBtn?.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(shareUrlEl.value);
                copyBtn.classList.add('slds-is-selected');
                copyBtn.textContent = 'Copied';
                setTimeout(() => {
                    copyBtn.classList.remove('slds-is-selected');
                    copyBtn.textContent = 'Copy';
                }, 1500);
            } catch (e) {
                // no-op
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();


