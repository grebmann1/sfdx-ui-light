import {
    loadExtensionConfigFromCache,
    saveExtensionConfigToCache,
    CACHE_ANALYTICS_CONFIG,
} from 'shared/cacheManager';
import { isUndefinedOrNull } from 'shared/utils';

const GA_ENDPOINT = 'https://www.google-analytics.com/mp/collect';
const DEFAULT_ENGAGEMENT_TIME_IN_MSEC = 100;
const SESSION_EXPIRATION_IN_MIN = 30;

// Defaults (can be overridden via configure())
let MEASUREMENT_ID = 'G-J8XPLSRY91';
let API_SECRET = 'BWTo0ZFqScem0ATDAX9Jdw';

type AnalyticsConfig = {
    measurementId?: string;
    apiSecret?: string;
};

type GAEvent = {
    name: string;
    params: Record<string, unknown>;
};

async function getOrCreateClientId(): Promise<string> {
    const configMap = await loadExtensionConfigFromCache([
        CACHE_ANALYTICS_CONFIG.CLIENT_STORAGE_KEY.key,
    ]);
    let clientId = configMap
        ? (configMap[CACHE_ANALYTICS_CONFIG.CLIENT_STORAGE_KEY.key] as string | null)
        : null;
    if (!clientId) {
        clientId =
            globalThis.crypto && crypto.randomUUID
                ? crypto.randomUUID()
                : `${Date.now()}_${Math.random()}`;
        await saveExtensionConfigToCache({
            [CACHE_ANALYTICS_CONFIG.CLIENT_STORAGE_KEY.key]: clientId,
        });
    }
    return clientId;
}

async function getOrCreateSessionId(): Promise<string> {
    const now = Date.now();
    const configMap = await loadExtensionConfigFromCache([
        CACHE_ANALYTICS_CONFIG.SESSION_STORAGE_KEY.key,
    ]);
    type SessionData = { session_id: string; timestamp: string };
    const cached = configMap
        ? (configMap[CACHE_ANALYTICS_CONFIG.SESSION_STORAGE_KEY.key] as SessionData | null)
        : null;
    let sessionData = cached;
    if (sessionData && sessionData.timestamp) {
        const durationInMin = (now - Number(sessionData.timestamp)) / 60000;
        if (durationInMin > SESSION_EXPIRATION_IN_MIN) {
            sessionData = null;
        } else {
            sessionData.timestamp = now.toString();
            await saveExtensionConfigToCache({
                [CACHE_ANALYTICS_CONFIG.SESSION_STORAGE_KEY.key]: sessionData,
            });
        }
    }
    if (!sessionData) {
        sessionData = { session_id: now.toString(), timestamp: now.toString() };
        await saveExtensionConfigToCache({
            [CACHE_ANALYTICS_CONFIG.SESSION_STORAGE_KEY.key]: sessionData,
        });
    }
    return sessionData.session_id;
}

async function postToGA(events: GAEvent[]): Promise<void> {
    if (!MEASUREMENT_ID || !API_SECRET) return;
    const body = {
        client_id: await getOrCreateClientId(),
        events,
    };
    try {
        await fetch(`${GA_ENDPOINT}?measurement_id=${MEASUREMENT_ID}&api_secret=${API_SECRET}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            keepalive: true,
        });
    } catch (e) {
        // Swallow errors to avoid impacting UX
    }
}

class AnalyticsTracker {
    configure({ measurementId, apiSecret }: AnalyticsConfig = {}): void {
        if (!isUndefinedOrNull(measurementId)) MEASUREMENT_ID = measurementId;
        if (!isUndefinedOrNull(apiSecret)) API_SECRET = apiSecret;
    }

    async track(eventName: string, params: Record<string, unknown> = {}): Promise<void> {
        const session_id = await getOrCreateSessionId();
        const event = {
            name: eventName,
            params: {
                session_id,
                engagement_time_msec: DEFAULT_ENGAGEMENT_TIME_IN_MSEC,
                ...params,
            },
        };
        await postToGA([event]);
    }

    async trackPageView({
        appName,
        pageTitle,
        pageLocation,
    }: {
        appName?: string;
        pageTitle?: string;
        pageLocation?: string;
    } = {}): Promise<void> {
        const session_id = await getOrCreateSessionId();
        await postToGA([
            {
                name: 'page_view',
                params: {
                    session_id,
                    engagement_time_msec: DEFAULT_ENGAGEMENT_TIME_IN_MSEC,
                    page_title: pageTitle || appName || document.title,
                    page_location:
                        pageLocation ||
                        (typeof document !== 'undefined' ? document.location.href : ''),
                    app_name: appName,
                },
            },
        ]);
    }

    async trackAppOpen(appName: string, extra: Record<string, unknown> = {}): Promise<void> {
        await this.track('app_opened', { app_name: appName, ...extra });
    }

    async trackAction(
        appName: string,
        actionName: string,
        extra: Record<string, unknown> = {}
    ): Promise<void> {
        await this.track('app_action', { app_name: appName, action_name: actionName, ...extra });
    }

    async trackError(
        appName: string,
        error: Error | string | null | undefined,
        extra: Record<string, unknown> = {}
    ): Promise<void> {
        const message =
            error && typeof error === 'object' && 'message' in error && error.message
                ? error.message
                : `${error}`;
        await this.track('app_error', { app_name: appName, message, ...extra });
    }
}

const Analytics = new AnalyticsTracker();
export default Analytics;
