import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { createBrowserSession } from '../src/browser-session.js';
import { captureEvidence } from '../src/browser-evidence.js';

test('manual login transfers session into headless, reuses it and captures annotated evidence', async () => {
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end('<label>Password<input type="password" value="secret"></label><h1>Application</h1>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const requestedModes = [];
  let visible;
  let session;
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'qat-evidence-'));
  try {
    session = await createBrowserSession({ qatBaseUrl: baseUrl }, {
      log: () => {},
      launch: async options => {
        requestedModes.push(options.headless);
        const browser = await chromium.launch({ headless: true });
        if (!options.headless) visible = browser;
        return browser;
      },
      terminal: { ask: async () => {
        const context = visible.contexts()[0];
        await context.addCookies([{ name: 'session', value: 'authenticated', url: baseUrl }]);
        await context.pages()[0].evaluate(() => { localStorage.setItem('auth', 'yes'); sessionStorage.setItem('twofactor', 'done'); });
        return 'listo';
      } },
    });
    await session.newPage();
    const originalPage = session.page;
    await session.authenticate();
    assert.deepEqual(requestedModes, [true, false]);
    assert.ok(originalPage.isClosed());
    assert.equal((await session.page.context().cookies())[0].value, 'authenticated');
    assert.equal(await session.page.evaluate(() => sessionStorage.getItem('twofactor')), 'done');
    await session.newPage();
    assert.equal(await session.page.evaluate(() => localStorage.getItem('auth')), 'yes');
    const file = path.join(directory, 'annotated.png');
    await captureEvidence(session.page, file, 'PASS | TC-1 | Application visible');
    assert.ok((await fs.stat(file)).size > 1000);
    assert.equal(await session.page.locator('[id^="qat-evidence-"]').count(), 0);
  } finally {
    await session?.close();
    await visible?.close();
    await fs.rm(directory, { recursive: true, force: true });
    await new Promise(resolve => server.close(resolve));
  }
});
