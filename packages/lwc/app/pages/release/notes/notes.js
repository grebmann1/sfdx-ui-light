import { LightningElement, track } from 'lwc';
import { isChromeExtension } from 'shared/utils';

const SECTION_COLOR_MAP = {
    'new features': 'section-badge--feature',
    'enhancements': 'section-badge--enhancement',
    'bug fixes': 'section-badge--bugfix',
    'breaking changes': 'section-badge--breaking',
};

function getSectionBadgeClass(title = '') {
    return SECTION_COLOR_MAP[title.toLowerCase()] ?? 'section-badge--other';
}

export default class Notes extends LightningElement {
    @track releases = [];
    @track error = null;
    @track selectedVersion = null;

    connectedCallback() {
        const url = isChromeExtension()
            ? `${chrome.runtime.getURL('releaseNotes.json')}`
            : '/public/releaseNotes.json';
        fetch(url)
            .then(response => response.json())
            .then(data => {
                this.releases = data;
                if (data.length > 0) {
                    this.selectedVersion = data[0].version;
                }
            })
            .catch(() => {
                this.error = 'Failed to load release notes.';
            });
    }

    handleSelect(event) {
        const version = event.currentTarget.dataset.version;
        this.selectedVersion = version;
    }

    get formattedReleases() {
        return this.releases.map((release, idx) => ({
            ...release,
            sections: release.sections.map((section, sIdx) => ({
                ...section,
                key: sIdx,
                badgeClass: `section-badge ${getSectionBadgeClass(section.title)}`,
                categories: section.categories.map((category, cIdx) => ({
                    ...category,
                    key: cIdx,
                    items: category.items.map((item, iIdx) => ({
                        text: item,
                        key: iIdx,
                    })),
                })),
            })),
            key: idx,
            isSelected: this.selectedVersion === release.version,
            isLatest: idx === 0,
            className: `release-list-item ${this.selectedVersion === release.version ? 'selected' : ''}`,
        }));
    }

    get selectedRelease() {
        if (!this.selectedVersion) return null;
        const release = this.releases.find(r => r.version === this.selectedVersion);
        if (!release) return null;
        return {
            ...release,
            sections: release.sections.map((section, sIdx) => ({
                ...section,
                key: sIdx,
                badgeClass: `section-badge ${getSectionBadgeClass(section.title)}`,
                categories: section.categories.map((category, cIdx) => ({
                    ...category,
                    key: cIdx,
                    items: category.items.map((item, iIdx) => ({
                        text: item,
                        key: iIdx,
                    })),
                })),
            })),
        };
    }
}
