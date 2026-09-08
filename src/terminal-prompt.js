import readline from 'node:readline/promises';
import { Writable } from 'node:stream';
import { stdin as input, stdout as output } from 'node:process';

export function terminalPrompt() {
  if (!input.isTTY || !output.isTTY) throw new Error('Ejecutá este comando en una terminal interactiva.');
  let muted = false;
  const sink = new Writable({ write(chunk, encoding, done) { if (!muted) output.write(chunk, encoding); done(); } });
  const rl = readline.createInterface({ input, output: sink, terminal: true });
  const abort = new AbortController();
  let closed = false;
  rl.on('close', () => { closed = true; abort.abort(); });
  rl.on('SIGINT', () => rl.close());
  return {
    get closed() { return closed; },
    async ask(label, { secret = false } = {}) {
      const pending = rl.question(label, { signal: abort.signal });
      muted = secret;
      try { return await pending; }
      finally { muted = false; if (secret) output.write('\n'); }
    },
    close() { rl.close(); },
  };
}
