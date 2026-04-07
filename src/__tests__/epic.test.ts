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

const mockReadFile = vi.fn();
vi.mock('node:fs/promises', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
}));

import { epicCommand } from '../commands/epic.js';

// Reset Commander option state between tests to avoid cross-test pollution
function resetCommandOptions(cmd: import('commander').Command): void {
  // @ts-expect-error accessing internal state
  cmd._optionValues = {};
  // @ts-expect-error accessing internal state
  cmd._optionValueSources = {};
  for (const sub of cmd.commands) {
    resetCommandOptions(sub);
  }
}

async function run(argv: string[]): Promise<void> {
  resetCommandOptions(epicCommand);
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

const CREDS_JSON = JSON.stringify({ credentials: { claudeAiOauth: { token: 'tok' } }, oauthAccount: { id: 'acct-1' } });

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
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: credentials file does not exist
    const notFound = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    mockReadFile.mockRejectedValue(notFound);
  });

  it('calls createEpic with project id and title (no credentials file)', async () => {
    mockCreateEpic.mockResolvedValue(EPIC);
    await run(['create', 'proj-1', '--title', 'My Epic']);
    expect(mockCreateEpic).toHaveBeenCalledWith('proj-1', { title: 'My Epic', description: undefined, claudeCredentials: undefined });
  });

  it('passes description when provided', async () => {
    mockCreateEpic.mockResolvedValue(EPIC);
    await run(['create', 'proj-1', '--title', 'My Epic', '--description', 'details']);
    expect(mockCreateEpic).toHaveBeenCalledWith('proj-1', { title: 'My Epic', description: 'details', claudeCredentials: undefined });
  });

  it('injects credentials from default file when it exists', async () => {
    mockReadFile.mockResolvedValue(CREDS_JSON);
    mockCreateEpic.mockResolvedValue(EPIC);
    await run(['create', 'proj-1', '--title', 'My Epic']);
    expect(mockCreateEpic).toHaveBeenCalledWith('proj-1', {
      title: 'My Epic',
      description: undefined,
      claudeCredentials: CREDS_JSON,
    });
  });

  it('injects credentials from explicit --claude-credentials path', async () => {
    mockReadFile.mockResolvedValue(CREDS_JSON);
    mockCreateEpic.mockResolvedValue(EPIC);
    await run(['create', 'proj-1', '--title', 'My Epic', '--claude-credentials', '/tmp/my-creds.json']);
    expect(mockReadFile).toHaveBeenCalledWith('/tmp/my-creds.json', 'utf-8');
    expect(mockCreateEpic).toHaveBeenCalledWith('proj-1', {
      title: 'My Epic',
      description: undefined,
      claudeCredentials: CREDS_JSON,
    });
  });

  it('shows info message when credentials are injected', async () => {
    mockReadFile.mockResolvedValue(CREDS_JSON);
    mockCreateEpic.mockResolvedValue(EPIC);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await run(['create', 'proj-1', '--title', 'My Epic', '--claude-credentials', '/tmp/my-creds.json']);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Injecting Claude credentials'));
    spy.mockRestore();
  });

  it('skips injection with --no-claude-credentials', async () => {
    mockCreateEpic.mockResolvedValue(EPIC);
    await run(['create', 'proj-1', '--title', 'My Epic', '--no-claude-credentials']);
    expect(mockReadFile).not.toHaveBeenCalled();
    expect(mockCreateEpic).toHaveBeenCalledWith('proj-1', {
      title: 'My Epic',
      description: undefined,
      claudeCredentials: undefined,
    });
  });

  it('sets exitCode and errors on malformed credentials JSON', async () => {
    mockReadFile.mockResolvedValue('not-valid-json{{{');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await run(['create', 'proj-1', '--title', 'My Epic', '--claude-credentials', '/tmp/bad.json']);
    expect(process.exitCode).toBe(1);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Invalid JSON'));
    process.exitCode = 0;
    spy.mockRestore();
  });

  it('sets exitCode when explicit credentials file is not found', async () => {
    const notFound = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    mockReadFile.mockRejectedValue(notFound);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await run(['create', 'proj-1', '--title', 'My Epic', '--claude-credentials', '/tmp/missing.json']);
    expect(process.exitCode).toBe(1);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('File not found'));
    process.exitCode = 0;
    spy.mockRestore();
  });

  it('sets exitCode on API error', async () => {
    mockCreateEpic.mockRejectedValue(new Error('server error'));
    await run(['create', 'proj-1', '--title', 'Bad Epic']);
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
  });
});
