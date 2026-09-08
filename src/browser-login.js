// Credentials go directly to a trusted login form, never to the model or logs.
export async function tryConfiguredLogin(page, cfg) {
  if (!cfg.qatUser || !cfg.qatPassword) return false;
  const trusted = new Set([new URL(cfg.qatBaseUrl).origin, ...(cfg.qatLoginOrigins || [])]);
  const allowed = () => { try { return trusted.has(new URL(page.url()).origin); } catch { return false; } };
  if (!allowed()) return false;
  let username = page.locator('input[type="email"], input[autocomplete="username"], input[name="username"], input[name="user"], input[name="email"]').filter({ visible: true });
  const password = page.locator('input[type="password"]').filter({ visible: true });
  // Some forms label a plain text input without name/autocomplete metadata.
  // Use it only when a single candidate exists alongside one password field.
  if (await username.count() === 0) username = page.locator('input[type="text"], input:not([type])').filter({ visible: true });
  // Only standard single-step forms: SSO, MFA and ambiguous forms remain manual.
  if (await username.count() !== 1 || await password.count() !== 1) return false;
  const submit = page.getByRole('button', { name: /^(ingresar|iniciar sesi[oó]n|acceder|entrar|sign in|log in|login)$/i }).filter({ visible: true });
  if (await submit.count() !== 1 || !allowed()) return false;
  await username.fill(cfg.qatUser);
  if (!allowed()) return false;
  await password.fill(cfg.qatPassword);
  if (!allowed()) return false;
  await submit.click({ timeout: 5000 });
  try { await password.waitFor({ state: 'hidden', timeout: 10000 }); } catch { return false; }
  return new URL(page.url()).origin === new URL(cfg.qatBaseUrl).origin;
}
