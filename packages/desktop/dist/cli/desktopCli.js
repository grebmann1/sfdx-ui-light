#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCliArgs = parseCliArgs;
exports.resolveElectronBinary = resolveElectronBinary;
exports.main = main;
const node_child_process_1 = require("node:child_process");
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const launchIntent_1 = require("../main/launchIntent");
function printHelp() {
    process.stdout.write(`sf-toolkit-desktop\n\n`);
    process.stdout.write(`Usage:\n`);
    process.stdout.write(`  sf-toolkit-desktop\n`);
    process.stdout.write(`  sf-toolkit-desktop --org <alias>\n`);
}
function parseCliArgs(argv) {
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
function resolveElectronBinary(appPath) {
    const candidatePaths = [
        node_path_1.default.resolve(appPath, 'node_modules/.bin/electron'),
        node_path_1.default.resolve(appPath, '../../node_modules/.bin/electron'),
    ];
    const electronBinary = candidatePaths.find(candidatePath => node_fs_1.default.existsSync(candidatePath));
    if (!electronBinary) {
        throw new Error('Electron was not found. Run `npm --prefix packages/desktop install` or the root install/bootstrap workflow first.');
    }
    return electronBinary;
}
function main() {
    const launchIntent = parseCliArgs(process.argv.slice(2));
    const appPath = node_path_1.default.resolve(__dirname, '../..');
    const electronBinary = resolveElectronBinary(appPath);
    const launchArgument = (0, launchIntent_1.serializeLaunchIntent)(launchIntent);
    const child = (0, node_child_process_1.spawn)(electronBinary, [appPath, launchArgument], {
        detached: true,
        stdio: 'ignore',
    });
    child.unref();
}
if (require.main === module) {
    main();
}
