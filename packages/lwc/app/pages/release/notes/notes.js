import { LightningElement, track } from 'lwc';
import { isChromeExtension } from 'shared/utils';

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
                    this.selectedVersion = data[0].version; // Default to latest
                }
            })
            .catch(err => {
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
            sections: release.sections.map((section, idx) => ({
                ...section,
                key: idx,
                categories: section.categories.map((category, idx) => ({
                    ...category,
                    key: idx,
                    items: category.items.map((item, idx) => ({
                        ...item,
                        key: idx,
                    })),
                })),
            })),
            key: idx,
            isSelected: this.selectedVersion === release.version,
            isLatest: idx === 0,
            className: `release-list-item slds-p-vertical_x-small slds-p-horizontal_small slds-truncate ${this.selectedVersion === release.version ? 'selected' : ''}`,
        }));
    }

    get selectedRelease() {
        return this.releases.find(r => r.version === this.selectedVersion);
    }
}
