import { LightningElement, api, track } from 'lwc';
import LOGGER from 'shared/logger';
export default class ApiTreePanel extends LightningElement {
     // List of OpenAPI projects for view 1
    @api isOpen;
    @api size;
    @api title;
    @api tree;

    @track selectedProject = null; // The selected OpenAPI project (object or id)
    @track selectedServerUrl = '';

    /** Event Handlers */

    // Called when a project is selected in view 1
    handleSelect(event) {
        this.dispatchEvent(new CustomEvent('select', { detail: event.detail }));
    }

    handleSelectProject(event) {
        const id = event.detail.item.id;
        this.selectedProject = this.tree.find(item => item.id === id);
        LOGGER.log('selectedProject', this.selectedProject);
        // Set default server URL if available
        const servers = this.selectedProject?.extra?.servers || [];
        const persisted = this.selectedProject?.extra?.selectedServerUrl;
        const isPersistedValid = persisted && servers.some(s => s.url === persisted);
        this.selectedServerUrl = isPersistedValid ? persisted : (servers.length > 0 ? servers[0].url : '');
        this.emitServerUrl();
    }

    handleServerChange(event) {
        this.selectedServerUrl = event.detail.value;
        this.emitServerUrl();
    }

    handleUpload(event) {
        this.dispatchEvent(new CustomEvent('upload', { detail: event.detail }));
    }

    handleClose(event) {
        this.dispatchEvent(new CustomEvent('close', { detail: event.detail }));
    }

    handleBack() {
        this.selectedProject = null;
        this.selectedNode = null;
    }

    /** Methods */

    emitServerUrl() {
        this.dispatchEvent(
            new CustomEvent('serverurlchange', {
                detail: { serverUrl: this.selectedServerUrl, projectId: this.selectedProject?.id },
            })
        );
    }

    /** Getters */

    get projectTree() {
        return (this.tree || []).map(item => ({
            ...item,
            label: item.name,
            icon: 'utility:notebook',
            children: null,
            isDeletable: true
        }));
    }

    get apiDetailsTree() {
        return this.selectedProject?.children || []
    }

    get serverOptions() {
        const servers = this.selectedProject?.extra?.servers || [];
        return servers.map(s => ({ label: s.description ? `${s.url} (${s.description})` : s.url, value: s.url }));
    }

    get apiSearchFields() {
        return ['name', 'id', 'title', 'keywords'];
    }

    get projectSearchFields() {
        return ['name', 'id', 'title'];
    }
}
