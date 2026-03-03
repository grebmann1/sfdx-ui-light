/**
 * String manipulation utilities
 */

export function escapeRegExp(str) {
    if (!str) return '';
    return str.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

export function checkIfPresent(a, b) {
    return (a || '').toLowerCase().includes((b || '').toLowerCase());
}

export function isSalesforceId(str) {
    // Salesforce ID pattern
    var idPattern = /^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/;

    // Check if the string matches the Salesforce ID pattern
    return idPattern.test(str);
}

export function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

export function compareString(a, b) {
    return lowerCaseKey(a) === lowerCaseKey(b);
}

/** Case-insensitive equality for API/relationship names (alias for compareString). */
export function isSame(a, b) {
    return compareString(a, b);
}

import { isNotUndefinedOrNull } from './validation';

export function lowerCaseKey(key) {
    return isNotUndefinedOrNull(key) ? key.toLowerCase() : null;
}

/**
 * Strip managed package namespace prefix from a field/relationship name or array of names.
 * e.g. "namespace__FieldName" -> "FieldName"
 */
export function stripNamespace(value) {
    if (value == null) return value;
    if (Array.isArray(value)) {
        return value.map(stripNamespace);
    }
    const str = String(value);
    return str.replace(/^[a-zA-Z0-9]+__/, '');
}

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
