import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { verifyCheck, classifyBrowserError } from '../src/browser-checks.js';

test('real browser verifies control state, values, visibility and URL', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent('<input aria-label="Name" value="QA"><input type="checkbox" aria-label="Active" checked><button disabled>Save</button><p>Saved</p><p>Saved</p>');
    for (const action of [
      { kind: 'value', role: 'textbox', name: 'Name', value: 'QA' },
      { kind: 'disabled', role: 'button', name: 'Save' },
      { kind: 'checked', role: 'checkbox', name: 'Active' },
      { kind: 'visible', role: 'textbox', name: 'Name' },
      { kind: 'hidden', role: 'button', name: 'Missing' },
      { kind: 'url', value: 'about:blank' },
    ]) assert.equal((await verifyCheck(page, { ...action, reason: 'Requirement' }, 100)).passed, true);
    assert.equal((await verifyCheck(page, { kind: 'enabled', role: 'button', name: 'Save', reason: 'Requirement' }, 100)).passed, false);
    await assert.rejects(verifyCheck(page, { text: 'Saved', reason: 'Confirmation' }, 100), /ambiguo/);
    await assert.rejects(verifyCheck(page, { kind: 'script', reason: 'No' }), /inválido/);
  } finally { await browser.close(); }
});

test('execution diagnostics distinguish model, locator and environment failures', () => {
  assert.equal(classifyBrowserError(new SyntaxError('JSON')), 'invalid_model_response');
  assert.equal(classifyBrowserError(new Error('strict mode violation')), 'ambiguous_locator');
  assert.equal(classifyBrowserError(new Error('locator.click: Timeout')), 'element_unavailable');
  assert.equal(classifyBrowserError({ code: 'QAT_ENVIRONMENT_UNAVAILABLE' }), 'environment');
});
