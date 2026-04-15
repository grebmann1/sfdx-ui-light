const CATEGORY_ICONS: Record<string, string> = {
    change: 'activity',
    event: 'radio',
    metadata: 'table',
    feed: 'rss',
    history: 'clock',
    share: 'share-2',
};

const DEFAULT_STANDARD_ICON = 'database';
const DEFAULT_CUSTOM_ICON = 'database';

export function getCategoryIcon(category: string, isCustom: boolean): string {
    const iconName = CATEGORY_ICONS[category] ?? (isCustom ? DEFAULT_CUSTOM_ICON : DEFAULT_STANDARD_ICON);
    return `lucide:${iconName}`;
}
