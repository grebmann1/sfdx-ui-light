import lwc from '@lwc/rollup-plugin';
import replace from '@rollup/plugin-replace';
import resolve from '@rollup/plugin-node-resolve';
import cjs from '@rollup/plugin-commonjs'
import { babel } from '@rollup/plugin-babel';

import copy from 'rollup-plugin-copy';

import * as data from './package.json';

const isProduction = process.env.NODE_ENV === 'production';

console.log('data.version', data.version);
//  'process.env.NODE_ENV': isProduction?'production':'development',

const basicBundler = (input, output, name) => ({
    input,
    output: {
        file: output,
        format: 'esm',
        name,
        sourcemap: true,
    },
    plugins: [
        resolve(),
        cjs(),
        babel({
            exclude: 'node_modules/**',
            babelHelpers: 'bundled',
            compact:true,
            presets: ['@babel/preset-env']
        }),
        //terser(),  // Optional: Minifies the bundle
        replace({
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
        }),
    ]
});

export default (args) => {
    return [
        {
            input: 'src/client_chrome/main.js',
            output: {
                dir: 'chrome_ext/scripts',
                format: 'esm',
                sourcemap: true
            },
            plugins: [
                replace({
                    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
                    'process.env.IS_CHROME': true,
                    preventAssignment: true,
                }),
                resolve(), // tells Rollup how to find node modules in node_modules
                cjs(), // converts CommonJS modules to ES6, so they can be included in a Rollup bundle
                lwc({
                    "enableDynamicComponents": true,
                    "modules": [
                        { "dir": "components" },
                        { "dir": "../client/modules" },
                        { "dir": "../client/components" },
                        { "dir": "../client/applications/documentation" },
                        { "dir": "../client/applications/explorers" },
                        { "dir": "../client/applications/tools" },
                        { "dir": "../client/applications/einstein" },
                        { "npm": "lightning-base-components" },
                        {
                            "name": "lwr/navigation",
                            "path": "node_modules/@lwrjs/router/build/es/modules/lwr/navigation/navigation.js"
                        },
                    ]
                }),
                //terser(),
                copy({
                    targets: [
                        { src: 'node_modules/@salesforce-ux/design-system/assets', dest: 'chrome_ext' },
                        { src: 'src/client/assets/styles/', dest: 'chrome_ext/assets' },
                        { src: 'src/client/assets/libs/', dest: 'chrome_ext/assets' },
                        { src: 'src/client/assets/images/', dest: 'chrome_ext/assets' },
                        { src: 'node_modules/monaco-editor/min/vs/', dest: 'chrome_ext/assets/libs/monaco-editor'},
                    ],
                    copyOnce: true
                }),
                copy({
                    targets: [
                        { src: 'src/client_chrome/views/', dest: 'chrome_ext' },
                        { src: 'src/client_chrome/scripts', dest: 'chrome_ext' },
                        { src: 'src/client_chrome/images', dest: 'chrome_ext' },
                        {
                            src: 'manifest.json', dest: 'chrome_ext', transform: (contents, filename) => {
                                let newContents = contents.toString();
                                newContents = newContents.replace('__buildLogo__', isProduction ? 'images/sf-toolkit-icon-128.png' : 'images/sf-toolkit-icon-128-dev.png');
                                newContents = newContents.replace('__buildVersion__', data.version);
                                return newContents;
                            }
                        },
                    ]
                })
            ],
        },
        basicBundler('src/client_chrome/components/extension/utils/utils.js', 'chrome_ext/scripts/utils.js', 'Utils'),
        basicBundler('node_modules/hotkeys-js/dist/hotkeys.esm.js', 'chrome_ext/scripts/hotkeys.esm.js', 'hotkeys')
    ]
}
//basicBundler('src/client_chrome/scripts/modules.js', 'chrome_ext/scripts/moduleBundled.js', 'ModuleBundled'),

//];