'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var path = require('path');
var lwc = require('@lwc/rollup-plugin');
var replace = require('@rollup/plugin-replace');
var resolve = require('@rollup/plugin-node-resolve');
var cjs = require('@rollup/plugin-commonjs');
var copy = require('rollup-plugin-copy');
var nodePolyfills = require('rollup-plugin-polyfill-node');
var terser = require('@rollup/plugin-terser');
var data = require('./package.json');

function _interopNamespaceDefault(e) {
    var n = Object.create(null);
    if (e) {
        Object.keys(e).forEach(function (k) {
            if (k !== 'default') {
                var d = Object.getOwnPropertyDescriptor(e, k);
                Object.defineProperty(n, k, d.get ? d : {
                    enumerable: true,
                    get: function () { return e[k]; }
                });
            }
        });
    }
    n.default = e;
    return Object.freeze(n);
}

var data__namespace = /*#__PURE__*/_interopNamespaceDefault(data);

const isProduction = process.env.NODE_ENV === 'production';

var rollup_config = (args) => {
    const modules = [
        { dir: path.resolve(__dirname, 'src/client_chrome/components') },
        { dir: path.resolve(__dirname, 'src/client/modules') },
        { dir: path.resolve(__dirname, 'src/client/components') },
        { dir: path.resolve(__dirname, 'src/client/applications/documentation') },
        { dir: path.resolve(__dirname, 'src/client/applications/explorers') },
        { dir: path.resolve(__dirname, 'src/client/applications/tools') },
        { dir: path.resolve(__dirname, 'src/client/applications/einstein') },
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

    const plugins = [
        replace({
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
            'process.env.IS_CHROME': true,
            '/assets/icons/': '/_slds/icons/',
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
                        newContents = newContents.replace('__buildVersion__', data__namespace.version);
                        return newContents;
                    },
                },
            ],
            copyOnce: true,
        }),
    ];

    return [
        // LWC builds combined
        {
            input: path.resolve(__dirname, 'src/client_chrome/main.js'),
            output: [
                {
                    dir: path.resolve(__dirname, 'chrome_ext/scripts'),
                    format: 'esm',
                    sourcemap: true,
                    entryFileNames: '[name].js',
                    inlineDynamicImports: true
                },
                {
                    dir: path.resolve(__dirname, 'chrome_ext/scripts'),
                    format: 'esm',
                    sourcemap: true,
                    entryFileNames: '[name].min.js',
                    inlineDynamicImports: true,
                    plugins: [terser()]
                }
            ],
            plugins
        },
        {
            input: path.resolve(__dirname, 'src/client_chrome/inject/inject_salesforce.js'),
            output: [
                {
                    dir: path.resolve(__dirname, 'chrome_ext/scripts'),
                    format: 'esm',
                    sourcemap: true,
                    entryFileNames: '[name].js',
                    inlineDynamicImports: true
                },
                {
                    dir: path.resolve(__dirname, 'chrome_ext/scripts'),
                    format: 'esm',
                    sourcemap: true,
                    entryFileNames: '[name].min.js',
                    inlineDynamicImports: true,
                    plugins: [terser()]
                }
            ],
            plugins
        },
        {
            input: path.resolve(__dirname, 'src/client_chrome/inject/inject_trailhead.js'),
            output: [
                {
                    dir: path.resolve(__dirname, 'chrome_ext/scripts'),
                    format: 'esm',
                    sourcemap: true,
                    entryFileNames: '[name].js',
                    inlineDynamicImports: true
                },
                {
                    dir: path.resolve(__dirname, 'chrome_ext/scripts'),
                    format: 'esm',
                    sourcemap: true,
                    entryFileNames: '[name].min.js',
                    inlineDynamicImports: true,
                    plugins: [terser()]
                }
            ],
            plugins
        },
        // Non-LWC builds combined
        {
            input: {
                background: path.resolve(__dirname, 'src/client_chrome/workers/background.js'),
                inject_toolkit: path.resolve(__dirname, 'src/client_chrome/inject/inject_toolkit.js'),
            },
            output: {
                dir: path.resolve(__dirname, 'chrome_ext/scripts'),
                format: 'esm',
                sourcemap: true,
                entryFileNames: '[name].js',
                inlineDynamicImports: true
            },
            plugins: [
                replace({
                    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
                    'process.env.IS_CHROME': true,
                    '/assets/icons/': '/_slds/icons/',
                    preventAssignment: true,
                }),
                resolve(),
                cjs(),
                nodePolyfills(),
                // No LWC plugin here
            ]
        },
    ];
};

exports.default = rollup_config;
