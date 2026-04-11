"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRepoRoot = getRepoRoot;
exports.getDesktopResourcesRoot = getDesktopResourcesRoot;
exports.getDesktopTemplatePath = getDesktopTemplatePath;
exports.getPackagedWebRoot = getPackagedWebRoot;
const node_path_1 = __importDefault(require("node:path"));
const electron_1 = require("electron");
function getPackageRoot() {
    return node_path_1.default.resolve(__dirname, '../..');
}
function getRepoRoot() {
    return node_path_1.default.resolve(__dirname, '../../../..');
}
function getDesktopResourcesRoot() {
    return electron_1.app.isPackaged ? node_path_1.default.join(process.resourcesPath, 'resources') : node_path_1.default.join(getPackageRoot(), 'resources');
}
function getDesktopTemplatePath(...segments) {
    return node_path_1.default.join(getDesktopResourcesRoot(), 'templates', ...segments);
}
function getPackagedWebRoot() {
    return electron_1.app.isPackaged ? node_path_1.default.join(process.resourcesPath, 'web') : node_path_1.default.join(getRepoRoot(), 'dist', 'web');
}
