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
    // Exclude 'message' and 'redirect' from settings
    const { message, redirect: redirectParam, ...settings } = params;
    if (Object.keys(settings).length === 0) {
        return Promise.resolve('No settings to update.');
    }
    return new Promise((resolve, reject) => {
        chrome.storage.sync.set(settings, function() {
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
    const statusEl = document.getElementById('status');
    const countdownEl = document.getElementById('countdown');
    const redirectBtn = document.getElementById('redirectBtn');
    // Show custom message if provided
    if (params.message) {
        statusEl.textContent = params.message;
    }
    // Determine redirect target (default: app.html)
    const redirectTarget = params.redirect || 'app.html';
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
        const updateResult = await updateSettings(params);
        if (updateResult === 'No settings to update.') {
            if (!params.message) statusEl.textContent = 'No parameters found.';
            // Let countdown/redirect handle navigation
            return;
        }
        if (!params.message) statusEl.textContent = 'Settings updated! Redirecting...';
        // Let countdown/redirect handle navigation
    } catch (e) {
        statusEl.textContent = 'Error updating settings: ' + e;
        // Let countdown/redirect handle navigation
    }
})();
