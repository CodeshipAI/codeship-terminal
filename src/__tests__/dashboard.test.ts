import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetDashboardStats = vi.fn();

vi.mock('../lib/api-client.js', () => ({
  getApiClient: () => ({
    getDashboardStats: (...args: unknown[]) => mockGetDashboardStats(...args),
  }),
}));

import { dashboardCommand } from '../commands/dashboard.js';

async function run(argv: string[]): Promise<void> {
  await dashboardCommand.parseAsync(argv, { from: 'user' });
}

const STATS = {
  activeSessions: 3,
  totalAgents: 12,
  pendingEscalations: 2,
  storiesCompleted: 8,
  storiesTotal: 10,
};

describe('dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset Commander option state between test runs
    (dashboardCommand as unknown as { _optionValues: Record<string, unknown> })._optionValues = {};
  });

  it('calls getDashboardStats with a since date', async () => {
    mockGetDashboardStats.mockResolvedValue(STATS);
    await run([]);
    expect(mockGetDashboardStats).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
  });

  it('uses custom --since date when provided', async () => {
    mockGetDashboardStats.mockResolvedValue(STATS);
    await run(['--since', '2026-01-01']);
    expect(mockGetDashboardStats).toHaveBeenCalledWith('2026-01-01');
  });

  it('outputs JSON when --json flag is set', async () => {
    mockGetDashboardStats.mockResolvedValue(STATS);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await run(['--json']);
    const output = spy.mock.calls.map((c) => c[0]).join('\n');
    const parsed = JSON.parse(output);
    expect(parsed.totalAgents).toBe(12);
    expect(parsed.storiesCompleted).toBe(8);
    spy.mockRestore();
  });

  it('displays summary with agents and blockers sections', async () => {
    mockGetDashboardStats.mockResolvedValue(STATS);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await run([]);
    const output = spy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('Agents');
    expect(output).toContain('Blockers');
    spy.mockRestore();
  });

  it('sets exitCode on error', async () => {
    mockGetDashboardStats.mockRejectedValue(new Error('network error'));
    await run([]);
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
  });
});
