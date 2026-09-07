import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStatus, executionSummary, buildExecutionComment } from '../src/execution.js';

test('normalizeStatus accepts supported values case-insensitively', () => {
  assert.equal(normalizeStatus('pass'), 'PASS');
  assert.equal(normalizeStatus(' Fail '), 'FAIL');
  assert.equal(normalizeStatus('blocked'), 'BLOCKED');
  assert.equal(normalizeStatus('todo'), 'TODO');
});

test('normalizeStatus rejects unsupported values', () => {
  assert.throws(() => normalizeStatus('skipped'), /Status inválido/);
});

test('executionSummary counts statuses', () => {
  const counts = executionSummary([
    { status: 'pass' },
    { status: 'PASS' },
    { status: 'fail' },
    { status: 'blocked' },
    { status: 'todo' },
  ]);
  assert.deepEqual(counts, { PASS: 2, FAIL: 1, BLOCKED: 1, TODO: 1 });
});

test('buildExecutionComment includes totals and notes', () => {
  const result = buildExecutionComment('QA-123', [
    { id: 'TC-1', title: 'Happy path', status: 'PASS' },
    { id: 'TC-2', title: 'Negative path', status: 'FAIL', note: 'Unexpected 500' },
  ]);
  assert.match(result.text, /Qat execution result for QA-123/);
  assert.match(result.text, /PASS: 1/);
  assert.match(result.text, /FAIL: 1/);
  assert.match(result.text, /Unexpected 500/);
});
