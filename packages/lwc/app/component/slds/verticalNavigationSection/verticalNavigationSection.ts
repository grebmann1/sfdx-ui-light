import { api, LightningElement } from 'lwc';

export default class VerticalNavigationSection extends LightningElement {
    @api label;

    /**
     * The section itself is not rendered when collapsed,
     * only its children (provided via `slot`) are rendered.
     */
    @api isCollapsed = false;
}
