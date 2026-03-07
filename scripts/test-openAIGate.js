#!/usr/bin/env node
/**
 * Basic tests for openAIGate model-tool support and tool filtering.
 * Run: node scripts/test-openAIGate.js
 */
const assert = require('assert');
const path = require('path');

const modelToolSupport = require('../src/server/modules/openAIGate/modelToolSupport');
const openAIGateModule = require('../src/server/modules/openAIGate/openAIGate');
const filterToolsByModel = openAIGateModule.filterToolsByModel;

const { getModelFamily, getSupportedBuiltInToolTypes } = modelToolSupport;

function ok(condition, message) {
    assert.ok(condition, message);
    console.log('  ✓', message);
}

// --- getModelFamily
console.log('\n1. getModelFamily');
ok(getModelFamily('gpt-5-mini') === 'gpt-5-mini', 'gpt-5-mini -> gpt-5-mini');
ok(getModelFamily('gpt-5.4-2026-03-05') === 'gpt-5.4', 'gpt-5.4-2026-03-05 -> gpt-5.4');
ok(getModelFamily('gpt-5-nano') === 'gpt-5-nano', 'gpt-5-nano -> gpt-5-nano');
ok(getModelFamily('o1-mini') === 'o1-mini', 'o1-mini -> o1-mini');
ok(getModelFamily('unknown-model') === null, 'unknown model -> null');
ok(getModelFamily('') === null, 'empty string -> null');

// --- getSupportedBuiltInToolTypes (per OpenAI model docs)
console.log('\n2. getSupportedBuiltInToolTypes');
const miniSet = getSupportedBuiltInToolTypes('gpt-5-mini');
ok(miniSet.has('web_search'), 'gpt-5-mini has web_search');
ok(miniSet.has('code_interpreter'), 'gpt-5-mini has code_interpreter');
ok(!miniSet.has('apply_patch'), 'gpt-5-mini does not have apply_patch');
ok(!miniSet.has('shell'), 'gpt-5-mini does not have shell');
ok(!miniSet.has('image_generation'), 'gpt-5-mini does not have image_generation');

const gpt5Set = getSupportedBuiltInToolTypes('gpt-5');
ok(gpt5Set.has('image_generation'), 'gpt-5 has image_generation');
ok(!gpt5Set.has('shell'), 'gpt-5 does not have shell');

const gpt54Set = getSupportedBuiltInToolTypes('gpt-5.4-2026-03-05');
ok(gpt54Set.has('apply_patch'), 'gpt-5.4 has apply_patch');
ok(gpt54Set.has('shell'), 'gpt-5.4 has shell');
ok(gpt54Set.has('web_search'), 'gpt-5.4 has web_search');

// --- filterToolsByModel
console.log('\n3. filterToolsByModel');
const toolsMixed = [
    { type: 'function', name: 'my_tool' },
    { type: 'web_search' },
    { type: 'apply_patch' },
    { type: 'code_interpreter' },
    { type: 'shell' },
];
const filteredMini = filterToolsByModel(toolsMixed, 'gpt-5-mini');
ok(filteredMini.length === 3, 'gpt-5-mini: 3 tools (function + web_search + code_interpreter)');
ok(filteredMini.every(t => t.type !== 'apply_patch' && t.type !== 'shell'), 'apply_patch and shell removed for gpt-5-mini');

const filtered54 = filterToolsByModel(toolsMixed, 'gpt-5.4');
ok(filtered54.length === 5, 'gpt-5.4: all 5 tools kept');

const empty = filterToolsByModel([], 'gpt-5-mini');
ok(Array.isArray(empty) && empty.length === 0, 'empty tools returns empty array');

const noTools = filterToolsByModel(undefined, 'gpt-5-mini');
ok(noTools === undefined, 'undefined tools returned as-is');

console.log('\nAll openAIGate tests passed.\n');
