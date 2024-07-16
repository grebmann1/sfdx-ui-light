import { getCurrentRank,isUndefinedOrNull,isEmpty} from "shared/utils";

export class Level {
    key;
    rules;

    isExpanded = false;

    constructor(key){
        this.key    = key;
        this.rules  = {};
    }

    get label(){
        return this.key.length > 0?this.key.charAt(0).toUpperCase()+ this.key.slice(1):'';
    }

    get arrayRules(){
        return Object.values(this.rules);
    }

    get recurences(){
        let recurences = this.arrayRules.reduce(function (acc, x) {
            return acc + x.totalRecords;
        }, 0);
        return recurences;
    }

    get description(){
        return `${this.recurences} ${this.label}`;
    }

    get rank_step(){
        const ranking = [50,30,15,10,0];
        const recurences = this.recurences;
        let currentRank = getCurrentRank(ranking,(item) => {
            return recurences > item;
        });
        return currentRank;
    }

    get rank_description(){
        const descriptions = [' > 50 ',' > 30',' > 15',' > 10',' < 5'];
        return descriptions[this.rank_step];
    }

    get rank_stepFormatted(){
        return this.rank_step + 1;
    }

    get rank_title(){
        return this.label;
    }

    get rank_subTitle(){
        switch (this.level){
            case 'error','High':
                return '<div class="slds-text-color_error">Critical</div>';
            case 'warning','Medium High':
                return '<div class="slds-color-orange-light">High</div>';
            case 'note':
                return 'Moderate';
            case 'none':
                return 'Low';
            default:
                return 'Low';
        }
    }

    get order(){
        const orderLevel = ['error','warning','note','none'];
        return orderLevel.includes(this.key)?orderLevel.findIndex(x => x == this.key):-1
    }
}

export class Rule {
    key;
    rule;
    files;

    levelLabel;
    isExpanded = false;

    constructor(key,rule,levelLabel){
        this.key    = key;
        this.rule   = rule;
        this.files  = {};
        this.levelLabel = levelLabel;
    }

    get label(){
        return this.rule?.name || this.rule?.shortDescription?.text || 'Empty';
    }

    get fileItems(){
        return Object.values(this.files);
    }

    get description(){
        return `${this.totalRecords} ${this.levelLabel}`;
    }

    get totalRecords(){
        let recurences = this.fileItems.reduce(function (acc, x) {
            return acc + x.totalRecords;
        }, 0);
        return recurences;
    }

    /*get groupedItems(){
        let grouped = this.items.reduce(function (acc, x) {
            if(!acc.hasOwnProperty(x.path)) acc[x.path] = [];
            acc[x.path].push(x);
            return acc;
        }, {});
        //console.log('grouped',grouped);
        return Object.values(grouped);
    }*/
}

export class FileItem{
    key;
    path;
    records;

    isExpanded = false;

    levelLabel;
    constructor(key,path,levelLabel,isExpanded=false){
        this.key   = key;
        this.path  = path;
        this.records = [];
        this.levelLabel = levelLabel;
        this.isExpanded = isExpanded;
    }

    get fileName(){
        return this.path.split('/').pop();
    }

    get label(){
        return `file ${this.fileName}`;
    }

    get description(){
        return `${this.items.length} ${this.levelLabel}`;
    }

    get totalRecords(){
        return this.items.length;
    }

    get items(){
        return this.records;
    }

}

export class Item {
    key;
    ruleId;
    level;
    message;
    location;

    constructor(key,level,ruleId,message,location){
        this.key = key;
        this.ruleId = ruleId;
        this.level  = level;
        this.message = message;
        this.location = location;
    }

    get label(){
        return `line ${this.location.region.startLine} : ${this.message}`;
    }

    get lineNumbers(){
        let total = [];
        for (let i = this.location.region.startLine; i <= this.location.region.endLine; i++) {
            total.push(i);
        }
        return total.join('\n');
    }

    get snippet(){
        return this.location?.region?.snippet?.text || '';
    }

    get isSnippetDisplayed(){
        return !isEmpty(this.snippet);
    }
}