let observationId = 0;
export async function observeTargets(page) {
  const locator = page.locator('button, a, input, select, textarea, [role], [tabindex], [onclick], mat-icon');
  if (typeof locator.elementHandles !== 'function') return { items: [], handles: new Map(), dispose: async () => {} };
  const generation = ++observationId;
  const handles = await locator.elementHandles();
  const items = [];
  const byRef = new Map();
  for (const handle of handles) {
    if (items.length >= 150 || !await handle.isVisible()) continue;
    const info = await handle.evaluate(el => ({
      tag: el.tagName.toLowerCase(), role: el.getAttribute('role'),
      name: el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('placeholder') || (el.tagName === 'INPUT' ? el.getAttribute('name') : el.textContent?.trim().slice(0, 160)),
      disabled: el.matches(':disabled') || el.getAttribute('aria-disabled') === 'true',
      context: el.closest('nav, [role=dialog], form')?.getAttribute('aria-label') || null,
      type: el.getAttribute('type'), expanded: el.getAttribute('aria-expanded'),
    }));
    const ref = `e${generation}-${items.length + 1}`;
    items.push({ ref, ...info }); byRef.set(ref, handle);
  }
  return { items, handles: byRef, dispose: async () => { await Promise.all(handles.map(h => h.dispose().catch(() => {}))); } };
}

export async function interactWithTarget(targets, a, cfg) {
  const handle = targets.handles.get(a.ref);
  if (!handle || !await handle.isVisible()) throw Object.assign(new Error('Referencia ausente u oculta; elegí un control de la observación actual.'), { code: 'QAT_CLICK_RECOVERABLE' });
  const options = { timeout: Math.min(cfg.navigationTimeout || 5000, 5000) };
  if (a.action === 'click') return handle.click(options);
  if (a.action === 'fill') {
    const value = a.credential === 'user' ? cfg.qatUser : a.credential === 'password' ? cfg.qatPassword : a.value;
    if (typeof value !== 'string') throw new Error('Falta valor para completar el campo');
    return handle.fill(value, options);
  }
  if (a.action === 'select') return handle.selectOption({ label: a.value }, options);
  if (a.action === 'press' && ['Enter', 'Tab', 'Escape'].includes(a.value)) return handle.press(a.value, options);
  throw new Error('Acción incompatible con referencia de control');
}

export function ticketNavigationUrls(issue, baseUrl) {
  const urls = new Set();
  const origin = new URL(baseUrl).origin;
  function visit(node) {
    if (typeof node === 'string') for (const raw of node.match(/https?:\/\/[^\s<>"\\]+/g) || []) {
      try { const url = new URL(raw.replace(/[),.;]+$/, '')); if (url.origin === origin && url.pathname !== '/') urls.add(url.href); } catch {}
    }
    else if (Array.isArray(node)) node.forEach(visit);
    else if (node && typeof node === 'object') Object.values(node).forEach(visit);
  }
  visit(issue.fields?.description); visit(issue.fields?.comment);
  return [...urls];
}
