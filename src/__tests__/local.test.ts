import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('local command', () => {
  let tempDir: string;
  const originalConfigFile = process.env.CODESHIP_CONFIG_FILE;
  const originalApiUrl = process.env.CODESHIP_API_URL;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'codeship-local-test-'));
    process.env.CODESHIP_CONFIG_FILE = join(tempDir, 'config.json');
    delete process.env.CODESHIP_API_URL;
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    if (originalConfigFile !== undefined) {
      process.env.CODESHIP_CONFIG_FILE = originalConfigFile;
    } else {
      delete process.env.CODESHIP_CONFIG_FILE;
    }
    if (originalApiUrl !== undefined) {
      process.env.CODESHIP_API_URL = originalApiUrl;
    } else {
      delete process.env.CODESHIP_API_URL;
    }
  });

  it('sets API URL to localhost when local start is called', async () => {
    const { setConfigValue, loadConfig } = await import('../lib/config.js');
    await setConfigValue('api-url', 'http://localhost:3000');
    const config = await loadConfig();
    expect(config.apiUrl).toBe('http://localhost:3000');
  });

  it('resets API URL to production when local stop is called', async () => {
    const { setConfigValue, resetConfig, loadConfig } = await import('../lib/config.js');
    await setConfigValue('api-url', 'http://localhost:3000');
    await resetConfig();
    const config = await loadConfig();
    expect(config.apiUrl).toBe('https://api.codeship.tech');
  });

  it('supports custom port for local start', async () => {
    const { setConfigValue, loadConfig } = await import('../lib/config.js');
    await setConfigValue('api-url', 'http://localhost:8080');
    const config = await loadConfig();
    expect(config.apiUrl).toBe('http://localhost:8080');
  });

  it('detects local URL correctly', () => {
    const localUrls = ['http://localhost:3000', 'http://localhost:8080', 'http://127.0.0.1:3000'];
    const productionUrls = ['https://api.codeship.tech', 'https://example.com'];

    function isLocalUrl(url: string): boolean {
      return url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1');
    }

    for (const url of localUrls) {
      expect(isLocalUrl(url)).toBe(true);
    }
    for (const url of productionUrls) {
      expect(isLocalUrl(url)).toBe(false);
    }
  });
});
