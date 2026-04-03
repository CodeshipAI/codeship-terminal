import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockIsAuthenticated = vi.fn();
const mockListProjects = vi.fn();
const mockGetProject = vi.fn();
const mockCreateProject = vi.fn();
const mockImportProject = vi.fn();
const mockDeleteProject = vi.fn();
const mockPrompt = vi.fn();

vi.mock('../lib/auth-store.js', () => ({
  isAuthenticated: (...args: unknown[]) => mockIsAuthenticated(...args),
}));

vi.mock('../lib/api-client.js', () => ({
  getApiClient: () => ({
    listProjects: (...args: unknown[]) => mockListProjects(...args),
    getProject: (...args: unknown[]) => mockGetProject(...args),
    createProject: (...args: unknown[]) => mockCreateProject(...args),
    importProject: (...args: unknown[]) => mockImportProject(...args),
    deleteProject: (...args: unknown[]) => mockDeleteProject(...args),
  }),
  AuthenticationError: class AuthenticationError extends Error {
    status = 401;
    constructor(msg: string) {
      super(msg);
      this.name = 'AuthenticationError';
    }
  },
}));

vi.mock('inquirer', () => ({
  default: {
    prompt: (...args: unknown[]) => mockPrompt(...args),
  },
}));

import { projectCommand } from '../commands/project.js';

const sampleProject = {
  id: 'proj-1',
  name: 'My Project',
  repoUrl: 'https://github.com/org/repo',
  description: 'A test project',
  createdAt: '2026-01-15T10:00:00.000Z',
  updatedAt: '2026-03-01T12:00:00.000Z',
};

async function runSubcommand(subcommand: string, ...args: string[]): Promise<void> {
  await projectCommand.parseAsync([subcommand, ...args], { from: 'user' });
}

describe('project commands', () => {
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

  describe('project list', () => {
    it('shows error when not authenticated', async () => {
      mockIsAuthenticated.mockResolvedValue(false);
      await runSubcommand('list');
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('ship auth login'));
      expect(mockListProjects).not.toHaveBeenCalled();
    });

    it('shows message when no projects', async () => {
      mockIsAuthenticated.mockResolvedValue(true);
      mockListProjects.mockResolvedValue([]);
      await runSubcommand('list');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('No projects found'));
    });

    it('renders table with project data', async () => {
      mockIsAuthenticated.mockResolvedValue(true);
      mockListProjects.mockResolvedValue([sampleProject]);
      await runSubcommand('list');
      const allOutput = consoleLogSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('My Project');
      expect(allOutput).toContain('https://github.com/org/repo');
    });

    it('handles api errors gracefully', async () => {
      mockIsAuthenticated.mockResolvedValue(true);
      mockListProjects.mockRejectedValue(new Error('Network error'));
      await runSubcommand('list');
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Network error'));
      expect(process.exitCode).toBe(1);
    });
  });

  describe('project view', () => {
    it('shows error when not authenticated', async () => {
      mockIsAuthenticated.mockResolvedValue(false);
      await runSubcommand('view', 'proj-1');
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('ship auth login'));
    });

    it('displays project details', async () => {
      mockIsAuthenticated.mockResolvedValue(true);
      mockGetProject.mockResolvedValue(sampleProject);
      await runSubcommand('view', 'proj-1');
      const allOutput = consoleLogSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('My Project');
      expect(allOutput).toContain('proj-1');
      expect(allOutput).toContain('https://github.com/org/repo');
      expect(allOutput).toContain('A test project');
    });

    it('calls getProject with the provided id', async () => {
      mockIsAuthenticated.mockResolvedValue(true);
      mockGetProject.mockResolvedValue(sampleProject);
      await runSubcommand('view', 'proj-42');
      expect(mockGetProject).toHaveBeenCalledWith('proj-42');
    });
  });

  describe('project create', () => {
    it('shows error when not authenticated', async () => {
      mockIsAuthenticated.mockResolvedValue(false);
      await runSubcommand('create');
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('ship auth login'));
      expect(mockPrompt).not.toHaveBeenCalled();
    });

    it('creates project from prompt answers', async () => {
      mockIsAuthenticated.mockResolvedValue(true);
      mockPrompt.mockResolvedValue({
        name: 'New Project',
        repoUrl: 'https://github.com/org/new',
        description: 'My desc',
      });
      mockCreateProject.mockResolvedValue({ ...sampleProject, name: 'New Project' });

      await runSubcommand('create');

      expect(mockCreateProject).toHaveBeenCalledWith({
        name: 'New Project',
        repoUrl: 'https://github.com/org/new',
        description: 'My desc',
      });
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('created successfully'));
    });

    it('omits empty description', async () => {
      mockIsAuthenticated.mockResolvedValue(true);
      mockPrompt.mockResolvedValue({
        name: 'New Project',
        repoUrl: 'https://github.com/org/new',
        description: '',
      });
      mockCreateProject.mockResolvedValue(sampleProject);

      await runSubcommand('create');

      expect(mockCreateProject).toHaveBeenCalledWith({
        name: 'New Project',
        repoUrl: 'https://github.com/org/new',
        description: undefined,
      });
    });
  });

  describe('project import', () => {
    it('shows error when not authenticated', async () => {
      mockIsAuthenticated.mockResolvedValue(false);
      await runSubcommand('import');
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('ship auth login'));
      expect(mockPrompt).not.toHaveBeenCalled();
    });

    it('imports project from prompted URL', async () => {
      mockIsAuthenticated.mockResolvedValue(true);
      mockPrompt.mockResolvedValue({ repoUrl: 'https://github.com/org/repo' });
      mockImportProject.mockResolvedValue(sampleProject);

      await runSubcommand('import');

      expect(mockImportProject).toHaveBeenCalledWith('https://github.com/org/repo');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('imported successfully'));
    });
  });

  describe('project delete', () => {
    it('shows error when not authenticated', async () => {
      mockIsAuthenticated.mockResolvedValue(false);
      await runSubcommand('delete', 'proj-1');
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('ship auth login'));
      expect(mockPrompt).not.toHaveBeenCalled();
    });

    it('cancels when user does not confirm', async () => {
      mockIsAuthenticated.mockResolvedValue(true);
      mockPrompt.mockResolvedValue({ confirmed: false });

      await runSubcommand('delete', 'proj-1');

      expect(mockDeleteProject).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('cancelled'));
    });

    it('deletes project when confirmed', async () => {
      mockIsAuthenticated.mockResolvedValue(true);
      mockPrompt.mockResolvedValue({ confirmed: true });
      mockDeleteProject.mockResolvedValue(undefined);

      await runSubcommand('delete', 'proj-1');

      expect(mockDeleteProject).toHaveBeenCalledWith('proj-1');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('deleted successfully'));
    });
  });
});
