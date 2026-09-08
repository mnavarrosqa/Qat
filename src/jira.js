import fs from 'node:fs/promises';
import { requireJira } from './config.js';

function auth(cfg) {
  return `Basic ${Buffer.from(`${cfg.jiraEmail}:${cfg.jiraToken}`).toString('base64')}`;
}

function adfText(value) {
  if (value && typeof value === 'object' && value.type === 'doc') return value;
  const lines = String(value || '').split('\n');
  return {
    type: 'doc',
    version: 1,
    content: lines.map((line) => ({
      type: 'paragraph',
      content: line ? [{ type: 'text', text: line }] : [],
    })),
  };
}

async function jiraFetch(cfg, path, options = {}) {
  requireJira(cfg);
  const response = await fetch(`${cfg.jiraBaseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: auth(cfg),
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`Jira ${response.status}: ${await response.text()}`);
  if (response.status === 204) return null;
  const body = await response.text();
  return body ? JSON.parse(body) : null;
}

function normalizeFields(fields) {
  const normalized = { ...fields };
  if (typeof normalized.description === 'string') normalized.description = adfText(normalized.description);
  return normalized;
}

export async function getIssue(cfg, key) {
  return jiraFetch(cfg, `/rest/api/3/issue/${encodeURIComponent(key)}?fields=summary,description,issuetype,priority,labels,status,project,issuelinks`);
}

// Read the complete discussion separately: Jira embeds only a page of comments.
export async function getIssueContext(cfg, key) {
  const path = `/rest/api/3/issue/${encodeURIComponent(key)}`;
  const issue = await jiraFetch(cfg, `${path}?fields=*all&expand=names`);
  const comments = [];
  let startAt = 0;
  while (true) {
    const page = await jiraFetch(cfg, `${path}/comment?startAt=${startAt}&maxResults=100&orderBy=created`);
    const batch = page?.comments || [];
    comments.push(...batch);
    startAt += batch.length;
    if (page?.isLast === true || startAt >= (page?.total ?? startAt)) break;
    if (!batch.length) throw new Error('Jira devolvió comentarios incompletos; no se puede analizar el contexto completo.');
  }
  issue.fields = { ...issue.fields, comment: { comments, total: comments.length } };
  return issue;
}

export async function createIssue(cfg, fields) {
  return jiraFetch(cfg, '/rest/api/3/issue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: normalizeFields(fields) }),
  });
}

export async function updateIssue(cfg, key, fields) {
  return jiraFetch(cfg, `/rest/api/3/issue/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: normalizeFields(fields) }),
  });
}

export async function searchIssues(cfg, jql, fields = ['key', 'summary']) {
  const result = await jiraFetch(cfg, '/rest/api/3/search/jql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jql, fields, maxResults: 50 }),
  });
  return result?.issues || [];
}

export async function linkIssues(cfg, sourceKey, testKey, linkType = 'Tests') {
  return jiraFetch(cfg, '/rest/api/3/issueLink', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: { name: linkType },
      inwardIssue: { key: sourceKey },
      outwardIssue: { key: testKey },
    }),
  });
}

export async function addComment(cfg, key, text) {
  return jiraFetch(cfg, `/rest/api/3/issue/${encodeURIComponent(key)}/comment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body: adfText(text) }),
  });
}

export async function attachEvidence(cfg, key, filePath) {
  requireJira(cfg);
  const bytes = await fs.readFile(filePath);
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: filePath.toLowerCase().endsWith('.png') ? 'image/png' : 'application/octet-stream' }), filePath.split(/[\\/]/).pop());
  const response = await fetch(`${cfg.jiraBaseUrl}/rest/api/3/issue/${encodeURIComponent(key)}/attachments`, {
    method: 'POST',
    headers: { Authorization: auth(cfg), Accept: 'application/json', 'X-Atlassian-Token': 'no-check' },
    body: form,
  });
  if (!response.ok) throw new Error(`Jira attachment ${response.status}: ${await response.text()}`);
  return response.json();
}
