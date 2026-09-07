import fs from 'node:fs/promises';
import { addComment, attachEvidence } from './jira.js';

const VALID_STATUSES = new Set(['PASS', 'FAIL', 'BLOCKED', 'TODO']);

export function normalizeStatus(value) {
  const status = String(value || '').trim().toUpperCase();
  if (!VALID_STATUSES.has(status)) {
    throw new Error(`Status inválido: ${value}. Usá PASS, FAIL, BLOCKED o TODO`);
  }
  return status;
}

export async function loadExecution(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  const data = JSON.parse(raw);
  const tests = Array.isArray(data) ? data : data.tests;
  if (!Array.isArray(tests)) throw new Error('El archivo debe contener un array "tests"');
  return { ...data, tests };
}

export function executionSummary(tests) {
  const counts = { PASS: 0, FAIL: 0, BLOCKED: 0, TODO: 0 };
  for (const test of tests) counts[normalizeStatus(test.status)] += 1;
  return counts;
}

export function buildExecutionComment(sourceKey, tests) {
  const counts = executionSummary(tests);
  const lines = [
    `Qat execution result for ${sourceKey}`,
    '',
    `PASS: ${counts.PASS}`,
    `FAIL: ${counts.FAIL}`,
    `BLOCKED: ${counts.BLOCKED}`,
    `TODO: ${counts.TODO}`,
    '',
    'Details:',
  ];

  for (const test of tests) {
    const status = normalizeStatus(test.status);
    const id = test.id || test.key || 'N/A';
    const title = test.title ? ` - ${test.title}` : '';
    const note = test.note || test.notes || test.comment || '';
    lines.push(`${status} | ${id}${title}${note ? ` | ${note}` : ''}`);
  }

  return { text: lines.join('\n'), counts };
}

export async function publishExecution(cfg, sourceKey, execution, { dryRun = false } = {}) {
  const tests = execution.tests || [];
  const normalized = tests.map((test) => ({ ...test, status: normalizeStatus(test.status) }));
  const { text, counts } = buildExecutionComment(sourceKey, normalized);

  const evidence = [...new Set(normalized.flatMap((test) => {
    if (!test.evidence) return [];
    return Array.isArray(test.evidence) ? test.evidence : [test.evidence];
  }).filter(Boolean))];

  if (dryRun) {
    return { sourceKey, counts, evidence, comment: text, dryRun: true };
  }

  const attachments = [];
  for (const file of evidence) {
    const result = await attachEvidence(cfg, sourceKey, file);
    attachments.push(...(Array.isArray(result) ? result : [result]));
  }

  await addComment(cfg, sourceKey, text);
  return {
    sourceKey,
    counts,
    attachments: attachments.map((item) => ({ id: item?.id, filename: item?.filename })),
    commentPublished: true,
  };
}
