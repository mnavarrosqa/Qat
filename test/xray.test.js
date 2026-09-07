import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseStructuredCases, exportTestCases } from '../src/xray.js';

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

test('exportTestCases creates importable CSV', async () => {
  const original = process.cwd();
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'qat-xray-'));
  try {
    process.chdir(temp);
    const result = await exportTestCases(
      { xrayExportFormat: 'csv', xrayTestIssueType: 'Test', xrayTestTypeValue: 'Manual' },
      'QA-123',
      [{ id: 'TC-001', title: 'Login válido', steps: [{ action: 'Ingresar', expected: 'Dashboard' }] }],
    );
    assert.equal(result.count, 1);
    const csv = await fs.readFile(result.file, 'utf8');
    assert.match(csv, /Summary,Issue Type,Description/);
    assert.match(csv, /\[TC-001\] Login válido/);
    assert.match(csv, /QA-123/);
  } finally {
    process.chdir(original);
    await fs.rm(temp, { recursive: true, force: true });
  }
});
