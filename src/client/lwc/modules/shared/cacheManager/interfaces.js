import { isUndefinedOrNull, safeParseJson, isNotUndefinedOrNull } from 'shared/utils';

const chromeStore = (variant = 'local') => {
    if (variant !== 'local' && variant !== 'sync') {
        throw new Error('Invalid variant');
    }
    if (isUndefinedOrNull(chrome)) {
        throw new Error('Chrome is not available');
    }
    return {
        getItem: function (key, callback) {
            // Custom implementation here...
            return new Promise((resolve, reject) => {
                chrome.storage[variant].get([key], function (result) {
                    const value = result[key];
                    if (callback) {
                        callback(value);
                    }
                    resolve(value);
                });
            });
        },
        removeItem: function (key, callback) {
            // Custom implementation here...
            return new Promise((resolve, reject) => {
                chrome.storage[variant].remove(key, function () {
                    if (callback) {
                        callback();
                    }
                    resolve();
                });
            });
        },
        setItem: function (key, value, callback) {
            // Custom implementation here...
            return new Promise((resolve, reject) => {
                chrome.storage[variant].set({ [key]: value }, function () {
                    if (callback) {
                        callback();
                    }
                    resolve();
                });
            });
        },
    };
};

const basicStore = (variant = 'local') => {
    if (variant !== 'local' && variant !== 'session') {
        throw new Error('Invalid variant');
    }

    const storage = variant === 'local' ? window.localStorage : window.sessionStorage;

    return {
        getItem: function (key, callback) {
            const value = storage.getItem(key);
            console.log('--> getItem <---',key,value);
            const parsedValue = safeParseJson(value);
            if (callback) {
                callback(isNotUndefinedOrNull(parsedValue) && parsedValue != 'null' ? parsedValue : null); // 'null' is related to legacy code
            }
            return Promise.resolve(isNotUndefinedOrNull(parsedValue) && parsedValue != 'null' ? parsedValue : null); // 'null' is related to legacy code
        },
        setItem: function (key, value, callback) {
            try {
                storage.setItem(key, value != null ? JSON.stringify(value) : null);
                if (callback) {
                    callback();
                }
                return Promise.resolve();
            } catch (error) {
                return Promise.reject(error);
            }
        },
        removeItem: function (key, callback) {
            storage.removeItem(key);
            if (callback) {
                callback();
            }
            return Promise.resolve();
        },
    };
};

// test
export { chromeStore, basicStore };
