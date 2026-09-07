import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticateXrayCloud, createXrayCloudTest, findXrayCloudTest } from '../src/xray-cloud.js';

function response(body, { ok = true, status = 200 } = {}) {
  return { ok, status, text: async () => typeof body === 'string' ? body : JSON.stringify(body) };
}

test('authenticateXrayCloud sends client credentials and returns token', async () => {
  const originalFetch = global.fetch;
  let seen;
  global.fetch = async (url, options) => {
    seen = { url, options };
    return response('token-123');
  };
  try {
    const token = await authenticateXrayCloud({ xrayClientId: 'id', xrayClientSecret: 'secret' });
    assert.equal(token, 'token-123');
    assert.match(seen.url, /authenticate$/);
    assert.deepEqual(JSON.parse(seen.options.body), { client_id: 'id', client_secret: 'secret' });
  } finally {
    global.fetch = originalFetch;
  }
});

test('findXrayCloudTest authenticates then searches through GraphQL', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    if (/authenticate$/.test(url)) return response('token-abc');
    return response({ data: { getTests: { results: [{ issueId: '10001', jira: { key: 'QA-77' } }] } } });
  };
  try {
    const found = await findXrayCloudTest({ xrayClientId: 'id', xrayClientSecret: 'secret' }, 'project = "QA"');
    assert.equal(found.jira.key, 'QA-77');
    assert.match(calls[1].options.headers.authorization, /Bearer token-abc/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('createXrayCloudTest maps manual steps to Xray GraphQL variables', async () => {
  const originalFetch = global.fetch;
  let graphqlBody;
  global.fetch = async (url, options) => {
    if (/authenticate$/.test(url)) return response('token-xyz');
    graphqlBody = JSON.parse(options.body);
    return response({ data: { createTest: { test: { issueId: '10002', jira: { key: 'QA-88' } }, warnings: [] } } });
  };
  try {
    const result = await createXrayCloudTest(
      { xrayClientId: 'id', xrayClientSecret: 'secret', xrayTestTypeValue: 'Manual' },
      {
        projectKey: 'QA',
        summary: '[TC-1] Login',
        labels: ['qat'],
        testCase: { id: 'TC-1', title: 'Login', steps: [{ action: 'Open login', expected: 'Login loads' }] },
      },
    );
    assert.equal(result.test.jira.key, 'QA-88');
    assert.equal(graphqlBody.variables.steps[0].action, 'Open login');
    assert.equal(graphqlBody.variables.steps[0].result, 'Login loads');
  } finally {
    global.fetch = originalFetch;
  }
});
