import path from 'path';

const DEFAULT_MAIN_LAYOUT = 'main_layout.njk';
const CACHE_TTL = '30m';

function generateRoutes(pages, { contentDir, layoutsDir }) {
  return pages.map(({ label, filepath }) => {
    return {
      id: `page_${label}`,
      path: `/${filepath.replace('.md', '')}`,
      contentTemplate: path.join(contentDir, filepath),
      layoutTemplate: path.join(layoutsDir, DEFAULT_MAIN_LAYOUT),
      cache: { ttl: CACHE_TTL },
    };
  });
}

// Export an Application Configuration hook
// Configured in lwr.config.json[hooks]
export default class MyAppHooks {
    
    initConfigs(lwrConfig, globalData){
      // The global data contains a list of files to display in the app
      // Global data location: src/data/site/pages.json
      const pages = globalData.site.pages;
  
      // Dynamically add a new route for each page
      // Merge with other routes statically declared in lwr.config.json[routes]
      lwrConfig.routes.push(...generateRoutes(pages, lwrConfig));
    }
}