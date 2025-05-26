import { LightningElement, api } from 'lwc';
import { decodeError, isNotUndefinedOrNull } from 'shared/utils';

export default class Analyzer extends LightningElement {
    @api projectPath;
}
