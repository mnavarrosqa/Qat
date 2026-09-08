import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { observeTargets, interactWithTarget, ticketNavigationUrls } from '../src/browser-targets.js';

test('references distinguish duplicate names and nested counters without exposing input values', async () => {
  const browser = await chromium.launch();
  let targets;
  try {
    const page = await browser.newPage();
    await page.setContent(`<button hidden>Clientes</button><button onclick="document.querySelector('p').textContent='OK'">Clientes <span>5.271</span></button><input type="password" value="secret"><p></p>`);
    targets = await observeTargets(page);
    assert.equal(targets.items.filter(i => i.tag === 'button').length, 1);
    assert.ok(!JSON.stringify(targets.items).includes('secret'));
    const button = targets.items.find(i => i.tag === 'button');
    await interactWithTarget(targets, { action: 'click', ref: button.ref }, {});
    assert.equal(await page.locator('p').textContent(), 'OK');
    await assert.rejects(interactWithTarget(targets, { action: 'click', ref: 'missing' }, {}), /Referencia/);
  } finally { await targets?.dispose(); await browser.close(); }
});

test('navigation routes preserve explicit ticket and comment URLs within the environment', () => {
  const urls = ticketNavigationUrls({ fields: { description: 'Go https://qa.example/v2/plan/2627/538', comment: { comments: [{ body: 'https://outside.example/path https://qa.example/v2/plan/2627/538' }] } } }, 'https://qa.example');
  assert.deepEqual(urls, ['https://qa.example/v2/plan/2627/538']);
});

test('references from an earlier observation cannot target a new control', async () => {
  const browser = await chromium.launch();
  let first, second;
  try {
    const page = await browser.newPage();
    await page.setContent('<button>First</button>');
    first = await observeTargets(page);
    await page.setContent('<button>Second</button>');
    second = await observeTargets(page);
    assert.notEqual(first.items[0].ref, second.items[0].ref);
    await assert.rejects(interactWithTarget(second, { action: 'click', ref: first.items[0].ref }, {}), /Referencia/);
  } finally { await first?.dispose(); await second?.dispose(); await browser.close(); }
});
