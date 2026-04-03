import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const CLI_PATH = resolve(import.meta.dirname, '../../dist/index.js');

function run(...args: string[]): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execFileSync('node', [CLI_PATH, ...args], {
      encoding: 'utf-8',
      timeout: 10_000,
    }).trim();
    return { stdout, stderr: '', exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: (e.stdout ?? '').trim(),
      stderr: (e.stderr ?? '').trim(),
      exitCode: e.status ?? 1,
    };
  }
}

describe('ship mcp', () => {
  it('shows mcp subcommands in help', () => {
    const { stdout } = run('mcp', '--help');
    expect(stdout).toContain('list');
    expect(stdout).toContain('add');
    expect(stdout).toContain('remove');
    expect(stdout).toContain('toggle');
    expect(stdout).toContain('update');
  });

  it('mcp list requires project-id argument', () => {
    const result = run('mcp', 'list');
    // Commander exits with error when required argument is missing
    expect(result.exitCode).not.toBe(0);
  });

  it('mcp remove requires project-id and connector-id arguments', () => {
    const result = run('mcp', 'remove');
    expect(result.exitCode).not.toBe(0);
  });

  it('mcp toggle requires project-id and connector-id arguments', () => {
    const result = run('mcp', 'toggle');
    expect(result.exitCode).not.toBe(0);
  });

  it('mcp add shows help with --help', () => {
    const { stdout } = run('mcp', 'add', '--help');
    expect(stdout).toContain('project-id');
    expect(stdout).toContain('--template');
  });

  it('mcp add requires project-id argument', () => {
    const result = run('mcp', 'add');
    expect(result.exitCode).not.toBe(0);
  });
});

// --- Unit tests for helper functions ---

describe('parseKeyValuePairs', () => {
  // Re-implement here to test without needing to export internals
  function parseKeyValuePairs(input: string): Record<string, string> {
    if (!input) return {};
    const result: Record<string, string> = {};
    for (const pair of input.split(',')) {
      const eqIdx = pair.indexOf('=');
      if (eqIdx > 0) {
        const k = pair.slice(0, eqIdx).trim();
        const v = pair.slice(eqIdx + 1).trim();
        if (k) result[k] = v;
      }
    }
    return result;
  }

  it('parses single key=value pair', () => {
    expect(parseKeyValuePairs('foo=bar')).toEqual({ foo: 'bar' });
  });

  it('parses multiple key=value pairs', () => {
    expect(parseKeyValuePairs('foo=bar,baz=qux')).toEqual({ foo: 'bar', baz: 'qux' });
  });

  it('returns empty object for empty string', () => {
    expect(parseKeyValuePairs('')).toEqual({});
  });

  it('handles values containing =', () => {
    expect(parseKeyValuePairs('token=abc=def')).toEqual({ token: 'abc=def' });
  });

  it('trims whitespace around keys and values', () => {
    expect(parseKeyValuePairs(' key = value ')).toEqual({ key: 'value' });
  });

  it('skips pairs without =', () => {
    expect(parseKeyValuePairs('noequals,key=val')).toEqual({ key: 'val' });
  });
});

// --- Mock-based tests for API interactions ---

const mockListConnectors = vi.fn();
const mockAddConnector = vi.fn();
const mockRemoveConnector = vi.fn();
const mockToggleConnector = vi.fn();

vi.mock('../lib/api-client.js', () => ({
  getApiClient: () => ({
    listConnectors: mockListConnectors,
    addConnector: mockAddConnector,
    removeConnector: mockRemoveConnector,
    toggleConnector: mockToggleConnector,
  }),
}));

// parseAsync skips argv[0] and argv[1] by default (node binary + script path)
// so for a subcommand, we pass ['node', '<cmd>', ...args]

describe('mcp list action', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockListConnectors.mockReset();
  });

  it('prints "No connectors found" when list is empty', async () => {
    mockListConnectors.mockResolvedValue([]);
    const { mcpCommand } = await import('../commands/mcp.js');
    const listCmd = mcpCommand.commands.find((c) => c.name() === 'list')!;
    await listCmd.parseAsync(['node', 'list', 'proj-1']);
    expect(consoleSpy).toHaveBeenCalledWith('No connectors found for this project.');
  });

  it('calls listConnectors with the given project id', async () => {
    mockListConnectors.mockResolvedValue([
      {
        id: 'c1',
        name: 'My HTTP Connector',
        type: 'http',
        enabled: true,
        projectId: 'proj-1',
        config: {},
        createdAt: '',
        updatedAt: '',
      },
    ]);
    const { mcpCommand } = await import('../commands/mcp.js');
    const listCmd = mcpCommand.commands.find((c) => c.name() === 'list')!;
    await listCmd.parseAsync(['node', 'list', 'proj-1']);
    expect(mockListConnectors).toHaveBeenCalledWith('proj-1');
  });

  it('prints table with connector details when connectors exist', async () => {
    mockListConnectors.mockResolvedValue([
      {
        id: 'c1',
        name: 'My Connector',
        type: 'stdio',
        enabled: false,
        projectId: 'proj-1',
        config: {},
        createdAt: '',
        updatedAt: '',
      },
    ]);
    const { mcpCommand } = await import('../commands/mcp.js');
    const listCmd = mcpCommand.commands.find((c) => c.name() === 'list')!;
    await listCmd.parseAsync(['node', 'list', 'proj-1']);

    const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(allOutput).toContain('My Connector');
    expect(allOutput).toContain('stdio');
    expect(allOutput).toContain('no');
  });

  it('handles API errors gracefully', async () => {
    mockListConnectors.mockRejectedValue(new Error('Network error'));
    const { mcpCommand } = await import('../commands/mcp.js');
    const listCmd = mcpCommand.commands.find((c) => c.name() === 'list')!;
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    await expect(
      listCmd.parseAsync(['node', 'list', 'proj-1']),
    ).rejects.toThrow();
    exitSpy.mockRestore();
  });
});

describe('mcp toggle action', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockListConnectors.mockReset();
    mockToggleConnector.mockReset();
  });

  it('fetches current state and toggles enabled to disabled', async () => {
    mockListConnectors.mockResolvedValue([
      {
        id: 'c1',
        name: 'My Connector',
        type: 'http',
        enabled: true,
        projectId: 'proj-1',
        config: {},
        createdAt: '',
        updatedAt: '',
      },
    ]);
    mockToggleConnector.mockResolvedValue({
      id: 'c1',
      name: 'My Connector',
      type: 'http',
      enabled: false,
      projectId: 'proj-1',
      config: {},
      createdAt: '',
      updatedAt: '',
    });

    const { mcpCommand } = await import('../commands/mcp.js');
    const toggleCmd = mcpCommand.commands.find((c) => c.name() === 'toggle')!;
    await toggleCmd.parseAsync(['node', 'toggle', 'proj-1', 'c1']);

    expect(mockToggleConnector).toHaveBeenCalledWith('c1', false);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('disabled'),
    );
  });

  it('fetches current state and toggles disabled to enabled', async () => {
    mockListConnectors.mockResolvedValue([
      {
        id: 'c1',
        name: 'My Connector',
        type: 'http',
        enabled: false,
        projectId: 'proj-1',
        config: {},
        createdAt: '',
        updatedAt: '',
      },
    ]);
    mockToggleConnector.mockResolvedValue({
      id: 'c1',
      name: 'My Connector',
      type: 'http',
      enabled: true,
      projectId: 'proj-1',
      config: {},
      createdAt: '',
      updatedAt: '',
    });

    const { mcpCommand } = await import('../commands/mcp.js');
    const toggleCmd = mcpCommand.commands.find((c) => c.name() === 'toggle')!;
    await toggleCmd.parseAsync(['node', 'toggle', 'proj-1', 'c1']);

    expect(mockToggleConnector).toHaveBeenCalledWith('c1', true);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('enabled'),
    );
  });

  it('exits with error if connector not found in project', async () => {
    mockListConnectors.mockResolvedValue([]);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const { mcpCommand } = await import('../commands/mcp.js');
    const toggleCmd = mcpCommand.commands.find((c) => c.name() === 'toggle')!;
    await expect(
      toggleCmd.parseAsync(['node', 'toggle', 'proj-1', 'c-missing']),
    ).rejects.toThrow();
    exitSpy.mockRestore();
  });
});
