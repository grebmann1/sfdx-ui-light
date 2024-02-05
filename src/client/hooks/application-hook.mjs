import path from 'path';

const DEFAULT_MAIN_LAYOUT = 'main.html';
const CACHE_TTL = '30m';


/** TO REFACTOR IN THE FUTUR !!!!! */
const APP_LIST = ['connections','access','code','org','metadata','sobject','documentation','soql']

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

export default class ApplicationHook {
    
    async initConfigs(lwrConfig, globalData){

      const applications = APP_LIST.filter(x => x.path);
      lwrConfig.routes.push(...generateRoutes(applications, lwrConfig));
    }
}