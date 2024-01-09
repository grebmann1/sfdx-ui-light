import { getCurrentRank,isUndefinedOrNull} from "shared/utils";

export class Level {
    label;
    key;
    rules;

    isExpanded = false;

    constructor(label,key){
        this.label  = label;
        this.key    = key;
        this.rules  = {};
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
            case 'error':
                return '<div class="slds-text-color_error">Critical</div>';
            case 'warning':
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
    label;
    key;
    files;

    levelLabel;
    isExpanded = false;

    constructor(key,label,levelLabel){
        this.label  = label;
        this.key    = key;
        this.files  = {};
        this.levelLabel = levelLabel;
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
        console.log('grouped',grouped);
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
}