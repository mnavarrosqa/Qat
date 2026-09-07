import fs from 'node:fs/promises';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

function yes(value) {
  return /^(s|si|sí|y|yes)$/i.test(String(value || '').trim());
}

async function readEnv(path = '.env') {
  try { return await fs.readFile(path, 'utf8'); } catch (error) {
    if (error.code === 'ENOENT') return '';
    throw error;
  }
}

function setEnv(content, key, value) {
  const line = `${key}=${value}`;
  const rx = new RegExp(`^${key}=.*$`, 'm');
  if (rx.test(content)) return content.replace(rx, line);
  return `${content.trimEnd()}${content.trim() ? '\n' : ''}${line}\n`;
}

export async function runSetup({ envPath = '.env' } = {}) {
  const rl = readline.createInterface({ input, output });
  try {
    console.log('Qat setup\n');
    const usesXray = yes(await rl.question('¿Usás Xray para administrar casos de prueba? [s/N] '));
    let content = await readEnv(envPath);

    if (!usesXray) {
      content = setEnv(content, 'XRAY_ENABLED', 'false');
      await fs.writeFile(envPath, content, 'utf8');
      console.log('\n✓ Xray deshabilitado. Podés cambiarlo luego en .env.');
      return { enabled: false };
    }

    content = setEnv(content, 'XRAY_ENABLED', 'true');
    const hasApi = yes(await rl.question('¿Tenés credenciales/API disponibles para Xray? [s/N] '));

    if (hasApi) {
      content = setEnv(content, 'XRAY_MODE', 'api');
      console.log('\nQat usará el modo API. Los secretos se leen desde variables de entorno/.env y nunca se guardan en la configuración pública.');
    } else {
      content = setEnv(content, 'XRAY_MODE', 'export');
      const formatAnswer = (await rl.question('Formato de exportación [csv/json] (csv): ')).trim().toLowerCase();
      const format = formatAnswer === 'json' ? 'json' : 'csv';
      content = setEnv(content, 'XRAY_EXPORT_FORMAT', format);
      console.log(`\n✓ Xray configurado en modo exportación ${format.toUpperCase()}.`);
      console.log('  Cuando pidas crear casos en Xray, Qat generará un archivo importable en artifacts/.');
    }

    await fs.writeFile(envPath, content, 'utf8');
    console.log(`✓ Configuración guardada en ${envPath}`);
    return { enabled: true, mode: hasApi ? 'api' : 'export' };
  } finally {
    rl.close();
  }
}
