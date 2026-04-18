#!/usr/bin/env node

import { constants as fsConstants } from 'node:fs';
import { access, cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_UPSTREAM_ROOT =
    '/Users/grebmann/Documents/salesforce/projects/vscode-extensions/salesforcedx-vscode/packages/salesforcedx-vscode-soql';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');
const upstreamRoot = path.resolve(process.env.SOQL_UPSTREAM_ROOT || DEFAULT_UPSTREAM_ROOT);
const destinationRoot = path.join(
    repoRoot,
    'assets/shared/libs/extensions/salesforcedx-vscode-soql'
);

const requiredCopySpecs = [
    {
        label: 'package.json',
        sourceCandidates: ['package.json'],
        destination: 'package.json',
    },
    {
        label: 'SOQL grammar',
        sourceCandidates: ['grammars/soql.tmLanguage'],
        destination: 'grammars/soql.tmLanguage',
    },
    {
        label: 'web runtime bundle',
        sourceCandidates: ['dist/web/index.js'],
        destination: 'dist/web/index.js',
    },
    {
        label: 'SOQL server worker',
        sourceCandidates: ['dist/serverWorker.js'],
        destination: 'dist/serverWorker.js',
    },
    {
        label: 'SOQL Builder UI bundle',
        sourceCandidates: ['dist/soql-builder-ui', 'src/soql-builder-ui/dist'],
        destination: 'dist/soql-builder-ui',
    },
    {
        label: 'SOQL Data View bundle',
        sourceCandidates: ['dist/soql-data-view', 'src/soql-data-view'],
        destination: 'dist/soql-data-view',
    },
];

const optionalCopySpecs = [
    {
        label: 'SOQL images',
        sourceCandidates: ['images'],
        destination: 'images',
    },
];

async function pathExists(targetPath) {
    try {
        await access(targetPath, fsConstants.F_OK);
        return true;
    } catch {
        return false;
    }
}

async function resolveExistingSourcePath(candidates) {
    for (const candidate of candidates) {
        const absolutePath = path.join(upstreamRoot, candidate);
        if (await pathExists(absolutePath)) {
            return absolutePath;
        }
    }
    return null;
}

async function copySpec(spec, { required }) {
    const sourcePath = await resolveExistingSourcePath(spec.sourceCandidates);
    if (!sourcePath) {
        if (required) {
            throw new Error(
                `Missing required source for ${spec.label}. Checked: ${spec.sourceCandidates
                    .map(candidate => path.join(upstreamRoot, candidate))
                    .join(', ')}`
            );
        }
        console.warn(
            `[sync_soql_extension_assets] Skipping optional ${spec.label}: source not found.`
        );
        return;
    }

    const destinationPath = path.join(destinationRoot, spec.destination);
    await rm(destinationPath, { force: true, recursive: true });
    await mkdir(path.dirname(destinationPath), { recursive: true });
    await cp(sourcePath, destinationPath, { recursive: true });
    console.log(`[sync_soql_extension_assets] Copied ${spec.label}`);
}

async function main() {
    if (!(await pathExists(upstreamRoot))) {
        throw new Error(
            `Upstream SOQL package path does not exist: ${upstreamRoot}\n` +
                'Set SOQL_UPSTREAM_ROOT to override the source path.'
        );
    }

    await mkdir(destinationRoot, { recursive: true });

    for (const spec of requiredCopySpecs) {
        await copySpec(spec, { required: true });
    }
    for (const spec of optionalCopySpecs) {
        await copySpec(spec, { required: false });
    }

    console.log('[sync_soql_extension_assets] SOQL extension assets sync complete.');
}

main().catch(error => {
    console.error(
        '[sync_soql_extension_assets] Failed:',
        error instanceof Error ? error.message : error
    );
    process.exitCode = 1;
});
