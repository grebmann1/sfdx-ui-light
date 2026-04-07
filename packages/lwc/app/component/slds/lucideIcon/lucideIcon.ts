import { api, LightningElement } from 'lwc';

import { LUCIDE_ICONS } from './constants';

type LucideNode = {
    key: string;
    tag: string;
    d?: string;
    cx?: string;
    cy?: string;
    r?: string;
    x?: string;
    y?: string;
    width?: string;
    height?: string;
    rx?: string;
    ry?: string;
    x1?: string;
    y1?: string;
    x2?: string;
    y2?: string;
    points?: string;
    fill?: string;
};

type LucideNodeGroups = {
    path: LucideNode[];
    circle: LucideNode[];
    ellipse: LucideNode[];
    line: LucideNode[];
    polygon: LucideNode[];
    polyline: LucideNode[];
    rect: LucideNode[];
};

const EMPTY_NODES: LucideNode[] = [];
const EMPTY_NODE_GROUPS: LucideNodeGroups = {
    path: EMPTY_NODES,
    circle: EMPTY_NODES,
    ellipse: EMPTY_NODES,
    line: EMPTY_NODES,
    polygon: EMPTY_NODES,
    polyline: EMPTY_NODES,
    rect: EMPTY_NODES,
};

function normalizeIconName(value: unknown): string {
    if (typeof value !== 'string') {
        return '';
    }

    const trimmedValue = value.trim();
    if (!trimmedValue) {
        return '';
    }

    return trimmedValue
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
        .replace(/[\s_]+/g, '-')
        .replace(/[^a-zA-Z0-9-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase();
}

function normalizeNumber(value: unknown, fallback: number): number {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
}

function normalizeBoolean(value: unknown): boolean {
    if (typeof value === 'string') {
        return value !== 'false';
    }

    return Boolean(value);
}

function groupNodes(nodes: LucideNode[]): LucideNodeGroups {
    const groups: LucideNodeGroups = {
        path: [],
        circle: [],
        ellipse: [],
        line: [],
        polygon: [],
        polyline: [],
        rect: [],
    };

    for (const node of nodes) {
        if (node.tag === 'path') {
            groups.path.push(node);
        } else if (node.tag === 'circle') {
            groups.circle.push(node);
        } else if (node.tag === 'ellipse') {
            groups.ellipse.push(node);
        } else if (node.tag === 'line') {
            groups.line.push(node);
        } else if (node.tag === 'polygon') {
            groups.polygon.push(node);
        } else if (node.tag === 'polyline') {
            groups.polyline.push(node);
        } else if (node.tag === 'rect') {
            groups.rect.push(node);
        }
    }

    return groups;
}

export default class LucideIcon extends LightningElement {
    @api name = '';
    @api size: string | number = 24;
    @api strokeWidth: string | number = 2;
    @api title = '';
    @api absoluteStrokeWidth = false;

    _iconNodeGroupsCache = new Map<string, LucideNodeGroups>();

    get normalizedName(): string {
        return normalizeIconName(this.name);
    }

    get hasIcon(): boolean {
        return Boolean(LUCIDE_ICONS[this.normalizedName]);
    }

    get iconNodeGroups(): LucideNodeGroups {
        const iconName = this.normalizedName;
        if (!iconName) {
            return EMPTY_NODE_GROUPS;
        }

        const cachedGroups = this._iconNodeGroupsCache.get(iconName);
        if (cachedGroups) {
            return cachedGroups;
        }

        const iconNodes = LUCIDE_ICONS[iconName] ?? EMPTY_NODES;
        const groupedNodes = groupNodes(iconNodes);
        this._iconNodeGroupsCache.set(iconName, groupedNodes);
        return groupedNodes;
    }

    get computedSize(): string {
        return String(normalizeNumber(this.size, 24));
    }

    get computedStrokeWidth(): string {
        const size = normalizeNumber(this.size, 24);
        const strokeWidth = normalizeNumber(this.strokeWidth, 2);
        const shouldUseAbsoluteStrokeWidth = normalizeBoolean(this.absoluteStrokeWidth);
        const computedStrokeWidth = shouldUseAbsoluteStrokeWidth
            ? (24 * strokeWidth) / size
            : strokeWidth;

        return String(computedStrokeWidth);
    }

    get computedAriaHidden(): string {
        return this.title ? 'false' : 'true';
    }

    get computedRole(): string {
        return this.title ? 'img' : 'presentation';
    }
}
