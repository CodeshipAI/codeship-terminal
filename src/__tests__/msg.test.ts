import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSendMessage = vi.fn();
const mockListMessages = vi.fn();
const mockGetMessage = vi.fn();

vi.mock('../lib/api-client.js', () => ({
  getApiClient: () => ({
    sendMessage: (...args: unknown[]) => mockSendMessage(...args),
    listMessages: (...args: unknown[]) => mockListMessages(...args),
    getMessage: (...args: unknown[]) => mockGetMessage(...args),
  }),
}));

import { msgCommand } from '../commands/msg.js';

async function run(argv: string[]): Promise<void> {
  await msgCommand.parseAsync(argv, { from: 'user' });
}

const MESSAGE = {
  id: 'msg-1',
  sessionId: 'session-1',
  agentId: 'agent-1',
  sender: 'user',
  content: 'Hello agent',
  createdAt: '2026-01-01T00:00:00Z',
};

describe('msg send', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls sendMessage with project, session, content', async () => {
    mockSendMessage.mockResolvedValue(MESSAGE);
    await run(['send', 'proj-1', 'session-1', '--content', 'Hello agent']);
    expect(mockSendMessage).toHaveBeenCalledWith('proj-1', 'session-1', {
      content: 'Hello agent',
      agentId: undefined,
    });
  });

  it('passes agentId when provided', async () => {
    mockSendMessage.mockResolvedValue(MESSAGE);
    await run(['send', 'proj-1', 'session-1', '--content', 'Hi', '--agent-id', 'agent-1']);
    expect(mockSendMessage).toHaveBeenCalledWith('proj-1', 'session-1', {
      content: 'Hi',
      agentId: 'agent-1',
    });
  });

  it('sets exitCode on error', async () => {
    mockSendMessage.mockRejectedValue(new Error('network error'));
    await run(['send', 'proj-1', 'session-1', '--content', 'Hello']);
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
  });
});

describe('msg list', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls listMessages with project and session ids', async () => {
    mockListMessages.mockResolvedValue([MESSAGE]);
    await run(['list', 'proj-1', 'session-1']);
    expect(mockListMessages).toHaveBeenCalledWith('proj-1', 'session-1', undefined);
  });

  it('passes agentId filter when provided', async () => {
    mockListMessages.mockResolvedValue([MESSAGE]);
    await run(['list', 'proj-1', 'session-1', '--agent-id', 'agent-1']);
    expect(mockListMessages).toHaveBeenCalledWith('proj-1', 'session-1', 'agent-1');
  });

  it('handles empty message list', async () => {
    mockListMessages.mockResolvedValue([]);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await run(['list', 'proj-1', 'session-1']);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('No messages'));
    spy.mockRestore();
  });

  it('sets exitCode on error', async () => {
    mockListMessages.mockRejectedValue(new Error('network error'));
    await run(['list', 'proj-1', 'session-1']);
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
  });
});

describe('msg read', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls getMessage with project, session, message ids', async () => {
    mockGetMessage.mockResolvedValue(MESSAGE);
    await run(['read', 'proj-1', 'session-1', 'msg-1']);
    expect(mockGetMessage).toHaveBeenCalledWith('proj-1', 'session-1', 'msg-1');
  });

  it('sets exitCode on error', async () => {
    mockGetMessage.mockRejectedValue(new Error('not found'));
    await run(['read', 'proj-1', 'session-1', 'msg-1']);
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
  });
});
