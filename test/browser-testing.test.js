import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { chromium } from 'playwright';
import { runBrowserCase, overallStatus, parseAction } from '../src/browser-testing.js';

test('overall outcome never reports incomplete execution as PASS', () => {
  assert.equal(overallStatus([]), 'BLOCKED');
  assert.equal(overallStatus([{ status: 'PASS' }, { status: 'BLOCKED' }]), 'BLOCKED');
  assert.equal(overallStatus([{ status: 'PASS' }, { status: 'FAIL' }]), 'FAIL');
  assert.throws(() => parseAction('{"action":"eval"}'), /inválida/);
});

test('browser performs interactions and distinguishes PASS, FAIL and no verification', async () => {
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end('<label>Name<input aria-label="Name"></label><button onclick="document.querySelector(\'p\').textContent=\'Saved\'">Save</button><p></p>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const actions = [
      { action: 'fill', role: 'textbox', name: 'Name', value: 'QA' },
      { action: 'click', role: 'button', name: 'Save' },
      { action: 'assert', text: 'Saved', checkId: 'result', reason: 'Save confirmation' },
      { action: 'done', reason: 'Save verified' },
    ];
    const result = await runBrowserCase(page, { id: 'TC-1', expectedResult: 'Save confirmation' }, { decide: async () => JSON.stringify(actions.shift()), cfg: {}, log: () => {} });
    assert.equal(result.status, 'PASS');
    assert.equal(await page.getByRole('textbox').inputValue(), 'QA');
    const blocked = await runBrowserCase(page, {}, { decide: async () => '{"action":"done"}', cfg: {} });
    assert.equal(blocked.status, 'BLOCKED');
    const failed = await runBrowserCase(page, { expectedResult: 'Confirmation' }, { decide: async () => '{"checkId":"result","action":"assert","text":"Missing confirmation","reason":"Expected confirmation"}', cfg: { navigationTimeout: 100 } });
    assert.equal(failed.status, 'FAIL');
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});

test('authentication action resumes with the replacement page and never counts as a verification', async () => {
  const page = { locator: () => ({ ariaSnapshot: async () => 'Login' }) };
  const resumed = { locator: () => ({ ariaSnapshot: async () => 'Authenticated' }) };
  const actions = ['{"action":"authenticate"}', '{"action":"done"}'];
  let calls = 0;
  const result = await runBrowserCase(page, {}, {
    cfg: {},
    decide: async prompt => {
      if (calls) assert.match(prompt, /Authenticated/);
      return actions.shift();
    },
    authenticate: async () => { calls++; return resumed; },
  });
  assert.equal(calls, 1);
  assert.equal(result.status, 'BLOCKED');
});

test('missing credentials request manual authentication rather than inventing values', async () => {
  const page = { locator: () => ({ ariaSnapshot: async () => 'Login' }) };
  let requested = false;
  await assert.rejects(runBrowserCase(page, {}, {
    cfg: {}, decide: async () => '{"action":"fill","role":"textbox","name":"Password","credential":"password"}',
    authenticate: async () => { requested = true; throw new Error('Autenticación cancelada'); },
  }), /cancelada/);
  assert.ok(requested);
});

test('a successful assertion cannot bypass other expected results', async () => {
  const page = { locator: () => ({ ariaSnapshot: async () => 'Saved' }), getByText: () => ({ count: async () => 1, isVisible: async () => true }) };
  const actions = [ { action: 'assert', checkId: 'step-1', text: 'Saved', reason: 'Confirmation' }, { action: 'done' } ];
  const result = await runBrowserCase(page, { steps: [{ expected: 'Confirmation' }], expectedResult: 'Record persisted' }, { cfg: {}, log() {}, decide: async () => JSON.stringify(actions.shift()) });
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.category, 'incomplete_coverage');
  assert.deepEqual(result.coverage.map(c => c.verified), [true, false]);
});

test('unknown requirement IDs cannot produce PASS', async () => {
  const page = { locator: () => ({ ariaSnapshot: async () => 'Saved' }) };
  await assert.rejects(runBrowserCase(page, { expectedResult: 'Saved' }, { cfg: {}, decide: async () => JSON.stringify({ action: 'assert', checkId: 'invented', text: 'Saved', reason: 'Saved' }) }), /checkId/);
});

test('discovers an unspecified route through menus after rejecting a premature block', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(`<button onclick="document.querySelector('#modules').hidden=false">Menú</button><div id="modules" hidden><button onclick="document.querySelector('#records').hidden=false">Operaciones</button></div><div id="records" hidden><button onclick="document.querySelector('#form').hidden=false">Solicitudes</button></div><div id="form" hidden><input aria-label="Referencia" value="QA-123"></div>`);
    const actions = [
      { action: 'blocked', category: 'navigation', reason: 'El ticket no indica la ruta' },
      { action: 'click', role: 'button', name: 'Menú' },
      { action: 'click', role: 'button', name: 'Operaciones' },
      { action: 'click', role: 'button', name: 'Solicitudes' },
      { action: 'assert', checkId: 'result', kind: 'value', role: 'textbox', name: 'Referencia', value: 'QA-123', reason: 'Referencia de solicitud' },
      { action: 'done' },
    ];
    const result = await runBrowserCase(page, { id: 'TC-route', preconditions: ['Ruta no indicada'], expectedResult: 'Referencia QA-123 en Solicitudes' }, {
      cfg: { navigationTimeout: 100 }, log() {}, decide: async prompt => {
        assert.match(prompt, /incluso si el caso generado/);
        if (actions.length === 5) assert.match(prompt, /discovery_required/);
        return JSON.stringify(actions.shift());
      },
    });
    assert.equal(result.status, 'PASS');
    assert.equal(result.history.filter(a => a.action === 'click').length, 3);
  } finally { await browser.close(); }
});

test('route discovery remains bounded and reports a navigation-specific block', async () => {
  const page = { locator: () => ({ ariaSnapshot: async () => 'No modules available' }) };
  let calls = 0;
  const result = await runBrowserCase(page, { expectedResult: 'Record' }, { cfg: {}, log() {}, decide: async () => { calls++; return JSON.stringify({ action: 'blocked', category: 'navigation', reason: 'Sin accesos visibles' }); } });
  assert.equal(calls, 3);
  assert.equal(result.category, 'navigation_not_found');
  assert.equal(result.coverage[0].verified, false);
});

test('hidden menu item triggers replanning and then succeeds after opening menu', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(`<button onclick="document.querySelector('#menu').hidden=false">Abrir menú</button><nav id="menu" hidden><button onclick="document.querySelector('p').textContent='Plan comercial'">Indicadores</button></nav><p></p>`);
    const actions = [
      { action: 'clickText', text: 'Indicadores' },
      { action: 'click', role: 'button', name: 'Abrir menú' },
      { action: 'clickText', text: 'Indicadores' },
      { action: 'assert', checkId: 'result', text: 'Plan comercial', reason: 'Pantalla cargada' },
      { action: 'done' },
    ];
    const result = await runBrowserCase(page, { expectedResult: 'Plan comercial' }, {
      cfg: {}, log() {}, decide: async prompt => {
        if (actions.length === 4) assert.match(prompt, /interaction_error.*oculto/);
        return JSON.stringify(actions.shift());
      },
    });
    assert.equal(result.status, 'PASS');
    assert.equal(result.history[0].action, 'interaction_error');
  } finally { await browser.close(); }
});

test('visible duplicate is clicked instead of first hidden text match', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(`<span hidden>Indicadores</span><button onclick="document.querySelector('p').textContent='Opened'">Indicadores</button><p></p>`);
    const { clickVisible } = await import('../src/browser-interaction.js');
    await clickVisible(page, { action: 'clickText', text: 'Indicadores' }, 100);
    assert.equal(await page.locator('p').textContent(), 'Opened');
    await page.setContent('<button>Indicadores</button><button>Indicadores</button>');
    await assert.rejects(clickVisible(page, { action: 'clickText', text: 'Indicadores' }, 100), /varios elementos/);
  } finally { await browser.close(); }
});
