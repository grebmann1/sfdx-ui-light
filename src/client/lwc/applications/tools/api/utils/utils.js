import { guid, isUndefinedOrNull,isNotUndefinedOrNull } from 'shared/utils';

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

export const formatApiRequest = ({ endpoint, method, body, header, connector, replaceVariableValues }) => {
    let error = null;
    // Ensure the endpoint starts with a leading slash if not a full URL
    const formattedEndpoint = endpoint.startsWith('/')
        ? endpoint
        : `/${endpoint}`;

    // If the endpoint is a full URL, use it, otherwise, prepend the instance URL
    const targetUrl = endpoint.startsWith('http')
        ? endpoint
        : `${connector.conn.instanceUrl}${formattedEndpoint}`;

    // Create the base request object with method and URL
    const request = {
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
        let headers = {};
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
                        headers[key] = replaceVariableValues ? replaceVariableValues(headers[key]) : headers[key];
                    } else {
                        isValidHeader = false; // Flag invalid header
                    }
                });
        } else {
            isValidHeader = false;
        }

        // If any headers are invalid, show a toast notification
        if (!isValidHeader ) {
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

    return {request,error}; // Return the formatted request object
}