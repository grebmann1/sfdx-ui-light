import { guid } from '../ids';
import { isUndefinedOrNull, isNotUndefinedOrNull } from '../validation';

export const VIEWERS = {
    PRETTY: 'Pretty',
    WORKBENCH: 'Workbench',
    RAW: 'Raw',
    PREVIEW: 'Preview',
    SNIPPET: 'Snippet',
};

export const TABS = {
    BODY: 'Body',
    HEADERS: 'Headers',
    VARIABLES: 'Variables',
    DETAILS: 'Details',
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
    ENDPOINT: (version: string) => `/services/data/v${version}`,
    BODY: '',
    METHOD: METHOD.GET,
    VARIABLES: '{}',
};

type ApiTab = {
    id: string;
    header: string;
    endpoint: string;
    body: string;
    method: string;
    variables: string;
    actions: unknown[];
    actionPointer: number | null;
};

export const generateDefaultTab = (version: string, id?: string): ApiTab => {
    return {
        id: id || guid(),
        header: DEFAULT.HEADER,
        endpoint: DEFAULT.ENDPOINT(version),
        body: DEFAULT.BODY,
        method: DEFAULT.METHOD,
        variables: DEFAULT.VARIABLES,
        actions: [],
        actionPointer: null,
    };
};

export const formattedContentType = (contentType?: string | null): string => {
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

type Connector = {
    conn: {
        instanceUrl: string;
        _callOptions?: {
            client?: string;
        };
    };
};

type FormatApiRequestParams = {
    endpoint: string;
    method: string;
    body: string;
    header: string | Record<string, string> | null | undefined;
    connector: Connector;
    replaceVariableValues?: (value: string) => string;
};

type FormattedApiRequest = {
    method: string;
    url: string;
    endpoint: string;
    body?: string;
    headers?: Record<string, string>;
};

export const formatApiRequest = ({
    endpoint,
    method,
    body,
    header,
    connector,
    replaceVariableValues,
}: FormatApiRequestParams): { request: FormattedApiRequest; error: string | null } => {
    let error: string | null = null;
    // Apply variable replacement to endpoint
    const replacedEndpoint = replaceVariableValues ? replaceVariableValues(endpoint) : endpoint;
    // Ensure the endpoint starts with a leading slash if not a full URL
    const formattedEndpoint = replacedEndpoint.startsWith('/')
        ? replacedEndpoint
        : `/${replacedEndpoint}`;

    // If the endpoint is a full URL, use it, otherwise, prepend the instance URL
    const targetUrl = replacedEndpoint.startsWith('http')
        ? replacedEndpoint
        : `${connector.conn.instanceUrl}${formattedEndpoint}`;

    // Create the base request object with method and URL
    const request: FormattedApiRequest = {
        method,
        url: targetUrl,
        endpoint: formattedEndpoint,
    };

    // Include body for PATCH, POST, or PUT requests
    if ([METHOD.PATCH, METHOD.POST, METHOD.PUT].includes(method)) {
        request.body = replaceVariableValues ? replaceVariableValues(body) : body;
    }

    // Process headers if they are defined
    if (isNotUndefinedOrNull(header)) {
        let headers: Record<string, string> = {};
        let isValidHeader = true;

        if (typeof header === 'object' && header !== null) {
            // If header is already an object, use it directly
            headers = { ...header };
            if (replaceVariableValues) {
                Object.keys(headers).forEach(key => {
                    headers[key] = replaceVariableValues(headers[key]);
                });
            }
        } else if (typeof header === 'string') {
            // Clean up the header string and process each line
            header
                .replace(/^[\s\r\n]+/gm, '') // Remove empty lines
                .trim()
                .split('\n')
                .forEach(line => {
                    const lineArr = line.split(':');
                    if (lineArr.length >= 2) {
                        const key = lineArr.shift().trim(); // Get the header name
                        headers[key] = lineArr.join(':').trim(); // Combine the remaining parts of the header value
                        headers[key] = replaceVariableValues
                            ? replaceVariableValues(headers[key])
                            : headers[key];
                    } else {
                        isValidHeader = false; // Flag invalid header
                    }
                });
        } else {
            isValidHeader = false;
        }

        // If any headers are invalid, show a toast notification
        if (!isValidHeader) {
            error = 'Invalid Header';
        } else {
            // Add headers to the request if valid and not empty
            if (Object.keys(headers).length > 0) {
                request.headers = {
                    ...request.headers,
                    ...headers,
                };
            }
        }
    }

    // Auto-add Sforce-Call-Options when user has set client_id in Settings (do not override if already set)
    const clientId = connector?.conn?._callOptions?.client;
    if (clientId) {
        request.headers = request.headers || {};
        const hasSforceCallOptions =
            request.headers &&
            Object.keys(request.headers).some(k => k.toLowerCase() === 'sforce-call-options');
        if (!hasSforceCallOptions) {
            request.headers['Sforce-Call-Options'] = 'client=' + clientId;
        }
    }

    return { request, error }; // Return the formatted request object
};
