import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockListEpics = vi.fn();
const mockGetEpic = vi.fn();
const mockCreateEpic = vi.fn();

vi.mock('../lib/api-client.js', () => ({
  getApiClient: () => ({
    listEpics: (...args: unknown[]) => mockListEpics(...args),
    getEpic: (...args: unknown[]) => mockGetEpic(...args),
    createEpic: (...args: unknown[]) => mockCreateEpic(...args),
  }),
}));

import { epicCommand } from '../commands/epic.js';

async function run(argv: string[]): Promise<void> {
  await epicCommand.parseAsync(argv, { from: 'user' });
}

const EPIC = {
  id: 'epic-1',
  projectId: 'proj-1',
  title: 'My Epic',
  description: 'An epic description',
  status: 'active',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('epic list', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls listEpics with the project id', async () => {
    mockListEpics.mockResolvedValue([EPIC]);
    await run(['list', 'proj-1']);
    expect(mockListEpics).toHaveBeenCalledWith('proj-1');
  });

  it('handles empty epic list', async () => {
    mockListEpics.mockResolvedValue([]);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await run(['list', 'proj-1']);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('No epics'));
    spy.mockRestore();
  });

  it('sets exitCode on error', async () => {
    mockListEpics.mockRejectedValue(new Error('network error'));
    await run(['list', 'proj-1']);
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
  });
});

describe('epic view', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls getEpic with the epic id', async () => {
    mockGetEpic.mockResolvedValue(EPIC);
    await run(['view', 'epic-1']);
    expect(mockGetEpic).toHaveBeenCalledWith('epic-1');
  });

  it('sets exitCode on error', async () => {
    mockGetEpic.mockRejectedValue(new Error('not found'));
    await run(['view', 'epic-1']);
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
  });
});

describe('epic status', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls getEpic with the epic id', async () => {
    mockGetEpic.mockResolvedValue(EPIC);
    await run(['status', 'epic-1']);
    expect(mockGetEpic).toHaveBeenCalledWith('epic-1');
  });
});

describe('epic create', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls createEpic with project id and title', async () => {
    mockCreateEpic.mockResolvedValue(EPIC);
    await run(['create', 'proj-1', '--title', 'My Epic']);
    expect(mockCreateEpic).toHaveBeenCalledWith('proj-1', { title: 'My Epic', description: undefined });
  });

  it('passes description when provided', async () => {
    mockCreateEpic.mockResolvedValue(EPIC);
    await run(['create', 'proj-1', '--title', 'My Epic', '--description', 'details']);
    expect(mockCreateEpic).toHaveBeenCalledWith('proj-1', { title: 'My Epic', description: 'details' });
  });

  it('sets exitCode on error', async () => {
    mockCreateEpic.mockRejectedValue(new Error('server error'));
    await run(['create', 'proj-1', '--title', 'Bad Epic']);
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
  });
});
