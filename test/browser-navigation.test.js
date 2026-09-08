import test from 'node:test';
import assert from 'node:assert/strict';
import { navigateReady, openEnvironment, cleanDiagnostic } from '../src/browser-navigation.js';
import { runBrowserCase } from '../src/browser-testing.js';
import { publishBrowserReport } from '../src/browser-evidence.js';

test('navigation waits for usable content and retries transient timeout', async () => {
  let calls = 0;
  let ready = false;
  const page = {
    goto: async (url, options) => { assert.equal(options.waitUntil, 'commit'); assert.equal(options.timeout, 45000); if (++calls === 1) throw new Error('Timeout exceeded'); return { status: () => 200 }; },
    waitForFunction: async () => { ready = true; },
    locator: () => ({ ariaSnapshot: async () => 'Ready' }),
  };
  await navigateReady(page, 'https://qa.example');
  assert.equal(calls, 2);
  assert.ok(ready);
});

test('unavailable environment fails with a single actionable error after bounded attempts', async () => {
  let calls = 0;
  await assert.rejects(navigateReady({ goto: async () => { calls++; throw new Error('Timeout exceeded'); } }, 'https://qa.example'), error => error.code === 'QAT_ENVIRONMENT_UNAVAILABLE' && /VPN/.test(error.message));
  assert.equal(calls, 2);
});

test('HTTP errors do not count as a ready application', async () => {
  await assert.rejects(navigateReady({ goto: async () => ({ status: () => 503 }) }, 'https://qa.example'), error => /HTTP 503/.test(error.cause.message));
});

test('external login interception yields control without retrying', async () => {
  let calls = 0;
  await navigateReady({ goto: async () => { calls++; throw new Error('net::ERR_FAILED'); } }, 'https://qa.example', { interrupted: () => true });
  assert.equal(calls, 1);
});

test('environment recovery offers headed login after navigation fails', async () => {
  let authenticated = false;
  const error = Object.assign(new Error('Unavailable'), { code: 'QAT_ENVIRONMENT_UNAVAILABLE' });
  await openEnvironment({ newPage: async () => { throw error; }, authenticate: async () => { authenticated = true; } }, { ask: async () => 'login' }, () => {});
  assert.ok(authenticated);
});

test('empty page does not reach the model', async () => {
  await assert.rejects(runBrowserCase({ locator: () => ({ ariaSnapshot: async () => '' }) }, {}, { cfg: {}, decide: async () => assert.fail('Must not call model') }), error => error.code === 'QAT_ENVIRONMENT_UNAVAILABLE');
});

test('shared environment block is reported once with unexecuted coverage', async () => {
  let body;
  await publishBrowserReport({}, { key: 'QA-1', status: 'BLOCKED', environment: 'qa', profile: 'default', results: [{ status: 'BLOCKED', scope: 'environment' }], environmentBlock: { note: '\u001b[2mAmbiente inaccesible\u001b[22m', notRun: [{ id: 'TC-1' }, { id: 'TC-2' }] } }, { confirm: async () => true, comment: async (cfg, key, value) => { body = JSON.stringify(value); } });
  assert.match(body, /Casos no ejecutados: 2/);
  assert.equal((body.match(/Ambiente inaccesible/g) || []).length, 1);
  assert.ok(!body.includes('\\u001b'));
  assert.equal(cleanDiagnostic('\u001b[2merror\u001b[22m&#x20;'), 'error');
});

test('navigation does not accept a DOM whose accessibility content is still empty', async () => {
  let snapshots = 0;
  await navigateReady({
    goto: async () => ({ status: () => 200 }),
    waitForFunction: async () => {},
    locator: () => ({ ariaSnapshot: async () => ++snapshots === 1 ? '' : 'Login form' }),
  }, 'https://qa.example', { timeout: 1000 });
  assert.equal(snapshots, 2);
});
