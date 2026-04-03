import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const CLI_PATH = resolve(import.meta.dirname, '../../dist/index.js');

function run(...args: string[]): string {
  return execFileSync('node', [CLI_PATH, ...args], {
    encoding: 'utf-8',
    timeout: 10_000,
  }).trim();
}

describe('ship CLI', () => {
  it('shows version with --version', () => {
    const output = run('--version');
    expect(output).toBe('0.1.0');
  });

  it('shows help with --help', () => {
    const output = run('--help');
    expect(output).toContain('ship');
    expect(output).toContain('Codeship CLI');
    expect(output).toContain('auth');
    expect(output).toContain('config');
    expect(output).toContain('project');
    expect(output).toContain('epic');
    expect(output).toContain('mcp');
  });

  it('shows auth subcommands', () => {
    const output = run('auth', '--help');
    expect(output).toContain('login');
    expect(output).toContain('logout');
    expect(output).toContain('status');
  });

  it('shows config subcommands', () => {
    const output = run('config', '--help');
    expect(output).toContain('set');
    expect(output).toContain('get');
    expect(output).toContain('reset');
  });

  it('shows project subcommands', () => {
    const output = run('project', '--help');
    expect(output).toContain('create');
    expect(output).toContain('list');
    expect(output).toContain('view');
    expect(output).toContain('import');
    expect(output).toContain('delete');
  });

  it('shows epic subcommands', () => {
    const output = run('epic', '--help');
    expect(output).toContain('create');
    expect(output).toContain('list');
    expect(output).toContain('view');
    expect(output).toContain('status');
  });

  it('shows mcp subcommands', () => {
    const output = run('mcp', '--help');
    expect(output).toContain('list');
    expect(output).toContain('add');
    expect(output).toContain('update');
    expect(output).toContain('remove');
    expect(output).toContain('toggle');
  });
});
