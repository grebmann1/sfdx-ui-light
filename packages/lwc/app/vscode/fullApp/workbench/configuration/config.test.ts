import { buildUserConfiguration } from './config';

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

const browserWorkbenchConfig = buildUserConfiguration(false);
assert(
    browserWorkbenchConfig['files.autoSave'] === 'off',
    'embedded browser workbench should default autosave to off'
);

const extensionWorkbenchConfig = buildUserConfiguration(true);
assert(
    extensionWorkbenchConfig['files.autoSave'] === 'off',
    'embedded extension workbench should also default autosave to off'
);
