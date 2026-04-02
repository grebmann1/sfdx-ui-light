import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const targetFile = join(
    scriptDir,
    '../../node_modules/@lwrjs/lwc-module-provider/build/es/index.js'
);

const SEARCH = `    async getModuleSource({ name, namespace, specifier }, moduleEntry) {
        const { entry, version, id } = moduleEntry;
        name = name || explodeSpecifier(specifier).name;`;

const REPLACE = `    async getModuleSource({ name, namespace, specifier }, moduleEntry) {
        const { entry, version, id } = moduleEntry;
        name = name || explodeSpecifier(specifier).name;
        namespace = namespace || explodeSpecifier(specifier).namespace;`;

try {
    const content = readFileSync(targetFile, 'utf8');

    if (content.includes('namespace = namespace || explodeSpecifier(specifier).namespace;')) {
        console.log('[patch-lwr-hmr] Patch already applied.');
    } else if (!content.includes(SEARCH)) {
        console.warn(
            '[patch-lwr-hmr] Expected getModuleSource block not found. LWR version may have changed; skipping.'
        );
    } else {
        const patched = content.replace(SEARCH, REPLACE);
        writeFileSync(targetFile, patched, 'utf8');
        console.log('[patch-lwr-hmr] Successfully patched LWR namespace fallback.');
    }
} catch (err) {
    if (err?.code === 'ENOENT') {
        console.warn('[patch-lwr-hmr] LWR module provider file not found; skipping.');
    } else {
        throw err;
    }
}

const otelPlatformShimPath = join(
    scriptDir,
    '../../node_modules/@opentelemetry/api/build/esm/platform.js'
);
const otelPlatformShimContent = "export * from './platform/index.js';\n";
const otelPlatformNodeShimPath = join(
    scriptDir,
    '../../node_modules/@opentelemetry/api/build/esm/platform/node.js'
);
const otelPlatformNodeShimContent = "export * from './node/index.js';\n";

try {
    if (!existsSync(otelPlatformShimPath)) {
        writeFileSync(otelPlatformShimPath, otelPlatformShimContent, 'utf8');
        console.log('[patch-lwr-hmr] Added OpenTelemetry platform shim for Rollup.');
    }
    if (!existsSync(otelPlatformNodeShimPath)) {
        writeFileSync(otelPlatformNodeShimPath, otelPlatformNodeShimContent, 'utf8');
        console.log('[patch-lwr-hmr] Added OpenTelemetry platform/node shim for Rollup.');
    }
} catch (err) {
    if (err?.code === 'ENOENT') {
        console.warn(
            '[patch-lwr-hmr] OpenTelemetry path not found while adding shim; skipping.'
        );
    } else {
        throw err;
    }
}
