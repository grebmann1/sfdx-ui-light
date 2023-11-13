const fs = require('node:fs');
const path = require('node:path');
const { globSync } = require('glob');

const directories = globSync('./plugins/*');

const originalPath = path.join('./lwc.config.json');
const original = fs.readFileSync(originalPath, 'utf-8');
const original_lwc_config = JSON.parse(original);
    original_lwc_config.modules = original_lwc_config.modules.filter(x => x.main);

for (const dir of directories) {
    const filename = path.join('./', dir, 'lwc.config.json');
    const actual = fs.readFileSync(filename, 'utf-8');
    const lwc_config = JSON.parse(actual);

    const { modules } = lwc_config;
    modules.forEach(module => {
        original_lwc_config.modules.push({...path.join('./',module),...{
            src:dir
        }});
    })
}

fs.writeFileSync(originalPath, JSON.stringify(original_lwc_config, null, 4), 'utf-8');