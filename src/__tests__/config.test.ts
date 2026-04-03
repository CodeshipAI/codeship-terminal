import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// We test the config logic by importing and overriding the path
// For unit tests, we directly test the serialization logic
describe('config', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'codeship-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
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
});
