import { spawn } from 'node:child_process';

export function runClaude(command, prompt) {
  return new Promise((resolve, reject) => {
    const parts = command.trim().split(/\s+/);
    const child = spawn(parts[0], parts.slice(1), { stdio: ['pipe', 'pipe', 'pipe'], shell: process.platform === 'win32' });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => stdout += d);
    child.stderr.on('data', (d) => stderr += d);
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve(stdout.trim()) : reject(new Error(stderr || `Claude terminó con código ${code}`)));
    child.stdin.end(prompt);
  });
}

export async function runLLM(cfg, prompt) {
  if (cfg.llmProvider !== 'claude-cli') throw new Error(`Proveedor no soportado todavía: ${cfg.llmProvider}`);
  return runClaude(cfg.claudeCommand, prompt);
}
