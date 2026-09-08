import path from 'node:path';
import { cleanDiagnostic } from './browser-navigation.js';
import { addComment, attachEvidence } from './jira.js';

export async function captureEvidence(page, file, annotation) {
  const marker = `qat-evidence-${Date.now()}`;
  await page.evaluate(({ marker, annotation }) => {
    const banner = document.createElement('div');
    banner.id = marker;
    banner.textContent = annotation;
    banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:2147483647;background:#101827;color:white;padding:16px;font:16px/1.5 sans-serif;white-space:pre-wrap;border-top:4px solid #38bdf8;pointer-events:none;';
    document.documentElement.appendChild(banner);
  }, { marker, annotation });
  try {
    await page.screenshot({ path: file, fullPage: true, mask: [page.locator('input, textarea, [contenteditable="true"]')] });
  } finally {
    await page.evaluate(marker => document.getElementById(marker)?.remove(), marker).catch(() => {});
  }
  return { file, annotation };
}

function paragraph(text, href) {
  return { type: 'paragraph', content: [{ type: 'text', text: cleanDiagnostic(text) || 'Sin detalle', ...(href ? { marks: [{ type: 'link', attrs: { href } }] } : {}) }] };
}

export function browserCommentDraft(report, redact = text => text) {
  const content = [paragraph(`QA automático: ${report.status}`), paragraph(`Ambiente: ${report.environment} / ${report.profile}`)];
  if (report.environmentBlock) {
    content.push(paragraph(`Bloqueo de acceso al ambiente: ${redact(report.environmentBlock.note)}`));
    content.push(paragraph(`Casos no ejecutados: ${report.environmentBlock.notRun.length}. No se evaluó su resultado funcional.`));
    if (report.environmentBlock.notRun.length) content.push(paragraph(report.environmentBlock.notRun.map(c => c.id).join(', ')));
  }
  for (const result of report.results) {
    if (result.scope === 'environment') continue;
    content.push(paragraph(redact(`${result.status} | ${result.id || ''} ${result.title || ''}\n${result.note || ''}`)));
    if (result.category) content.push(paragraph(`Diagnóstico: ${result.category}`));
    if (result.coverage?.length) {
      const passed = result.coverage.filter(c => c.verified).length;
      content.push(paragraph(`Cobertura: ${passed}/${result.coverage.length} resultados esperados verificados.`));
      for (const check of result.coverage) content.push(paragraph(redact(`${check.verified ? 'VERIFICADO' : 'NO VERIFICADO'} | ${check.id}: ${check.expected}`)));
    }
    if (!(result.evidence || []).length) content.push(paragraph('Sin capturas disponibles para este caso.'));
    for (const evidence of result.evidence || []) {
      content.push(paragraph(redact(evidence.annotation)));
      if (evidence.uploadError) content.push(paragraph(redact(evidence.uploadError)));
      else content.push(paragraph(evidence.attachment?.filename || path.basename(evidence.file), evidence.attachment?.url));
    }
    if (result.evidenceNote) content.push(paragraph(redact(result.evidenceNote)));
  }
  return { type: 'doc', version: 1, content };
}

export function commentPreviewText(body) {
  return body.content.map(p => p.content.map(t => t.text + (t.marks?.[0]?.attrs?.href ? ` (${t.marks[0].attrs.href})` : '')).join('')).join('\n\n');
}

export async function confirmBrowserPublication({ key, body, files, revised }, { terminal, log = console.log } = {}) {
  log(`\nVista previa del comentario para ${key}${revised ? ' (actualizada por errores al adjuntar)' : ''}:\n`);
  log(commentPreviewText(body));
  if (files.length) {
    log('\nEvidencias a adjuntar (sus nombres tendrán enlaces de Jira en el comentario):');
    for (const file of files) log(file);
  }
  if (!terminal || terminal.closed) {
    log('Sin confirmación interactiva: el comentario queda guardado localmente.');
    return false;
  }
  while (true) {
    const answer = (await terminal.ask(`\n¿Publicar este comentario${files.length ? ' y adjuntar estas evidencias' : ''} en ${key}? [sí/no] (no): `)).trim().toLowerCase();
    if (['sí', 'si', 's'].includes(answer)) return true;
    if (['', 'no', 'n', 'cancelar', 'salir'].includes(answer)) return false;
    log('Respondé sí para publicar o no para conservarlo solamente en esta Mac.');
  }
}

export async function publishBrowserReport(cfg, report, { upload = attachEvidence, comment = addComment, save = async () => {}, redact = text => text, confirm = preview => confirmBrowserPublication(preview) } = {}) {
  report.publication = { commentPublished: false, status: 'pending_confirmation', errors: [] };
  const evidence = report.results.filter(r => r.scope !== 'environment').flatMap(r => r.evidence || []);
  let body = browserCommentDraft(report, redact);
  report.publication.preview = body;
  await save();
  try {
    if (await confirm({ key: report.key, body, files: evidence.filter(e => !e.attachment).map(e => e.file), revised: false }) !== true) {
      report.publication.status = 'cancelled';
      return;
    }
    report.publication.status = 'approved';
    for (const item of evidence) {
      try {
        if (!item.attachment) {
          const uploaded = await upload(cfg, report.key, item.file);
          const attachment = uploaded?.[0];
          if (!attachment?.content) throw new Error('Jira no devolvió el enlace del adjunto.');
          item.attachment = { id: attachment.id, filename: attachment.filename, url: attachment.content };
          delete item.uploadError;
          await save();
        }
      } catch (error) {
        item.uploadError = redact(`No se pudo adjuntar ${path.basename(item.file)}: ${error.message}`);
        report.publication.errors.push(item.uploadError);
      }
    }
    body = browserCommentDraft(report, redact);
    report.publication.preview = body;
    await save();
    if (report.publication.errors.length && await confirm({ key: report.key, body, files: [], revised: true }) !== true) {
      report.publication.status = 'cancelled_after_upload';
      return;
    }
    await comment(cfg, report.key, body);
    report.publication.commentPublished = true;
    report.publication.status = 'published';
  } catch (error) {
    report.publication.status = 'interrupted_or_failed';
    report.publication.errors.push(redact(error.message));
    throw error;
  } finally { await save(); }
}
