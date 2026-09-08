export function expectedChecks(testCase) {
  const checks = (testCase.steps || []).flatMap((step, index) => {
    const expected = typeof step === 'object' && (step.expected || step.expectedResult);
    return typeof expected === 'string' && expected.trim() ? [{ id: `step-${index + 1}`, expected }] : [];
  });
  const expected = testCase.expectedResult || testCase.expected;
  if (typeof expected === 'string' && expected.trim()) checks.push({ id: 'result', expected });
  return checks;
}

export function classifyBrowserError(error) {
  if (error.code === 'QAT_ENVIRONMENT_UNAVAILABLE') return 'environment';
  if (error instanceof SyntaxError || error.code === 'QAT_INVALID_ACTION') return 'invalid_model_response';
  if (/strict mode violation/i.test(error.message)) return 'ambiguous_locator';
  if (/Timeout|locator\./i.test(error.message)) return 'element_unavailable';
  if (/autentic|login|2FA/i.test(error.message)) return 'authentication';
  return 'execution_error';
}

export async function verifyCheck(page, action, timeout = 5000) {
  const kind = action.kind || 'text';
  if (!['text', 'value', 'enabled', 'disabled', 'checked', 'unchecked', 'visible', 'hidden', 'url'].includes(kind)) throw invalid('Tipo de verificación inválido');
  if (!action.reason || (kind === 'text' && (typeof action.text !== 'string' || !action.text.trim()))) throw invalid('Verificación incompleta');
  if (['value', 'url'].includes(kind) && typeof action.value !== 'string') throw invalid('Falta el valor esperado');
  if (!['text', 'url'].includes(kind) && (typeof action.role !== 'string' || typeof action.name !== 'string')) throw invalid('Falta el elemento observado');
  const locator = kind === 'url' ? null : kind === 'text' ? page.getByText(action.text, { exact: true }) : page.getByRole(action.role, { name: action.name, exact: true });
  const deadline = Date.now() + timeout;
  let observed;
  do {
    if (kind === 'url') observed = page.url();
    else {
      const count = await locator.count();
      if (count > 1) throw invalid('El elemento de verificación es ambiguo');
      if (!count) { if (kind === 'hidden') return { passed: true, observed: 'absent' }; observed = 'absent'; }
      else if (['text', 'visible', 'hidden'].includes(kind)) observed = await locator.isVisible();
      else if (kind === 'value') observed = await locator.inputValue({ timeout });
      else if (['enabled', 'disabled'].includes(kind)) observed = await locator.isEnabled({ timeout });
      else observed = await locator.isChecked({ timeout });
    }
    const expected = ['url', 'value'].includes(kind) ? action.value : !['hidden', 'disabled', 'unchecked'].includes(kind);
    if (observed === expected) return { passed: true, observed };
    await new Promise(resolve => setTimeout(resolve, 50));
  } while (Date.now() < deadline);
  return { passed: false, observed };
}

export function invalid(message) {
  return Object.assign(new Error(message), { code: 'QAT_INVALID_ACTION' });
}
