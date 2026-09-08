import test from 'node:test';
import assert from 'node:assert/strict';
import { publishBrowserReport } from '../src/browser-evidence.js';

function report() {
  return { key: 'QA-1', status: 'FAIL', environment: 'qa', profile: 'default', results: [{ id: 'TC-1', status: 'FAIL', note: 'Expected message missing', evidence: [{ file: '/tmp/test.png', annotation: 'FAIL | TC-1 | expected confirmation' }] }] };
}

test('uploads evidence before posting a comment containing the actual Jira attachment link', async () => {
  const value = report();
  const calls = [];
  await publishBrowserReport({}, value, {
    confirm: async () => true,
    upload: async (cfg, key, file) => { calls.push('upload'); assert.equal(key, 'QA-1'); return [{ id: '123', filename: 'test.png', content: 'https://jira.example/attachment/123' }]; },
    comment: async (cfg, key, body) => {
      calls.push('comment');
      assert.equal(body.type, 'doc');
      assert.ok(JSON.stringify(body).includes('https://jira.example/attachment/123'));
      assert.ok(JSON.stringify(body).includes('expected confirmation'));
    },
  });
  assert.deepEqual(calls, ['upload', 'comment']);
  assert.ok(value.publication.commentPublished);
});

test('attachment failures are explicit in the comment and report', async () => {
  const value = report();
  await publishBrowserReport({}, value, {
    confirm: async () => true,
    upload: async () => { throw new Error('403'); },
    comment: async (cfg, key, body) => assert.match(JSON.stringify(body), /No se pudo adjuntar/),
  });
  assert.equal(value.publication.errors.length, 1);
  assert.ok(value.publication.commentPublished);
});

test('comment failure preserves uploaded attachment and failure details', async () => {
  const value = report();
  let saved;
  await assert.rejects(publishBrowserReport({}, value, {
    confirm: async () => true,
    upload: async () => [{ id: '123', content: 'https://jira.example/attachment/123' }],
    comment: async () => { throw new Error('503'); },
    save: async () => { saved = JSON.parse(JSON.stringify(value)); },
  }), /503/);
  assert.equal(saved.results[0].evidence[0].attachment.id, '123');
  assert.equal(saved.publication.commentPublished, false);
  assert.match(saved.publication.errors[0], /503/);
});

test('approval sees full draft and attachment list before any Jira write', async () => {
  const calls = [];
  await publishBrowserReport({}, report(), {
    confirm: async preview => {
      calls.push('preview');
      assert.equal(preview.key, 'QA-1');
      assert.match(JSON.stringify(preview.body), /Expected message missing/);
      assert.deepEqual(preview.files, ['/tmp/test.png']);
      return true;
    },
    upload: async () => { calls.push('upload'); return [{ content: 'https://jira.example/123' }]; },
    comment: async () => { calls.push('comment'); },
  });
  assert.deepEqual(calls, ['preview', 'upload', 'comment']);
});

test('declining preserves preview and does not write to Jira', async () => {
  const value = report();
  let saved;
  await publishBrowserReport({}, value, {
    confirm: async () => false,
    upload: async () => assert.fail('Must not upload'),
    comment: async () => assert.fail('Must not comment'),
    save: async () => { saved = JSON.parse(JSON.stringify(value)); },
  });
  assert.equal(saved.publication.status, 'cancelled');
  assert.equal(saved.publication.commentPublished, false);
  assert.ok(saved.publication.preview);
});

test('confirmation interruption prevents all writes', async () => {
  const value = report();
  await assert.rejects(publishBrowserReport({}, value, {
    confirm: async () => { throw new Error('Cancelled'); },
    upload: async () => assert.fail('Must not upload'),
    comment: async () => assert.fail('Must not comment'),
  }), /Cancelled/);
  assert.equal(value.publication.commentPublished, false);
});

test('changed comment after an upload failure requires fresh approval', async () => {
  const value = report();
  let approvals = 0;
  await publishBrowserReport({}, value, {
    confirm: async preview => {
      if (++approvals === 1) return true;
      assert.ok(preview.revised);
      assert.match(JSON.stringify(preview.body), /No se pudo adjuntar/);
      return false;
    },
    upload: async () => { throw new Error('403'); },
    comment: async () => assert.fail('Changed comment was rejected'),
  });
  assert.equal(approvals, 2);
  assert.equal(value.publication.status, 'cancelled_after_upload');
});

test('empty answer and no interactive terminal never approve publication', async () => {
  const { confirmBrowserPublication } = await import('../src/browser-evidence.js');
  const preview = { key: 'QA-1', body: { content: [] }, files: [] };
  assert.equal(await confirmBrowserPublication(preview, { log() {} }), false);
  assert.equal(await confirmBrowserPublication(preview, { log() {}, terminal: { ask: async () => '' } }), false);
  assert.equal(await confirmBrowserPublication(preview, { log() {}, terminal: { ask: async () => 'sí' } }), true);
});
