import { terminalPrompt } from './terminal-prompt.js';

export async function interactiveSession({ run, prompt = terminalPrompt, log = console.log }) {
  const terminal = prompt();
  log('QAT — escribí tu pedido. Ejemplo: probemos el ticket AGDCF-1234');
  log('Escribí salir para terminar.');
  try {
    while (!terminal.closed) {
      let input;
      try { input = (await terminal.ask('qat> ')).trim(); }
      catch (error) { if (terminal.closed) break; throw error; }
      if (!input) continue;
      if (/^(salir|exit|quit)$/i.test(input)) break;
      try { await run(input, terminal); }
      catch (error) {
        if (terminal.closed) break;
        log(`Error: ${error.message}`);
      }
    }
  } finally { terminal.close(); }
}
