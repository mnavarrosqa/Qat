import fs from 'node:fs/promises';
import { addComment, attachEvidence, createIssue, getIssue, linkIssues } from './jira.js';

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
  if (!Array.isArray(tests) || tests.length === 0) throw new Error('El archivo debe contener un array "tests" no vacío');
  return { ...data, tests };
}

export function executionSummary(tests) {
  const counts = { PASS: 0, FAIL: 0, BLOCKED: 0, TODO: 0 };
  for (const test of tests) counts[normalizeStatus(test.status)] += 1;
  return counts;
}

export function buildExecutionComment(sourceKey, tests, executionKey = '') {
  const counts = executionSummary(tests);
  const lines = [
    `Qat execution result for ${sourceKey}${executionKey ? ` (${executionKey})` : ''}`,
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
    lines.push(`${status} | ${id}${test.key && test.key !== id ? ` [${test.key}]` : ''}${title}${note ? ` | ${note}` : ''}`);
  }

  return { text: lines.join('\n'), counts };
}

function executionDescription(sourceKey, tests) {
  return buildExecutionComment(sourceKey, tests).text;
}

function evidenceFiles(tests) {
  return [...new Set(tests.flatMap((test) => {
    if (!test.evidence) return [];
    return Array.isArray(test.evidence) ? test.evidence : [test.evidence];
  }).filter(Boolean))];
}

export async function publishExecution(cfg, sourceKey, execution, { dryRun = false } = {}) {
  if (!cfg.xrayEnabled) throw new Error('XRAY_ENABLED=false');

  const source = await getIssue(cfg, sourceKey);
  const projectKey = cfg.xrayProjectKey || source.fields?.project?.key || sourceKey.split('-')[0];
  const tests = execution.tests || [];
  const normalized = tests.map((test) => ({ ...test, status: normalizeStatus(test.status) }));
  const counts = executionSummary(normalized);
  const evidence = evidenceFiles(normalized);
  const fields = {
    project: { key: projectKey },
    issuetype: { name: cfg.xrayExecutionIssueType },
    summary: (execution.summary || `Qat execution - ${sourceKey}`).slice(0, 255),
    description: executionDescription(sourceKey, normalized),
    labels: ['qat', 'qat-execution', `qat-source-${sourceKey.toLowerCase()}`],
  };

  if (dryRun) {
    return { sourceKey, counts, evidence, fields, tests: normalized, dryRun: true };
  }

  const created = await createIssue(cfg, fields);
  const executionKey = created.key;
  await linkIssues(cfg, sourceKey, executionKey, cfg.xrayExecutionLinkType);

  for (const test of normalized) {
    if (test.key) await linkIssues(cfg, executionKey, test.key, cfg.xrayExecutionLinkType);
  }

  const attachments = [];
  for (const file of evidence) {
    const result = await attachEvidence(cfg, executionKey, file);
    attachments.push(...(Array.isArray(result) ? result : [result]));
  }

  const { text } = buildExecutionComment(sourceKey, normalized, executionKey);
  await addComment(cfg, sourceKey, text);

  return {
    sourceKey,
    executionKey,
    counts,
    attachments: attachments.map((item) => ({ id: item?.id, filename: item?.filename })),
    commentPublished: true,
  };
}
