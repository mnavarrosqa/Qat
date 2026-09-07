function flattenDescription(description) {
  if (!description) return '';
  if (typeof description === 'string') return description;
  const out = [];
  const walk = (node) => {
    if (node?.text) out.push(node.text);
    if (Array.isArray(node?.content)) node.content.forEach(walk);
  };
  walk(description);
  return out.join(' ');
}

export function testCasesPrompt(issue, tokenBudget = 12000) {
  const f = issue.fields || {};
  const compact = {
    key: issue.key,
    summary: f.summary,
    description: flattenDescription(f.description),
    type: f.issuetype?.name,
    priority: f.priority?.name,
    labels: f.labels,
  };
  const maxChars = Math.max(4000, tokenBudget * 3);
  const context = JSON.stringify(compact).slice(0, maxChars);
  return `Actuá como QA senior. A partir del ticket siguiente generá casos de prueba concisos y accionables. Cubrí happy path, negativos, límites y riesgos relevantes sin inventar requisitos. Para cada caso incluí: ID, título, precondiciones, pasos numerados, resultado esperado, prioridad y tipo. Al final agregá preguntas/ambigüedades. Respondé en Markdown, apto para revisión humana y posterior mapeo a Xray.\n\nTICKET:\n${context}`;
}
