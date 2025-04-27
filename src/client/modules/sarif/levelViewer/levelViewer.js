import { LightningElement, track, api } from 'lwc';
import {
    isNotUndefinedOrNull,
    isUndefinedOrNull,
    getCurrentRank,
    runActionAfterTimeOut,
} from 'shared/utils';

export default class LevelViewer extends LightningElement {
    @api data = [];
    @api selectedFile;

    /** Events */

    handleLevelDisplay = e => {
        let level = e.currentTarget.dataset.level;
        let levelIndex = this.data.findIndex(x => x.key === level);

        let _temp = this.data;
        _temp[levelIndex].isExpanded = !_temp[levelIndex].isExpanded;
        this.data = null;
        this.data = _temp;
    };

    handleRuleDisplay = e => {
        let rule = e.currentTarget.dataset.rule;
        let level = e.currentTarget.dataset.level;

        let levelIndex = this.data.findIndex(x => x.key === level);

        let _temp = this.data;
        _temp[levelIndex].rules[rule].isExpanded = !_temp[levelIndex].rules[rule].isExpanded;
        this.data = null;
        this.data = _temp;
    };

    handleFileDisplay = e => {
        e.preventDefault();
        const { rule, level, file } = e.currentTarget.dataset;
        this.selectedFile = this.data.find(x => x.key === level).rules[rule].files[file];
    };

    handleItemDisplay = e => {
        e.preventDefault();
        const { rule, level, file } = e.currentTarget.dataset;
        this.selectedFile = this.data.find(x => x.key === level).rules[rule].files[file];
    };

    /** Processing Methods */

    /** Getters */

    get isPreviewDisplayed() {
        return isNotUndefinedOrNull(this.selectedFile);
    }
}
