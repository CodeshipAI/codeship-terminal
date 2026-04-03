import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockListSessions = vi.fn();
const mockGetSession = vi.fn();

vi.mock('../lib/api-client.js', () => ({
  getApiClient: () => ({
    listSessions: (...args: unknown[]) => mockListSessions(...args),
    getSession: (...args: unknown[]) => mockGetSession(...args),
  }),
}));

import { sessionsCommand } from '../commands/sessions.js';

async function run(argv: string[]): Promise<void> {
  await sessionsCommand.parseAsync(argv, { from: 'user' });
}

const SESSION = {
  id: 'session-1',
  epicId: 'epic-1',
  status: 'active',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('sessions list', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls listSessions with the epic id', async () => {
    mockListSessions.mockResolvedValue([SESSION]);
    await run(['list', 'epic-1']);
    expect(mockListSessions).toHaveBeenCalledWith('epic-1');
  });

  it('handles empty session list', async () => {
    mockListSessions.mockResolvedValue([]);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await run(['list', 'epic-1']);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('No sessions'));
    spy.mockRestore();
  });

  it('sets exitCode on error', async () => {
    mockListSessions.mockRejectedValue(new Error('network error'));
    await run(['list', 'epic-1']);
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
  });
});

describe('sessions view', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls getSession with the session id', async () => {
    mockGetSession.mockResolvedValue(SESSION);
    await run(['view', 'session-1']);
    expect(mockGetSession).toHaveBeenCalledWith('session-1');
  });

  it('sets exitCode on error', async () => {
    mockGetSession.mockRejectedValue(new Error('not found'));
    await run(['view', 'session-1']);
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
  });
});
