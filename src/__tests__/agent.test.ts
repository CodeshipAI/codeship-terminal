import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockListAgents = vi.fn();
const mockGetAgent = vi.fn();
const mockGetAgentLogs = vi.fn();

vi.mock('../lib/api-client.js', () => ({
  getApiClient: () => ({
    listAgents: (...args: unknown[]) => mockListAgents(...args),
    getAgent: (...args: unknown[]) => mockGetAgent(...args),
    getAgentLogs: (...args: unknown[]) => mockGetAgentLogs(...args),
  }),
}));

import { agentCommand } from '../commands/agent.js';

async function run(argv: string[]): Promise<void> {
  await agentCommand.parseAsync(argv, { from: 'user' });
}

const AGENT = {
  id: 'agent-1',
  sessionId: 'session-1',
  name: 'TestAgent',
  role: 'developer',
  status: 'active',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const LOG_ENTRY = {
  id: 'log-1',
  agentId: 'agent-1',
  level: 'info',
  message: 'Agent started',
  timestamp: '2026-01-01T00:00:00Z',
};

describe('agent list', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls listAgents with project and session ids', async () => {
    mockListAgents.mockResolvedValue([AGENT]);
    await run(['list', 'project-1', 'session-1']);
    expect(mockListAgents).toHaveBeenCalledWith('project-1', 'session-1');
  });

  it('handles empty agent list', async () => {
    mockListAgents.mockResolvedValue([]);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await run(['list', 'project-1', 'session-1']);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('No agents'));
    spy.mockRestore();
  });

  it('sets exitCode on error', async () => {
    mockListAgents.mockRejectedValue(new Error('network error'));
    await run(['list', 'project-1', 'session-1']);
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
  });
});

describe('agent view', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls getAgent with project, session, and agent ids', async () => {
    mockGetAgent.mockResolvedValue(AGENT);
    await run(['view', 'project-1', 'session-1', 'agent-1']);
    expect(mockGetAgent).toHaveBeenCalledWith('project-1', 'session-1', 'agent-1');
  });

  it('sets exitCode on error', async () => {
    mockGetAgent.mockRejectedValue(new Error('not found'));
    await run(['view', 'project-1', 'session-1', 'agent-1']);
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
  });
});

describe('agent logs', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls getAgentLogs with project, session, and agent ids', async () => {
    mockGetAgentLogs.mockResolvedValue([LOG_ENTRY]);
    await run(['logs', 'project-1', 'session-1', 'agent-1']);
    expect(mockGetAgentLogs).toHaveBeenCalledWith('project-1', 'session-1', 'agent-1');
  });

  it('handles empty logs', async () => {
    mockGetAgentLogs.mockResolvedValue([]);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await run(['logs', 'project-1', 'session-1', 'agent-1']);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('No logs'));
    spy.mockRestore();
  });

  it('sets exitCode on error', async () => {
    mockGetAgentLogs.mockRejectedValue(new Error('network error'));
    await run(['logs', 'project-1', 'session-1', 'agent-1']);
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
  });
});
