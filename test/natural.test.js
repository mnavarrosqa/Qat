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
