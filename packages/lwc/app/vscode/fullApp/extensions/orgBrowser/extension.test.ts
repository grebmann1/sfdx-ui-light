import {
    COLLAPSE_ALL_COMMAND,
    OPEN_VIEW_COMMAND,
    REFRESH_TYPE_COMMAND,
    RETRIEVE_METADATA_COMMAND,
    TREE_VIEW_ID,
    VIEW_CONTAINER_ID,
} from './constants';
import { buildOrgBrowserExtensionConfig, openOrgBrowserView } from './extensionConfig';

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

const config = buildOrgBrowserExtensionConfig();
const activitybar = config.contributes?.viewsContainers?.activitybar || [];
assert(activitybar.length === 1, 'org browser should contribute one activity-bar container');
assert(
    activitybar[0].id === VIEW_CONTAINER_ID,
    'org browser should reuse the metadata container id'
);

const views = config.contributes?.views?.[VIEW_CONTAINER_ID] || [];
assert(
    views.length === 1 && views[0].id === TREE_VIEW_ID,
    'org browser should contribute the tree view'
);

const commands = new Set((config.contributes?.commands || []).map(command => command.command));
assert(commands.has(OPEN_VIEW_COMMAND), 'org browser should expose the open-view command');
assert(commands.has(REFRESH_TYPE_COMMAND), 'org browser should expose the refresh command');
assert(commands.has(RETRIEVE_METADATA_COMMAND), 'org browser should expose the retrieve command');
assert(commands.has(COLLAPSE_ALL_COMMAND), 'org browser should expose the collapse-all command');

async function main() {
    const executedCommands: string[] = [];
    await openOrgBrowserView({
        commands: {
            async executeCommand(command: string) {
                executedCommands.push(command);
                if (command === `workbench.view.extension.${VIEW_CONTAINER_ID}`) {
                    return;
                }
                throw new Error('unexpected fallback execution');
            },
        },
    });
    assert(
        executedCommands[0] === `workbench.view.extension.${VIEW_CONTAINER_ID}`,
        'open view should focus the contributed container first'
    );
}

main().catch(error => {
    throw error;
});
