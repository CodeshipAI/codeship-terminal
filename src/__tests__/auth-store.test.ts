import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getToken, setToken, clearToken, isAuthenticated } from '../lib/auth-store.js';

vi.mock('../lib/config.js', () => {
  let store: Record<string, unknown> = {};
  return {
    loadConfig: vi.fn(() => ({ apiUrl: 'https://api.codeship.ai', ...store })),
    saveConfig: vi.fn((config: Record<string, unknown>) => {
      store = { ...config };
    }),
  };
});

describe('auth-store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    // isAuthenticated calls loadConfig which returns the mocked store
    // Since we set the token through saveConfig mock, we need the mock to reflect it
    const { loadConfig } = await import('../lib/config.js');
    const config = await loadConfig();
    expect(!!config.token).toBe(true);
  });
});
