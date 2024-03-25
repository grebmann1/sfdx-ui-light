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
                { "dir": "../components" },
                { "dir": "../applications/documentation" },
                { "dir": "components" },
                { "npm": "lightning-base-components" },
                {
                    "name": "mermaid",
                    "path": "node_modules/mermaid/dist/mermaid.js"
                },
                {
                    "name": "tabulator-tables",
                    "path": "node_modules/tabulator-tables/dist/js/tabulator_esm.js"
                },
                {
                    "name": "@babel/runtime/helpers/esm/objectSpread2",
                    "path": "../../node_modules/@babel/runtime/helpers/esm/objectSpread2.js"
                },
                {
                    "name": "redux",
                    "path": "node_modules/redux/es/redux.js"
                },
                {
                    "name":"redux-thunk",
                    "path":"node_modules/redux-thunk/es/index.js"
                },
                {
                    "name":"lwr/navigation",
                    "path":"node_modules/@lwrjs/router/build/es/modules/lwr/navigation/navigation.js"
                }
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
              { src: 'src/client/web_extension/views/', dest: 'chrome_ext' },
              { src: 'src/client/web_extension/scripts', dest: 'chrome_ext' },
              { src: 'src/client/web_extension/images', dest: 'chrome_ext' },
              { src: 'manifest.json', dest: 'chrome_ext' },
              { src: 'src/client/web_extension/callback.js', dest: 'chrome_ext/popup' },
              { src: 'src/client/web_extension/side.js', dest: 'chrome_ext/popup' },
              { src: 'src/client/web_extension/popup.js', dest: 'chrome_ext/popup' },
            ]
        })
    ],
};