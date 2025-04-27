import { api, LightningElement } from 'lwc';

export default class Paginator extends LightningElement {
    init = false;

    @api previousClass;
    @api goPrevious;
    @api previousTitle;

    @api nextClass;
    @api goNext;
    @api nextTitle;
}
