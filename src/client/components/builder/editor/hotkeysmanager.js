import hotkeys from 'hotkeys-js';

class HotkeysManager {
    constructor() {
        this.subscribers = new Map();
    }

    subscribe(keyCombo, callback) {
        if (!this.subscribers.has(keyCombo)) {
            this.subscribers.set(keyCombo, new Set());
            
            // Bind the hotkey using hotkeys-js
            hotkeys(keyCombo, event => {
                // Notify all subscribers
                this.subscribers.get(keyCombo)?.forEach(cb => cb(event));
            });
        }

        // Add the callback to the subscribers list
        this.subscribers.get(keyCombo).add(callback);
    }

    unsubscribe(keyCombo, callback) {
        if (this.subscribers.has(keyCombo)) {
            const callbacks = this.subscribers.get(keyCombo);
            callbacks.delete(callback);
            // If no callbacks remain for this key combo, unbind it
            if (callbacks.size === 0) {
                this.subscribers.delete(keyCombo);
                hotkeys.unbind(keyCombo);
            }
        }
    }

    cleanup() {
        // Unbind all hotkeys and clear the subscribers
        hotkeys.unbind();
        this.subscribers.clear();
    }
}

const hotkeysManager = new HotkeysManager();
export default hotkeysManager;