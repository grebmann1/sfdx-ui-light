import { LightningElement, api } from 'lwc';

export default class Analyzer extends LightningElement {
    @api projectPath: string | null = null;
}
