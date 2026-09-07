import fs from 'node:fs';
import path from 'node:path';

export function loadEnvironments(filePath = '.qat/environments.json') {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) return null;
  const raw = fs.readFileSync(resolved, 'utf8');
  const parsed = JSON.parse(raw);
  return parsed.environments || parsed;
}

export function resolveEnvironment({ filePath, environment, profile, fallback = {} }) {
  const environments = loadEnvironments(filePath);
  if (!environments) {
    return {
      name: environment || fallback.name || 'qa',
      profile: profile || fallback.profile || 'default',
      baseUrl: fallback.baseUrl || '',
      user: fallback.user || '',
      password: fallback.password || '',
      source: 'env',
    };
  }

  const name = environment || 'qa';
  const env = environments[name];
  if (!env) throw new Error(`Ambiente Qat no encontrado: ${name}`);

  const profiles = env.profiles || {};
  const selectedProfile = profile || env.defaultProfile || 'default';
  const credentials = profiles[selectedProfile] || {};
  if (Object.keys(profiles).length && !profiles[selectedProfile]) {
    throw new Error(`Perfil '${selectedProfile}' no encontrado en ambiente '${name}'`);
  }

  return {
    name,
    profile: selectedProfile,
    baseUrl: String(env.baseUrl || '').replace(/\/$/, ''),
    user: credentials.user || '',
    password: credentials.password || '',
    source: 'file',
  };
}

export function listEnvironments(filePath = '.qat/environments.json') {
  const environments = loadEnvironments(filePath) || {};
  return Object.entries(environments).map(([name, env]) => ({
    name,
    baseUrl: env.baseUrl || '',
    defaultProfile: env.defaultProfile || 'default',
    profiles: Object.keys(env.profiles || {}),
  }));
}
