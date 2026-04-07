import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockListEscalations = vi.fn();
const mockResolveEscalation = vi.fn();

vi.mock('../lib/api-client.js', () => ({
  getApiClient: () => ({
    listEscalations: (...args: unknown[]) => mockListEscalations(...args),
    resolveEscalation: (...args: unknown[]) => mockResolveEscalation(...args),
  }),
}));

import { escalationCommand } from '../commands/escalation.js';

async function run(argv: string[]): Promise<void> {
  await escalationCommand.parseAsync(argv, { from: 'user' });
}

const ESCALATION = {
  id: 'esc-1',
  sessionId: 'session-1',
  agentId: 'agent-1',
  title: 'Agent blocked',
  description: 'Agent cannot proceed',
  status: 'open',
  resolution: undefined,
  createdAt: '2026-01-01T00:00:00Z',
};

describe('escalation list', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls listEscalations with project id and session id', async () => {
    mockListEscalations.mockResolvedValue([ESCALATION]);
    await run(['list', 'proj-1', 'session-1']);
    expect(mockListEscalations).toHaveBeenCalledWith('proj-1', 'session-1');
  });

  it('handles empty escalation list', async () => {
    mockListEscalations.mockResolvedValue([]);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await run(['list', 'proj-1', 'session-1']);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('No escalations'));
    spy.mockRestore();
  });

  it('sets exitCode on error', async () => {
    mockListEscalations.mockRejectedValue(new Error('network error'));
    await run(['list', 'proj-1', 'session-1']);
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
  });
});

describe('escalation resolve', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls resolveEscalation with all arguments', async () => {
    mockResolveEscalation.mockResolvedValue({ ...ESCALATION, status: 'resolved', resolution: 'Fixed it' });
    await run(['resolve', 'proj-1', 'session-1', 'esc-1', '--resolution', 'Fixed it']);
    expect(mockResolveEscalation).toHaveBeenCalledWith('proj-1', 'session-1', 'esc-1', 'Fixed it');
  });

  it('sets exitCode on error', async () => {
    mockResolveEscalation.mockRejectedValue(new Error('not found'));
    await run(['resolve', 'proj-1', 'session-1', 'esc-1', '--resolution', 'Fix']);
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
  });
});
