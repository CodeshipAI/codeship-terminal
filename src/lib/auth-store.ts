import { loadConfig, saveConfig } from './config.js';

export type TokenSource = 'env' | 'config' | 'none';

export function getEnvToken(): string | undefined {
  return process.env.CODESHIP_TOKEN || undefined;
}

export async function getToken(): Promise<string | undefined> {
  const envToken = getEnvToken();
  if (envToken) return envToken;
  const config = await loadConfig();
  return config.token;
}

export async function getTokenSource(): Promise<TokenSource> {
  if (getEnvToken()) return 'env';
  const config = await loadConfig();
  if (config.token) return 'config';
  return 'none';
}

export async function setToken(token: string): Promise<void> {
  const config = await loadConfig();
  config.token = token;
  await saveConfig(config);
}

export async function clearToken(): Promise<void> {
  const config = await loadConfig();
  delete config.token;
  await saveConfig(config);
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await getToken();
  return !!token;
}
