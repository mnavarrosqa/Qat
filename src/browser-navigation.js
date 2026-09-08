import { setTimeout as delay } from 'node:timers/promises';
import { stripVTControlCharacters } from 'node:util';

export function cleanDiagnostic(value) {
  return stripVTControlCharacters(String(value || '')).replace(/&#x20;|&nbsp;/gi, ' ').trim();
}

export class EnvironmentAccessError extends Error {
  constructor(message, cause) { super(message, { cause }); this.code = 'QAT_ENVIRONMENT_UNAVAILABLE'; }
}

export async function navigateReady(page, url, { timeout = 45000, attempts = 2, interrupted = () => false } = {}) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      // Commit does not depend on slow scripts completing DOMContentLoaded.
      const response = await page.goto(url, { waitUntil: 'commit', timeout });
      if (response && response.status() >= 400) throw new Error(`El ambiente respondió HTTP ${response.status()}.`);
      await page.waitForFunction(() => {
        const body = document.body;
        if (!body) return false;
        const visible = element => element.getClientRects().length > 0;
        return (visible(body) && body.innerText.trim().length > 0) ||
          [...body.querySelectorAll('input, button, select, textarea')].some(visible);
      }, null, { timeout });
      const deadline = Date.now() + timeout;
      while (!(await page.locator('body').ariaSnapshot()).trim()) {
        if (interrupted()) return;
        if (Date.now() >= deadline) throw new Error('Timeout: la página sigue sin contenido accesible.');
        await delay(250);
      }
      return;
    } catch (error) {
      if (interrupted()) return;
      lastError = error;
      if (!/timeout|net::ERR_/i.test(error.message)) break;
    }
  }
  throw new EnvironmentAccessError(`No se pudo abrir una página utilizable del ambiente después de ${attempts} intentos como máximo. Revisá conectividad/VPN, disponibilidad o autenticación.`, lastError);
}

export async function openEnvironment(session, terminal, log = console.log) {
  try { await session.newPage(); }
  catch (error) {
    if (!terminal || error.code !== 'QAT_ENVIRONMENT_UNAVAILABLE') throw error;
    log(error.message);
    while (true) {
      const answer = (await terminal.ask('Escribí reintentar tras revisar la conexión, login para abrir el navegador visible, o cancelar: ')).trim().toLowerCase();
      if (answer === 'reintentar') { await session.newPage(); break; }
      if (answer === 'login') { await session.authenticate(); break; }
      if (['cancelar', 'salir', '0'].includes(answer)) throw error;
    }
  }
  if (session.needsLogin) await session.authenticate();
}
