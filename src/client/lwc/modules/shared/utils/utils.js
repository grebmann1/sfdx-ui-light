export { classSet } from './classSet';
export * from './salesforce';
export * from './normalize';
export { generateUniqueId } from './idGenerator';
export { calculateOverflow } from './sldsOverflowLibrary';
export { LightningResizeObserver } from './sldsResizeObserver';
export * as SETUP_LINKS from './links';
export * as API from './modules/api';
export * as METADATA from './modules/metadata';
export * as ASSISTANT from './modules/assistant';
export * as PLATFORM_EVENT from './modules/platformEvent';
export {
    keyCodes,
    runActionOnBufferedTypedCharacters,
    normalizeKeyValue,
    isShiftMetaOrControlKey,
} from './keyboard';

export function enableBodyScroll() {
    document.querySelector('body').style.overflow = '';
}

export function disableBodyScroll() {
    document.querySelector('body').style.overflow = 'hidden';
}

export function isUndefinedOrNull(value) {
    return value === null || value === undefined;
}

export function isNotUndefinedOrNull(value) {
    return !isUndefinedOrNull(value);
}

export function isEmpty(str) {
    return !str || str.length === 0;
}

export function decodeError({ name, message }) {
    const e = new Error(message);
    e.name = name;
    return e;
}

export function guid() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }

    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

export function guidFromHash(input) {
    // Generate a hash from the input string
    let hash = 0;
    if (input) {
        for (let i = 0; i < input.length; i++) {
            hash = (hash << 5) - hash + input.charCodeAt(i);
            hash |= 0; // Convert to 32-bit integer
        }
    }

    // Convert the hash to a hexadecimal string
    const hashHex = Math.abs(hash).toString(16).padStart(8, '0'); // Ensure consistent length

    // Use the existing `guid` structure, injecting part of the hash
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }

    return (
        hashHex.substring(0, 4) +
        s4() +
        '-' +
        hashHex.substring(4) +
        '-' +
        s4() +
        '-' +
        s4() +
        '-' +
        s4() +
        s4() +
        s4()
    );
}

export function groupBy(items, key) {
    return items.reduce((x, y) => {
        (x[y[key]] = x[y[key]] || []).push(y);
        return x;
    }, {});
}

export function chunkArray(arr, chunkSize = 5) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
        const chunk = arr.slice(i, i + chunkSize);
        chunks.push(chunk);
    }
    return chunks;
}

export async function getAllOrgs(debugMode = false) {
    if (debugMode) {
        return [
            {
                id: 'DEMO-B2C',
                username: 'DEMO-B2C@test.com',
                company: 'DEMO',
                name: 'B2C',
                alias: 'DEMO-B2C',
            },
        ];
    }
    let res = await window.electron.invoke('org-getAllOrgs');
    res = res.sort((a, b) => a.alias.localeCompare(b.alias));
    res = res.map((item, index) => {
        return {
            ...item,
            ...{
                id: item.alias,
                username: item.value,
                company: `${
                    item.alias.split('-').length > 1 ? item.alias.split('-').shift() : ''
                }`.toUpperCase(),
                name: item.alias.split('-').pop(),
            },
        };
    });
    return res;
}

export function chunkPromises(arr, size, method) {
    if (!Array.isArray(arr) || !arr.length) {
        return Promise.resolve([]);
    }

    size = size ? size : 10;

    const chunks = [];
    for (let i = 0, j = arr.length; i < j; i += size) {
        chunks.push(arr.slice(i, i + size));
    }

    let collector = Promise.resolve([]);
    for (const chunk of chunks) {
        collector = collector.then(results =>
            Promise.all(chunk.map(params => method(params))).then(subResults =>
                results.concat(subResults)
            )
        );
    }
    return collector;
}

const buffer = {};
export function runActionAfterTimeOut(value, action, { timeout = 300 } = {}) {
    if (buffer._clearBufferId) {
        clearTimeout(buffer._clearBufferId);
    }
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    buffer._clearBufferId = setTimeout(() => {
        action(value);
    }, timeout);
}

export function timeout(interval) {
    return new Promise(resolve => {
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(resolve, interval);
    });
}

export function animationFrame() {
    return new Promise(resolve => {
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        window.requestAnimationFrame(resolve);
    });
}

export const isElectronApp = () => {
    return isNotUndefinedOrNull(window.electron);
};

export const isChromeExtension = () => {
    try {
        if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
            // Check for Chrome and Chromium-based browsers
            return true;
        }
        if (typeof browser !== 'undefined' && browser.runtime?.id) {
            // Check for Firefox
            return true;
        }
    } catch (error) {
        console.error('Error detecting browser extension environment:', error);
    }
    return false; // Not a recognized browser extension
};

export function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function getCurrentRank(mapping, check) {
    for (let i = 0; i < mapping.length; i++) {
        if (check(mapping[i])) {
            return i;
        }
    }
    return mapping.length - 1;
}

export function escapeRegExp(str) {
    if (!str) return '';
    return str.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

export function basicTextFormatter(text, filter) {
    var regex = new RegExp('(' + filter + ')', 'gim');
    if (regex.test(text)) {
        text = text
            .toString()
            .replace(regex, `<span style="font-weight:Bold; color:blue;">$1</span>`);
    }
    return text;
}

const languageMapping = {
    css: 'css',
    scss: 'scss',
    js: 'javascript',
    json: 'json',
    md: 'markdown',
    ts: 'typescript',
    txt: 'text',
    apex: 'apex', // We map apex to JAVA,
    cls: 'apex', // We map cls to JAVA
    xml: 'xml',
    design: 'xml', // We map cls to xml
    trigger: 'apex',
    html: 'html',
    page: 'html',
    auradoc: 'html',
    cmp: 'html',
    png: 'png',
    svg: 'xml',
};

export function getLanguage(extension) {
    return languageMapping.hasOwnProperty(extension) ? languageMapping[extension] : null;
}

export function formatFiles(files, defaultLanguage) {
    return [...files].map(file => {
        const extension = file?.name.includes('.') ? file?.name.split('.').pop() : null;
        return {
            ...file,
            ...{
                extension: extension, // we remove the '.' for the editor
                language: getLanguage(extension) || defaultLanguage,
            },
        };
    });
}

export function sortObjectsByField(objects, field, order) {
    // Define a map for storing the order of each element
    const orderMap = {};
    order.forEach((item, index) => {
        orderMap[item] = index;
    });

    // Sort function
    return objects.sort((a, b) => {
        // Get the order index, default to a large number if the item is not in the order array
        const orderA = orderMap.hasOwnProperty(a[field]) ? orderMap[a[field]] : 999;
        const orderB = orderMap.hasOwnProperty(b[field]) ? orderMap[b[field]] : 999;

        // Compare the order indices
        return orderA - orderB;
    });
}

export function removeDuplicates(arr, prop) {
    const unique = new Set();
    const result = arr.filter(item => {
        const val = item[prop];
        const isPresent = unique.has(val);
        unique.add(val); //always add
        return !isPresent;
    });
    return result;
}

export function getFromStorage(item, byDefault) {
    try {
        const parsedItem = JSON.parse(item);
        return isUndefinedOrNull(parsedItem) ? byDefault : parsedItem;
    } catch (e) {
        return byDefault;
    }
}

export function safeParseJson(item) {
    try {
        const parsedItem = JSON.parse(item);
        return parsedItem;
    } catch (e) {
        return null;
    }
}
/*
export function goToUrl(conn,redirectUrl){
    let url = conn.instanceUrl+'/secur/frontdoor.jsp?sid='+conn.accessToken;
    if(redirectUrl){
        url+=`&retURL=${encodeURIComponent(redirectUrl)}`
    }
    window.open(url,'_blank');
}
*/
export function checkIfPresent(a, b) {
    return (a || '').toLowerCase().includes((b || '').toLowerCase());
}

export function isSalesforceId(str) {
    // Salesforce ID pattern
    var idPattern = /^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/;

    // Check if the string matches the Salesforce ID pattern
    return idPattern.test(str);
}

export function download(data, type, filename) {
    //console.log('download');
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const download = document.createElement('a');
    download.href = window.URL.createObjectURL(blob);
    download.download = filename;
    download.click();
    URL.revokeObjectURL(url);
}

export const ROLES = {
    USER: 'user',
    SYSTEM: 'system',
    TOOL: 'tool',
};

export const runSilent = async (func, placeholder) => {
    try {
        return await func();
    } catch (e) {
        console.error('Run Silent', e);
    }
    return placeholder;
};

export const refreshCurrentTab = () => {
    if (!isChromeExtension()) return;

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        chrome.tabs.reload(tabs[0].id);
    });
};

export const forceVariableSave = (variable, value) => {
    variable = null;
    variable = value;
};

export const generateExternalId = (connector, key) => `${connector.alias}_${key}`;

export const lowerCaseKey = key => (isNotUndefinedOrNull(key) ? key.toLowerCase() : null);

export const isObject = obj => typeof obj === 'object' && obj !== null;

export const capitalizeFirstLetter = string => {
    return string.charAt(0).toUpperCase() + string.slice(1);
};

export const compareString = (a, b) => lowerCaseKey(a) === lowerCaseKey(b);

export const getFieldValue = (field, record) => {
    let value = record;
    field.split('.').forEach(name => {
        if (value) value = value[name];
    });
    return value;
};

export const arrayToMap = (array, idField, attributes, format) => {
    const _format = format ? format : x => x;
    return array.reduce((map, item) => {
        if (item.hasOwnProperty(idField)) {
            map[_format(item[idField])] = attributes
                ? Object.assign({ ...item }, attributes)
                : item;
        }
        return map;
    }, {});
};

export const extractErrorDetailsFromQuery = errorMessage => {
    const rowRegex = /Row:(\d+)/;
    const columnRegex = /Column:(\d+)/;
    const rowMatch = errorMessage.match(rowRegex);
    const columnMatch = errorMessage.match(columnRegex);

    const row = rowMatch ? parseInt(rowMatch[1], 10) : null;
    const column = columnMatch ? parseInt(columnMatch[1], 10) : null;
    const messageStartIndex = errorMessage.indexOf('\n') + 1;
    const message = errorMessage.substring(messageStartIndex).trim();

    return {
        row: row,
        column: column,
        message: message,
    };
};

export const shortFormatter = new Intl.NumberFormat('en-US', {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
});

export const splitTextByTimestamp = text => {
    // Regular expression to match the timestamp structure
    const timestampRegex = /\d{2}:\d{2}:\d{2}\.\d{1,3} \(\d{8,}\)\|/;

    // Split the text by new lines
    const lines = text.split('\n');
    // Initialize an array to store the resulting chunks
    let result = [];

    // Initialize a temporary string to build chunks
    let temp = '';

    // Iterate through each line
    lines.forEach(line => {
        if (timestampRegex.test(line)) {
            // If temp is not empty, push it to the result array
            if (temp.trim() !== '') {
                result.push(temp.trim());
            }
            // Start a new chunk with the current line
            temp = line;
        } else {
            // Append the current line to the temp string
            temp += '\n' + line;
        }
    });

    // Push the last temp to result if it's not empty
    if (temp.trim() !== '') {
        result.push(temp.trim());
    }

    return result;
};

export const isMonacoLanguageSetup = language => {
    if (!window._monacoCompletionProviders) {
        window._monacoCompletionProviders = {};
    }
    const _isSetup = window._monacoCompletionProviders[language] === true;
    window._monacoCompletionProviders[language] = true;
    return _isSetup;
};

export const prettifyXml = sourceXml => {
    var xmlDoc = new DOMParser().parseFromString(sourceXml, 'application/xml');
    var xsltDoc = new DOMParser().parseFromString(
        [
            // describes how we want to modify the XML - indent everything
            '<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform">',
            '  <xsl:strip-space elements="*"/>',
            '  <xsl:template match="para[content-style][not(text())]">', // change to just text() to strip space in text nodes
            '    <xsl:value-of select="normalize-space(.)"/>',
            '  </xsl:template>',
            '  <xsl:template match="node()|@*">',
            '    <xsl:copy><xsl:apply-templates select="node()|@*"/></xsl:copy>',
            '  </xsl:template>',
            '  <xsl:output indent="yes"/>',
            '</xsl:stylesheet>',
        ].join('\n'),
        'application/xml'
    );

    var xsltProcessor = new XSLTProcessor();
    xsltProcessor.importStylesheet(xsltDoc);
    var resultDoc = xsltProcessor.transformToDocument(xmlDoc);
    var resultXml = new XMLSerializer().serializeToString(resultDoc);
    return resultXml;
};

export function detectLanguageFromContentType(header) {
    if (!header) return null;
    const contentTypeLine = header
        .split('\n')
        .find(line => line.toLowerCase().startsWith('content-type:'));
    if (!contentTypeLine) return null;
    const value = contentTypeLine.split(':')[1]?.toLowerCase() || '';
    if (value.includes('json')) return 'json';
    if (value.includes('xml')) return 'xml';
    if (value.includes('html')) return 'html';
    if (value.includes('javascript')) return 'javascript';
    if (value.includes('text/plain')) return 'text';
    // Add more as needed
    return null;
}

export const autoDetectAndFormat = (text, header) => {
    // 1. Try header-based detection first
    const langFromHeader = detectLanguageFromContentType(header);
    if (langFromHeader) return langFromHeader;

    // 2. Fallback to content-based detection
    const trimmedText = (text || '').trim();
    if (trimmedText.startsWith('{') || trimmedText.startsWith('[')) {
        return 'json';
    }
    if (trimmedText.startsWith('<')) {
        return 'xml';
    }
    return null;
};

/** Migrated from Extension/utils **/

export const redirectToUrlViaChrome = ({
    baseUrl,
    redirectUrl,
    sessionId,
    serverUrl,
    isNewTab,
}) => {
    let params = new URLSearchParams();
    if (sessionId) {
        params.append('sessionId', sessionId);
        params.append('serverUrl', serverUrl);
    }

    if (redirectUrl) {
        params.append('redirectUrl', redirectUrl);
    }
    let url = new URL(baseUrl);
    url.search = params.toString();
    if (isNewTab) {
        window.open(url.href, '_blank');
    } else {
        window.open(url.href);
    }
};

export function getCurrentObjectType(conn, recordId) {
    return new Promise((resolve, reject) => {
        conn.tooling
            .executeAnonymous(
                "ID a='" + recordId + "';Integer.valueOf(String.valueOf(a.getSObjectType()));"
            )
            .then(res => {
                let _sobjectString = res.exceptionMessage.replace(/^.* (.*)$/, '$1');
                resolve(_sobjectString == 'null' ? null : _sobjectString);
            })
            .catch(e => {
                console.err(err);
                reject(err);
            });
    });
}

export async function getCurrentTab() {
    if (!isChromeExtension()) return null;
    let queryOptions = { active: true, lastFocusedWindow: true };
    // `tab` will either be a `tabs.Tab` instance or `undefined`.
    let [tab] = await chrome.tabs.query(queryOptions);
    return tab;
}

export function getObjectSetupLink({ host, sobjectName, durableId, isCustomSetting }) {
    if (sobjectName.endsWith('__mdt')) {
        return getCustomMetadataLink(durableId);
    } else if (isCustomSetting) {
        return `${host}/lightning/setup/CustomSettings/page?address=%2F${durableId}?setupid=CustomSettings`;
    } else if (!isEmpty(durableId) && sobjectName.endsWith('__c')) {
        return `${host}/lightning/setup/ObjectManager/${durableId}/Details/view`;
    } else {
        return `${host}/lightning/setup/ObjectManager/${sobjectName}/Details/view`;
    }
}

export function getCustomMetadataLink(durableId) {
    return `${host}/lightning/setup/CustomMetadata/page?address=%2F${durableId}%3Fsetupid%3DCustomMetadata`;
}

export function getObjectFieldsSetupLink({ host, sobjectName, durableId, isCustomSetting }) {
    if (sobjectName.endsWith('__mdt')) {
        return getCustomMetadataLink(durableId);
    } else if (isCustomSetting) {
        return `${host}/lightning/setup/CustomSettings/page?address=%2F${durableId}?setupid=CustomSettings`;
    } else if (
        !isEmpty(durableId) &&
        (sobjectName.endsWith('__c') || sobjectName.endsWith('__kav'))
    ) {
        return `${host}/lightning/setup/ObjectManager/${durableId}/FieldsAndRelationships/view`;
    } else {
        return `${host}/lightning/setup/ObjectManager/${sobjectName}/FieldsAndRelationships/view`;
    }
}

export function getObjectFieldDetailSetupLink({
    host,
    sobjectName,
    durableId,
    fieldName,
    fieldNameDurableId,
}) {
    const _sobjectParam =
        sobjectName.endsWith('__c') || sobjectName.endsWith('__kav') ? durableId : sobjectName;
    const _fieldParam =
        sobjectName.endsWith('__c') || sobjectName.endsWith('__kav')
            ? fieldNameDurableId
            : fieldName;

    return `${host}/lightning/setup/ObjectManager/${_sobjectParam}/FieldsAndRelationships/${_fieldParam}/view`;
}

export function getObjectListLink({ host, sobjectName, keyPrefix, isCustomSetting }) {
    if (sobjectName.endsWith('__mdt')) {
        return `${host}/lightning/setup/CustomMetadata/page?address=%2F${keyPrefix}`;
    } else if (isCustomSetting) {
        return `${host}/lightning/setup/CustomSettings/page?address=%2Fsetup%2Fui%2FlistCustomSettingsData.apexp?id=${keyPrefix}`;
    } else {
        return `${host}/lightning/o/${sobjectName}/list`;
    }
}

export function getRecordTypesLink({ host, sobjectName, durableId }) {
    if (sobjectName.endsWith('__c') || sobjectName.endsWith('__kav')) {
        return `${host}/lightning/setup/ObjectManager/${durableId}/RecordTypes/view`;
    } else {
        return `${host}/lightning/setup/ObjectManager/${sobjectName}/RecordTypes/view`;
    }
}

export function getObjectDocLink(sobjectName, isUsingToolingApi) {
    if (isUsingToolingApi) {
        return `https://developer.salesforce.com/docs/atlas.en-us.api_tooling.meta/api_tooling/tooling_api_objects_${sobjectName.toLowerCase()}.htm`;
    }
    return `https://developer.salesforce.com/docs/atlas.en-us.object_reference.meta/object_reference/sforce_api_objects_${sobjectName.toLowerCase()}.htm`;
}

export function getSobject(href) {
    let url = new URL(href);
    if (url.pathname) {
        let match = url.pathname.match(/\/lightning\/[r|o]\/([a-zA-Z0-9_]+)\/[a-zA-Z0-9]+/);
        if (match) {
            return match[1];
        }
    }
    return null;
}

const extractRecordId = href => {
    if (!href) return null;
    try {
        let url = new URL(href);
        // Find record ID from URL
        let searchParams = new URLSearchParams(url.search.substring(1));
        // Salesforce Classic and Console
        if (url.hostname.endsWith('.salesforce.com') || url.hostname.endsWith('.salesforce.mil')) {
            let match = url.pathname.match(
                /\/([a-zA-Z0-9]{3}|[a-zA-Z0-9]{15}|[a-zA-Z0-9]{18})(?:\/|$)/
            );
            if (match) {
                let res = match[1];
                if (res.includes('0000') || res.length == 3) {
                    return match[1];
                }
            }
        }

        // Lightning Experience and Salesforce1
        if (
            url.hostname.endsWith('.lightning.force.com') ||
            url.hostname.endsWith('.lightning.force.mil') ||
            url.hostname.endsWith('.lightning.crmforce.mil')
        ) {
            let match;

            if (url.pathname == '/one/one.app') {
                // Pre URL change: https://docs.releasenotes.salesforce.com/en-us/spring18/release-notes/rn_general_enhanced_urls_cruc.htm
                match = url.hash.match(/\/sObject\/([a-zA-Z0-9]+)(?:\/|$)/);
            } else {
                match = url.pathname.match(/\/lightning\/[r|o]\/[a-zA-Z0-9_]+\/([a-zA-Z0-9]+)/);
            }
            if (match) {
                return match[1];
            }
        }
        // Visualforce
        {
            let idParam = searchParams.get('id');
            if (idParam) {
                return idParam;
            }
        }
        // Visualforce page that does not follow standard Visualforce naming
        for (let [, p] of searchParams) {
            if (
                p.match(/^([a-zA-Z0-9]{3}|[a-zA-Z0-9]{15}|[a-zA-Z0-9]{18})$/) &&
                p.includes('0000')
            ) {
                return p;
            }
        }
    } catch (e) {
        console.error('Error while extracting the recordId');
    }
    return null;
};

export function getRecordId(href) {
    const recordId = extractRecordId(href);
    return recordId && recordId.match(/^([a-zA-Z0-9]{3}|[a-zA-Z0-9]{15}|[a-zA-Z0-9]{18})$/)
        ? recordId
        : null;
}

/**
 * Chrome Extension Port Singleton Handler
 * Inspired by src/client_chrome/components/views/default/default.js
 */
let _chromePort = null;

export function getChromePort() {
    return _chromePort;
}

export function registerChromePort(chromePort) {
    _chromePort = chromePort;
    return _chromePort;
}

export function disconnectChromePort() {
    if (_chromePort) {
        _chromePort.disconnect();
        _chromePort = null;
    }
}

export const RECOMMENDED_PROMPT_PREFIX = `# System context
You are part of a multi-agent system called the Agents SDK, designed to make agent coordination and execution easy. Agents uses two primary abstractions: **Agents** and **Handoffs**. An agent encompasses instructions and tools and can hand off a conversation to another agent when appropriate. Handoffs are achieved by calling a handoff function, generally named \`transfer_to_<agent_name>\`. Transfers between agents are handled seamlessly in the background; do not mention or draw attention to these transfers in your conversation with the user.`;


export const promptWithHandoffInstructions = (prompt) => {
  return `${RECOMMENDED_PROMPT_PREFIX}\n\n${prompt}`;
}

export const isMac = () => navigator.platform.toUpperCase().indexOf('MAC') >= 0;
