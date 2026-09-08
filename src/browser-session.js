import { tryConfiguredLogin } from './browser-login.js';
import { chromium } from 'playwright';
import { navigateReady } from './browser-navigation.js';

// Authentication state stays in memory and is never included in test reports.
export async function createBrowserSession(cfg, { terminal, log = console.log, launch = options => chromium.launch(options) } = {}) {
  const navigationTimeout = Number(cfg.navigationTimeout) > 0 ? Number(cfg.navigationTimeout) : 45000;
  const origin = new URL(cfg.qatBaseUrl).origin;
  const browser = await launch({ headless: true });
  let context;
  let page;
  let storageState;
  let sessionStorage = {};
  let externalNavigation = false;
  async function newPage(url = cfg.qatBaseUrl) {
    await context?.close();
    externalNavigation = false;
    context = await browser.newContext({ serviceWorkers: 'block', storageState });
    await context.addInitScript(({ origin, entries }) => {
      if (location.origin === origin) for (const [key, value] of Object.entries(entries)) sessionStorage.setItem(key, value);
    }, { origin, entries: sessionStorage });
    await context.route('**/*', route => {
      const request = route.request();
      if (request.isNavigationRequest() && new URL(request.url()).origin !== origin) {
        externalNavigation = true;
        return route.abort();
      }
      return route.continue();
    });
    page = await context.newPage();
    // Keep element actions aligned with the environment navigation timeout.
    // Some QA environments render the shell before their feature modules.
    page.setDefaultTimeout(navigationTimeout);
    page.setDefaultNavigationTimeout(navigationTimeout);
    await navigateReady(page, url, { timeout: navigationTimeout, interrupted: () => externalNavigation });
    return page;
  }
  return {
    get page() { return page; },
    get needsLogin() { return externalNavigation; },
    newPage,
    async authenticate() {

      log('QAT necesita autenticación. Intentará usar las credenciales configuradas en formularios de confianza; login externo/2FA puede requerir intervención.');
      const visible = await launch({ headless: false });
      try {
        const manualContext = await visible.newContext({ storageState: await context.storageState({ indexedDB: true }) });
        const login = await manualContext.newPage();
        // No agent actions, snapshots, traces or screenshots during manual login.
        try { await login.goto(cfg.qatBaseUrl, { waitUntil: 'commit', timeout: navigationTimeout }); }
        catch { log('La carga inicial no terminó. Podés revisar la conexión y navegar manualmente en la ventana abierta.'); }
        let automatic = false;
        try { automatic = await tryConfiguredLogin(login, cfg); } catch { log('No se pudo completar el login automático.'); }
        while (true) {
          if (!automatic && !terminal) throw new Error('El login requiere intervención: abrí QAT en una terminal interactiva para completar login/2FA.');
          const answer = automatic ? 'listo' : (await terminal.ask('Completá el login y volvé a la aplicación. Escribí listo para continuar o cancelar: ')).trim().toLowerCase();
          automatic = false;
          if (['cancelar', '0', 'salir'].includes(answer)) throw new Error('Autenticación cancelada por el usuario.');
          if (answer !== 'listo') continue;
          const authenticatedPage = manualContext.pages().findLast(p => !p.isClosed() && new URL(p.url()).origin === origin);
          if (!authenticatedPage) { log('Volvé al ambiente de pruebas después de completar el login.'); continue; }
          storageState = await manualContext.storageState({ indexedDB: true });
          sessionStorage = await authenticatedPage.evaluate(() => Object.fromEntries(Object.entries(window.sessionStorage)));
          const resumeUrl = authenticatedPage.url();
          await newPage(resumeUrl);
          log('Sesión transferida. QAT continúa en headless.');
          return page;
        }
      } finally { await visible.close(); }
    },
    async close() { await browser.close(); storageState = undefined; sessionStorage = {}; },
  };
}
