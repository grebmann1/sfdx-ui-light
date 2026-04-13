import { createOrgBrowserNode, type OrgBrowserNode } from './orgBrowserNode';

function stripNamespacePrefix(namespace: string | undefined, value: string) {
    const prefix = String(namespace || '').trim();
    if (!prefix) {
        return value;
    }
    return String(value || '').replace(new RegExp(`^${prefix}__`), '');
}

function buildCustomFieldLabel(field, namespace?: string) {
    const fieldName = stripNamespacePrefix(namespace, String(field?.name || 'field'));
    const fieldType = String(field?.type || 'custom');
    if (fieldType === 'string' || fieldType === 'textarea' || fieldType === 'email') {
        return `${fieldName} | ${fieldType} | length: ${Number(field?.length || 0) || 0}`;
    }
    if (fieldType === 'reference') {
        return `${String(field?.relationshipName || fieldName)} | reference`;
    }
    if (fieldType === 'double' || fieldType === 'currency' || fieldType === 'percent') {
        return `${fieldName} | ${fieldType} | scale: ${field?.scale ?? 0} | precision: ${
            field?.precision ?? 0
        }`;
    }
    return `${fieldName} | ${fieldType}`;
}

export function createCustomFieldNode(
    objectNode: OrgBrowserNode,
    field,
    { filePresent }: { filePresent?: boolean } = {}
) {
    return createOrgBrowserNode({
        kind: 'customField',
        xmlName: 'CustomField',
        componentName: `${objectNode.componentName}.${String(field?.name || '').trim()}`,
        filePresent,
        label: buildCustomFieldLabel(field, objectNode.namespace),
        tooltip: `CustomField: ${String(field?.name || '')}`,
    });
}
