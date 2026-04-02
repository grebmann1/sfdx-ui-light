import path from 'path';
import fs from 'fs';
import lwcPlugin from '@lwc/rollup-plugin';
import replace from '@rollup/plugin-replace';
import resolve from '@rollup/plugin-node-resolve';
import cjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import { transformSync } from '@babel/core';
import syntaxDecorators from '@babel/plugin-syntax-decorators';
import transformTypescript from '@babel/plugin-transform-typescript';
import copy from 'rollup-plugin-copy';
import alias from '@rollup/plugin-alias';
import nodePolyfills from 'rollup-plugin-polyfill-node';
import * as data from '../../package.json';

const getIsProduction = (args) => (args?.NODE_ENV || process.env.NODE_ENV) === 'production';
const r = (...args) => path.resolve(__dirname, ...args);
const lwc = typeof lwcPlugin === 'function' ? lwcPlugin : lwcPlugin?.default;
if (typeof lwc !== 'function') {
    throw new TypeError(
        '@lwc/rollup-plugin export is not callable. Verify package version and Rollup CJS config interop.'
    );
}

// Some UMD/CJS deps (e.g. `sax`) rely on top-level `this` to attach globals.
// In ESM bundles Rollup rewrites top-level `this` to `undefined` by default, which can break them.
const moduleContext = (id) => {
    if (!id) return undefined;
    if (id.includes('node_modules/sax/')) return 'globalThis';
    return undefined;
};

// Reusable plugin instances
// Important: this project targets the browser (Chrome extension + web).
// Ensure Rollup resolves browser-compatible entrypoints and does not treat Node built-ins
// (e.g., "stream") as external modules.
const resolvePlugin = resolve({
    browser: true,
    preferBuiltins: false,
    extensions: ['.mjs', '.js', '.json', '.ts', '.tsx'],
});
const cjsPlugin = cjs({ requireReturnsDefault: 'auto' });
const terserPlugin = terser();
const stripTypescript = () => ({
    name: 'strip-typescript',
    transform(code, id) {
        if (!id.endsWith('.ts')) {
            return null;
        }
        const result = transformSync(code, {
            filename: id,
            babelrc: false,
            configFile: false,
            sourceMaps: true,
            plugins: [
                [syntaxDecorators, { decoratorsBeforeExport: false }],
                [transformTypescript, { allowDeclareFields: true, onlyRemoveTypeImports: true }],
            ],
        });
        if (!result) {
            return null;
        }
        return {
            code: result.code || code,
            map: result.map || null,
        };
    },
});

const assertNoBareSpecifiers = (label, patterns) => ({
    name: `assert-no-bare-specifiers-${label}`,
    generateBundle(_options, bundle) {
        const offenders = [];
        const regexes = patterns.map(p => (p instanceof RegExp ? p : new RegExp(p, 'g')));
        for (const chunk of Object.values(bundle)) {
            if (chunk.type !== 'chunk') continue;
            const code = chunk.code || '';
            const matches = [];
            regexes.forEach(regex => {
                let match;
                while ((match = regex.exec(code)) !== null) {
                    matches.push(match[0]);
                }
            });
            if (matches.length > 0) {
                offenders.push({ file: chunk.fileName, matches: matches.slice(0, 5) });
            }
        }
        if (offenders.length > 0) {
            const details = offenders
                .map(offender => `- ${offender.file}: ${offender.matches.join(', ')}`)
                .join('\n');
            this.error(
                `[${label}] Found bare module specifiers in output.\n` +
                    `${details}\n` +
                    'Ensure rollup aliases are applied and rebuild.'
            );
        }
    },
});

const chevrotainAlias = alias({
    entries: [
        {
            find: 'chevrotain/lib/src/diagrams/render_public.js',
            replacement: r('../../tools/scripts/files/chevrotain_render_public_dummy.js')
        },
        {
            // AI SDK transitively imports this path, but @opentelemetry/api only ships platform/index.js.
            // Map the missing path explicitly so Rollup can resolve it in browser bundles.
            find: '@opentelemetry/api/build/esm/platform.js',
            replacement: r('../../node_modules/@opentelemetry/api/build/esm/platform/index.js'),
        },
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
                    const entryTs = path.join(nsPath, comp, `${comp}.ts`);
                    const entryIndexJs = path.join(nsPath, comp, 'index.js');
                    const entryIndexTs = path.join(nsPath, comp, 'index.ts');
                    const replacement = fs.existsSync(entryJs)
                        ? entryJs
                        : (fs.existsSync(entryTs)
                            ? entryTs
                            : (fs.existsSync(entryIndexJs)
                                ? entryIndexJs
                                : (fs.existsSync(entryIndexTs) ? entryIndexTs : null)));
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

const createAliasPlugin = (entries) => {
    if (!entries || entries.length === 0) {
        return null;
    }
    return alias({
        entries,
        // Use the same resolver as the bundle to ensure TS/TSX extensions resolve.
        customResolver: resolve({
            browser: true,
            preferBuiltins: false,
            extensions: ['.mjs', '.js', '.json', '.ts', '.tsx'],
        }),
    });
};

const lwcAliasForNonLwcBundles = (modulesArg) => {
    const entries = getLwcModuleAliasEntries(modulesArg);
    return createAliasPlugin(entries);
};

const getSharedModulePath = (moduleName) => {
    const distPath = r(`../../packages/shared/dist/modules/${moduleName}/${moduleName}.js`);
    if (fs.existsSync(distPath)) {
        return distPath;
    }
    return r(`../../packages/shared/modules/${moduleName}/${moduleName}.ts`);
};

const sharedModules = [
    { name: 'shared/analytics', path: getSharedModulePath('analytics') },
    { name: 'shared/cacheManager', path: getSharedModulePath('cacheManager') },
    { name: 'shared/loader', path: getSharedModulePath('loader') },
    { name: 'shared/logger', path: getSharedModulePath('logger') },
    { name: 'shared/markdown', path: getSharedModulePath('markdown') },
    { name: 'shared/middleware', path: getSharedModulePath('middleware') },
    { name: 'shared/sf', path: getSharedModulePath('sf') },
    { name: 'shared/store', path: getSharedModulePath('store') },
    { name: 'shared/utils', path: getSharedModulePath('utils') },
];

const coreAliasEntries = [
    { find: 'core/bash', replacement: r('../../packages/lwc/app/core/bash/bash.ts') },
    { find: 'core/fs', replacement: r('../../packages/lwc/app/core/fs/fs.ts') },
];

// Copy targets extracted for clarity
const assetCopyTargets = [
    { src: r('../../packages/server/assets/styles'), dest: r('../../dist/extension') },
    { src: r('../../packages/server/assets/libs'), dest: r('../../dist/extension') },
    { src: r('../../packages/server/assets/images'), dest: r('../../dist/extension') },
    { src: r('../../node_modules/@salesforce-ux/design-system/assets'), dest: r('../../dist/extension') },
    // Default skills are fetched from /public/skills at runtime.
    // Note: copying a directory into ".../public/skills" would create ".../public/skills/skills/...".
    // We want "/public/skills/<...>".
    { src: r('../../assets/skills'), dest: r('../../dist/extension/public') },
    { src: r('../../packages/server/assets/releaseNotes.json'), dest: r('../../dist/extension') }
];

const getChromeCopyTargets = (isProduction) => [
    { src: r('../../packages/extension/src/views/'), dest: r('../../dist/extension') },
    {
        src: r('../../packages/extension/src/scripts'),
        dest: r('../../dist/extension'),
        filter: (name) => !name.endsWith('/viewer.js') && !name.endsWith('\\viewer.js'),
    },
    { src: r('../../packages/extension/src/images'), dest: r('../../dist/extension') },
    {
        src: r('../../packages/extension/manifest.template.json'),
        dest: r('../../dist/extension'),
        rename: 'manifest.json',
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
    { dir: r('../../packages/lwc/web-extension') },
    { dir: r('../../packages/lwc/app') },
    { dir: r('../../packages/lwc/app/component') },
    { dir: r('../../packages/lwc/app/application') },
    { dir: r('../../packages/lwc/app/pages') },
    { dir: r('../../packages/lwc/app/pages/documentation') },
    { dir: r('../../packages/lwc/app/tools') },
    { npm: 'lightning-base-components' },
    { name: 'lwr/profiler', path: r('../../node_modules/@lwrjs/client-modules/build/modules/lwr/profiler/profiler.js') },
    { name: 'lwr/metrics', path: r('../../node_modules/@lwrjs/client-modules/build/modules/lwr/metrics/metrics.js') },
    { name: 'just-bash', path: r('../../packages/server/assets/libs/just-bash/just-bash.browser.js') },
    { dir: r('../../node_modules/@lwrjs/router/build/modules') },
    { name: 'core/bash', path: r('../../packages/lwc/app/core/bash/bash.ts') },
    { name: 'core/connector', path: r('../../packages/lwc/app/core/connector/connector.ts') },
    { name: 'core/fs', path: r('../../packages/lwc/app/core/fs/fs.ts') },
    { name: 'core/store/storeRef', path: r('../../packages/lwc/app/core/store/storeRef.ts') },
    ...sharedModules,
    //{ name: 'jspdf', path: r('src/client/assets/libs/jspdf/jspdf.es.js') },
    //{ name: 'jspdf-autotable', path: r('src/client/assets/libs/jspdf/jspdf.plugin.autotable.js') },
    { name: 'imported/jsforce', path: r('../../packages/server/assets/libs/jsforce/jsforce.js') },
    { name: 'imported/openapi-parser', path: r('../../packages/server/assets/libs/openapi-parser/openapi-parser.esm.min.js') }
];

const injectedModules = [
    { name: 'core/store', path: r('../../packages/lwc/app/core/store/lightStore.ts') }, // fake store for injection
    { dir: r('../../packages/lwc/web-extension') },
    { dir: r('../../packages/lwc/app') },
    { dir: r('../../packages/lwc/app/component') },
    { dir: r('../../packages/lwc/app/application') },
    { dir: r('../../packages/lwc/app/pages') },
    { dir: r('../../packages/lwc/app/pages/documentation') },
    { dir: r('../../packages/lwc/app/tools') },
    { name: 'core/connector', path: r('../../packages/lwc/app/core/connector/connector.ts') },
    { name: 'core/store/storeRef', path: r('../../packages/lwc/app/core/store/storeRef.ts') },
    ...sharedModules,
    { npm: 'lightning-base-components' },
    { name: 'imported/jsforce', path: r('../../packages/server/assets/libs/jsforce/jsforce.js') },
    { name: 'smartinput/utils', path: r('../../packages/lwc/app/tools/smartinput/utils/utils.js') },
];

const coreStoreToLightStoreAlias = alias({
    entries: [
        {
            find: 'core/store',
            replacement: r('../../packages/lwc/app/core/store/lightStore.ts'),
        },
    ],
});

const onwarn = (warning, warn) => {
    if (warning.code === 'CIRCULAR_DEPENDENCY') {
        const ids = warning.ids || [];
        const isThirdParty = ids.some(id => id.includes('/node_modules/'));
        const isLwcSelfReference = ids.some(id => id.endsWith('.html'));
        if (isThirdParty || isLwcSelfReference) {
            return;
        }
    }
    if (warning.code === 'PURE_ANNOTATION') {
        return;
    }
    if (
        warning.code === 'SOURCEMAP_ERROR' &&
        typeof warning.id === 'string' &&
        warning.id.includes('/node_modules/')
    ) {
        return;
    }
    if (
        typeof warning.message === 'string' &&
        warning.message.includes('annotation that Rollup cannot interpret') &&
        typeof warning.id === 'string' &&
        warning.id.includes('/node_modules/')
    ) {
        return;
    }
    if (
        warning.plugin === 'rollup-plugin-lwc-compiler' &&
        typeof warning.id === 'string' &&
        warning.id.includes('/node_modules/')
    ) {
        return;
    }
    warn(warning);
};

const basicBundler = (
    input,
    output,
    name,
    isProduction,
    useLwc = false,
    modulesArg,
    extraPlugins,
    useLightStoreAlias = false
) => ({
    input: r(input),
    context: 'globalThis',
    moduleContext,
    onwarn,
    output: {
        file: r(output),
        format: 'esm',
        name,
        sourcemap: false,
        inlineDynamicImports: true,
        intro: '(typeof window!=="undefined"&&(window.openaiAgent=window.openaiAgent||{},window.openaiAgent.Agent={}));'
    },
    plugins: [
        ...(useLightStoreAlias ? [coreStoreToLightStoreAlias] : []),
        chevrotainAlias,
        chevrotainUrlReplace,
        createAliasPlugin(coreAliasEntries),
        ...(useLwc ? [] : [lwcAliasForNonLwcBundles(modulesArg)]),
        resolvePlugin,
        cjsPlugin,
        // Provide polyfills for any Node built-ins used by bundled deps (browser-only output).
        nodePolyfills(),
        ...(useLwc
            ? [
                stripTypescript(),
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
        ...(isProduction ? [terserPlugin] : []),
    ].filter(Boolean),
});

const coreBuilder = (modulesArg, isProduction) => ({
    input: r('../../packages/extension/src/main.js'),
    context: 'globalThis',
    moduleContext,
    onwarn,
    output: {
        dir: r('../../dist/extension/scripts'),
        format: 'esm',
        sourcemap: false,
    },
    plugins: [
        chevrotainAlias,
        chevrotainUrlReplace,
        createAliasPlugin(coreAliasEntries),
        replace({
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
            'process.env.IS_CHROME': true,
            preventAssignment: true,
        }),
        // Polyfill Node built-ins before resolving dependencies.
        nodePolyfills(),
        resolvePlugin,
        cjsPlugin,
        stripTypescript(),
        lwc({
            enableDynamicComponents: true,
            modules: modulesArg,
        }),
        copy({
            targets: assetCopyTargets,
            copyOnce: true,
        }),
        copy({
            targets: getChromeCopyTargets(isProduction),
        }),
        ...(isProduction ? [terserPlugin] : []),
    ]
});

/**
 * Sandbox bundle for Chrome extension (eval iframe).
 * Bundles packages/extension/src/modules/sandbox.js with puppeteer-core browser entrypoint
 * per https://pptr.dev/guides/running-puppeteer-in-extensions
 * Uses browser resolution so puppeteer-core resolves to its ESM browser build.
 */
const sandboxBuilder = (isProduction) => ({
    input: r('../../packages/extension/src/modules/sandbox.js'),
    context: 'globalThis',
    onwarn,
    output: {
        dir: r('../../dist/extension/scripts/'),
        format: 'esm'
    },
    external: ['chromium-bidi/lib/cjs/bidiMapper/BidiMapper.js'],
    plugins: [
        replace({
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
            preventAssignment: true,
        }),
        resolve({
            // Indicate that we target a browser environment.
            browser: true,
            // Keep the sandbox bundle browser-safe: only resolve the puppeteer browser build and its required deps.
            // If a required dep is excluded here, Rollup leaves a bare specifier in the output (e.g. "mitt") and the browser fails at runtime.
            resolveOnly: ['puppeteer-core'],
        }),
        ...(isProduction ? [terserPlugin] : []),
    ],
});

const getBundleTargets = (args) => {
    const raw = String(args?.BUNDLE_TARGET || process.env.BUNDLE_TARGET || 'all')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
    return raw.length ? raw : ['all'];
};

export default (args) => {
    const isProduction = getIsProduction(args);
    const mainBundles = [
        coreBuilder(modules, isProduction),
        basicBundler(
        '../../packages/extension/src/workers/background.js',
        '../../dist/extension/scripts/background.js',
        'Background',
        isProduction,
        false,
        [
            { name: 'shared/cacheManager', path: r('../../packages/shared/dist/modules/cacheManager/cacheManager.js') },
            { name: 'shared/logger', path: r('../../packages/shared/dist/modules/logger/logger.js') },
            { name: 'shared/utils', path: r('../../packages/shared/dist/modules/utils/utils.js') },
        ]
    ),
        basicBundler(
        '../../packages/extension/src/scripts/viewer.js',
        '../../dist/extension/scripts/viewer.js',
        'ExtensionViewer',
        isProduction,
        false,
        modules,
        [
            stripTypescript(),
            assertNoBareSpecifiers('viewer', [
                /['"]core\/[^'"]+['"]/g,
                /['"]shared\/[^'"]+['"]/g,
            ]),
        ]
    ),
        basicBundler(
        '../../packages/extension/src/inject/inject_salesforce.js',
        '../../dist/extension/scripts/inject_salesforce.js',
        'InjectSalesforce',
        isProduction,
        true,
        injectedModules,
        undefined,
        true
    ),
        basicBundler(
        '../../packages/extension/src/inject/inject_toolkit.js',
        '../../dist/extension/scripts/inject_toolkit.js',
        'InjectToolkit',
        isProduction,
        false,
        null
    )
    ];

    const sandboxBundles = [sandboxBuilder(isProduction)];

    const targets = getBundleTargets(args);
    if (targets.includes('all') || targets.includes('extension')) {
        return [...mainBundles, ...sandboxBundles];
    }

    const selected = [];
    if (targets.includes('main')) selected.push(...mainBundles, ...sandboxBundles);
    if (targets.includes('sandbox')) selected.push(...sandboxBundles);

    // Default to all if an unknown target is provided.
    return selected.length ? selected : [...mainBundles, ...sandboxBundles];
};
