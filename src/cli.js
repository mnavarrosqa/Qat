#!/usr/bin/env node
import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { config } from './config.js';
import { getIssue, addComment, attachEvidence } from './jira.js';
import { runLLM } from './llm.js';
import { testCasesPrompt, xrayCasesPrompt } from './prompts.js';
import { cached } from './cache.js';
import { parseStructuredCases, syncTestCases, exportTestCases } from './xray.js';
import { checkXrayCloud } from './xray-cloud.js';
import { loadExecution, publishExecution } from './execution.js';
import { interpretNatural } from './natural.js';
import { runSetup } from './setup.js';
import { listEnvironments, resolveEnvironment } from './environments.js';

const cfg = config();
const argv = process.argv.slice(2);
const [command, ...args] = argv;
const knownCommands = new Set(['setup', 'doctor', 'env', 'generate', 'xray-sync', 'execute', 'comment', 'evidence']);
const has = (flag) => args.includes(flag);
const value = (flag, fallback = '') => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : fallback; };

function help() {
  console.log(`Qat v0.7\n\nPrimer uso:\n  qat setup\n\nUso recomendado (lenguaje natural):\n  qat "analiza QA-123 y genera casos de prueba"\n  qat "crea los tests de QA-123 en Xray"\n  qat "comenta QA-123 indicando que el smoke pasó"\n  qat "adjunta ./evidence/error.png a QA-123"\n\nAmbientes y perfiles:\n  qat env list\n  qat env show\n  qat env use qa admin\n\nComandos clásicos:\n  setup\n  doctor\n  env list|show|use <ambiente> [perfil]\n  generate <ISSUE> [--save]\n  xray-sync <ISSUE> [--dry-run] [--save]\n  execute <ISSUE> <archivo.json> [--dry-run]\n  comment <ISSUE> --status <status> --summary <texto>\n  evidence <ISSUE> <archivo>\n`);
}

async function setEnvValue(content, key, value) {
  const line = `${key}=${value}`;
  const rx = new RegExp(`^${key}=.*$`, 'm');
  if (rx.test(content)) return content.replace(rx, line);
  return `${content.trimEnd()}${content.trim() ? '\n' : ''}${line}\n`;
}

async function useEnvironment(name, profile = '') {
  if (!name) throw new Error('Uso: env use <ambiente> [perfil]');
  const selected = resolveEnvironment({ filePath: cfg.qatEnvironmentsFile, environment: name, profile });
  let content = '';
  try { content = await fs.readFile('.env', 'utf8'); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  content = await setEnvValue(content, 'QAT_ENV', selected.name);
  content = await setEnvValue(content, 'QAT_PROFILE', selected.profile);
  await fs.writeFile('.env', content, 'utf8');
  console.log(`✓ Ambiente activo: ${selected.name}`);
  console.log(`✓ Perfil activo: ${selected.profile}`);
  console.log('  Reiniciá el comando para usar la nueva selección.');
}

async function environmentCommand() {
  const [subcommand = 'show', name, profile] = args;
  if (subcommand === 'list') {
    const items = listEnvironments(cfg.qatEnvironmentsFile);
    if (!items.length) {
      console.log('No hay archivo de ambientes configurado. Se usa el modo compatible de .env.');
      return;
    }
    for (const item of items) {
      const profiles = item.profiles.length ? item.profiles.join(', ') : '(sin perfiles)';
      console.log(`${item.name} - ${item.baseUrl || '(sin URL)'} - perfiles: ${profiles} - default: ${item.defaultProfile}`);
    }
    return;
  }
  if (subcommand === 'show') {
    console.log(`Ambiente: ${cfg.qatEnv}`);
    console.log(`Perfil: ${cfg.qatProfile}`);
    console.log(`Base URL: ${cfg.qatBaseUrl || 'faltante'}`);
    console.log(`Credenciales: ${cfg.qatUser && cfg.qatPassword ? 'configuradas' : 'opcionales/no configuradas'}`);
    console.log(`Fuente: ${cfg.qatEnvironmentSource === 'file' ? cfg.qatEnvironmentsFile : '.env'}`);
    return;
  }
  if (subcommand === 'use') return useEnvironment(name, profile);
  throw new Error('Uso: env list | env show | env use <ambiente> [perfil]');
}

async function generate(key, save = false) {
  const issue = await getIssue(cfg, key);
  const prompt = testCasesPrompt(issue, cfg.tokenBudget);
  const output = await cached(`${key}:${prompt}`, () => runLLM(cfg, prompt));
  console.log(output);
  if (save) {
    await fs.mkdir('artifacts', { recursive: true });
    const file = `artifacts/${key}-test-cases.md`;
    await fs.writeFile(file, output, 'utf8');
    console.log(`\nGuardado en ${file}`);
  }
}

async function xraySync(key, { dryRun = false, save = false } = {}) {
  const issue = await getIssue(cfg, key);
  const prompt = xrayCasesPrompt(issue, cfg.tokenBudget);
  const raw = await cached(`xray:${key}:${prompt}`, () => runLLM(cfg, prompt));
  const testCases = parseStructuredCases(raw);
  if (save) {
    await fs.mkdir('artifacts', { recursive: true });
    const file = `artifacts/${key}-xray.json`;
    await fs.writeFile(file, JSON.stringify({ testCases }, null, 2), 'utf8');
    console.log(`Casos estructurados guardados en ${file}`);
  }

  if (cfg.xrayMode === 'export') {
    const result = await exportTestCases(cfg, key, testCases);
    console.log(`✓ ${result.count} casos exportados para Xray`);
    console.log(`✓ Archivo importable: ${result.file}`);
    return result;
  }

  const results = await syncTestCases(cfg, key, testCases, { dryRun });
  console.log(JSON.stringify(results, null, 2));
  return results;
}

async function runNatural(input) {
  const intent = await interpretNatural(cfg, input);
  if (intent.action === 'help') {
    if (intent.summary) console.log(intent.summary);
    return help();
  }
  if (!intent.issue) throw new Error('No pude identificar el ticket Jira. Ejemplo: QA-123');
  if (intent.action === 'generate') return generate(intent.issue, Boolean(intent.save));
  if (intent.action === 'xray-sync') return xraySync(intent.issue, { dryRun: Boolean(intent.dryRun), save: Boolean(intent.save) });
  if (intent.action === 'comment') {
    await addComment(cfg, intent.issue, `QA result: ${String(intent.status || 'INFO').toUpperCase()}\n${intent.summary || input}`);
    console.log(`Comentario publicado en ${intent.issue}`);
    return;
  }
  if (intent.action === 'evidence') {
    if (!intent.file) throw new Error('No pude identificar el archivo de evidencia.');
    await attachEvidence(cfg, intent.issue, intent.file);
    console.log(`Evidencia adjuntada a ${intent.issue}`);
  }
}

async function doctor() {
  const check = spawnSync(cfg.claudeCommand.split(/\s+/)[0], ['--version'], { encoding: 'utf8', shell: process.platform === 'win32' });
  console.log(`Claude CLI: ${check.status === 0 ? 'OK - ' + (check.stdout || check.stderr).trim() : 'NO DISPONIBLE'}`);
  console.log(`Jira URL: ${cfg.jiraBaseUrl ? 'configurada' : 'faltante'}`);
  console.log(`Jira credentials: ${cfg.jiraEmail && cfg.jiraToken ? 'configuradas' : 'faltantes'}`);
  console.log(`Xray: ${cfg.xrayEnabled ? `habilitado (${cfg.xrayMode})` : 'deshabilitado'}`);
  if (cfg.xrayEnabled && cfg.xrayMode === 'export') {
    console.log(`Xray export format: ${cfg.xrayExportFormat}`);
  }
  if (cfg.xrayEnabled && cfg.xrayMode === 'api') {
    const status = await checkXrayCloud(cfg);
    console.log(`Xray Cloud API: ${status.ok ? 'OK' : `NO DISPONIBLE - ${status.reason}`}`);
    if (!status.ok) console.log(`Xray fallback recomendado: XRAY_MODE=export (${cfg.xrayExportFormat})`);
  }
  console.log(`QA environment: ${cfg.qatEnv}`);
  console.log(`QA profile: ${cfg.qatProfile}`);
  console.log(`QA base URL: ${cfg.qatBaseUrl || 'faltante'}`);
  console.log(`QA test credentials: ${cfg.qatUser && cfg.qatPassword ? 'configuradas' : 'opcionales/no configuradas'}`);
}

async function main() {
  if (!command || command === '--help' || command === '-h') return help();
  if (!knownCommands.has(command)) return runNatural(argv.join(' '));
  if (command === 'setup') return runSetup();
  if (command === 'env') return environmentCommand();
  if (command === 'doctor') return doctor();
  if (command === 'generate') {
    const key = args[0]; if (!key) throw new Error('Indicá el issue, por ejemplo QA-123');
    return generate(key, has('--save'));
  }
  if (command === 'xray-sync') {
    const key = args[0]; if (!key) throw new Error('Indicá el issue, por ejemplo QA-123');
    return xraySync(key, { dryRun: has('--dry-run'), save: has('--save') });
  }
  if (command === 'execute') {
    const [key, file] = args;
    if (!key || !file) throw new Error('Uso: execute ISSUE archivo.json [--dry-run]');
    const execution = await loadExecution(file);
    const result = await publishExecution(cfg, key, execution, { dryRun: has('--dry-run') });
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (command === 'comment') {
    const key = args[0];
    if (!key) throw new Error('Indicá el issue');
    await addComment(cfg, key, `QA result: ${value('--status', 'unknown').toUpperCase()}\n${value('--summary', 'Sin resumen')}`);
    console.log(`Comentario publicado en ${key}`);
    return;
  }
  if (command === 'evidence') {
    const [key, file] = args;
    if (!key || !file) throw new Error('Uso: evidence ISSUE archivo');
    await attachEvidence(cfg, key, file);
    console.log(`Evidencia adjuntada a ${key}`);
  }
}

main().catch((error) => { console.error(`Error: ${error.message}`); process.exitCode = 1; });
