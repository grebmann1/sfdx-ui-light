"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDefaultLaunchIntent = createDefaultLaunchIntent;
exports.parseLaunchIntent = parseLaunchIntent;
exports.serializeLaunchIntent = serializeLaunchIntent;
const LAUNCH_INTENT_ARG_PREFIX = '--desktop-intent=';
function isDesktopLaunchIntent(value) {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const candidate = value;
    if (candidate.target === 'app') {
        return true;
    }
    return candidate.target === 'org' && typeof candidate.orgAlias === 'string';
}
function createDefaultLaunchIntent() {
    return { target: 'app' };
}
function parseLaunchIntent(argv) {
    const encodedIntent = argv.find(argument => argument.startsWith(LAUNCH_INTENT_ARG_PREFIX));
    if (!encodedIntent) {
        return createDefaultLaunchIntent();
    }
    const base64Payload = encodedIntent.slice(LAUNCH_INTENT_ARG_PREFIX.length);
    try {
        const payload = JSON.parse(Buffer.from(base64Payload, 'base64url').toString('utf8'));
        return isDesktopLaunchIntent(payload) ? payload : createDefaultLaunchIntent();
    }
    catch {
        return createDefaultLaunchIntent();
    }
}
function serializeLaunchIntent(intent) {
    const payload = Buffer.from(JSON.stringify(intent), 'utf8').toString('base64url');
    return `${LAUNCH_INTENT_ARG_PREFIX}${payload}`;
}
