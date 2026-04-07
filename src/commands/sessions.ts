import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getApiClient, type Session, type SessionDetail } from '../lib/api-client.js';

export const sessionsCommand = new Command('sessions')
  .description('Manage sessions');

sessionsCommand
  .command('list')
  .description('List sessions for an epic')
  .argument('<epic-id>', 'Epic ID')
  .action(async (epicId: string) => {
    const spinner = ora('Fetching sessions...').start();
    try {
      const client = getApiClient();
      const sessions = await client.listSessions(epicId);
      spinner.stop();
      if (sessions.length === 0) {
        console.log(chalk.dim('No sessions found for this epic.'));
        return;
      }
      console.log(chalk.bold(`Sessions for epic ${epicId}:`));
      for (const session of sessions) {
        const statusColor = session.status === 'active' ? chalk.green : chalk.dim;
        console.log(`  ${chalk.cyan(session.id)}  ${statusColor(`[${session.status}]`)}  ${chalk.dim(session.createdAt)}`);
      }
    } catch (err) {
      spinner.fail('Failed to fetch sessions.');
      console.error(chalk.red(String(err)));
      process.exitCode = 1;
    }
  });

sessionsCommand
  .command('view')
  .description('View session details')
  .argument('<session-id>', 'Session ID')
  .action(async (sessionId: string) => {
    const spinner = ora('Fetching session...').start();
    try {
      const client = getApiClient();
      const session = await client.getSession(sessionId);
      spinner.stop();
      printSession(session);
    } catch (err) {
      spinner.fail('Failed to fetch session.');
      console.error(chalk.red(String(err)));
      process.exitCode = 1;
    }
  });

sessionsCommand
  .command('activity')
  .description('Show activity feed for a session')
  .argument('<project-id>', 'Project ID')
  .argument('<session-id>', 'Session ID')
  .option('--limit <n>', 'Limit number of entries', parseInt)
  .action(async (projectId: string, sessionId: string, opts: { limit?: number }) => {
    const spinner = ora('Fetching activity...').start();
    try {
      const client = getApiClient();
      let entries = await client.getSessionActivity(projectId, sessionId);
      spinner.stop();
      if (opts.limit && opts.limit > 0) {
        entries = entries.slice(0, opts.limit);
      }
      if (entries.length === 0) {
        console.log(chalk.dim('No activity found for this session.'));
        return;
      }
      console.log(chalk.bold(`Activity for session ${sessionId}:`));
      for (const entry of entries) {
        // API may use eventType/message or type/description
        const raw = entry as unknown as Record<string, string>;
        const type = raw.eventType ?? raw.type ?? 'unknown';
        const desc = raw.message ?? raw.description ?? '';
        const typeColor = activityColor(type);
        console.log(
          `  ${chalk.dim(entry.timestamp)}  ${typeColor(`[${type}]`)}  ${desc}`,
        );
      }
    } catch (err) {
      spinner.fail('Failed to fetch activity.');
      console.error(chalk.red(String(err)));
      process.exitCode = 1;
    }
  });

sessionsCommand
  .command('costs')
  .description('Show token usage and cost breakdown for a session')
  .argument('<project-id>', 'Project ID')
  .argument('<session-id>', 'Session ID')
  .action(async (projectId: string, sessionId: string) => {
    const spinner = ora('Fetching costs...').start();
    try {
      const client = getApiClient();
      const costs = await client.getSessionCosts(projectId, sessionId);
      spinner.stop();
      console.log(chalk.bold(`Costs for session ${sessionId}:`));
      const raw = costs as unknown as Record<string, unknown>;
      const totalCost = (raw.totalCost ?? 0) as number;
      console.log(`  ${chalk.bold('Total cost:')}  ${chalk.cyan('$' + totalCost.toFixed(4))}`);
      const byAgent = (raw.byAgent ?? raw.breakdown ?? []) as { agentId?: string; cost?: number; name?: string }[];
      if (byAgent.length > 0) {
        console.log();
        console.log(chalk.bold('  By agent:'));
        for (const item of byAgent) {
          const label = item.agentId ?? item.name ?? 'unknown';
          const cost = item.cost ?? 0;
          console.log(`    ${chalk.dim(label)}  ${chalk.cyan('$' + cost.toFixed(4))}`);
        }
      }
      const totalTokens = ((raw.totalInputTokens ?? 0) as number) + ((raw.totalOutputTokens ?? 0) as number);
      if (totalTokens > 0) {
        console.log();
        console.log(`  ${chalk.bold('Input tokens:')}   ${raw.totalInputTokens}`);
        console.log(`  ${chalk.bold('Output tokens:')}  ${raw.totalOutputTokens}`);
        console.log(`  ${chalk.bold('Total requests:')} ${raw.totalRequests}`);
      }
    } catch (err) {
      spinner.fail('Failed to fetch costs.');
      console.error(chalk.red(String(err)));
      process.exitCode = 1;
    }
  });

sessionsCommand
  .command('poll')
  .description('Show full session state, optionally polling for updates')
  .argument('<project-id>', 'Project ID')
  .argument('<session-id>', 'Session ID')
  .option('--watch', 'Poll every 5 seconds for updates')
  .action(async (projectId: string, sessionId: string, opts: { watch?: boolean }) => {
    const spinner = ora('Fetching session state...').start();
    try {
      const client = getApiClient();

      if (!opts.watch) {
        const detail = await client.pollSession(projectId, sessionId);
        spinner.stop();
        printSessionDetail(detail);
        return;
      }

      // Watch mode with ETag support
      spinner.stop();
      console.log(chalk.dim('Watching session (Ctrl+C to stop)...'));
      let etag: string | undefined;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const result = await client.pollSessionEtag(projectId, sessionId, etag);
        if (result.data !== null) {
          etag = result.etag;
          console.clear();
          console.log(chalk.dim('Watching session (Ctrl+C to stop)...'));
          printSessionDetail(result.data);
        }
        await sleep(5000);
      }
    } catch (err) {
      spinner.fail('Failed to fetch session state.');
      console.error(chalk.red(String(err)));
      process.exitCode = 1;
    }
  });

function printSession(session: Session): void {
  console.log(`  ${chalk.bold('ID:')}      ${session.id}`);
  console.log(`  ${chalk.bold('Epic:')}    ${session.epicId}`);
  console.log(`  ${chalk.bold('Status:')}  ${session.status}`);
  console.log(`  ${chalk.bold('Created:')} ${session.createdAt}`);
  console.log(`  ${chalk.bold('Updated:')} ${session.updatedAt}`);
}

function printSessionDetail(detail: SessionDetail): void {
  // The API may return either { session, stories, agents, escalations } or a flat poll object
  const raw = detail as unknown as Record<string, unknown>;
  if (raw.session && typeof raw.session === 'object') {
    printSession(raw.session as Session);
  } else if (raw.status) {
    console.log(`  ${chalk.bold('Status:')}  ${raw.status}`);
  }

  const stories = (detail.stories ?? []) as { id: string; status: string; title: string }[];
  const agents = (detail.agents ?? []) as { id: string; status: string; name: string; role: string }[];
  const escalations = (detail.escalations ?? []) as { id: string; status: string; title: string }[];

  // Summary if present
  const summary = raw.summary as Record<string, unknown> | undefined;
  if (summary) {
    console.log();
    console.log(chalk.bold('Summary:'));
    console.log(`  Total stories:  ${summary.totalStories}`);
    console.log(`  Active agents:  ${summary.activeAgents}`);
    const cats = summary.storiesByCategory as Record<string, number> | undefined;
    if (cats) {
      const parts = Object.entries(cats).filter(([, v]) => v > 0).map(([k, v]) => `${k}: ${v}`);
      if (parts.length > 0) console.log(`  Categories:     ${parts.join(', ')}`);
    }
  }

  console.log();
  console.log(chalk.bold(`Stories (${stories.length}):`));
  for (const s of stories) {
    const statusColor = s.status === 'completed' || s.status === 'merged' ? chalk.green : chalk.dim;
    console.log(`  ${chalk.cyan(s.id)}  ${statusColor(`[${s.status}]`)}  ${s.title}`);
  }
  console.log();
  console.log(chalk.bold(`Agents (${agents.length}):`));
  for (const a of agents) {
    const statusColor = a.status === 'active' ? chalk.green : chalk.dim;
    console.log(`  ${chalk.cyan(a.id)}  ${statusColor(`[${a.status}]`)}  ${a.name}  ${chalk.dim(a.role)}`);
  }
  if (escalations.length > 0) {
    console.log();
    console.log(chalk.bold(`Escalations (${escalations.length}):`));
    for (const e of escalations) {
      const statusColor = e.status === 'pending' ? chalk.yellow : chalk.dim;
      console.log(`  ${chalk.cyan(e.id)}  ${statusColor(`[${e.status}]`)}  ${e.title}`);
    }
  }
}

function activityColor(type: string): typeof chalk {
  switch (type) {
    case 'error':
    case 'failed':
      return chalk.red;
    case 'warning':
      return chalk.yellow;
    case 'completed':
    case 'success':
      return chalk.green;
    case 'started':
    case 'in_progress':
      return chalk.cyan;
    default:
      return chalk.dim;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
