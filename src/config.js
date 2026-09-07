import 'dotenv/config';
import { resolveEnvironment } from './environments.js';

export function config() {
  const environmentFile = process.env.QAT_ENVIRONMENTS_FILE || '.qat/environments.json';
  const selected = resolveEnvironment({
    filePath: environmentFile,
    environment: process.env.QAT_ENV || 'qa',
    profile: process.env.QAT_PROFILE || '',
    fallback: {
      name: process.env.QAT_ENV || 'qa',
      profile: process.env.QAT_PROFILE || 'default',
      baseUrl: process.env.QAT_BASE_URL || '',
      user: process.env.QAT_USER || '',
      password: process.env.QAT_PASSWORD || '',
    },
  });

  return {
    llmProvider: process.env.LLM_PROVIDER || 'claude-cli',
    claudeCommand: process.env.CLAUDE_COMMAND || 'claude',
    jiraBaseUrl: (process.env.JIRA_BASE_URL || '').replace(/\/$/, ''),
    jiraEmail: process.env.JIRA_EMAIL || '',
    jiraToken: process.env.JIRA_API_TOKEN || '',
    xrayEnabled: process.env.XRAY_ENABLED !== 'false',
    xrayMode: process.env.XRAY_MODE || 'api',
    xrayExportFormat: process.env.XRAY_EXPORT_FORMAT || 'csv',
    xrayClientId: process.env.XRAY_CLIENT_ID || '',
    xrayClientSecret: process.env.XRAY_CLIENT_SECRET || '',
    xrayProjectKey: process.env.XRAY_PROJECT_KEY || '',
    xrayTestIssueType: process.env.XRAY_TEST_ISSUE_TYPE || 'Test',
    xrayExecutionIssueType: process.env.XRAY_EXECUTION_ISSUE_TYPE || 'Test Execution',
    xrayLinkType: process.env.XRAY_LINK_TYPE || 'Tests',
    xrayExecutionLinkType: process.env.XRAY_EXECUTION_LINK_TYPE || process.env.XRAY_LINK_TYPE || 'Tests',
    xrayTestTypeField: process.env.XRAY_TEST_TYPE_FIELD || '',
    xrayTestTypeValue: process.env.XRAY_TEST_TYPE_VALUE || 'Manual',
    qatEnvironmentsFile: environmentFile,
    qatEnv: selected.name,
    qatProfile: selected.profile,
    qatBaseUrl: selected.baseUrl,
    qatUser: selected.user,
    qatPassword: selected.password,
    qatEnvironmentSource: selected.source,
    tokenBudget: Number(process.env.TOKEN_BUDGET || 12000),
  };
}

export function requireJira(cfg) {
  const missing = ['jiraBaseUrl', 'jiraEmail', 'jiraToken'].filter((key) => !cfg[key]);
  if (missing.length) throw new Error(`Falta configuración de Jira: ${missing.join(', ')}`);
}
