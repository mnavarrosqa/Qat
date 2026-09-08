import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { tryConfiguredLogin } from '../src/browser-login.js';

test('configured credentials fill trusted form and never fill another origin', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.route('https://qa.example/**', route => route.fulfill({ contentType: 'text/html', body: '<input name="username"><input type="password"><button onclick="document.querySelector(\'input[type=password]\').style.display=\'none\'">Ingresar</button>' }));
    await page.goto('https://qa.example/login');
    const cfg = { qatBaseUrl: 'https://qa.example', qatUser: 'test-user', qatPassword: 'test-password' };
    assert.equal(await tryConfiguredLogin(page, {...cfg, qatBaseUrl: 'https://other.example'}), false);
    assert.equal(await page.locator('[name=username]').inputValue(), '');
    assert.equal(await tryConfiguredLogin(page, cfg), true);
    assert.equal(await page.locator('[name=username]').inputValue(), 'test-user');
  } finally { await browser.close(); }
});

test('plain username input is supported but ambiguous text fields stay manual', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.route('https://qa.example/**', route => route.fulfill({ contentType: 'text/html', body: '<input type="text" placeholder="Usuario"><input type="password"><button onclick="document.querySelector(\'input[type=password]\').style.display=\'none\'">Ingresar</button>' }));
    await page.goto('https://qa.example/v2/login');
    const cfg = { qatBaseUrl: 'https://qa.example', qatUser: 'test-user', qatPassword: 'test-password' };
    assert.equal(await tryConfiguredLogin(page, cfg), true);
    assert.equal(await page.locator('[placeholder=Usuario]').inputValue(), 'test-user');
    await page.setContent('<input type="text"><input type="text"><input type="password"><button>Ingresar</button>');
    assert.equal(await tryConfiguredLogin(page, cfg), false);
    assert.equal(await page.locator('input[type=password]').inputValue(), '');
  } finally { await browser.close(); }
});
