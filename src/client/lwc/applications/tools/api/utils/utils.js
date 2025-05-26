import { guid, isUndefinedOrNull } from 'shared/utils';

export const VIEWERS = {
    PRETTY: 'Pretty',
    WORKBENCH: 'Workbench',
    RAW: 'Raw',
    PREVIEW: 'Preview',
};

export const TABS = {
    BODY: 'Body',
    HEADERS: 'Headers',
};

export const METHOD = {
    GET: 'GET',
    POST: 'POST',
    PUT: 'PUT',
    PATCH: 'PATCH',
    DELETE: 'DELETE',
};

export const DEFAULT = {
    HEADER: 'Content-Type: application/json; charset=UTF-8\nAccept: application/json',
    ENDPOINT: version => `/services/data/v${version}`,
    BODY: '',
    METHOD: METHOD.GET,
};

export const generateDefaultTab = version => {
    return {
        id: guid(),
        header: DEFAULT.HEADER,
        endpoint: DEFAULT.ENDPOINT(version),
        body: DEFAULT.BODY,
        method: DEFAULT.METHOD,
        actions: [],
        actionPointer: null,
    };
};

export const formattedContentType = contentType => {
    if (isUndefinedOrNull(contentType)) return 'text';

    if (/^(text|application)\/xml(;|$)/.test(contentType)) {
        return 'xml';
    }
    if (/^application\/json(;|$)/.test(contentType)) {
        return 'json';
    }

    if (/^text\/csv(;|$)/.test(contentType)) {
        return 'csv';
    }

    if (/^text\/html(;|$)/.test(contentType)) {
        return 'html';
    }

    if (/^image\/png(;|$)/.test(contentType)) {
        return 'png';
    }

    if (/^image\/jpeg(;|$)/.test(contentType)) {
        return 'jpeg';
    }

    if (/^image\/jpg(;|$)/.test(contentType)) {
        return 'jpg';
    }

    return 'text';
};
