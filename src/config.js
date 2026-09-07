import 'dotenv/config';

export function config() {
  return {
    llmProvider: process.env.LLM_PROVIDER || 'claude-cli',
    claudeCommand: process.env.CLAUDE_COMMAND || 'claude',
    jiraBaseUrl: (process.env.JIRA_BASE_URL || '').replace(/\/$/, ''),
    jiraEmail: process.env.JIRA_EMAIL || '',
    jiraToken: process.env.JIRA_API_TOKEN || '',
    xrayEnabled: process.env.XRAY_ENABLED !== 'false',
    xrayProjectKey: process.env.XRAY_PROJECT_KEY || '',
    xrayTestIssueType: process.env.XRAY_TEST_ISSUE_TYPE || 'Test',
    xrayLinkType: process.env.XRAY_LINK_TYPE || 'Tests',
    xrayTestTypeField: process.env.XRAY_TEST_TYPE_FIELD || '',
    xrayTestTypeValue: process.env.XRAY_TEST_TYPE_VALUE || 'Manual',
    tokenBudget: Number(process.env.TOKEN_BUDGET || 12000),
  };
}

export function requireJira(cfg) {
  const missing = ['jiraBaseUrl', 'jiraEmail', 'jiraToken'].filter((key) => !cfg[key]);
  if (missing.length) throw new Error(`Falta configuración de Jira: ${missing.join(', ')}`);
}
