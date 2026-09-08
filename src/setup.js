import fs from 'node:fs/promises';
import path from 'node:path';
import { terminalPrompt } from './terminal-prompt.js';
import dotenv from 'dotenv';

async function readEnv(file) {
  try { return await fs.readFile(file, 'utf8'); } catch (error) {
    if (error.code === 'ENOENT') return '';
    throw error;
  }
}

function setEnv(content, key, value) {
  // Quoting preserves hashes, spaces and dollar signs without dotenv expansion.
  const quote = !value.includes("'") ? "'" : !value.includes('"') ? '"' : '`';
  if (value.includes(quote) || /[\r\n]/.test(value)) throw new Error('El valor contiene caracteres no admitidos.');
  const line = `${key}=${quote}${value}${quote}`;
  const rx = new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=.*$`, 'gm');
  if (rx.test(content)) return content.replace(rx, () => line);
  return `${content.trimEnd()}${content.trim() ? '\n' : ''}${line}\n`;
}


const validUrl = (value) => {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; }
  catch { return false; }
};

export async function runSetup({ envPath = '.env', ask, log = console.log } = {}) {
  const terminal = ask ? null : terminalPrompt();
  ask ||= terminal.ask;
  try {
    let content = await readEnv(envPath);
    const values = dotenv.parse(content);
    log('Configuración de Qat\nEnter conserva el valor actual. Los secretos no se muestran. Ctrl+C cancela sin guardar.');
    async function field(key, label, { fallback = '', secret = false, required = false, validate = () => true } = {}) {
      const current = values[key] || process.env[key] || fallback;
      for (;;) {
        const hint = current ? (secret ? ' [configurado]' : ` [${current}]`) : '';
        const answer = await ask(`${label}${hint}: `, { secret, key });
        const value = answer === '' ? current : secret ? answer : answer.trim();
        if ((required && !value) || (value && !validate(value))) { log('Valor inválido. Revisá el formato e intentá nuevamente.'); continue; }
        try { content = setEnv(content, key, value); }
        catch { log('Usá un valor de una sola línea sin combinar los tres tipos de comillas.'); continue; }
        values[key] = value;
        return value;
      }
    }
    await field('JIRA_BASE_URL', 'URL de Jira (https://empresa.atlassian.net)', { required: true, validate: validUrl });
    await field('JIRA_EMAIL', 'Email de Jira', { required: true, validate: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) });
    await field('JIRA_API_TOKEN', 'Token API de Jira', { secret: true, required: true });
    await field('CLAUDE_COMMAND', 'Comando de Claude CLI', { fallback: 'claude', required: true });
    content = setEnv(content, 'LLM_PROVIDER', 'claude-cli');
    const enabled = await field('XRAY_ENABLED', '¿Usás Xray? (true/false)', { fallback: 'false', validate: v => ['true', 'false'].includes(v) });
    let mode;
    if (enabled === 'true') {
      await field('XRAY_PROJECT_KEY', 'Clave del proyecto Jira para Tests y ejecuciones (vacío = proyecto del ticket)', { validate: v => /^[A-Z][A-Z0-9_]*$/.test(v) });
      mode = await field('XRAY_MODE', 'Modo Xray (api/export)', { fallback: 'export', validate: v => ['api', 'export'].includes(v) });
      if (mode === 'api') {
        await field('XRAY_CLIENT_ID', 'Client ID de Xray Cloud', { secret: true, required: true });
        await field('XRAY_CLIENT_SECRET', 'Client secret de Xray Cloud', { secret: true, required: true });
      } else {
        await field('XRAY_EXPORT_FORMAT', 'Formato de exportación (csv/json)', { fallback: 'csv', validate: v => ['csv', 'json'].includes(v) });
      }
    }
    const environmentsFile = values.QAT_ENVIRONMENTS_FILE || process.env.QAT_ENVIRONMENTS_FILE || '.qat/environments.json';
    const environmentsText = await readEnv(path.resolve(path.dirname(envPath), environmentsFile));
    if (environmentsText) {
      const parsed = JSON.parse(environmentsText);
      const environments = parsed.environments || parsed;
      log(`Ambientes disponibles: ${Object.keys(environments).join(', ')}`);
      const env = await field('QAT_ENV', 'Ambiente activo', { fallback: Object.keys(environments)[0], required: true, validate: v => Object.hasOwn(environments, v) });
      const profiles = environments[env].profiles || {};
      log(`Perfiles disponibles: ${Object.keys(profiles).join(', ') || 'default'}`);
      await field('QAT_PROFILE', 'Perfil activo', { fallback: environments[env].defaultProfile || 'default', required: true, validate: v => !Object.keys(profiles).length || Object.hasOwn(profiles, v) });
    } else {
      await field('QAT_ENV', 'Nombre del ambiente de pruebas', { fallback: 'qa', required: true });
      await field('QAT_PROFILE', 'Nombre del perfil de pruebas', { fallback: 'default', required: true });
      await field('QAT_BASE_URL', 'URL de la aplicación a probar (opcional)', { validate: validUrl });
      await field('QAT_USER', 'Usuario de pruebas (opcional)');
      await field('QAT_PASSWORD', 'Contraseña de pruebas (opcional)', { secret: true });
    }
    await fs.writeFile(envPath, content, { encoding: 'utf8', mode: 0o600 });
    await fs.chmod(envPath, 0o600);
    log(`✓ Configuración guardada en ${envPath}. Ejecutá npm run doctor para validar las conexiones.`);
    return { enabled: enabled === 'true', ...(mode ? { mode } : {}) };
  } finally { terminal?.close(); }
}
