const AUTH_URL = 'https://xray.cloud.getxray.app/api/v1/authenticate';
const GRAPHQL_URL = 'https://xray.cloud.getxray.app/api/v2/graphql';

function requireCredentials(cfg) {
  if (!cfg.xrayClientId || !cfg.xrayClientSecret) {
    throw new Error('Faltan XRAY_CLIENT_ID/XRAY_CLIENT_SECRET para usar Xray Cloud API');
  }
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) {
    const detail = typeof body === 'string' ? body : JSON.stringify(body);
    throw new Error(`Xray Cloud HTTP ${response.status}: ${detail}`);
  }
  return body;
}

export async function authenticateXrayCloud(cfg) {
  requireCredentials(cfg);
  const body = await requestJson(AUTH_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: cfg.xrayClientId, client_secret: cfg.xrayClientSecret }),
  });
  const token = typeof body === 'string' ? body : body?.token;
  if (!token) throw new Error('Xray Cloud no devolvió un token válido');
  return token;
}

export async function xrayGraphql(cfg, query, variables = {}) {
  const token = await authenticateXrayCloud(cfg);
  const body = await requestJson(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (body?.errors?.length) {
    throw new Error(`Xray GraphQL: ${body.errors.map((item) => item.message).join('; ')}`);
  }
  return body?.data;
}

function stepForXray(step) {
  if (typeof step === 'string') return { action: step, result: '' };
  return {
    action: String(step?.action || step?.step || ''),
    data: String(step?.data || ''),
    result: String(step?.expected || step?.expectedResult || step?.result || ''),
  };
}

export async function findXrayCloudTest(cfg, jql) {
  const query = `query FindTests($jql: String!) {
    getTests(jql: $jql, limit: 2) {
      results { issueId jira(fields: ["key", "summary", "labels"]) }
    }
  }`;
  const data = await xrayGraphql(cfg, query, { jql });
  return data?.getTests?.results?.[0] || null;
}

export async function createXrayCloudTest(cfg, { projectKey, summary, labels = [], testCase }) {
  const query = `mutation CreateTest($testType: UpdateTestTypeInput, $steps: [CreateStepInput], $jira: JSON!) {
    createTest(testType: $testType, steps: $steps, jira: $jira) {
      test { issueId jira(fields: ["key", "summary"]) }
      warnings
    }
  }`;
  const variables = {
    testType: { name: testCase.type || cfg.xrayTestTypeValue || 'Manual' },
    steps: Array.isArray(testCase.steps) ? testCase.steps.map(stepForXray) : [],
    jira: {
      fields: {
        project: { key: projectKey },
        summary: String(summary).slice(0, 255),
        labels,
      },
    },
  };
  const data = await xrayGraphql(cfg, query, variables);
  return data?.createTest || null;
}

export async function checkXrayCloud(cfg) {
  if (!cfg.xrayClientId || !cfg.xrayClientSecret) {
    return { ok: false, reason: 'faltan XRAY_CLIENT_ID/XRAY_CLIENT_SECRET' };
  }
  try {
    const token = await authenticateXrayCloud(cfg);
    return { ok: Boolean(token) };
  } catch (error) {
    return { ok: false, reason: error.message };
  }
}
