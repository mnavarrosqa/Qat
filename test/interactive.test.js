import test from 'node:test';
import assert from 'node:assert/strict';
import { interactiveSession } from '../src/interactive.js';
import { ticketSession } from '../src/ticket-session.js';

test('conversational session shares its terminal with ticket choices and accepts further requests', async () => {
  const answers = ['', 'probemos el ticket QA-1', '0', 'otro pedido', 'salir'];
  const requests = [];
  let closes = 0;
  const terminal = { ask: async () => answers.shift(), close: () => { closes++; } };
  await interactiveSession({ prompt: () => terminal, log: () => {}, run: async (input, shared) => {
    requests.push(input);
    assert.equal(shared, terminal);
    if (input.includes('QA-1')) await ticketSession('QA-1', { terminal: shared, log: () => {} });
    assert.equal(closes, 0);
  } });
  assert.deepEqual(requests, ['probemos el ticket QA-1', 'otro pedido']);
  assert.equal(closes, 1);
});

test('failed request does not end conversation', async () => {
  const answers = ['pedido', 'salir'];
  const messages = [];
  await interactiveSession({
    prompt: () => ({ ask: async () => answers.shift(), close() {} }),
    run: async () => { throw new Error('Jira unavailable'); }, log: value => messages.push(value),
  });
  assert.ok(messages.includes('Error: Jira unavailable'));
});

test('terminal cancellation exits cleanly', async () => {
  const terminal = { closed: false, ask: async () => { terminal.closed = true; throw new Error('aborted'); }, close() {} };
  await interactiveSession({ prompt: () => terminal, log() {}, run() { assert.fail('Should not execute'); } });
});
