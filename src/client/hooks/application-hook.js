const path = require('path');
const DEFAULT_MAIN_LAYOUT = 'main.html';
const CACHE_TTL = '30m';


/** TO REFACTOR IN THE FUTUR !!!!! */
const APP_LIST = [
  'connections',
  'access',
  'code',
  'org',
  'metadata',
  'metadata/:attribute1',
  'sobject',
  'sobject/:attribute1',
  'documentation',
  'documentation/:attribute1',
  'soql',
  'platformevent',
  'anonymousapex'
]

function generateRoutes(applications, { contentDir, layoutsDir }) {
  return applications.map((app) => {
    return {
      id: `app_${app}`,
      path: `/app/${app}`,
      rootComponent: "ui/fullView",
      layoutTemplate: path.join(layoutsDir, DEFAULT_MAIN_LAYOUT),
      cache: { ttl: CACHE_TTL },
      bootstrap: {
            syntheticShadow: true
        }
    };
  });
}

class ApplicationHook {
    
    async initConfigs(lwrConfig, globalData){
      lwrConfig.routes.push(...generateRoutes(APP_LIST, lwrConfig));
    }
}

module.exports = ApplicationHook;