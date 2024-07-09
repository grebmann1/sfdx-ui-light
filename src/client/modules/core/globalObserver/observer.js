class Connector_Observer {
    constructor(initialData = {}) {
      this.data = initialData;
      this.subscribers = [];
    }
  
    // Method to subscribe to changes
    subscribe(callback) {
      this.subscribers.push(callback);
    }
  
    // Method to unsubscribe from changes
    unsubscribe(callback) {
      this.subscribers = this.subscribers.filter(sub => sub !== callback);
    }
  
    // Method to notify subscribers of changes
    notify() {
      this.subscribers.forEach(callback => callback(this.data));
    }
  
    // Proxy handler
    handler = {
      set: (obj, prop, value) => {
        obj[prop] = value;
        this.notify();
        return true;
      }
    };
  
    // Create a proxy for the data
    getDataProxy() {
      return new Proxy(this.data, this.handler);
    }
  
    // Method to get current data (can be used by components to get values)
    getCurrentData() {
      return this.data;
    }
}
const ConnectorObserver = new Connector_Observer();
export {
    ConnectorObserver
}