/**
 * Store ref for use by store modules to avoid circular dependency on core/store.
 * Set by store.js after configureStore. Use getStore() only inside thunks/callbacks.
 */
export const storeRef = { current: null };

export function getStore() {
    return storeRef.current;
}
