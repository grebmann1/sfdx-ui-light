
import { formatQuery,parseQuery } from '@jetstreamapp/soql-parser-js';
const STRICT_TOKEN = {
	FROM:'FROM',
	OPEN:'(',
	CLOSE:')'
}
export function configureSoqlLanguage(monaco) {
	monaco.languages.register({
		id: 'soql'
	});
	monaco.languages.setLanguageConfiguration('soql', languageConfiguration);
	monaco.languages.setMonarchTokensProvider('soql', language);

	monaco.languages.registerDocumentFormattingEditProvider('soql', {
		provideDocumentFormattingEdits: async (model, options, token) => {
			return [{
				range: model.getFullModelRange(),
				text: formatQuery(model.getValue()),
			}, ];
		},
	});
}

class BasicSOQLParser {
    constructor(query) {
        this.query = query;
        this.tokens = [];
        this.position = 0;
        this.currentToken = null;
    }

    tokenize() {
        const regex = /\b(SELECT|FROM|WHERE|LIMIT|ORDER BY|GROUP BY|HAVING|IN|NOT IN|AND|OR|ASC|DESC)\b|['"][^'"]*['"]|\*|\w+|\(|\)|,|./gi;
        this.tokens = this.query.match(regex).filter(token => token.trim().length > 0);
    }

    nextToken() {
        if (this.position < this.tokens.length) {
            this.currentToken = this.tokens[this.position++];
        } else {
            this.currentToken = null;
        }
        return this.currentToken;
    }

	parseFrom(){
		this.tokenize();
		while (this.nextToken()) {
            if(this.currentToken.toUpperCase() === 'FROM'){
				return this.nextToken();
			}
		}
		return this.currentToken;
	}
}

const getSuggestions = async (monaco,model,position,searchField) => {
	const textUntilPositionRaw = model.getValueInRange({
		startLineNumber: 0,
		startColumn: 0,
		endLineNumber: position.lineNumber,
		endColumn: position.column,
	});
	console.log('textUntilPositionRaw',textUntilPositionRaw)
	const charBeforePosition = model.getValueInRange({ 
		startLineNumber: position.lineNumber, 
		startColumn: position.column - 1, 
		endLineNumber: position.lineNumber, 
		endColumn: position.column 
	});

	const textUntilPosition = textUntilPositionRaw.trim();
	
	const currentChar = model.getValueInRange({
				startLineNumber: position.lineNumber,
				startColumn: Math.max(position.column - 1, 0),
				endLineNumber: position.lineNumber,
				endColumn: position.column,
	}).trim();
	
	const getWordUntilPosition = model.getWordUntilPosition(position);
	
	const range = {
		startLineNumber: position.lineNumber,
		endLineNumber: position.lineNumber,
		startColumn: getWordUntilPosition.startColumn,
		endColumn: getWordUntilPosition.endColumn,
	};
	console.log('getWordUntilPosition',getWordUntilPosition);
	console.log('mostRecentCharacter',currentChar);
	console.log('textUntilPosition',textUntilPosition);

	let completions = [];

	const extractRightFrom = (tokens) => {
		if(tokens.length <= 1) return null;
		var _from = null;
		var _isOpen = false;
		for (let i = 0; i < tokens.length -1; i++) {
			if(tokens[i].toUpperCase() === STRICT_TOKEN.OPEN){
				_isOpen = true;
			}else if(tokens[i].toUpperCase() === STRICT_TOKEN.CLOSE){
				if(_isOpen){
					_isOpen = false;
				}else{

					_from = null
					break;
				}
			}else if(tokens[i].toUpperCase() === STRICT_TOKEN.FROM && !_isOpen){
				_from = tokens[i+1];
				break;
			}
		}
		return _from
	}

	const checkIfIsObject = (tokens) => {
		if(tokens.length <= 3) return false;
		return tokens[tokens.length - 3].toUpperCase() === STRICT_TOKEN.FROM;
	}

	const extractLeftFrom = (tokens) => {
		console.log('tokens',tokens);
		if(tokens.length <= 1) return null;
		var _from = null;
		for (let i = tokens.length - 1; i > 0; i--) {
			if(tokens[i].toUpperCase() === STRICT_TOKEN.FROM){
				_from = tokens[i+1];
				break;
			}
		}
		return _from
	}

	const text_full = model.getValue().trim();
	if(currentChar === ',' || currentChar === '.' && charBeforePosition != ' '){
		const _parserUntil = new BasicSOQLParser(textUntilPosition);
		const _parserTotal = new BasicSOQLParser(text_full)
			_parserUntil.tokenize();
			_parserTotal.tokenize();
		const _pointer = _parserUntil.tokens.length - 1;
		const right_tokens = _parserTotal.tokens.slice(_pointer);
		const left_tokens = _parserTotal.tokens.slice(0,_pointer);
		//console.log('right_tokens',right_tokens);

		if(!checkIfIsObject(_parserUntil.tokens) && !language.keywords.includes(_parserTotal.tokens[_pointer-1].toUpperCase())){
			const query_object = extractRightFrom(right_tokens) || extractLeftFrom(left_tokens);
			const query_field = currentChar === ','?null:_parserTotal.tokens[_pointer-1];
			const fields = await searchField(query_object,query_field);
			completions = completions.concat(
				fields.map((field) => ({
					label: field.label,
					kind: monaco.languages.CompletionItemKind.Class,
					insertText: field.value,
					range: range,
				}))
			);
		}

		
		
	}else{
		completions = completions.concat(
			language.keywords.map((completion) => ({
				label: completion,
				kind: monaco.languages.CompletionItemKind.Class,
				insertText: completion,
				range: range,
			}))
		);
	}

		
	console.log('completions',completions);
	return completions;
}

export async function configureSoqlCompletions(monaco,searchField) {
	const triggerChars = 'adefhijlmnsu';
    monaco.languages.registerCompletionItemProvider('soql', {
        triggerCharacters: ['.',',', ...triggerChars.split(''), ...triggerChars.toUpperCase().split('')],
        provideCompletionItems: async (model, position, context) => {

            return {
                suggestions: await getSuggestions(monaco, model, position,searchField),
            };
        },
    });
}



export const languageConfiguration = {
	comments: {
		lineComment: '//',
		blockComment: ['/*', '*/'],
	},
	brackets: [
		['[', ']'],
		['(', ')'],
	],
	autoClosingPairs: [{
			open: '[',
			close: ']'
		},
		{
			open: '(',
			close: ')'
		},
		{
			open: "'",
			close: "'"
		},
	],
	surroundingPairs: [{
			open: '[',
			close: ']'
		},
		{
			open: '(',
			close: ')'
		},
		{
			open: "'",
			close: "'"
		},
	],
};

export const language = {
	defaultToken: '',
	tokenPostfix: '.soql',
	ignoreCase: true,

	brackets: [{
			open: '[',
			close: ']',
			token: 'delimiter.square'
		},
		{
			open: '(',
			close: ')',
			token: 'delimiter.parenthesis'
		},
	],
	keywords: [
		'ALLPRIVATE',
		'AS',
		'ASC',
		'AT',
		'BELOW',
		'BY',
		'BY',
		'CALENDAR_MONTH',
		'CALENDAR_QUARTER',
		'CALENDAR_YEAR',
		'CATEGORY',
		'CONVERTCURRENCY',
		'CONVERTTIMEZONE',
		'COUNT_DISTINCT',
		'CUSTOM',
		'DATA',
		'DAY_IN_MONTH',
		'DAY_IN_WEEK',
		'DAY_IN_YEAR',
		'DAY_ONLY',
		'DELEGATED',
		'DESC',
		'DISTANCE',
		'ELSE',
		'END',
		'EVERYTHING',
		'EXCLUDES',
		'FALSE',
		'FIELDS',
		'FIRST',
		'FISCAL_MONTH',
		'FISCAL_QUARTER',
		'FISCAL_YEAR',
		'FOR',
		'FROM',
		'GEOLOCATION',
		'GROUP',
		'HAVING',
		'HOUR_IN_DAY',
		'INCLUDES',
		'LAST_90_DAYS',
		'LAST_FISCAL_QUARTER',
		'LAST_FISCAL_YEAR',
		'LAST_MONTH',
		'LAST_N_DAYS',
		'LAST_N_FISCAL_QUARTERS',
		'LAST_N_FISCAL_YEARS',
		'LAST_N_MONTHS',
		'LAST_N_QUARTERS',
		'LAST_N_WEEKS',
		'LAST_N_YEARS',
		'LAST_QUARTER',
		'LAST_WEEK',
		'LAST_YEAR',
		'LAST',
		'LIMIT',
		'MINE',
		'MINEANDMYGROUPS',
		'MY_TEAM_TERRITORY',
		'MY_TERRITORY',
		'N_DAYS_AGO',
		'N_FISCAL_QUARTERS_AGO',
		'N_FISCAL_YEARS_AGO',
		'N_MONTHS_AGO',
		'N_QUARTERS_AGO',
		'N_WEEKS_AGO',
		'N_YEARS_AGO',
		'NEXT_90_DAYS',
		'NEXT_FISCAL_QUARTER',
		'NEXT_FISCAL_YEAR',
		'NEXT_MONTH',
		'NEXT_N_DAYS',
		'NEXT_N_FISCAL_QUARTERS',
		'NEXT_N_FISCAL_YEARS',
		'NEXT_N_MONTHS',
		'NEXT_N_QUARTERS',
		'NEXT_N_WEEKS',
		'NEXT_N_YEARS',
		'NEXT_QUARTER',
		'NEXT_WEEK',
		'NEXT_YEAR',
		'NULLS',
		'OFFSET',
		'ORDER',
		'REFERENCE',
		'ROLLUP',
		'SCOPE',
		'SECURITY_ENFORCED',
		'SELECT',
		'STANDARD',
		'TEAM',
		'THEN',
		'THIS_FISCAL_QUARTER',
		'THIS_FISCAL_YEAR',
		'THIS_MONTH',
		'THIS_QUARTER',
		'THIS_WEEK',
		'THIS_YEAR',
		'TODAY',
		'TOLABEL',
		'TOMORROW',
		'TRACKING',
		'TRUE',
		'TYPEOF',
		'UPDATE',
		'USING',
		'VIEW',
		'VIEWSTAT',
		'WEEK_IN_MONTH',
		'WEEK_IN_YEAR',
		'WHEN',
		'WHERE',
		'WITH',
		'YESTERDAY',
	],
	operators: ['ABOVE_OR_BELOW', 'ABOVE', 'ALL', 'AND', 'IN', 'LIKE', 'NOT IN', 'NOT', 'NULL', 'OR'],
	builtinFunctions: ['AVG', 'COUNT', 'CUBE', 'FORMAT', 'GROUPING', 'MAX', 'MIN', 'SUM', 'UPDATE'],
	tokenizer: {
		root: [{
				include: '@comments'
			},
			{
				include: '@whitespace'
			},
			{
				include: '@numbers'
			},
			{
				include: '@strings'
			},
			{
				include: '@complexIdentifiers'
			},
			{
				include: '@scopes'
			},
			[/[;,.]/, 'delimiter'],
			[/[()]/, '@brackets'],
			[
				/[\w@#$]+/,
				{
					cases: {
						'@keywords': 'keyword',
						'@operators': 'operator',
						'@builtinFunctions': 'predefined',
						'@default': 'identifier',
					},
				},
			],
			[/[<>=!%+-]/, 'operator'],
		],
		whitespace: [
			[/\s+/, 'white']
		],
		comments: [
			[/\/\/+.*/, 'comment'],
			[/\/\*/, {
				token: 'comment.quote',
				next: '@comment'
			}],
		],
		comment: [
			[/[^*/]+/, 'comment'],
			[/\*\//, {
				token: 'comment.quote',
				next: '@pop'
			}],
			[/./, 'comment'],
		],
		numbers: [
			[/0[xX][0-9a-fA-F]*/, 'number'],
			[/[$][+-]*\d*(\.\d*)?/, 'number'],
			[/((\d+(\.\d*)?)|(\.\d+))([eE][-+]?\d+)?/, 'number'],
		],
		strings: [
			[/N'/, {
				token: 'string',
				next: '@string'
			}],
			[/'/, {
				token: 'string',
				next: '@string'
			}],
		],
		string: [
			[/[^']+/, 'string'],
			[/''/, 'string'],
			[/'/, {
				token: 'string',
				next: '@pop'
			}],
		],
		complexIdentifiers: [
			[/\[/, {
				token: 'identifier.quote',
				next: '@bracketedIdentifier'
			}],
			[/"/, {
				token: 'identifier.quote',
				next: '@quotedIdentifier'
			}],
		],
		bracketedIdentifier: [
			[/[^\]]+/, 'identifier'],
			[/]]/, 'identifier'],
			[/]/, {
				token: 'identifier.quote',
				next: '@pop'
			}],
		],
		quotedIdentifier: [
			[/[^"]+/, 'identifier'],
			[/""/, 'identifier'],
			[/"/, {
				token: 'identifier.quote',
				next: '@pop'
			}],
		],
		scopes: [
			[/(BEGIN|CASE)\b/i, {
				token: 'keyword.block'
			}],
			[/TYPEOF\b/i, {
				token: 'keyword.block'
			}],
			[/END\b/i, {
				token: 'keyword.block'
			}],
			[/WHEN\b/i, {
				token: 'keyword.choice'
			}],
			[/THEN\b/i, {
				token: 'keyword.choice'
			}],
			[/ELSE\b/i, {
				token: 'keyword.choice'
			}],
		],
	},
};