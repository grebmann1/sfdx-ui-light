export type DesktopLaunchIntent =
    | {
          target: 'app';
      }
    | {
          target: 'org';
          orgAlias: string;
      };

const LAUNCH_INTENT_ARG_PREFIX = '--desktop-intent=';

function isDesktopLaunchIntent(value: unknown): value is DesktopLaunchIntent {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const candidate = value as Record<string, unknown>;

    if (candidate.target === 'app') {
        return true;
    }

    return candidate.target === 'org' && typeof candidate.orgAlias === 'string';
}

export function createDefaultLaunchIntent(): DesktopLaunchIntent {
    return { target: 'app' };
}

export function parseLaunchIntent(argv: string[]): DesktopLaunchIntent {
    const encodedIntent = argv.find(argument => argument.startsWith(LAUNCH_INTENT_ARG_PREFIX));
    if (!encodedIntent) {
        return createDefaultLaunchIntent();
    }

    const base64Payload = encodedIntent.slice(LAUNCH_INTENT_ARG_PREFIX.length);

    try {
        const payload = JSON.parse(Buffer.from(base64Payload, 'base64url').toString('utf8'));
        return isDesktopLaunchIntent(payload) ? payload : createDefaultLaunchIntent();
    } catch {
        return createDefaultLaunchIntent();
    }
}

export function serializeLaunchIntent(intent: DesktopLaunchIntent): string {
    const payload = Buffer.from(JSON.stringify(intent), 'utf8').toString('base64url');
    return `${LAUNCH_INTENT_ARG_PREFIX}${payload}`;
}
