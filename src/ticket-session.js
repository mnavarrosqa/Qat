import { terminalPrompt } from './terminal-prompt.js';

export async function ticketSession(key, { generate, runTests, prompt = terminalPrompt, log = console.log, terminal: sharedTerminal }) {
  const terminal = sharedTerminal || prompt();
  try {
    log(`Vamos a probar ${key}.`);
    log('1. Generar casos de prueba');
    log('2. Solo pruebas y comentario PASS/FAIL en el ticket');
    log('0. Cancelar');
    while (true) {
      const answer = (await terminal.ask('¿Qué querés hacer? [1/2/0]: ')).trim().toLowerCase();
      if (['0', 'cancelar', 'salir'].includes(answer)) return;
      if (['1', 'casos', 'casos de prueba'].includes(answer)) return await generate(key, true);
      if (['2', 'pruebas', 'solo pruebas', 'pruebas normales'].includes(answer)) return await runTests(key, terminal);
      log('Elegí 1 para casos, 2 para pruebas o 0 para cancelar.');
    }
  } finally { if (!sharedTerminal) terminal.close(); }
}

// Publication policy comes from the user's request, never from ticket/LLM content.
export async function runTicketRequest(key, input, { runTests, terminal: sharedTerminal, prompt = terminalPrompt, log = console.log }) {
  const terminal = sharedTerminal || prompt();
  const localOnly = /sin\s+publicar|no\s+publi(?:ques|car)|solo\s+local|sólo\s+local|dry[- ]?run/i.test(input);
  try {
    log(`Probando ${key}: lectura completa, ejecución y ${localOnly ? 'reporte local' : 'publicación con evidencias'}.`);
    return await runTests(key, {
      terminal,
      publish: !localOnly,
      scope: `Ejecutá el happy path y las verificaciones explícitas de la descripción y comentarios del ticket. No agregues negativos ni escenarios especulativos fuera de ese alcance. Pedido del usuario: ${input}`,
    });
  } finally { if (!sharedTerminal) terminal.close(); }
}
