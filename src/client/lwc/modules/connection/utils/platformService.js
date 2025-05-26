// platformService.js
import * as web from './web';
import * as chrome from './chrome';
import * as electron from './electron';
import { normalizeConfiguration } from './utils';
import { isChromeExtension,isElectronApp } from 'shared/utils';

export const PLATFORM = {
    WEB: 'web',
    CHROME: 'chrome',
    ELECTRON: 'electron',
};

export function getCurrentPlatform() {
    if (isElectronApp()) return PLATFORM.ELECTRON;
    if (isChromeExtension()) return PLATFORM.CHROME;
    return PLATFORM.WEB;
}

export async function getConfigurations() {
    let configurations = [];
    switch (getCurrentPlatform()) {
        case PLATFORM.ELECTRON:
            configurations = await electron.getConfigurations();
            break;
        /* case PLATFORM.CHROME:
            configurations = await chrome.getConfigurations(); */
        default:
            configurations = await web.getConfigurations();
    }
    return configurations.map(x => normalizeConfiguration(x,true));
}

export async function getConfiguration(alias) {
    let configuration = null;
    switch (getCurrentPlatform()) {
        case PLATFORM.ELECTRON:
            configuration = await electron.getConfiguration(alias);
            break;
        /* case PLATFORM.CHROME:
            configuration = await chrome.getConfiguration(alias); */
        default:
            configuration = await web.getConfiguration(alias);
    }
    return configuration ? normalizeConfiguration(configuration,true) : null;
}

export function saveConfiguration(alias, configuration) {
    switch (getCurrentPlatform()) {
        case PLATFORM.ELECTRON:
            return electron.saveConfiguration(alias, configuration);
        /* case PLATFORM.CHROME:
            return chrome.saveConfiguration(alias, configuration); */
        default:
            return web.saveConfiguration(alias, configuration);
    }
}

export function setConfigurations(configurations) {
    switch (getCurrentPlatform()) {
        case PLATFORM.ELECTRON:
            return electron.setConfigurations(configurations);
        /* case PLATFORM.CHROME:
            return chrome.setConfigurations(configurations); */
        default:
            return web.setConfigurations(configurations);
    }
}

export function renameConfiguration(params) {
    switch (getCurrentPlatform()) {
        case PLATFORM.ELECTRON:
            return electron.renameConfiguration(params);
        /* case PLATFORM.CHROME:
            return chrome.renameConfiguration(params); */
        default:
            return web.renameConfiguration(params);
    }
}

export function removeConfiguration(alias) {
    switch (getCurrentPlatform()) {
        case PLATFORM.ELECTRON:
            return electron.removeConfiguration(alias);
        /* case PLATFORM.CHROME:
            return chrome.removeConfiguration(alias); */
        default:
            return web.removeConfiguration(alias);
    }
}
