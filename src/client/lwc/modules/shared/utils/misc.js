/**
 * Miscellaneous utilities
 */

export function decodeError({ name, message }) {
    const e = new Error(message);
    e.name = name;
    return e;
}

export function download(data, type, filename) {
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

export const forceVariableSave = (variable, value) => {
    variable = null;
    variable = value;
};

export const generateExternalId = (connector, key) => `${connector.alias}_${key}`;

export const isObject = obj => typeof obj === 'object' && obj !== null;

export const getFieldValue = (field, record) => {
    let value = record;
    field.split('.').forEach(name => {
        if (value) value = value[name];
    });
    return value;
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
