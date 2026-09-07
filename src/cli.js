#!/usr/bin/env node
import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { config } from './config.js';
import { getIssue, addComment, attachEvidence } from './jira.js';
import { runLLM } from './llm.js';
import { testCasesPrompt, xrayCasesPrompt } from './prompts.js';
import { cached } from './cache.js';
import { parseStructuredCases, syncTestCases } from './xray.js';
import { loadExecution, publishExecution } from './execution.js';

const cfg = config();
const [command, ...args] = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const value = (flag, fallback = '') => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : fallback; };

function help() {
  console.log(`Qat v0.3\n\nComandos:\n  doctor\n  generate <ISSUE> [--save]\n  xray-sync <ISSUE> [--dry-run] [--save]\n  execute <ISSUE> <archivo.json> [--dry-run]\n  comment <ISSUE> --status <status> --summary <texto>\n  evidence <ISSUE> <archivo>\n`);
}

async function main() {
  if (!command || command === '--help' || command === '-h') return help();
  if (command === 'doctor') {
    const check = spawnSync(cfg.claudeCommand.split(/\s+/)[0], ['--version'], { encoding: 'utf8', shell: process.platform === 'win32' });
    console.log(`Claude CLI: ${check.status === 0 ? 'OK - ' + (check.stdout || check.stderr).trim() : 'NO DISPONIBLE'}`);
    console.log(`Jira URL: ${cfg.jiraBaseUrl ? 'configurada' : 'faltante'}`);
    console.log(`Jira credentials: ${cfg.jiraEmail && cfg.jiraToken ? 'configuradas' : 'faltantes'}`);
    console.log(`Xray: ${cfg.xrayEnabled ? 'habilitado' : 'deshabilitado'}`);
    console.log(`Xray Test issue type: ${cfg.xrayTestIssueType}`);
    console.log(`Xray link type: ${cfg.xrayLinkType}`);
    return;
  }
  if (command === 'generate') {
    const key = args[0]; if (!key) throw new Error('Indicá el issue, por ejemplo QA-123');
    const issue = await getIssue(cfg, key);
    const prompt = testCasesPrompt(issue, cfg.tokenBudget);
    const output = await cached(`${key}:${prompt}`, () => runLLM(cfg, prompt));
    console.log(output);
    if (has('--save')) {
      await fs.mkdir('artifacts', { recursive: true });
      const file = `artifacts/${key}-test-cases.md`;
      await fs.writeFile(file, output, 'utf8');
      console.log(`\nGuardado en ${file}`);
    }
    return;
  }
  if (command === 'xray-sync') {
    const key = args[0]; if (!key) throw new Error('Indicá el issue, por ejemplo QA-123');
    const issue = await getIssue(cfg, key);
    const prompt = xrayCasesPrompt(issue, cfg.tokenBudget);
    const raw = await cached(`xray:${key}:${prompt}`, () => runLLM(cfg, prompt));
    const testCases = parseStructuredCases(raw);

    if (has('--save')) {
      await fs.mkdir('artifacts', { recursive: true });
      const file = `artifacts/${key}-xray.json`;
      await fs.writeFile(file, JSON.stringify({ testCases }, null, 2), 'utf8');
      console.log(`Casos estructurados guardados en ${file}`);
    }

    const results = await syncTestCases(cfg, key, testCases, { dryRun: has('--dry-run') });
    console.log(JSON.stringify(results, null, 2));
    return;
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
    const status = value('--status', 'unknown');
    const summary = value('--summary', 'Sin resumen');
    if (!key) throw new Error('Indicá el issue');
    await addComment(cfg, key, `QA result: ${status.toUpperCase()}\n${summary}`);
    console.log(`Comentario publicado en ${key}`);
    return;
  }
  if (command === 'evidence') {
    const [key, file] = args;
    if (!key || !file) throw new Error('Uso: evidence ISSUE archivo');
    await attachEvidence(cfg, key, file);
    console.log(`Evidencia adjuntada a ${key}`);
    return;
  }
  throw new Error(`Comando desconocido: ${command}`);
}

main().catch((error) => { console.error(`Error: ${error.message}`); process.exitCode = 1; });
