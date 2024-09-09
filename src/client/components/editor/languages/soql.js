
import { formatQuery } from '@jetstreamapp/soql-parser-js';
import { isMonacoLanguageSetup } from 'shared/utils';
import { store } from 'core/store';

import SOQLParser from './soqlParser';
import SuggestionHandler from './suggestion';

export function configureSoqlLanguage(monaco) {
	if(isMonacoLanguageSetup('soql')) return;
	monaco.languages.register({
		id: 'soql'
	});
	monaco.languages.setLanguageConfiguration('soql', languageConfiguration);
	monaco.languages.setMonarchTokensProvider('soql', language);

	monaco.languages.registerDocumentFormattingEditProvider('soql', {
		provideDocumentFormattingEdits: async (model, options, token) => {
			return [{
				range: model.getFullModelRange(),
				text: formatQuery(model.getValue(),{
					fieldMaxLineLength: 20,
					fieldSubqueryParensOnOwnLine: false,
					whereClauseOperatorsIndented: true,
				  }),
			}, ];
		},
	});
	monaco.languages.registerCompletionItemProvider('soql', {
		provideCompletionItems: (model,position,context) => {
			return new Promise((resolve,reject) => {
				let completionItems = new Promise((resolve) => resolve([]));
		
				const textBefore = model.getValueInRange({
					startLineNumber: 1,
					startColumn: 1,
					endLineNumber: position.lineNumber,
					endColumn: position.column
				})
				const textAfter = model.getValue().substring(textBefore.length);
			
				const parserInstance = new SOQLParser().process(textBefore,textAfter);
				const {application,ui} = store.getState();
				//console.log('application.connector,ui.useToolingApi',application.connector,ui.useToolingApi);
				const suggestionInstance = new SuggestionHandler(monaco,parserInstance,application.connector,ui.useToolingApi);
		
				completionItems = getCompletionItems(parserInstance,suggestionInstance) || completionItems;
		
				//console.log('### Text ###',textBefore,textAfter);
				//console.log('suggestionInstance',suggestionInstance);
				//console.log('parserInstance',parserInstance);
				//console.log('##### completionItems #####',completionItems);
		
				Promise.resolve(completionItems).then(res => {
					resolve({
						suggestions: res,
					})
				});
			})
		},
	});
}

const getCompletionItems = (parserInstance, suggestionInstance) => {
	console.log('parserInstance',parserInstance);
	const isSelectPosition = (parser, sub = false) => {
		return sub ? parser.subquery.position === "select" : parser.position === "select";
	};

	const hasFromObject = (parser, sub = false) => {
		return sub ? parser.subquery.fromObject !== null : parser.fromObject !== null;
	};

	const isWherePosition = (parser, sub = false) => {
		return sub ? parser.subquery.position === "where" : parser.position === "where";
	};

	const getFilterCompletionItems = (parser, sub = false) => {
		const query = sub ? parser.subquery : parser;
		if (query.filter.field && query.filter.operator) {
			if (query.filter.value.startsWith("(")) {
				return Promise.all([
					suggestionInstance.getTypeFieldSuggestions(query.fromObject, query.filter),
					suggestionInstance.getSObjectSuggestions(true)
				]).then(results => [...results[0], ...results[1]]);
			} else {
				return suggestionInstance.getTypeFieldSuggestions(query.fromObject, query.filter);
			}
		} else {
			return suggestionInstance.getFieldSuggestions(false);
		}
	};

	const getSubqueryItems = () => {
		if (parserInstance.subquery.type === "select" && !parserInstance.subquery.hasSelect) {
			return suggestionInstance.getChildRelationshipSuggestions(true);
		}
		if (isWherePosition(parserInstance, true) && hasFromObject(parserInstance, true)) {
			return getFilterCompletionItems(parserInstance, true);
		}
		if (isSelectPosition(parserInstance, true) && !parserInstance.subquery.fromRelation.length) {
			return suggestionInstance.getFieldSuggestions(parserInstance.isSubQuery);
		}
		return null;
	};
	//console.log('parserInstance',parserInstance)
	if (parserInstance.isSubQuery || parserInstance.hasSelect) {
		if (parserInstance.isSubQuery || parserInstance.position !== "select" || parserInstance.fromObject !== null) {
			const subqueryItems = parserInstance.isSubQuery ? getSubqueryItems() : null;
			//console.log('--> suggestion 0 - subqueryItems',subqueryItems);
			if (subqueryItems) return subqueryItems;

			if (parserInstance.fromRelation.length && (isSelectPosition(parserInstance) || isWherePosition(parserInstance)) && hasFromObject(parserInstance)) {
				//console.log('--> suggestion 1');
				return suggestionInstance.getLookupFieldSuggestions();
			}

			if (isSelectPosition(parserInstance) && hasFromObject(parserInstance) && !parserInstance.fromRelation.length) {
				//console.log('--> suggestion 2');
				return suggestionInstance.getFieldSuggestions(parserInstance.isSubQuery);
			}

			if (parserInstance.position === "from" && parserInstance.lastWord === parserInstance.fromObject /*!hasFromObject(parserInstance, true)*/ || (parserInstance.isSubQuery && (parserInstance.subquery.position === "from" || !parserInstance.subquery.hasSelect))) {
				//console.log('--> suggestion 3');
				return suggestionInstance.getSObjectSuggestions(false);
			}

			if(parserInstance.position === "from" && hasFromObject(parserInstance)){
				//console.log('--> suggestion 3.1');
				return suggestionInstance.getAfterFromSuggestions(parserInstance);
			}

			if (isWherePosition(parserInstance) && hasFromObject(parserInstance) && !parserInstance.isSubQuery) {
				//console.log('--> suggestion 4');
				return getFilterCompletionItems(parserInstance);
			}

			if (parserInstance.position === "order by") {
				//console.log('--> suggestion 5');
				return suggestionInstance.getFieldSuggestions(false);
			}

			if (parserInstance.position === "group by" || parserInstance.position === "having") {
				//console.log('--> suggestion 6');
				return suggestionInstance.getSelectedFields();
			}
		} else if(parserInstance.fromObject !== null) {
			//console.log('--> suggestion 7');
			return suggestionInstance.getSObjectSuggestions(true);
		} else if(parserInstance.fromObject === null && parserInstance.position === 'select'){
			return suggestionInstance.getFromSuggestions();
		}
	} else {
		//console.log('--> suggestion 8');
		return suggestionInstance.getSObjectSuggestions(true,true);
	}
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

