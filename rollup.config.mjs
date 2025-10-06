import path from 'path';
import fs from 'fs';
import lwc from '@lwc/rollup-plugin';
import replace from '@rollup/plugin-replace';
import resolve from '@rollup/plugin-node-resolve';
import cjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import copy from 'rollup-plugin-copy';
import alias from '@rollup/plugin-alias';
import nodePolyfills from 'rollup-plugin-polyfill-node';
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

// Build LWC-like alias entries so non-LWC bundles (e.g., background worker)
// can import modules using the "namespace/name" syntax (e.g., "shared/cacheManager").
// Supports module descriptors in three shapes:
// - { dir }
// - { name, path } → direct single-file alias mapping
const getLwcModuleAliasEntries = (modulesArg) => {
    const entries = [];
    const addDirWithNamespaces = (dirPath) => {
        try {
            if (!dirPath || !fs.existsSync(dirPath)) {
                return;
            }
            const namespaces = fs
                .readdirSync(dirPath, { withFileTypes: true })
                .filter((d) => d.isDirectory())
                .map((d) => d.name);
            namespaces.forEach((ns) => {
                const nsPath = path.join(dirPath, ns);
                if (!fs.existsSync(nsPath)) {
                    return;
                }
                const components = fs
                    .readdirSync(nsPath, { withFileTypes: true })
                    .filter((d) => d.isDirectory())
                    .map((d) => d.name);
                components.forEach((comp) => {
                    const entryJs = path.join(nsPath, comp, `${comp}.js`);
                    const entryIndexJs = path.join(nsPath, comp, 'index.js');
                    const replacement = fs.existsSync(entryJs)
                        ? entryJs
                        : (fs.existsSync(entryIndexJs) ? entryIndexJs : null);
                    if (replacement) {
                        entries.push({ find: `${ns}/${comp}`, replacement });
                    }
                });
            });
        } catch (_e) {
            // Ignore directories that don't follow the expected LWC module structure
        }
    };
    (modulesArg || []).forEach((m) => {
        if (!m) { return; }
        if (m.name && m.path && fs.existsSync(m.path)) {
            entries.push({ find: m.name, replacement: m.path });
            return;
        }
        if (m.dir) {
            addDirWithNamespaces(m.dir);
        }
    });
    return entries;
};

const lwcAliasForNonLwcBundles = (modulesArg) => {
    const entries = getLwcModuleAliasEntries(modulesArg);
    console.log('--> entries', entries);
    return entries.length ? alias({ entries }) : null;
};

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
    //{ name: 'jspdf', path: r('src/client/assets/libs/jspdf/jspdf.es.js') },
    //{ name: 'jspdf-autotable', path: r('src/client/assets/libs/jspdf/jspdf.plugin.autotable.js') },
    { name: 'imported/jsforce', path: r('src/client/assets/libs/jsforce/jsforce.js') },
    { name: 'imported/openapi-parser', path: r('src/client/assets/libs/openapi-parser/openapi-parser.esm.min.js') }
];

const injectedModules = [
    { name: 'core/store', path: r('src/client/lwc/modules/core/store/lightStore.js') }, // fake store for injection
    { dir: r('src/client_chrome/components') },
    { dir: r('src/client/lwc/components') },
    { dir: r('src/client/lwc/modules') },
    { npm: 'lightning-base-components' },
    { name: 'imported/jsforce', path: r('src/client/assets/libs/jsforce/jsforce.js') },
    { name: 'smartinput/utils', path: r('src/client/lwc/applications/tools/smartinput/utils/utils.js') },
];

const prodPlugins = isProduction ? [terserPlugin] : [];

const basicBundler = (input, output, name, useLwc = false, modulesArg, extraPlugins) => ({
    input: r(input),
    output: {
        file: r(output),
        format: 'esm',
        name,
        sourcemap: true,
        inlineDynamicImports: true,
        intro: '(typeof window!=="undefined"&&(window.openaiAgent=window.openaiAgent||{},window.openaiAgent.Agent={}));'
    },
    plugins: [
        chevrotainAlias,
        chevrotainUrlReplace,
        ...(useLwc ? [] : ((lwcAliasForNonLwcBundles(modulesArg) ? [lwcAliasForNonLwcBundles(modulesArg)] : []))),
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
        [
            { name: 'shared/cacheManager', path: r('src/client/lwc/modules/shared/cacheManager/cacheManager.js') },
            { name: 'shared/logger', path: r('src/client/lwc/modules/shared/logger/logger.js') },
            { name: 'shared/utils', path: r('src/client/lwc/modules/shared/utils/utils.js') },
        ]
    ),
    basicBundler(
        'src/client_chrome/inject/inject_salesforce.js',
        'chrome_ext/scripts/inject_salesforce.js',
        'InjectSalesforce',
        true,
        injectedModules
    ),
    basicBundler(
        'src/client_chrome/inject/inject_toolkit.js',
        'chrome_ext/scripts/inject_toolkit.js',
        'InjectToolkit',
        false,
        null
    )
];
