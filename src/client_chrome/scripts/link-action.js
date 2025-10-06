// link-action.js: Handles magic link actions for the Chrome extension

// Helper: Parse query string into an object
function parseQuery(queryString) {
    const params = new URLSearchParams(queryString);
    const result = {};
    for (const [key, value] of params.entries()) {
        result[key] = value;
    }
    return result;
}

// Allowed setting keys mirrored from cacheManager.CACHE_CONFIG (CONFIG_OBJECT.key values)
// This prevents polluting storage with unknown keys
const ALLOWED_SETTING_KEYS = new Set([
    // AI settings
    'openai_key',
    'openai_url',
]);

/**
 * Redirects to the given URL after a delay
 * @param {string} url - The URL to redirect to
 * @param {number} delay - Delay in milliseconds
 */
function redirect(url = 'app.html', delay = 0) {
    setTimeout(() => {
        window.location.href = url;
    }, delay);
}

/**
 * Updates settings in chrome.storage.sync, excluding 'message' and 'redirect'
 * @param {Object} params - The parsed query parameters
 * @returns {Promise<void>}
 */
function updateSettings(params) {
    // Exclude non-setting fields from params
    const { message, redirect: redirectParam, data: encodedData, settings: groupedSettings, ...rawSettings } = params;
    console.log('--> params', params);

    // Prefer grouped settings if present (object or JSON string),
    // otherwise fall back to legacy top-level flattened keys
    let candidateSettings = {};
    if (groupedSettings) {
        if (typeof groupedSettings === 'string') {
            try { candidateSettings = JSON.parse(groupedSettings) || {}; } catch { candidateSettings = {}; }
        } else if (typeof groupedSettings === 'object') {
            candidateSettings = groupedSettings || {};
        }
    } else {
        candidateSettings = rawSettings;
    }

    // Filter only known keys defined in cacheManager configuration
    const filteredSettings = {};
    for (const [key, value] of Object.entries(candidateSettings)) {
        if (ALLOWED_SETTING_KEYS.has(key)) {
            filteredSettings[key] = value;
        }
    }

    if (Object.keys(filteredSettings).length === 0) {
        return Promise.resolve('No settings to update.');
    }

    return new Promise((resolve, reject) => {
        console.log('--> filteredSettings', filteredSettings);
        chrome.storage.local.set(filteredSettings, function() {
            if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
            else resolve();
        });
    });
}

function startCountdown(seconds, onTick, onDone) {
    let remaining = seconds;
   onTick(remaining);
    const interval = setInterval(() => {
        remaining--;
        onTick(remaining);
        if (remaining <= 0) {
            clearInterval(interval);
            onDone();
        }
    }, 1000);
    return () => clearInterval(interval); // returns a cancel function  
}

(async function() {
    const params = parseQuery(window.location.search);
    // Decode optional base64 data payload into params
    function base64DecodeUnicode(str) {
        try {
            return decodeURIComponent(escape(atob(str)));
        } catch (e) {
            return null;
        }
    }
    function mergeDecodedData(p) {
        if (!p.data) return p;
        const decoded = base64DecodeUnicode(p.data);
        if (!decoded) return p;
        try {
            const obj = JSON.parse(decoded);
            // Optional: verify extId matches current extension
            const currentId = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) ? chrome.runtime.id : null;
            if (obj.extId && currentId && obj.extId !== currentId) {
                // Soft warning by updating status later
            }
            const merged = { ...p };
            // Keep settings grouped under `settings` instead of flattening
            if (obj.settings && typeof obj.settings === 'object') {
                merged.settings = obj.settings;
            }
            if (obj.message && !merged.message) merged.message = obj.message;
            if (obj.redirect && !merged.redirect) merged.redirect = obj.redirect;
            delete merged.data; // prevent storing encoded blob
            return merged;
        } catch (e) {
            return p;
        }
    }
    
    const decodedParams = mergeDecodedData(params);
    const statusEl = document.getElementById('status');
    const countdownEl = document.getElementById('countdown');
    const redirectBtn = document.getElementById('redirectBtn');
    // Show custom message if provided
    if (decodedParams.message) {
        statusEl.textContent = decodedParams.message;
    }
    // Determine redirect target (default: app.html)
    const redirectTarget = decodedParams.redirect || 'app.html';
    let redirectDone = false;
    // Countdown logic
    let cancelCountdown = startCountdown(5, (remaining) => {
        if (countdownEl) countdownEl.textContent = `Redirecting in ${remaining}s...`;
        if (redirectBtn) redirectBtn.style.display = 'inline-block';
    }, () => {
        if (!redirectDone) {
            redirectDone = true;
            redirect(redirectTarget, 0);
        }
    });
    if (redirectBtn) {
        redirectBtn.addEventListener('click', () => {
            if (!redirectDone) {
                redirectDone = true;
                cancelCountdown();
                redirect(redirectTarget, 0);
            }
        });
    }
    try {
        const updateResult = await updateSettings(decodedParams);
        if (updateResult === 'No settings to update.') {
            if (!decodedParams.message) statusEl.textContent = 'No parameters found.';
            // Let countdown/redirect handle navigation
            return;
        }
        if (!decodedParams.message) statusEl.textContent = 'Settings updated! Redirecting...';
        // Let countdown/redirect handle navigation
    } catch (e) {
        statusEl.textContent = 'Error updating settings: ' + e;
        // Let countdown/redirect handle navigation
    }
})();