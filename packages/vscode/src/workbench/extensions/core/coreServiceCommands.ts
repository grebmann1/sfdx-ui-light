import { registerCommand } from './extensionRegistration';

export type CommandsCoreService = {
    register?: typeof registerCommand;
};

export function buildCommandsCoreService(): CommandsCoreService {
    return {
        register: registerCommand,
    };
}
