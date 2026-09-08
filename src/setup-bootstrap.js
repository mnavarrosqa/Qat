import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { terminalPrompt } from './terminal-prompt.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
function run(command, args, install = false) {
  return spawnSync(command, args, {
    cwd: root, stdio: install ? 'inherit' : 'pipe',
    ...(install ? {} : { timeout: 15000 }),
  }).status === 0;
}

export async function checkDependencies({ ask, log = console.log, execute = run, version = process.versions.node, claudeCommand = 'claude' }) {
  log('1. Verificando dependencias…');
  if (Number(version.split('.')[0]) < 18) throw new Error('Se requiere Node.js 18 o superior. Actualizalo desde https://nodejs.org y volvé a ejecutar el setup.');
  log(`✓ Node.js ${version}`);
  if (!execute(npm, ['--version'])) throw new Error('Falta npm. Instalá Node.js con npm desde https://nodejs.org y volvé a ejecutar el setup.');
  log('✓ npm');
  async function offer(label, command, args) {
    const answer = await ask(`${label}. ¿Instalar ahora con ${command} ${args.join(' ')}? [s/N]: `);
    if (!/^(s|si|sí|y|yes)$/i.test(answer.trim())) throw new Error('Instalación pendiente. Volvé a ejecutar npm run setup cuando las dependencias estén disponibles.');
    if (!execute(command, args, true)) throw new Error('La instalación falló. Revisá el mensaje anterior y volvé a ejecutar npm run setup.');
  }
  if (!execute(npm, ['ls', '--omit=dev', '--depth=0'])) {
    await offer('Faltan dependencias del proyecto o sus versiones son inválidas', npm, ['install']);
    if (!execute(npm, ['ls', '--omit=dev', '--depth=0'])) throw new Error('Las dependencias del proyecto siguen sin resolverse.');
  }
  log('✓ Dependencias del proyecto');
  const parts = claudeCommand.trim().split(/\s+/);
  if (!execute(parts[0], [...parts.slice(1), '--version'])) {
    if (claudeCommand !== 'claude') throw new Error('El CLAUDE_COMMAND configurado no funciona. Corregilo en .env o en las variables de entorno y reintentá.');
    await offer('No se pudo ejecutar Claude CLI', npm, ['install', '-g', '@anthropic-ai/claude-code']);
    if (!execute('claude', ['--version'])) throw new Error('Claude todavía no está disponible. Revisá el PATH y volvé a ejecutar el setup.');
  }
  log('✓ Claude CLI\nLa autenticación de Claude se valida luego con npm run doctor.');
}

export async function setup() {
  const terminal = terminalPrompt();
  try {
    // Read the custom command without importing any external dependency first.
    let env = '';
    try { env = await readFile(path.join(root, '.env'), 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const match = env.match(/^\s*CLAUDE_COMMAND\s*=\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`|([^#\r\n]*))/m);
    const claudeCommand = process.env.CLAUDE_COMMAND || (match && (match[1] ?? match[2] ?? match[3] ?? match[4]).trim()) || 'claude';
    await checkDependencies({ ask: terminal.ask, claudeCommand });
    const { runSetup } = await import('./setup.js');
    await runSetup({ envPath: path.join(root, '.env'), ask: terminal.ask });
  } finally { terminal.close(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  setup().catch(error => { console.error(error.message); process.exitCode = 1; });
}
