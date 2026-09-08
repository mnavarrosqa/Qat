import test from 'node:test';
import assert from 'node:assert/strict';
import { localNaturalIntent, parseNaturalIntent } from '../src/natural.js';

test('understands generate cases locally without LLM', () => {
  assert.deepEqual(localNaturalIntent('analiza QA-123 y genera casos de prueba'), {
    action: 'generate', issue: 'QA-123', save: false,
  });
});

test('understands Xray sync locally', () => {
  const intent = localNaturalIntent('sube los tests de QA-123 a Xray sin modificar');
  assert.equal(intent.action, 'xray-sync');
  assert.equal(intent.issue, 'QA-123');
  assert.equal(intent.dryRun, true);
});

test('parses fenced Claude JSON', () => {
  const intent = parseNaturalIntent('```json\n{"action":"comment","issue":"QA-123","summary":"Smoke OK"}\n```');
  assert.equal(intent.action, 'comment');
  assert.equal(intent.issue, 'QA-123');
});

test('recognizes a request to test a ticket without choosing its mode', () => {
  for (const input of ['probemos el ticket AGDCF-1234', 'testeemos agdcf-1234', 'probar AGDCF-1234']) {
    assert.deepEqual(localNaturalIntent(input), { action: 'test-ticket', issue: 'AGDCF-1234' });
  }
});

test('recognizes accented imperatives without LLM interpretation', () => {
  for (const input of ['probá AGDCF-4981', 'testeá AGDCF-4981']) assert.equal(localNaturalIntent(input).action, 'test-ticket');
});
