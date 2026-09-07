import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStructuredCases } from '../src/xray.js';

test('parseStructuredCases accepts plain JSON', () => {
  const result = parseStructuredCases('{"testCases":[{"id":"TC-001","title":"Login"}]}');
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'TC-001');
});

test('parseStructuredCases accepts fenced JSON from Claude', () => {
  const result = parseStructuredCases('```json\n{"testCases":[{"id":"TC-002","title":"Logout"}]}\n```');
  assert.equal(result[0].title, 'Logout');
});

test('parseStructuredCases rejects invalid structures', () => {
  assert.throws(() => parseStructuredCases('{"foo":[]}'), /testCases/);
});
