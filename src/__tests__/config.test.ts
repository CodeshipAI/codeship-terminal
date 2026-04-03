import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('config', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'codeship-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    delete process.env.CODESHIP_API_URL;
  });

  it('should have correct default API URL', async () => {
    const { loadConfig } = await import('../lib/config.js');
    const config = await loadConfig();
    expect(config.apiUrl).toBe('https://api.codeship.ai');
  });

  it('should return default config when file does not exist', async () => {
    const { loadConfig } = await import('../lib/config.js');
    const config = await loadConfig();
    expect(config).toHaveProperty('apiUrl');
    expect(config.token).toBeUndefined();
  });

  it('should respect CODESHIP_API_URL env var', async () => {
    process.env.CODESHIP_API_URL = 'https://custom.env.api.com';
    // Re-import to pick up fresh module state
    const { loadConfig } = await import('../lib/config.js');
    const config = await loadConfig();
    expect(config.apiUrl).toBe('https://custom.env.api.com');
  });

  it('should validate config keys', async () => {
    const { isValidConfigKey } = await import('../lib/config.js');
    expect(isValidConfigKey('api-url')).toBe(true);
    expect(isValidConfigKey('invalid-key')).toBe(false);
    expect(isValidConfigKey('')).toBe(false);
  });
});
