var customChromeStorageDriver = {
  _driver: 'customChromeStorageDriver',
  _initStorage: function(options) {
      // Custom implementation here...
  },
  clear: function(callback) {
      // Custom implementation here...
  },
  getItem: function(key, callback) {
      // Custom implementation here...
      return new Promise((resolve, reject) => {
          chrome.storage.local.get([key], function(result) {
              const value = result[key];
              if (callback) {
                  callback(value);
              }
              resolve(value);
          });
      });
  },
  iterate: function(iteratorCallback, successCallback) {
      // Custom implementation here...
  },    
  key: function(n, callback) {
      // Custom implementation here...
  },
  keys: function(callback) {
      // Custom implementation here...
  },
  length: function(callback) {
      // Custom implementation here...
  },
  removeItem: function(key, callback) {
      // Custom implementation here...
      return new Promise((resolve, reject) => {
        chrome.storage.local.remove(key, function() {
            if (callback) {
                callback();
            }
            resolve();
        });
    });
  },
  setItem: function(key, value, callback) {
      // Custom implementation here...
      return new Promise((resolve, reject) => {
          chrome.storage.local.set({ [key]: value }, function() {
              if (callback) {
                  callback();
              }
              resolve();
          });
      });
  }
}