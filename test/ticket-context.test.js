import test from 'node:test';
import assert from 'node:assert/strict';
import { getIssueContext } from '../src/jira.js';
import { testCasesPrompt, xrayCasesPrompt } from '../src/prompts.js';

test('context reads every comment page and retains additional fields', async () => {
  const original = globalThis.fetch;
  const urls = [];
  const responses = [
    { key: 'QA-1', fields: { customfield_1: 'Acceptance criteria' } },
    { comments: [{ id: '1', body: 'First' }], total: 2 },
    { comments: [{ id: '2', body: 'Developer clarification' }], total: 2 },
  ];
  globalThis.fetch = async url => {
    urls.push(url);
    return { ok: true, status: 200, text: async () => JSON.stringify(responses.shift()) };
  };
  try {
    const issue = await getIssueContext({ jiraBaseUrl: 'https://jira.example', jiraEmail: 'test', jiraToken: 'test' }, 'QA-1');
    assert.equal(issue.fields.comment.comments.length, 2);
    assert.match(urls[2], /startAt=1/);
    assert.equal(issue.fields.customfield_1, 'Acceptance criteria');
    for (const prompt of [testCasesPrompt(issue), xrayCasesPrompt(issue)]) {
      assert.match(prompt, /Developer clarification/);
      assert.match(prompt, /Acceptance criteria/);
      assert.match(prompt, /contradicciones/);
    }
  } finally { globalThis.fetch = original; }
});

test('context is never silently truncated when comments exceed the budget', () => {
  const issue = { fields: { comment: { comments: [{ body: 'x'.repeat(40000) }] } } };
  assert.throws(() => testCasesPrompt(issue), /excede el presupuesto/);
  assert.throws(() => xrayCasesPrompt(issue), /excede el presupuesto/);
});

test('prompts retain comment attribution, attachment limitations and related issues', () => {
  const issue = { fields: { comment: { comments: [{ id: '42', author: { displayName: 'Developer' }, updated: '2026-09-07', body: { type: 'doc', content: [{ type: 'text', text: 'Use flag A' }] } }] }, attachment: [{ filename: 'spec.pdf', content: 'https://jira.example/spec' }], issuelinks: [{ outwardIssue: { key: 'QA-2' } }] } };
  const prompt = testCasesPrompt(issue);
  for (const text of ['42', 'Developer', '2026-09-07', 'Use flag A', 'spec.pdf', 'no leído', 'QA-2']) assert.ok(prompt.includes(text));
});
