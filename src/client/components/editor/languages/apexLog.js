import { isMonacoLanguageSetup } from 'shared/utils';

export function configureApexLogLanguage(monaco) {
    if (isMonacoLanguageSetup('apexLog')) return;
    monaco.languages.register({ id: 'apexLog' });
    monaco.languages.setMonarchTokensProvider('apexLog', {
        defaultToken: '',
        tokenPostfix: '.log',
        ignoreCase: true,

        brackets: [
            { token: 'delimiter.curly', open: '{', close: '}' },
            { token: 'delimiter.square', open: '[', close: ']' },
            { token: 'delimiter.parenthesis', open: '(', close: ')' },
        ],

        keywords: [
            'BULK_HEAP_ALLOCATE',
            'CALLOUT_REQUEST',
            'CALLOUT_RESPONSE',
            'NAMED_CREDENTIAL_REQUEST',
            'NAMED_CREDENTIAL_RESPONSE',
            'NAMED_CREDENTIAL_RESPONSE_DETAIL',
            'CONSTRUCTOR_ENTRY',
            'CONSTRUCTOR_EXIT',
            'EMAIL_QUEUE',
            'METHOD_ENTRY',
            'METHOD_EXIT',
            'SYSTEM_CONSTRUCTOR_ENTRY',
            'SYSTEM_CONSTRUCTOR_EXIT',
            'SYSTEM_METHOD_ENTRY',
            'SYSTEM_METHOD_EXIT',
            'CODE_UNIT_STARTED',
            'CODE_UNIT_FINISHED',
            'VF_APEX_CALL_START',
            'VF_APEX_CALL_END',
            'VF_DESERIALIZE_VIEWSTATE_BEGIN',
            'VF_DESERIALIZE_VIEWSTATE_END',
            'VF_EVALUATE_FORMULA_BEGIN',
            'VF_EVALUATE_FORMULA_END',
            'VF_SERIALIZE_VIEWSTATE_BEGIN',
            'VF_SERIALIZE_VIEWSTATE_END',
            'VF_PAGE_MESSAGE',
            'DML_BEGIN',
            'DML_END',
            'IDEAS_QUERY_EXECUTE',
            'SOQL_EXECUTE_BEGIN',
            'SOQL_EXECUTE_END',
            'SOQL_EXECUTE_EXPLAIN',
            'SOSL_EXECUTE_BEGIN',
            'SOSL_EXECUTE_END',
            'HEAP_ALLOCATE',
            'HEAP_DEALLOCATE',
            'STATEMENT_EXECUTE',
            'VARIABLE_SCOPE_BEGIN',
            'VARIABLE_SCOPE_END',
            'VARIABLE_ASSIGNMENT',
            'USER_INFO',
            'USER_DEBUG',
            'CUMULATIVE_LIMIT_USAGE',
            'CUMULATIVE_LIMIT_USAGE_END',
            'CUMULATIVE_PROFILING',
            'CUMULATIVE_PROFILING_BEGIN',
            'CUMULATIVE_PROFILING_END',
            'LIMIT_USAGE',
            'LIMIT_USAGE_FOR_NS',
            'POP_TRACE_FLAGS',
            'PUSH_TRACE_FLAGS',
            'QUERY_MORE_BEGIN',
            'QUERY_MORE_END',
            'QUERY_MORE_ITERATIONS',
            'TOTAL_EMAIL_RECIPIENTS_QUEUED',
            'SAVEPOINT_ROLLBACK',
            'SAVEPOINT_SET',
            'STACK_FRAME_VARIABLE_LIST',
            'STATIC_VARIABLE_LIST',
            'SYSTEM_MODE_ENTER',
            'SYSTEM_MODE_EXIT',
            'EXECUTION_STARTED',
            'EXECUTION_FINISHED',
            'ENTERING_MANAGED_PKG',
            'EVENT_SERVICE_PUB_BEGIN',
            'EVENT_SERVICE_PUB_END',
            'EVENT_SERVICE_PUB_DETAIL',
            'EVENT_SERVICE_SUB_BEGIN',
            'EVENT_SERVICE_SUB_DETAIL',
            'EVENT_SERVICE_SUB_END',
            'SAVEPOINT_SET',
            'FLOW_START_INTERVIEWS_BEGIN',
            'FLOW_START_INTERVIEWS_END',
            'FLOW_START_INTERVIEWS_ERROR',
            'FLOW_START_INTERVIEW_BEGIN',
            'FLOW_START_INTERVIEW_END',
            'FLOW_START_INTERVIEW_LIMIT_USAGE',
            'FLOW_START_SCHEDULED_RECORDS',
            'FLOW_CREATE_INTERVIEW_BEGIN',
            'FLOW_CREATE_INTERVIEW_END',
            'FLOW_CREATE_INTERVIEW_ERROR',
            'FLOW_ELEMENT_BEGIN',
            'FLOW_ELEMENT_END',
            'FLOW_ELEMENT_DEFERRED',
            'FLOW_ELEMENT_ERROR',
            'FLOW_ELEMENT_FAULT',
            'FLOW_ELEMENT_LIMIT_USAGE',
            'FLOW_INTERVIEW_FINISHED_LIMIT_USAGE',
            'FLOW_SUBFLOW_DETAIL',
            'FLOW_VALUE_ASSIGNMENT',
            'FLOW_WAIT_EVENT_RESUMING_DETAIL',
            'FLOW_WAIT_EVENT_WAITING_DETAIL',
            'FLOW_WAIT_RESUMING_DETAIL',
            'FLOW_WAIT_WAITING_DETAIL',
            'FLOW_INTERVIEW_FINISHED',
            'FLOW_INTERVIEW_PAUSED',
            'FLOW_INTERVIEW_RESUMED',
            'FLOW_ACTIONCALL_DETAIL',
            'FLOW_ASSIGNMENT_DETAIL',
            'FLOW_LOOP_DETAIL',
            'FLOW_RULE_DETAIL',
            'FLOW_BULK_ELEMENT_BEGIN',
            'FLOW_BULK_ELEMENT_END',
            'FLOW_BULK_ELEMENT_DETAIL',
            'FLOW_BULK_ELEMENT_LIMIT_USAGE',
            'FLOW_BULK_ELEMENT_NOT_SUPPORTED',
            'PUSH_NOTIFICATION_INVALID_APP',
            'PUSH_NOTIFICATION_INVALID_CERTIFICATE',
            'PUSH_NOTIFICATION_INVALID_NOTIFICATION',
            'PUSH_NOTIFICATION_NO_DEVICES',
            'PUSH_NOTIFICATION_NOT_ENABLED',
            'PUSH_NOTIFICATION_SENT',
            'SLA_END',
            'SLA_EVAL_MILESTONE',
            'SLA_NULL_START_DATE',
            'SLA_PROCESS_CASE',
            'TESTING_LIMITS',
            'VALIDATION_ERROR',
            'VALIDATION_FAIL',
            'VALIDATION_FORMULA',
            'VALIDATION_PASS',
            'VALIDATION_RULE',
            'WF_FLOW_ACTION_BEGIN',
            'WF_FLOW_ACTION_END',
            'WF_FLOW_ACTION_ERROR',
            'WF_FLOW_ACTION_ERROR_DETAIL',
            'WF_FIELD_UPDATE',
            'WF_RULE_EVAL_BEGIN',
            'WF_RULE_EVAL_END',
            'WF_RULE_EVAL_VALUE',
            'WF_RULE_FILTER',
            'WF_RULE_NOT_EVALUATED',
            'WF_CRITERIA_BEGIN',
            'WF_CRITERIA_END',
            'WF_FORMULA',
            'WF_ACTION',
            'WF_ACTIONS_END',
            'WF_ACTION_TASK',
            'WF_APPROVAL',
            'WF_APPROVAL_REMOVE',
            'WF_APPROVAL_SUBMIT',
            'WF_APPROVAL_SUBMITTER',
            'WF_ASSIGN',
            'WF_EMAIL_ALERT',
            'WF_EMAIL_SENT',
            'WF_ENQUEUE_ACTIONS',
            'WF_ESCALATION_ACTION',
            'WF_ESCALATION_RULE',
            'WF_EVAL_ENTRY_CRITERIA',
            'WF_FLOW_ACTION_DETAIL',
            'WF_HARD_REJECT',
            'WF_NEXT_APPROVER',
            'WF_NO_PROCESS_FOUND',
            'WF_OUTBOUND_MSG',
            'WF_PROCESS_FOUND',
            'WF_REASSIGN_RECORD',
            'WF_RESPONSE_NOTIFY',
            'WF_RULE_ENTRY_ORDER',
            'WF_RULE_INVOCATION',
            'WF_SOFT_REJECT',
            'WF_SPOOL_ACTION_BEGIN',
            'WF_TIME_TRIGGER',
            'WF_TIME_TRIGGERS_BEGIN',
            'EXCEPTION_THROWN',
            'FATAL_ERROR',
            'XDS_DETAIL',
            'XDS_RESPONSE',
            'XDS_RESPONSE_DETAIL',
            'XDS_RESPONSE_ERROR',
        ],

        tokenizer: {
            root: [
                [/\|USER_DEBUG.*/, 'user-debug'],
                [/\|USER_INFO.*/, 'user-info'],
                [/[a-z0-9]\w{4}0\w{12}|[a-z0-9]\w{4}0\w{9}/, 'string'],
                { include: '@numbers' },
                [/^Execute Anonymous:.*/, 'comment'],
                [/\|EXCEPTION_THROWN\|.*/, 'invalid'],
                [/\|FLOW_START_INTERVIEWS_ERROR\|.*/, 'invalid'],
                [/\|FLOW_CREATE_INTERVIEW_ERROR\|.*/, 'invalid'],
                [/\|FLOW_ELEMENT_ERROR\|.*/, 'invalid'],
                [/\|VALIDATION_ERROR\|.*/, 'invalid'],
                [/\|WF_FLOW_ACTION_ERROR\|.*/, 'invalid'],
                [/\|WF_FLOW_ACTION_ERROR_DETAIL\|.*/, 'invalid'],
                [/\|FATAL_ERROR\|.*/, 'invalid'],
                [/\|XDS_RESPONSE_ERROR\|.*/, 'invalid'],
                [/line [0-9]+, column [0-9]+/, 'invalid'],
                [/^ {2}((Number of)|(Maximum)) [a-zA-Z0-9 ]+: [0-9]+ out of [0-9]+$/, 'string'],
                [/"[a-zA-Z0-9-_\\.]+"/, 'string'],
                [
                    /[A-Z_]+/,
                    {
                        cases: {
                            '@keywords': 'keyword',
                            '@default': 'identifier',
                        },
                    },
                ],
            ],
            numbers: [
                [/0[xX][0-9a-fA-F]*/, 'number'],
                [/[$][+-]*\d*(\.\d*)?/, 'number'],
                [/((\d+(\.\d*)?)|(\.\d+))([eE][-+]?\d+)?/, 'number'],
            ],
        },
    });

    monaco.languages.setLanguageConfiguration('apexLog', {
        brackets: [
            ['[', ']'],
            ['(', ')'],
        ],
        autoClosingPairs: [
            { open: '[', close: ']' },
            { open: '(', close: ')' },
            { open: "'", close: "'" },
        ],
        surroundingPairs: [
            { open: '[', close: ']' },
            { open: '(', close: ')' },
            { open: "'", close: "'" },
        ],
    });
    monaco.editor.defineTheme('apexLog', {
        base: 'vs',
        inherit: true,
        rules: [
            {
                token: 'custom-info',
                foreground: '#667083',
            },
            {
                token: 'custom-error',
                foreground: '#ff0000',
                fontStyle: 'bold',
            },
            {
                token: 'custom-notice',
                foreground: '#333D50',
            },
            {
                token: 'custom-date',
                foreground: '#008800',
            },
            {
                token: 'info-line',
                foreground: '#ff0000',
                fontStyle: 'bold',
            },
            {
                token: 'info-version',
                foreground: '#008800',
                fontStyle: 'bold',
            },
            {
                token: 'info-debug',
                foreground: '#333D50',
            },
            {
                token: 'user-debug',
                foreground: '#0000ff',
            },
            {
                token: 'user-info',
                foreground: '#0000ff',
            },
            {
                token: 'performance',
                foreground: '#333D50',
                fontStyle: 'bold',
            },
            {
                token: 'maximum',
                foreground: '#333D50',
                fontStyle: 'bold',
            },
            {
                token: 'anonymous',
                foreground: '#333D50',
            },
            { token: 'custom-apex-code', foreground: '808080' },
            { token: 'runtime-error', foreground: 'ff0000', fontStyle: 'bold' },
            { token: 'custom-number', foreground: '008800' },
            { token: 'custom-timestamp', foreground: '008800' },
            //{ token: 'keyword', foreground: '569cd6' },
            { token: 'custom-id', foreground: '569cd6' },
            { token: 'custom-limits', foreground: 'b5cea8' },
            //{ token: 'string', foreground: 'ce9178' },
        ],
        colors: {
            //'editor.foreground': '#ff0000',
            'editor.selectionBackground': '#fdefec',
            'editor.selectionHighlightBackground': '#fdefec',
            'editor.findMatchBackground': '#fdefec',
            'editor.findMatchHighlightBackground': '#fdefec',
            'editor.findRangeHighlightBackground': '#f3f2f2',
            'editor.hoverHighlightBackground': '#f3f2f2',
            'editor.inactiveSelectionBackground': '#f3f2f2',
        },
    });
}
