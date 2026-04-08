import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface CodeshipConfig {
  apiUrl: string;
  token?: string;
}

function getConfigFile(): string {
  if (process.env.CODESHIP_CONFIG_FILE) return process.env.CODESHIP_CONFIG_FILE;
  const configDir = join(homedir(), '.codeship');
  return join(configDir, 'config.json');
}

const DEFAULT_API_URL = 'https://api.codeship.tech';

const ALLOWED_KEYS = ['api-url'] as const;
export type ConfigKey = (typeof ALLOWED_KEYS)[number];

export function isValidConfigKey(key: string): key is ConfigKey {
  return (ALLOWED_KEYS as readonly string[]).includes(key);
}

function resolveApiUrl(fileApiUrl?: string): string {
  return process.env.CODESHIP_API_URL ?? fileApiUrl ?? DEFAULT_API_URL;
}

export async function loadConfig(): Promise<CodeshipConfig> {
  const configFile = getConfigFile();
  try {
    const data = await readFile(configFile, 'utf-8');
    const parsed = JSON.parse(data) as Partial<CodeshipConfig>;
    return {
      apiUrl: resolveApiUrl(parsed.apiUrl),
      token: parsed.token,
    };
  } catch {
    return { apiUrl: resolveApiUrl() };
  }
}

export async function saveConfig(config: CodeshipConfig): Promise<void> {
  const configFile = getConfigFile();
  const configDir = join(configFile, '..');
  await mkdir(configDir, { recursive: true });
  await writeFile(configFile, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

export async function setConfigValue(key: ConfigKey, value: string): Promise<void> {
  const config = await loadConfig();
  switch (key) {
    case 'api-url':
      config.apiUrl = value;
      break;
  }
  await saveConfig(config);
}

export async function getConfigValue(key: ConfigKey): Promise<string | undefined> {
  const config = await loadConfig();
  switch (key) {
    case 'api-url':
      return config.apiUrl;
  }
}

export async function resetConfig(): Promise<void> {
  await saveConfig({ apiUrl: DEFAULT_API_URL });
}

export function getConfigPath(): string {
  return getConfigFile();
}
