import path from 'path';
import lwc from '@lwc/rollup-plugin';
import replace from '@rollup/plugin-replace';
import resolve from '@rollup/plugin-node-resolve';
import cjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import copy from 'rollup-plugin-copy';
import alias from '@rollup/plugin-alias';
import nodePolyfills from 'rollup-plugin-polyfill-node';
import postcss from 'rollup-plugin-postcss';
import * as data from './package.json';

const isProduction = process.env.NODE_ENV === 'production';
const r = (...args) => path.resolve(__dirname, ...args);

// Reusable plugin instances
const resolvePlugin = resolve();
const cjsPlugin = cjs();
const terserPlugin = terser();

const chevrotainAlias = alias({
    entries: [
        {
            find: 'chevrotain/lib/src/diagrams/render_public.js',
            replacement: r('scripts/files/chevrotain_render_public_dummy.js')
        }
    ]
});

const chevrotainUrlReplace = replace({
    'https://unpkg.com/chevrotain@': '__NO_URL_CHROME_EXTENSION__',
    preventAssignment: false,
    delimiters: ['', '']
});

// Copy targets extracted for clarity
const assetCopyTargets = [
    { src: r('src/client/assets/styles'), dest: r('chrome_ext') },
    { src: r('src/client/assets/libs'), dest: r('chrome_ext') },
    { src: r('src/client/assets/images'), dest: r('chrome_ext') },
    { src: r('node_modules/@salesforce-ux/design-system/assets'), dest: r('chrome_ext') },
    { src: r('src/client/assets/releaseNotes.json'), dest: r('chrome_ext') }
];

const chromeCopyTargets = [
    { src: r('src/client_chrome/views/'), dest: r('chrome_ext') },
    { src: r('src/client_chrome/scripts'), dest: r('chrome_ext') },
    { src: r('src/client_chrome/images'), dest: r('chrome_ext') },
    {
        src: r('manifest.json'),
        dest: r('chrome_ext'),
        transform: (contents) => {
            let newContents = contents.toString();
            newContents = newContents.replace(
                '__buildLogo__',
                isProduction ? 'images/sf-toolkit-icon-128.png' : 'images/sf-toolkit-icon-128-dev.png'
            );
            newContents = newContents.replace('__buildVersion__', data.version);
            return newContents;
        }
    }
];

// Modules array extracted for clarity
const modules = [
    { dir: r('src/client_chrome/components') },
    { dir: r('src/client/lwc/modules') },
    { dir: r('src/client/lwc/components') },
    { dir: r('src/client/lwc/applications/documentation') },
    { dir: r('src/client/lwc/applications/explorers') },
    { dir: r('src/client/lwc/applications/tools') },
    { dir: r('src/client/lwc/applications/einstein') },
    { npm: 'lightning-base-components' },
    { name: 'lwr/profiler', path: r('node_modules/@lwrjs/client-modules/build/modules/lwr/profiler/profiler.js') },
    { name: 'lwr/metrics', path: r('node_modules/@lwrjs/client-modules/build/modules/lwr/metrics/metrics.js') },
    { dir: r('node_modules/@lwrjs/router/build/modules') },
    { name: 'jspdf', path: r('src/client/assets/libs/jspdf/jspdf.es.js') },
    { name: 'jspdf-autotable', path: r('src/client/assets/libs/jspdf/jspdf.plugin.autotable.js') },
    { name: 'imported/jsforce', path: r('src/client/assets/libs/jsforce/jsforce.js') }
];

const prodPlugins = isProduction ? [terserPlugin] : [];

const basicBundler = (input, output, name, useLwc = false, modulesArg, extraPlugins) => ({
    input: r(input),
    output: {
        file: r(output),
        format: 'esm',
        name,
        sourcemap: true,
        inlineDynamicImports: true
    },
    plugins: [
        chevrotainAlias,
        chevrotainUrlReplace,
        resolvePlugin,
        cjsPlugin,
        ...(useLwc
            ? [
                lwc({
                    enableDynamicComponents: true,
                    modules: modulesArg,
                }),
            ]
            : []),
        replace({
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
            '/assets/icons/': '/_slds/icons/',
            preventAssignment: true,
            'process.env.IS_CHROME': true,
            'import.meta.url': '""'
        }),
        ...(extraPlugins || []),
        ...prodPlugins
    ],
});

const coreBuilder = (modulesArg) => ({
    input: r('src/client_chrome/main.js'),
    output: {
        dir: r('chrome_ext/scripts'),
        format: 'esm',
        sourcemap: true,
    },
    plugins: [
        chevrotainAlias,
        chevrotainUrlReplace,
        replace({
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
            'process.env.IS_CHROME': true,
            preventAssignment: true,
        }),
        resolvePlugin,
        cjsPlugin,
        nodePolyfills(),
        lwc({
            enableDynamicComponents: true,
            modules: modulesArg,
        }),
        copy({
            targets: assetCopyTargets,
            copyOnce: true,
        }),
        copy({
            targets: chromeCopyTargets,
        }),
        ...prodPlugins
    ]
});

export default (args) => [
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
