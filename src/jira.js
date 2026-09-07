import fs from 'node:fs/promises';
import { requireJira } from './config.js';

function auth(cfg) {
  return `Basic ${Buffer.from(`${cfg.jiraEmail}:${cfg.jiraToken}`).toString('base64')}`;
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
  return response.json();
}

export async function getIssue(cfg, key) {
  return jiraFetch(cfg, `/rest/api/3/issue/${encodeURIComponent(key)}?fields=summary,description,issuetype,priority,labels,status`);
}

export async function addComment(cfg, key, text) {
  const body = {
    body: {
      type: 'doc', version: 1,
      content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
    },
  };
  return jiraFetch(cfg, `/rest/api/3/issue/${encodeURIComponent(key)}/comment`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

export async function attachEvidence(cfg, key, filePath) {
  requireJira(cfg);
  const bytes = await fs.readFile(filePath);
  const form = new FormData();
  form.append('file', new Blob([bytes]), filePath.split(/[\\/]/).pop());
  const response = await fetch(`${cfg.jiraBaseUrl}/rest/api/3/issue/${encodeURIComponent(key)}/attachments`, {
    method: 'POST',
    headers: { Authorization: auth(cfg), Accept: 'application/json', 'X-Atlassian-Token': 'no-check' },
    body: form,
  });
  if (!response.ok) throw new Error(`Jira attachment ${response.status}: ${await response.text()}`);
  return response.json();
}
