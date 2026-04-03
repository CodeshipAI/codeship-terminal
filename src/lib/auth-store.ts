import { loadConfig, saveConfig } from './config.js';

export async function getToken(): Promise<string | undefined> {
  const config = await loadConfig();
  return config.token;
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
