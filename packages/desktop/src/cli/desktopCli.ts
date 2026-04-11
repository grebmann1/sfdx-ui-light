#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { serializeLaunchIntent, type DesktopLaunchIntent } from '../main/launchIntent';

function printHelp(): void {
    process.stdout.write(`sf-toolkit-desktop\n\n`);
    process.stdout.write(`Usage:\n`);
    process.stdout.write(`  sf-toolkit-desktop\n`);
    process.stdout.write(`  sf-toolkit-desktop --org <alias>\n`);
}

export function parseCliArgs(argv: string[]): DesktopLaunchIntent {
    if (argv.includes('--help') || argv.includes('-h')) {
        printHelp();
        process.exit(0);
    }

    const orgFlagIndex = argv.indexOf('--org');
    if (orgFlagIndex >= 0) {
        const orgAlias = argv[orgFlagIndex + 1];
        if (!orgAlias) {
            process.stderr.write('Missing value for --org\n');
            process.exit(1);
        }

        return {
            target: 'org',
            orgAlias,
        };
    }

    return { target: 'app' };
}

export function resolveElectronBinary(appPath: string): string {
    const candidatePaths = [
        path.resolve(appPath, 'node_modules/.bin/electron'),
        path.resolve(appPath, '../../node_modules/.bin/electron'),
    ];

    const electronBinary = candidatePaths.find(candidatePath => fs.existsSync(candidatePath));
    if (!electronBinary) {
        throw new Error(
            'Electron was not found. Run `npm --prefix packages/desktop install` or the root install/bootstrap workflow first.'
        );
    }

    return electronBinary;
}

export function main(): void {
    const launchIntent = parseCliArgs(process.argv.slice(2));
    const appPath = path.resolve(__dirname, '../..');
    const electronBinary = resolveElectronBinary(appPath);
    const launchArgument = serializeLaunchIntent(launchIntent);

    const child = spawn(electronBinary, [appPath, launchArgument], {
        detached: true,
        stdio: 'ignore',
    });

    child.unref();
}

if (require.main === module) {
    main();
}
