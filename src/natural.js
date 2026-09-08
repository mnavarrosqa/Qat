import { runLLM } from './llm.js';

const ISSUE_RE = /\b[A-Z][A-Z0-9]+-\d+\b/i;

function stripFences(value) {
  return String(value || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
}

export function naturalIntentPrompt(input) {
  return `Interpretá el pedido del QA y devolvé EXCLUSIVAMENTE JSON válido. No ejecutes nada. Acciones permitidas: test-ticket, generate, xray-sync, comment, evidence, help. Forma: {"action":"test-ticket|generate|xray-sync|comment|evidence|help","issue":"QA-123","save":false,"dryRun":false,"status":"","summary":"","file":""}. Reglas: probar/testear un ticket sin especificar modalidad => test-ticket; generar/revisar/analizar casos => generate; crear/subir/sincronizar tests en Xray => xray-sync; comentar/informar resultado => comment; adjuntar/subir evidencia => evidence. Si falta un dato obligatorio usá action help y explicalo en summary. Nunca incluyas passwords, tokens o secretos.\n\nPEDIDO:\n${input}`;
}

export function parseNaturalIntent(raw) {
  const value = JSON.parse(stripFences(raw));
  const allowed = new Set(['test-ticket', 'generate', 'xray-sync', 'comment', 'evidence', 'help']);
  if (!allowed.has(value.action)) throw new Error(`Acción natural no soportada: ${value.action}`);
  return value;
}

export function localNaturalIntent(input) {
  const text = String(input || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const issue = text.match(ISSUE_RE)?.[0]?.toUpperCase() || '';
  if (!text) return { action: 'help', summary: 'Escribí qué querés hacer.' };
  if (/^(ayuda|help|qué puedo hacer|que puedo hacer)\??$/i.test(text)) return { action: 'help' };
  if (issue && /\b(genera|generar|analiza|analizar|revisa|revisar)\b/i.test(text) && /\b(casos?|tests?|pruebas?)\b/i.test(text)) {
    return { action: 'generate', issue, save: /\b(guarda|guardar|save)\b/i.test(text) };
  }
  if (issue && /\b(xray|sincroniza|sincronizar|sube|subir|crea|crear)\b/i.test(text) && /\b(casos?|tests?|pruebas?)\b/i.test(text)) {
    return { action: 'xray-sync', issue, dryRun: /\b(dry[- ]?run|simula|simular|probar sin|sin modificar)\b/i.test(text), save: /\b(guarda|guardar|save)\b/i.test(text) };
  }
  if (issue && /\b(probemos|proba|probá|probar|prueba|testea|testeá|testear|testeemos)\b/i.test(text)) return { action: 'test-ticket', issue };
  return null;
}

export async function interpretNatural(cfg, input) {
  const local = localNaturalIntent(input);
  if (local) return local;
  const raw = await runLLM(cfg, naturalIntentPrompt(input));
  return parseNaturalIntent(raw);
}
