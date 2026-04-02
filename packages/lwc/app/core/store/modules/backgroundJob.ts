import { createSlice } from '@reduxjs/toolkit';

const MAX_JOB_HISTORY = 50;
const BACKGROUND_JOB_HISTORY_CACHE_KEY = 'sfToolkit.backgroundJobs.history';
const TERMINAL_STATUSES = new Set(['finished', 'error', 'cancelled']);

const isBrowser = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined';

const coerceTimestamp = value => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? Date.now() : parsed;
};

const normalizeProgress = progress => {
    if (!progress || typeof progress !== 'object') {
        return null;
    }
    const completed = Number(progress.completed);
    const total = Number(progress.total);
    const percent = Number(progress.percent);
    return {
        completed: Number.isFinite(completed) ? completed : 0,
        total: Number.isFinite(total) ? total : 0,
        percent: Number.isFinite(percent) ? percent : null,
    };
};

const normalizeActions = actions => {
    if (!Array.isArray(actions)) {
        return [];
    }
    return actions
        .filter(action => action && typeof action === 'object')
        .map((action, index) => ({
            id: action.id || `job-action-${index}`,
            kind: action.kind || 'unknown',
            label: action.label || 'Run action',
            payload: action.payload || null,
        }));
};

const normalizeJob = (job = {}) => {
    const now = Date.now();
    const startedAt = coerceTimestamp(job.startedAt || now);
    const updatedAt = coerceTimestamp(job.updatedAt || now);
    return {
        id: job.id || `job-${now}`,
        category: job.category || 'unknown',
        label: job.label || 'Background job',
        status: job.status || 'idle',
        phase: job.phase || null,
        progress: normalizeProgress(job.progress),
        message: job.message || null,
        startedAt,
        updatedAt,
        endedAt: job.endedAt ? coerceTimestamp(job.endedAt) : null,
        error: job.error || null,
        resultSummary: job.resultSummary || null,
        source: job.source || null,
        actions: normalizeActions(job.actions),
    };
};

const trimHistory = state => {
    if (state.length > MAX_JOB_HISTORY) {
        state.splice(0, state.length - MAX_JOB_HISTORY);
    }
};

const loadCachedJobs = () => {
    if (!isBrowser()) return [];
    try {
        const raw = localStorage.getItem(BACKGROUND_JOB_HISTORY_CACHE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.map(normalizeJob).slice(-MAX_JOB_HISTORY);
    } catch (error) {
        return [];
    }
};

const saveCachedJobs = state => {
    if (!isBrowser()) return;
    try {
        const terminalJobs = state
            .filter(job => TERMINAL_STATUSES.has(job.status))
            .slice(-MAX_JOB_HISTORY)
            .map(job => ({
                id: job.id,
                category: job.category,
                label: job.label,
                status: job.status,
                startedAt: job.startedAt,
                updatedAt: job.updatedAt,
                endedAt: job.endedAt,
                // Keep lightweight history only.
                message: job.message,
            }));
        localStorage.setItem(BACKGROUND_JOB_HISTORY_CACHE_KEY, JSON.stringify(terminalJobs));
    } catch (error) {
        // no-op
    }
};

const upsertNormalizedJob = (state, payload = {}) => {
    const incoming = normalizeJob(payload);
    const index = state.findIndex(job => job.id === incoming.id);
    if (index === -1) {
        state.push(incoming);
    } else {
        state[index] = {
            ...state[index],
            ...incoming,
            startedAt: state[index].startedAt || incoming.startedAt,
        };
    }
    trimHistory(state);
};

const backgroundJobSlice = createSlice({
    name: 'backgroundJobs',
    initialState: loadCachedJobs(),
    reducers: {
        upsertJob: (state, action) => {
            upsertNormalizedJob(state, action.payload);
        },
        completeJob: (state, action) => {
            upsertNormalizedJob(state, {
                ...action.payload,
                status: 'finished',
                endedAt: Date.now(),
                updatedAt: Date.now(),
            });
            saveCachedJobs(state);
        },
        failJob: (state, action) => {
            upsertNormalizedJob(state, {
                ...action.payload,
                status: 'error',
                endedAt: Date.now(),
                updatedAt: Date.now(),
            });
            saveCachedJobs(state);
        },
        cancelJob: (state, action) => {
            upsertNormalizedJob(state, {
                ...action.payload,
                status: 'cancelled',
                endedAt: Date.now(),
                updatedAt: Date.now(),
            });
            saveCachedJobs(state);
        },
        clearJobs: () => {
            saveCachedJobs([]);
            return [];
        },
        removeJob: (state, action) => {
            const nextState = state.filter(
                job => String(job.id) !== String(action.payload?.id ?? action.payload)
            );
            saveCachedJobs(nextState);
            return nextState;
        },
    },
});

export const reduxSlice = backgroundJobSlice;
