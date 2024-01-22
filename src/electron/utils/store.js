const electron = require('electron');
const path = require('path');
const fs = require('fs');

class Store {

  constructor(opts) {
    const userDataPath = (electron.app || electron.remote.app).getPath('userData');
    this.path = path.join(userDataPath,'JSON Store', opts.configName + '.json');
    this.data = parseDataFile(this.path, opts.defaults || {});
  }

  isEmpty(){
    return Object.keys(this.data || {}).length == 0;
  }

  contains(key){
    //console.log(`contain for ${key}`,this.data.hasOwnProperty(key));
    return this.data.hasOwnProperty(key);
  }
  
  get(key) {
    return this.data[key];
  }
  
  set(key, val) {
    if(key){
      this.data[key] = val;
    }else{
      this.data = val;
    }
    
    if(!fs.existsSync(path.dirname(this.path))) {
      fs.mkdirSync(path.dirname(this.path), { recursive: true }) ;
    }
    fs.writeFileSync(this.path, JSON.stringify(this.data));
  }
}

function parseDataFile(filePath, defaults) {
  try {
    return JSON.parse(fs.readFileSync(filePath));
  } catch(error) {
    return defaults;
  }
}

module.exports = Store;