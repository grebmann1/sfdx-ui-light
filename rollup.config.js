import lwc from '@lwc/rollup-plugin';
import replace from '@rollup/plugin-replace';
import copy from 'rollup-plugin-copy';


export default {
    input: 'src/client/web_extension/main.js',
    output: {
        dir: 'chrome_ext/popup'
    },
    plugins: [
        replace({
            'process.env.NODE_ENV': JSON.stringify('development'),
        }),
        lwc({
            "modules": [
                { "dir": "../modules" },
                { "npm": "lightning-base-components" },
                {
                    "name": "tabulator-tables",
                    "path": "node_modules/tabulator-tables/dist/js/tabulator_esm.js"
                },
            ]
        }),
        copy({
            targets: [
              { src: 'node_modules/@salesforce-ux/design-system/assets', dest: 'chrome_ext'},
              { src: 'src/client/assets/styles/', dest: 'chrome_ext/assets'},
              { src: 'src/client/assets/libs/', dest: 'chrome_ext/assets'},
              { src: 'src/client/assets/images/', dest: 'chrome_ext/assets'}
            ],
            copyOnce: true
        }),
        copy({
            targets: [
              { src: 'src/client/web_extension/index.html', dest: 'chrome_ext' },
              { src: 'src/client/web_extension/scripts', dest: 'chrome_ext' },
              { src: 'src/client/web_extension/images', dest: 'chrome_ext' },
              { src: 'manifest.json', dest: 'chrome_ext' },
            ]
        })
    ],
};