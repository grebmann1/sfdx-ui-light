/**
 * Bundles just-bash browser build into a single ESM file.
 * The published browser.js leaves minimatch, sprintf-js, turndown (and diff) as external
 * imports; this re-bundles with all deps inlined.
 *
 * Private class methods/fields (#foo) are transformed via Babel (targets: chrome 83)
 * for LWC and environments that don't support private syntax.
 *
 * Output: dist/just-bash.browser.js
 */

import path from 'path';
import { fileURLToPath } from 'url';
import resolve from '@rollup/plugin-node-resolve';
import cjs from '@rollup/plugin-commonjs';
import alias from '@rollup/plugin-alias';
import babel from '@rollup/plugin-babel';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
    input: path.join(__dirname, 'node_modules/just-bash/dist/bundle/browser.js'),
    output: {
        file: path.join(__dirname, 'dist', 'just-bash.browser.js'),
        format: 'esm',
        inlineDynamicImports: true,
    },
    context: 'globalThis',
    plugins: [
        alias({
            entries: [
                {
                    find: 'node:zlib',
                    replacement: path.join(__dirname, 'stubs/node-zlib-stub.js'),
                },
                {
                    find: 'node:dns',
                    replacement: path.join(__dirname, 'stubs/node-dns-stub.js'),
                },
            ],
        }),
        resolve({
            browser: true,
            preferBuiltins: false,
        }),
        cjs(),
        babel({
            babelHelpers: 'bundled',
            presets: [
                [
                    '@babel/preset-env',
                    {
                        targets: { chrome: '83' },
                    },
                ],
            ],
        }),
    ],
};
