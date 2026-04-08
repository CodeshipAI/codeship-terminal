import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getToken, setToken, clearToken, isAuthenticated, getTokenSource, getEnvToken } from '../lib/auth-store.js';

let mockStore: Record<string, unknown> = {};

vi.mock('../lib/config.js', () => {
  return {
    loadConfig: vi.fn(() => ({ apiUrl: 'https://api.codeship.ai', ...mockStore })),
    saveConfig: vi.fn((config: Record<string, unknown>) => {
      mockStore = { ...config };
    }),
  };
});

describe('auth-store', () => {
  const originalEnv = process.env.CODESHIP_TOKEN;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStore = {};
    delete process.env.CODESHIP_TOKEN;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.CODESHIP_TOKEN = originalEnv;
    } else {
      delete process.env.CODESHIP_TOKEN;
    }
  });

  it('returns undefined when no token is stored', async () => {
    const token = await getToken();
    expect(token).toBeUndefined();
  });

  it('stores and retrieves a token', async () => {
    await setToken('my-test-token');
    const { loadConfig } = await import('../lib/config.js');
    const config = await loadConfig();
    expect(config.token).toBe('my-test-token');
  });

  it('reports authenticated after setting token', async () => {
    await setToken('a-token');
    const { loadConfig } = await import('../lib/config.js');
    const config = await loadConfig();
    expect(!!config.token).toBe(true);
  });

  describe('CODESHIP_TOKEN env var', () => {
    it('returns env var token when CODESHIP_TOKEN is set', async () => {
      process.env.CODESHIP_TOKEN = 'cs_env_token_123';
      const token = await getToken();
      expect(token).toBe('cs_env_token_123');
    });

    it('env var token takes priority over config file token', async () => {
      await setToken('config-token');
      process.env.CODESHIP_TOKEN = 'cs_env_token_456';
      const token = await getToken();
      expect(token).toBe('cs_env_token_456');
    });

    it('falls back to config token when env var is not set', async () => {
      await setToken('config-token');
      const token = await getToken();
      expect(token).toBe('config-token');
    });

    it('isAuthenticated returns true when env var is set', async () => {
      process.env.CODESHIP_TOKEN = 'cs_env_token';
      expect(await isAuthenticated()).toBe(true);
    });

    it('getTokenSource returns env when CODESHIP_TOKEN is set', async () => {
      process.env.CODESHIP_TOKEN = 'cs_env_token';
      expect(await getTokenSource()).toBe('env');
    });

    it('getTokenSource returns config when only config token exists', async () => {
      await setToken('config-token');
      expect(await getTokenSource()).toBe('config');
    });

    it('getTokenSource returns none when no token exists', async () => {
      expect(await getTokenSource()).toBe('none');
    });

    it('getEnvToken returns the env var value', () => {
      process.env.CODESHIP_TOKEN = 'cs_test';
      expect(getEnvToken()).toBe('cs_test');
    });

    it('getEnvToken returns undefined when env var is not set', () => {
      expect(getEnvToken()).toBeUndefined();
    });

    it('getEnvToken returns undefined for empty string', () => {
      process.env.CODESHIP_TOKEN = '';
      expect(getEnvToken()).toBeUndefined();
    });
  });
});
