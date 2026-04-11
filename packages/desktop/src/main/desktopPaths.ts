import path from 'node:path';

import { app } from 'electron';

function getPackageRoot(): string {
    return path.resolve(__dirname, '../..');
}

export function getRepoRoot(): string {
    return path.resolve(__dirname, '../../../..');
}

export function getDesktopResourcesRoot(): string {
    return app.isPackaged ? path.join(process.resourcesPath, 'resources') : path.join(getPackageRoot(), 'resources');
}

export function getDesktopTemplatePath(...segments: string[]): string {
    return path.join(getDesktopResourcesRoot(), 'templates', ...segments);
}

export function getPackagedWebRoot(): string {
    return app.isPackaged ? path.join(process.resourcesPath, 'web') : path.join(getRepoRoot(), 'dist', 'web');
}
