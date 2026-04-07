import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockListSessions = vi.fn();
const mockGetSession = vi.fn();
const mockGetSessionActivity = vi.fn();
const mockGetSessionCosts = vi.fn();
const mockPollSession = vi.fn();
const mockPollSessionEtag = vi.fn();

vi.mock('../lib/api-client.js', () => ({
  getApiClient: () => ({
    listSessions: (...args: unknown[]) => mockListSessions(...args),
    getSession: (...args: unknown[]) => mockGetSession(...args),
    getSessionActivity: (...args: unknown[]) => mockGetSessionActivity(...args),
    getSessionCosts: (...args: unknown[]) => mockGetSessionCosts(...args),
    pollSession: (...args: unknown[]) => mockPollSession(...args),
    pollSessionEtag: (...args: unknown[]) => mockPollSessionEtag(...args),
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

const SESSION_DETAIL = {
  session: SESSION,
  stories: [
    { id: 'story-1', sessionId: 'session-1', title: 'A story', status: 'completed', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
  ],
  agents: [
    { id: 'agent-1', sessionId: 'session-1', name: 'Alice', role: 'developer', status: 'active', createdAt: '2026-01-01T00:00:00Z' },
  ],
  escalations: [],
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

describe('sessions activity', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls getSessionActivity with project and session id', async () => {
    mockGetSessionActivity.mockResolvedValue([
      { id: 'act-1', sessionId: 'session-1', type: 'started', description: 'Session started', timestamp: '2026-01-01T00:00:00Z' },
    ]);
    await run(['activity', 'project-1', 'session-1']);
    expect(mockGetSessionActivity).toHaveBeenCalledWith('project-1', 'session-1');
  });

  it('limits entries when --limit is provided', async () => {
    const entries = [
      { id: 'act-1', sessionId: 'session-1', type: 'started', description: 'One', timestamp: '2026-01-01T00:00:00Z' },
      { id: 'act-2', sessionId: 'session-1', type: 'completed', description: 'Two', timestamp: '2026-01-01T00:01:00Z' },
      { id: 'act-3', sessionId: 'session-1', type: 'error', description: 'Three', timestamp: '2026-01-01T00:02:00Z' },
    ];
    mockGetSessionActivity.mockResolvedValue(entries);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await run(['activity', 'project-1', 'session-1', '--limit', '2']);
    const lines = spy.mock.calls.map((c) => c[0]).join('\n');
    expect(lines).toContain('One');
    expect(lines).toContain('Two');
    expect(lines).not.toContain('Three');
    spy.mockRestore();
  });

  it('handles empty activity', async () => {
    mockGetSessionActivity.mockResolvedValue([]);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await run(['activity', 'project-1', 'session-1']);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('No activity'));
    spy.mockRestore();
  });

  it('sets exitCode on error', async () => {
    mockGetSessionActivity.mockRejectedValue(new Error('fail'));
    await run(['activity', 'project-1', 'session-1']);
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
  });
});

describe('sessions costs', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls getSessionCosts with project and session id', async () => {
    mockGetSessionCosts.mockResolvedValue({ sessionId: 'session-1', totalCost: 0.5, breakdown: [] });
    await run(['costs', 'project-1', 'session-1']);
    expect(mockGetSessionCosts).toHaveBeenCalledWith('project-1', 'session-1');
  });

  it('displays total cost and breakdown', async () => {
    mockGetSessionCosts.mockResolvedValue({
      sessionId: 'session-1',
      totalCost: 1.234,
      breakdown: [{ agentId: 'agent-1', cost: 1.234 }],
    });
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await run(['costs', 'project-1', 'session-1']);
    const output = spy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('1.2340');
    expect(output).toContain('agent-1');
    spy.mockRestore();
  });

  it('sets exitCode on error', async () => {
    mockGetSessionCosts.mockRejectedValue(new Error('fail'));
    await run(['costs', 'project-1', 'session-1']);
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
  });
});

describe('sessions poll', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls pollSession without --watch', async () => {
    mockPollSession.mockResolvedValue(SESSION_DETAIL);
    await run(['poll', 'project-1', 'session-1']);
    expect(mockPollSession).toHaveBeenCalledWith('project-1', 'session-1');
  });

  it('displays session detail fields', async () => {
    mockPollSession.mockResolvedValue(SESSION_DETAIL);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await run(['poll', 'project-1', 'session-1']);
    const output = spy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('session-1');
    expect(output).toContain('A story');
    expect(output).toContain('Alice');
    spy.mockRestore();
  });

  it('sets exitCode on error', async () => {
    mockPollSession.mockRejectedValue(new Error('fail'));
    await run(['poll', 'project-1', 'session-1']);
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
  });
});
