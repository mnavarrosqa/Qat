import test from 'node:test';
import assert from 'node:assert/strict';
import { ticketSession } from '../src/ticket-session.js';

for (const [answers, expected] of [[['1'], 'cases'], [['incorrecto', '2'], 'tests'], [['0'], undefined]]) {
  test(`ticket session routes choice ${answers.join(', ')}`, async () => {
    let action;
    let closed = false;
    await ticketSession('AGDCF-1234', {
      prompt: () => ({ ask: async () => answers.shift(), close: () => { closed = true; } }),
      log: () => {},
      generate: async (key, save) => { assert.equal(key, 'AGDCF-1234'); assert.equal(save, true); action = 'cases'; },
      runTests: async key => { assert.equal(key, 'AGDCF-1234'); action = 'tests'; },
    });
    assert.equal(action, expected);
    assert.ok(closed);
  });
}

test('closes terminal on execution failure', async () => {
  let closed = false;
  await assert.rejects(ticketSession('QA-1', {
    prompt: () => ({ ask: async () => '2', close: () => { closed = true; } }), log: () => {},
    runTests: async () => { throw new Error('Execution failed'); },
  }), /Execution failed/);
  assert.ok(closed);
});

const { runTicketRequest } = await import('../src/ticket-session.js');
test('testing request executes directly with publication and ticket scope', async () => {
  let closed = false;
  const result = await runTicketRequest('QA-1', 'probá QA-1', {
    log() {}, prompt: () => ({ ask() { assert.fail('Unexpected mode question'); }, close() { closed = true; } }),
    runTests: async (key, options) => {
      assert.equal(key, 'QA-1'); assert.equal(options.publish, true);
      assert.match(options.scope, /comentarios/); return 'done';
    },
  });
  assert.equal(result, 'done'); assert.ok(closed);
});
test('explicit local-only request cannot publish and preserves shared terminal', async () => {
  await runTicketRequest('QA-1', 'probá QA-1 sin publicar', {
    log() {}, terminal: { close() { assert.fail('Shared terminal closed'); } },
    runTests: async (_, options) => { assert.equal(options.publish, false); },
  });
});
