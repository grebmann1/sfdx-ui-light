import LOGGER from 'shared/logger';

const removeLastXChars = (input, length) => (length > input.length ? '' : input.slice(0, -length));

class TextHandler {
    constructor() {
        this.textBeforeCursor = '';
        this.textAfterCursor = '';
        this.fullText = '';
    }

    setTexts(textBeforeCursor, textAfterCursor) {
        this.textBeforeCursor = textBeforeCursor.toLowerCase();
        this.textAfterCursor = textAfterCursor.toLowerCase();
        this.fullText = this.textBeforeCursor + this.textAfterCursor;
    }

    static getLastWord(textBeforeCursor) {
        const words = textBeforeCursor.split(' ');
        const lastWord = words[words.length - 1];
        if (lastWord.includes(',')) {
            return lastWord.split(',').pop();
        }
        return lastWord;
    }

    findSubQuery(pattern) {
        const lastOpenParen = this.textBeforeCursor.lastIndexOf('(');
        const lastCloseParen = this.textBeforeCursor.lastIndexOf(')');

        if (
            lastOpenParen === -1 ||
            (lastOpenParen !== -1 && lastCloseParen > lastOpenParen) ||
            !this.textBeforeCursor.match(pattern)
        )
            return false;

        let subQueryEnd = -1;
        let balance = 0;

        for (let i = lastOpenParen + 1; i < this.textBeforeCursor.length; i++) {
            const char = this.textBeforeCursor[i];
            if (char === ')' && balance === 0) {
                subQueryEnd = i;
                break;
            }
            char === ')' ? balance-- : char === '(' && balance++;
        }

        if (subQueryEnd === -1) {
            for (let i = 0; i < this.textAfterCursor.length; i++) {
                const char = this.textAfterCursor[i];
                if (char === ')' && balance === 0) {
                    subQueryEnd = i + this.textBeforeCursor.length;
                    break;
                }
                char === ')' ? balance-- : char === '(' && balance++;
            }
        }

        if (subQueryEnd !== -1) {
            if (subQueryEnd > this.textBeforeCursor.length) {
                return {
                    textBeforeCursor: this.textBeforeCursor.substring(lastOpenParen + 1),
                    textAfterCursor: this.textAfterCursor.substring(
                        0,
                        subQueryEnd - this.textBeforeCursor.length
                    ),
                };
            } else {
                return {
                    textBeforeCursor: this.textBeforeCursor.substring(
                        lastOpenParen + 1,
                        subQueryEnd
                    ),
                    textAfterCursor: '',
                };
            }
        } else {
            return {
                textBeforeCursor: this.textBeforeCursor.substring(lastOpenParen + 1),
                textAfterCursor: this.textAfterCursor,
            };
        }
    }
}

class QueryValidator {
    static checkHasSelect(fullText) {
        return !!fullText.match(/select\s/gm);
    }

    static getObject(fullText) {
        const match = fullText.match(/.*\s(from(?![^\(]*\)))\s+($|\w+).*$/m);
        return match && match[2] ? match[2] : null;
    }

    static getPosition(textBeforeCursor) {
        const patterns = [
            { type: 'select', pattern: /.*\s?(select(?![^\(]*\)))\s+($|\w+).*$/m },
            { type: 'from', pattern: /.*\s(from(?![^\(]*\)))\s+($|\w+).*$/m },
            { type: 'where', pattern: /.*\s(where(?![^\\(]*\)))\s+($|\w+).*$/m },
            { type: 'offset', pattern: /.*\s(offset(?![^\\(]*\)))\s+($|\w+).*$/m },
            { type: 'limit', pattern: /.*\s(limit(?![^\\(]*\)))\s+($|\w+).*$/m },
            { type: 'order by', pattern: /.*\s(order by(?![^\\(]*\)))\s+($|\w+).*$/m },
            { type: 'having', pattern: /.*\s(having(?![^\\(]*\)))\s+($|\w+).*$/m },
            { type: 'group by', pattern: /.*\s(group by(?![^\\(]*\)))\s+($|\w+).*$/m },
        ].reverse();

        for (let patternObj of patterns) {
            if (textBeforeCursor.match(patternObj.pattern)) {
                return patternObj.type;
            }
        }
        return null;
    }
}

class FilterParser {
    constructor(fullText, parsedData) {
        this.fullText = fullText;
        this.parsedData = parsedData;
    }

    parseFilterData() {
        this.parsedData.filter = { field: null, operator: null, value: null };
        if (
            (this.parsedData.position === 'where' && !this.parsedData.isSubQuery) ||
            this.parsedData.subquery.position === 'where'
        ) {
            const filterMatch = this.fullText.match(
                /(((or|and|not|where)\s)(?!.*((or|and|not|where)\s)))(.*)/m
            )[6];
            const operatorMatch = filterMatch.match(
                /(=|<=|>=|<|>|!=|LIKE|\bIN\b|\bNOT IN\b|\bINCLUDES\b|\bEXCLUDES\b)/im
            );
            if (operatorMatch) {
                const [field, value] = filterMatch.split(operatorMatch[0]);
                this.parsedData.filter.field = field.trim();
                this.parsedData.filter.operator = operatorMatch[0].trim();
                this.parsedData.filter.value =
                    this.parsedData.lastWord.trim() != value.trim()
                        ? removeLastXChars(value, this.parsedData.lastWord.length).trim()
                        : value.trim();
            }
        }
    }
}

class SubQueryHandler {
    constructor(textHandler, parsedData) {
        this.textHandler = textHandler;
        this.parsedData = parsedData;
    }

    setSelectSubquery() {
        const subQueryMatch = this.textHandler.findSubQuery(/(select|,)\s*\(\s*\w/gm);
        //console.log('setSelectSubquery',subQueryMatch);
        if (subQueryMatch) {
            this.parsedData.isSubQuery = !!subQueryMatch;
            this.textHandler.setTexts(
                subQueryMatch.textBeforeCursor,
                subQueryMatch.textAfterCursor
            );
            this.parsedData.subquery.hasSelect = QueryValidator.checkHasSelect(
                this.textHandler.fullText
            );
            this.parsedData.subquery.fromObject = QueryValidator.getObject(
                this.textHandler.fullText
            );
            this.parsedData.subquery.position = QueryValidator.getPosition(
                subQueryMatch.textBeforeCursor
            );
            this.parsedData.lastWord = TextHandler.getLastWord(subQueryMatch.textBeforeCursor);
            this.parsedData.subquery.fromRelation = this.getParents();
            this.parsedData.subquery.type = 'select';
        }
    }

    setWhereSubquery() {
        const subQueryMatch = this.textHandler.findSubQuery(/(in)\s*\(\s*select/gm);
        //console.log('setWhereSubquery',subQueryMatch);
        if (subQueryMatch) {
            this.parsedData.isSubQuery = !!subQueryMatch;
            this.textHandler.setTexts(
                subQueryMatch.textBeforeCursor,
                subQueryMatch.textAfterCursor
            );
            this.parsedData.subquery.type = 'filter';
            this.parsedData.subquery.hasSelect = QueryValidator.checkHasSelect(
                this.textHandler.fullText
            );
            this.parsedData.subquery.fromObject = QueryValidator.getObject(
                this.textHandler.fullText
            );
            this.parsedData.subquery.position = QueryValidator.getPosition(
                subQueryMatch.textBeforeCursor
            );
            this.parsedData.lastWord = TextHandler.getLastWord(subQueryMatch.textBeforeCursor);
            this.parsedData.subquery.fromRelation = this.getParents();
        }
    }

    getParents() {
        if (this.parsedData.lastWord && this.parsedData.lastWord.match(/\./gm)) {
            const relations = this.parsedData.lastWord.split('.');
            relations.pop();
            return relations;
        }
        return [];
    }
}

export default class SOQLParser {
    constructor() {
        this.textHandler = new TextHandler();
        this.parsedData = {
            hasSelect: false,
            fromObject: undefined,
            isSubQuery: false,
            hasHaving: false,
            fromRelation: [],
            position: null,
            lastWord: null,
            fields: [],
            filter: {
                field: null,
                operator: null,
                value: null,
            },
            subquery: {
                type: null,
                hasSelect: false,
                fromObject: undefined,
                fromRelation: [],
                position: null,
            },
        };
        this.subQueryHandler = new SubQueryHandler(this.textHandler, this.parsedData);
    }

    process(textBeforeCursor, textAfterCursor) {
        this.textHandler.setTexts(textBeforeCursor, textAfterCursor);
        this.parsedData.hasSelect = QueryValidator.checkHasSelect(this.textHandler.fullText);
        this.parsedData.fromObject = QueryValidator.getObject(this.textHandler.fullText);
        this.parsedData.position = QueryValidator.getPosition(this.textHandler.textBeforeCursor);
        this.parsedData.lastWord = TextHandler.getLastWord(this.textHandler.textBeforeCursor);
        this.parsedData.fromRelation = this.subQueryHandler.getParents();
        this.parsedData.isSubQuery = false;
        this.parsedData.fields = this.parseFields();

        if (this.parsedData.position === 'select') {
            this.subQueryHandler.setSelectSubquery();
        } else if (this.parsedData.position === 'where') {
            this.subQueryHandler.setWhereSubquery();
            const filterParser = new FilterParser(
                this.textHandler.textBeforeCursor,
                this.parsedData
            );
            filterParser.parseFilterData();
        }

        return this.parsedData;
    }

    parseFields() {
        const selectMatch = this.textHandler.fullText.match(/select(.*?)from(?![^\(]*\))/gm);
        if (selectMatch && selectMatch.length) {
            return selectMatch[0]
                .replace('select', '')
                .replace('from', '')
                .replace(/\((.*?)\)/gim, '')
                .trim()
                .split(',');
        }
        return [];
    }
}
