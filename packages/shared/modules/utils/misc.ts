/**
 * Miscellaneous utilities
 */

type ErrorLikePayload = {
    name?: string;
    message?: string;
};

export function decodeError({ name, message }: ErrorLikePayload): Error {
    const e = new Error(message);
    if (name) {
        e.name = name;
    }
    return e;
}

export function download(data: BlobPart | BlobPart[], type: string, filename: string): void {
    const blobParts = Array.isArray(data) ? data : [data];
    const blob = new Blob(blobParts, { type });
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
    ASSISTANT: 'assistant',
};

export const forceVariableSave = (variable: unknown, value: unknown): void => {
    variable = null;
    variable = value;
};

type ConnectorAlias = {
    alias: string;
};

export const generateExternalId = (connector: ConnectorAlias, key: string): string =>
    `${connector.alias}_${key}`;

export const isObject = (obj: unknown): boolean => typeof obj === 'object' && obj !== null;

export const getFieldValue = (field: string, record: Record<string, unknown>): unknown => {
    let value: unknown = record;
    field.split('.').forEach(name => {
        if (value && typeof value === 'object' && name in value) {
            value = (value as Record<string, unknown>)[name];
        }
    });
    return value;
};

export const extractErrorDetailsFromQuery = (errorMessage: string) => {
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

export const isMonacoLanguageSetup = (language: string): boolean => {
    const windowWithMonaco = window as Window & {
        _monacoCompletionProviders?: Record<string, boolean>;
    };
    if (!windowWithMonaco._monacoCompletionProviders) {
        windowWithMonaco._monacoCompletionProviders = {};
    }
    const _isSetup = windowWithMonaco._monacoCompletionProviders[language] === true;
    windowWithMonaco._monacoCompletionProviders[language] = true;
    return _isSetup;
};

export const prettifyXml = (sourceXml: string): string => {
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
