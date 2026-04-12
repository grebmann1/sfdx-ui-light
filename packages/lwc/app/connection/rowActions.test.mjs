import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
    CONNECTION_ROW_ACTIONS,
    getErrorRowActionName,
    resolveRequestedConnectionAction,
} from './rowActions/rowActions.ts';

test('uses authorize for errored rows that need re-authorization', () => {
    assert.equal(
        getErrorRowActionName(CONNECTION_ROW_ACTIONS.AUTHORIZE),
        CONNECTION_ROW_ACTIONS.AUTHORIZE
    );
});

test('routes stale login events to authorize when the row expects re-authorization', () => {
    assert.equal(
        resolveRequestedConnectionAction(
            CONNECTION_ROW_ACTIONS.LOGIN,
            CONNECTION_ROW_ACTIONS.AUTHORIZE
        ),
        CONNECTION_ROW_ACTIONS.AUTHORIZE
    );
});

test('keeps normal login events unchanged', () => {
    assert.equal(
        resolveRequestedConnectionAction(
            CONNECTION_ROW_ACTIONS.LOGIN,
            CONNECTION_ROW_ACTIONS.LOGIN
        ),
        CONNECTION_ROW_ACTIONS.LOGIN
    );
});
