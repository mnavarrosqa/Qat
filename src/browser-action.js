import { invalid } from './browser-checks.js';
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
export function validateAction(a) {
  if (!a || typeof a !== 'object' || Array.isArray(a)) throw invalid('La acción debe ser un objeto JSON');
  if (!['click', 'clickText', 'fill', 'select', 'press', 'assert', 'done', 'blocked', 'authenticate', 'navigate'].includes(a.action)) throw invalid('Acción de navegador inválida');
  if (['click', 'fill', 'select', 'press'].includes(a.action) && !nonempty(a.ref) && !(nonempty(a.role) && typeof a.name === 'string')) throw invalid('Indicá ref de CONTROLES o role y name observados');
  if (a.action === 'clickText' && !nonempty(a.text)) throw invalid('clickText requiere text');
  if (a.action === 'navigate' && !nonempty(a.url)) throw invalid('navigate requiere url de RUTAS DEL TICKET');
  if (a.credential !== undefined && !['user', 'password'].includes(a.credential)) throw invalid('credential debe ser user o password');
  if (a.action === 'fill' && !a.credential && typeof a.value !== 'string') throw invalid('fill requiere value o credential');
  if (a.action === 'select' && typeof a.value !== 'string') throw invalid('select requiere value');
  if (a.action === 'press' && !['Enter', 'Tab', 'Escape'].includes(a.value)) throw invalid('Tecla no soportada');
  if (a.action === 'assert' && (!nonempty(a.checkId) || !nonempty(a.reason))) throw invalid('assert requiere checkId y reason');
  return a;
}
