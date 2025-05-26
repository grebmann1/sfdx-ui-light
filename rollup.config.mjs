
import path from 'path'; // Import the path module
import lwc from '@lwc/rollup-plugin';
import replace from '@rollup/plugin-replace';
import resolve from '@rollup/plugin-node-resolve';
import cjs from '@rollup/plugin-commonjs';
import copy from 'rollup-plugin-copy';
import alias from '@rollup/plugin-alias';
import nodePolyfills from 'rollup-plugin-polyfill-node';
import postcss from 'rollup-plugin-postcss'


import * as data from './package.json';

const isProduction = process.env.NODE_ENV === 'production';

const basicBundler = (input, output, name, useLwc = false, modules, extraPlugins) => ({
    input: path.resolve(__dirname, input), // Use path.resolve
    output: {
        file: path.resolve(__dirname, output), // Use path.resolve
        format: 'esm',
        name,
        sourcemap: true,
        inlineDynamicImports: true
    },
    plugins: [
        resolve(),
        cjs(),
        ...(useLwc
            ? [
                lwc({
                    enableDynamicComponents: true,
                    modules,
                }),
            ]
            : []), // If useLwc is false, include an empty array
        replace({
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
            '/assets/icons/': '/_slds/icons/',// replace url for icons
            preventAssignment: true,
            'process.env.IS_CHROME': true,
            'import.meta.url':'""'// to prevent issue when building the package
        }),
        ...extraPlugins ? extraPlugins : [] // to add extra plugins
    ],
});

const coreBuilder = (modules) => {
    return {
        input: path.resolve(__dirname, 'src/client_chrome/main.js'), // Use path.resolve
        output: {
            dir: path.resolve(__dirname, 'chrome_ext/scripts'), // Use path.resolve
            format: 'esm',
            sourcemap: true,
        },
        plugins: [
            replace({
                'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
                'process.env.IS_CHROME': true,
                preventAssignment: true,
            }),
            resolve(),
            cjs(),
            nodePolyfills(),
            lwc({
                enableDynamicComponents: true,
                modules,
            }),
            copy({
                targets: [
                    {
                        src: path.resolve(__dirname, 'src/client/assets/styles'),
                        dest: path.resolve(__dirname, 'chrome_ext')
                    },
                    {
                        src: path.resolve(__dirname, 'src/client/assets/libs'),
                        dest: path.resolve(__dirname, 'chrome_ext')
                    },
                    {
                        src: path.resolve(__dirname, 'src/client/assets/images'),
                        dest: path.resolve(__dirname, 'chrome_ext')
                    },
                    {
                        src: path.resolve(__dirname, 'node_modules/@salesforce-ux/design-system/assets'),
                        dest: path.resolve(__dirname, 'chrome_ext')
                    },
                    {
                        src: path.resolve(__dirname, 'src/client/assets/releaseNotes.json'),
                        dest: path.resolve(__dirname, 'chrome_ext')
                    }
                ],
                copyOnce: true,
            }),
            copy({
                targets: [
                    {
                        src: path.resolve(__dirname, 'src/client_chrome/views/'),
                        dest: path.resolve(__dirname, 'chrome_ext'),
                    },
                    {
                        src: path.resolve(__dirname, 'src/client_chrome/scripts'),
                        dest: path.resolve(__dirname, 'chrome_ext'),
                    },
                    {
                        src: path.resolve(__dirname, 'src/client_chrome/images'),
                        dest: path.resolve(__dirname, 'chrome_ext'),
                    },
                    {
                        src: path.resolve(__dirname, 'manifest.json'),
                        dest: path.resolve(__dirname, 'chrome_ext'),
                        transform: (contents, filename) => {
                            let newContents = contents.toString();
                            newContents = newContents.replace(
                                '__buildLogo__',
                                isProduction
                                    ? 'images/sf-toolkit-icon-128.png'
                                    : 'images/sf-toolkit-icon-128-dev.png'
                            );
                            newContents = newContents.replace('__buildVersion__', data.version);
                            return newContents;
                        },
                    },
                ],
            }),
        ]
    }
}


export default (args) => {
    const modules = [
        { dir: path.resolve(__dirname, 'src/client_chrome/components') },
        { dir: path.resolve(__dirname, 'src/client/lwc/modules') },
        { dir: path.resolve(__dirname, 'src/client/lwc/components') },
        { dir: path.resolve(__dirname, 'src/client/lwc/applications/documentation') },
        { dir: path.resolve(__dirname, 'src/client/lwc/applications/explorers') },
        { dir: path.resolve(__dirname, 'src/client/lwc/applications/tools') },
        { dir: path.resolve(__dirname, 'src/client/lwc/applications/einstein') },
        { npm: 'lightning-base-components' },
        { name: "lwr/profiler", path: path.resolve(__dirname, 'node_modules/@lwrjs/client-modules/build/modules/lwr/profiler/profiler.js') },
        { name: "lwr/metrics", path: path.resolve(__dirname, 'node_modules/@lwrjs/client-modules/build/modules/lwr/metrics/metrics.js') },
        { dir: path.resolve(__dirname, 'node_modules/@lwrjs/router/build/modules') },
        {
            name:'jspdf',
            path:"src/client/assets/libs/jspdf/jspdf.es.js"
        },
        {
            name:'jspdf-autotable',
            path:"src/client/assets/libs/jspdf/jspdf.plugin.autotable.js"
        },
        {
            "name": "imported/jsforce",
            "path": "src/client/assets/libs/jsforce/jsforce.js"
        }
    ];
    return [
        coreBuilder(modules),
        basicBundler(
            'src/client_chrome/workers/background.js',
            'chrome_ext/scripts/background.js',
            'Background',
            false,
            modules
        ),
        basicBundler(
            'src/client_chrome/inject/inject_salesforce.js',
            'chrome_ext/scripts/inject_salesforce.js',
            'InjectSalesforce',
            true,
            modules
        ),
        basicBundler(
            'src/client_chrome/inject/inject_toolkit.js',
            'chrome_ext/scripts/inject_toolkit.js',
            'InjectToolkit',
            false,
            null
        )
    ];
};
