import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import dotenv from 'dotenv';
import { runSetup } from '../src/setup.js';

async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'qat-setup-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  return path.join(dir, '.env');
}
const base = { JIRA_BASE_URL: 'https://example.atlassian.net', JIRA_EMAIL: 'qa@example.com', JIRA_API_TOKEN: 'token # $& secret' };

test('setup configures Jira without Xray, preserves unrelated values and protects secrets', async t => {
  const envPath = await fixture(t);
  await fs.writeFile(envPath, '# custom\nOTHER=value\n');
  const logs = [];
  await runSetup({ envPath, log: v => logs.push(v), ask: async (label, options) => {
    if (options.key === 'JIRA_API_TOKEN') assert.equal(options.secret, true);
    return base[options.key] || '';
  } });
  const content = await fs.readFile(envPath, 'utf8');
  const env = dotenv.parse(content);
  assert.equal(env.JIRA_API_TOKEN, base.JIRA_API_TOKEN);
  assert.equal(env.XRAY_ENABLED, 'false');
  assert.equal(env.OTHER, 'value');
  assert.equal((await fs.stat(envPath)).mode & 0o777, 0o600);
  assert.ok(!logs.join('').includes(base.JIRA_API_TOKEN));
});

for (const mode of ['api', 'export']) test(`setup configures Xray ${mode} and validates URL`, async t => {
  const envPath = await fixture(t);
  let urls = 0;
  const answers = { ...base, XRAY_ENABLED: 'true', XRAY_PROJECT_KEY: 'QA', XRAY_MODE: mode, XRAY_CLIENT_ID: 'id', XRAY_CLIENT_SECRET: 'secret', XRAY_EXPORT_FORMAT: 'json' };
  await runSetup({ envPath, log() {}, ask: async (_, { key }) => key === 'JIRA_BASE_URL' && urls++ === 0 ? 'invalid' : answers[key] || '' });
  const env = dotenv.parse(await fs.readFile(envPath, 'utf8'));
  assert.equal(urls, 2);
  assert.equal(env.XRAY_MODE, mode);
  assert.equal(env.XRAY_PROJECT_KEY, 'QA');
  assert.equal(mode === 'api' ? env.XRAY_CLIENT_SECRET : env.XRAY_EXPORT_FORMAT, mode === 'api' ? 'secret' : 'json');
});

test('cancellation leaves existing configuration untouched', async t => {
  const envPath = await fixture(t);
  const original = 'OTHER=keep\n';
  await fs.writeFile(envPath, original);
  await assert.rejects(runSetup({ envPath, log() {}, ask: async () => { throw new Error('cancel'); } }), /cancel/);
  assert.equal(await fs.readFile(envPath, 'utf8'), original);
});

test('rerun preserves credentials and selects existing environment profiles', async t => {
  const envPath = await fixture(t);
  await fs.mkdir(path.join(path.dirname(envPath), '.qat'));
  const source = JSON.stringify({ environments: { staging: { baseUrl: 'https://example.com', defaultProfile: 'admin', profiles: { admin: { user: 'a', password: 'b' } } } } });
  const envFile = path.join(path.dirname(envPath), '.qat/environments.json');
  await fs.writeFile(envFile, source);
  await fs.writeFile(envPath, Object.entries(base).map(([key, value]) => `${key}='${value}'`).join('\n'));
  await runSetup({ envPath, log() {}, ask: async label => { assert.ok(!label.includes(base.JIRA_API_TOKEN)); return ''; } });
  const env = dotenv.parse(await fs.readFile(envPath, 'utf8'));
  assert.equal(env.JIRA_API_TOKEN, base.JIRA_API_TOKEN);
  assert.equal(env.QAT_ENV, 'staging');
  assert.equal(env.QAT_PROFILE, 'admin');
  assert.equal(await fs.readFile(envFile, 'utf8'), source);
});
