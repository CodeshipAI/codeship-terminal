import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockListStories = vi.fn();
const mockCreateStory = vi.fn();
const mockUpdateStory = vi.fn();
const mockUpdateStoryStatus = vi.fn();
const mockDeleteStory = vi.fn();
const mockPrompt = vi.fn();

vi.mock('../lib/api-client.js', () => ({
  getApiClient: () => ({
    listStories: (...args: unknown[]) => mockListStories(...args),
    createStory: (...args: unknown[]) => mockCreateStory(...args),
    updateStory: (...args: unknown[]) => mockUpdateStory(...args),
    updateStoryStatus: (...args: unknown[]) => mockUpdateStoryStatus(...args),
    deleteStory: (...args: unknown[]) => mockDeleteStory(...args),
  }),
  AuthenticationError: class AuthenticationError extends Error {
    status = 401;
    constructor(msg: string) {
      super(msg);
      this.name = 'AuthenticationError';
    }
  },
  ApiError: class ApiError extends Error {
    constructor(
      public readonly status: number,
      public readonly statusText: string,
      public readonly body: string,
    ) {
      super(`API error ${status}: ${body || statusText}`);
      this.name = 'ApiError';
    }
  },
}));

vi.mock('inquirer', () => ({
  default: {
    prompt: (...args: unknown[]) => mockPrompt(...args),
  },
}));

import { createStoryCommand } from '../commands/story.js';

const sampleStory = {
  id: 'story-1',
  sessionId: 'sess-1',
  title: 'Implement login',
  description: 'Add OAuth login flow',
  status: 'in_progress',
  assignee: 'agent-1',
  complexity: 5,
  createdAt: '2026-01-15T10:00:00.000Z',
  updatedAt: '2026-03-01T12:00:00.000Z',
};

async function runSubcommand(subcommand: string, ...args: string[]): Promise<void> {
  const cmd = createStoryCommand();
  await cmd.parseAsync([subcommand, ...args], { from: 'user' });
}

describe('story commands', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    process.exitCode = 0;
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('story list', () => {
    it('shows message when no stories found', async () => {
      mockListStories.mockResolvedValue([]);
      await runSubcommand('list', 'p1', 's1');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('No stories found'));
    });

    it('renders table with story data', async () => {
      mockListStories.mockResolvedValue([sampleStory]);
      await runSubcommand('list', 'p1', 's1');
      const allOutput = consoleLogSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('Implement login');
      expect(allOutput).toContain('story-1');
    });

    it('filters by status', async () => {
      mockListStories.mockResolvedValue([
        sampleStory,
        { ...sampleStory, id: 'story-2', status: 'draft', title: 'Draft story' },
      ]);
      await runSubcommand('list', 'p1', 's1', '--status', 'draft');
      const allOutput = consoleLogSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('Draft story');
      expect(allOutput).not.toContain('Implement login');
    });

    it('outputs JSON with --json flag', async () => {
      mockListStories.mockResolvedValue([sampleStory]);
      await runSubcommand('list', '--json', 'p1', 's1');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('"id": "story-1"'));
    });

    it('handles API errors gracefully', async () => {
      mockListStories.mockRejectedValue(new Error('Network error'));
      await runSubcommand('list', 'p1', 's1');
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Network error'));
      expect(process.exitCode).toBe(1);
    });
  });

  describe('story create', () => {
    it('creates story with flags', async () => {
      mockCreateStory.mockResolvedValue(sampleStory);
      await runSubcommand('create', 'p1', 's1', '--title', 'Implement login');
      expect(mockCreateStory).toHaveBeenCalledWith('p1', 's1', {
        title: 'Implement login',
        description: undefined,
        complexity: undefined,
      });
    });

    it('prompts for title when not provided', async () => {
      mockPrompt.mockResolvedValue({ title: 'Prompted title', description: '', complexity: undefined });
      mockCreateStory.mockResolvedValue({ ...sampleStory, title: 'Prompted title' });
      await runSubcommand('create', 'p1', 's1');
      expect(mockPrompt).toHaveBeenCalled();
      expect(mockCreateStory).toHaveBeenCalledWith('p1', 's1', expect.objectContaining({ title: 'Prompted title' }));
    });
  });

  describe('story view', () => {
    it('displays story details', async () => {
      mockListStories.mockResolvedValue([sampleStory]);
      await runSubcommand('view', 'p1', 's1', 'story-1');
      const allOutput = consoleLogSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('Implement login');
      expect(allOutput).toContain('story-1');
      expect(allOutput).toContain('Add OAuth login flow');
    });

    it('shows error for non-existent story', async () => {
      mockListStories.mockResolvedValue([]);
      await runSubcommand('view', 'p1', 's1', 'no-such-story');
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('not found'));
      expect(process.exitCode).toBe(1);
    });

    it('outputs JSON with --json flag', async () => {
      mockListStories.mockResolvedValue([sampleStory]);
      await runSubcommand('view', 'p1', 's1', 'story-1', '--json');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('"id": "story-1"'));
    });
  });

  describe('story update', () => {
    it('updates story title', async () => {
      mockUpdateStory.mockResolvedValue({ ...sampleStory, title: 'New title' });
      await runSubcommand('update', 'p1', 's1', 'story-1', '--title', 'New title');
      expect(mockUpdateStory).toHaveBeenCalledWith('p1', 's1', 'story-1', { title: 'New title' });
    });

    it('shows error when no updates specified', async () => {
      await runSubcommand('update', 'p1', 's1', 'story-1');
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('No updates specified'));
      expect(process.exitCode).toBe(1);
    });
  });

  describe('story delete', () => {
    it('cancels when user does not confirm', async () => {
      mockPrompt.mockResolvedValue({ confirmed: false });
      await runSubcommand('delete', 'p1', 's1', 'story-1');
      expect(mockDeleteStory).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('cancelled'));
    });

    it('deletes when confirmed', async () => {
      mockPrompt.mockResolvedValue({ confirmed: true });
      mockDeleteStory.mockResolvedValue(undefined);
      await runSubcommand('delete', 'p1', 's1', 'story-1');
      expect(mockDeleteStory).toHaveBeenCalledWith('p1', 's1', 'story-1');
    });

    it('skips confirmation with --yes', async () => {
      mockDeleteStory.mockResolvedValue(undefined);
      await runSubcommand('delete', 'p1', 's1', 'story-1', '--yes');
      expect(mockPrompt).not.toHaveBeenCalled();
      expect(mockDeleteStory).toHaveBeenCalledWith('p1', 's1', 'story-1');
    });
  });

  describe('story move', () => {
    it('transitions story status', async () => {
      mockUpdateStoryStatus.mockResolvedValue({ ...sampleStory, status: 'review' });
      await runSubcommand('move', 'p1', 's1', 'story-1', '--status', 'review');
      expect(mockUpdateStoryStatus).toHaveBeenCalledWith('p1', 's1', 'story-1', 'review');
    });

    it('rejects invalid status', async () => {
      await runSubcommand('move', 'p1', 's1', 'story-1', '--status', 'invalid');
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid status'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Valid statuses'));
      expect(process.exitCode).toBe(1);
    });

    it('shows valid transitions on 409 error', async () => {
      const { ApiError } = await import('../lib/api-client.js');
      mockUpdateStoryStatus.mockRejectedValue(new ApiError(409, 'Conflict', 'Invalid transition'));
      await runSubcommand('move', 'p1', 's1', 'story-1', '--status', 'merged');
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Valid statuses'));
      expect(process.exitCode).toBe(1);
    });
  });
});
