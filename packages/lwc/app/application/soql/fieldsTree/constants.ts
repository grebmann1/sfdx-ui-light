const FIELD_TYPE_ICONS: Record<string, string> = {
    id: 'hash',
    string: 'type',
    textarea: 'align-left',
    boolean: 'toggle-left',
    int: 'hash',
    integer: 'hash',
    double: 'hash',
    long: 'hash',
    currency: 'circle-dollar-sign',
    date: 'calendar',
    datetime: 'calendar-clock',
    time: 'clock',
    reference: 'link',
    picklist: 'chevrons-up-down',
    multipicklist: 'list-checks',
    email: 'mail',
    phone: 'phone',
    url: 'globe',
    percent: 'percent',
    address: 'map-pin',
    location: 'map-pin',
    encryptedstring: 'lock',
    combobox: 'chevrons-up-down',
    anytype: 'circle-help',
    base64: 'binary',
};

const DEFAULT_FIELD_ICON = 'type';

export function getFieldTypeIcon(fieldType: string): string {
    const iconName = FIELD_TYPE_ICONS[(fieldType || '').toLowerCase()] || DEFAULT_FIELD_ICON;
    return `lucide:${iconName}`;
}
