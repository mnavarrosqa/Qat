import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAction, runBrowserCase } from '../src/browser-testing.js';

test('rejects malformed actions before touching the browser', () => {
  for (const a of [null, [], { action: 'click' }, { action: 'fill', ref: 'e1' }, { action: 'press', ref: 'e1', value: 'Control+C' }]) assert.throws(() => parseAction(JSON.stringify(a)));
});

test('repairs an incomplete action instead of aborting the case', async () => {
  const page = { locator: () => ({ ariaSnapshot: async () => 'Page' }), getByText: () => ({ count: async () => 1, isVisible: async () => true }) };
  const actions = [{ action: 'click' }, { action: 'assert', text: 'Ready', checkId: 'result', reason: 'Ready' }, { action: 'done' }];
  const result = await runBrowserCase(page, { expectedResult: 'Ready' }, { cfg: {}, log() {}, decide: async prompt => {
    if (actions.length === 2) assert.match(prompt, /invalid_response/);
    return JSON.stringify(actions.shift());
  } });
  assert.equal(result.status, 'PASS');
  assert.equal(result.history[0].action, 'invalid_response');
});

test('invalid responses have a bounded retry budget', async () => {
  const page = { locator: () => ({ ariaSnapshot: async () => 'Page' }) };
  let calls = 0;
  const result = await runBrowserCase(page, {}, { cfg: {}, log() {}, decide: async () => { calls++; return 'not JSON'; } });
  assert.equal(calls, 3); assert.equal(result.category, 'invalid_model_response');
});
