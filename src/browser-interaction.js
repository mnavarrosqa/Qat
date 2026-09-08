// Resolve only visible matches; never force a hidden menu item or pick an
// arbitrary duplicate. Let the planner open its parent menu when needed.
export async function clickVisible(page, action, timeout = 5000) {
  const base = action.action === 'clickText'
    ? page.getByText(action.text, { exact: true })
    : page.getByRole(action.role, { name: action.name, exact: true });
  const visible = base.filter({ visible: true });
  const count = await visible.count();
  if (count !== 1) {
    const total = await base.count();
    const message = count > 1 ? 'Hay varios elementos visibles con ese nombre; necesitás desambiguar.'
      : total ? 'El elemento existe pero está oculto. Abrí el menú o sección que lo contiene usando un control visible.'
      : 'El elemento no está en la página actual. Revisá los controles visibles y la navegación.';
    throw Object.assign(new Error(message), { code: 'QAT_CLICK_RECOVERABLE' });
  }
  await visible.click({ timeout });
}
