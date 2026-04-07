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
        const typeColor = activityColor(entry.type);
        console.log(
          `  ${chalk.dim(entry.timestamp)}  ${typeColor(`[${entry.type}]`)}  ${entry.description}`,
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
      console.log(`  ${chalk.bold('Total cost:')}  ${chalk.cyan('$' + costs.totalCost.toFixed(4))}`);
      if (costs.breakdown.length > 0) {
        console.log();
        console.log(chalk.bold('  By agent:'));
        for (const item of costs.breakdown) {
          console.log(`    ${chalk.dim(item.agentId)}  ${chalk.cyan('$' + item.cost.toFixed(4))}`);
        }
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
  printSession(detail.session);
  console.log();
  console.log(chalk.bold(`Stories (${detail.stories.length}):`));
  for (const s of detail.stories) {
    const statusColor = s.status === 'completed' ? chalk.green : chalk.dim;
    console.log(`  ${chalk.cyan(s.id)}  ${statusColor(`[${s.status}]`)}  ${s.title}`);
  }
  console.log();
  console.log(chalk.bold(`Agents (${detail.agents.length}):`));
  for (const a of detail.agents) {
    const statusColor = a.status === 'active' ? chalk.green : chalk.dim;
    console.log(`  ${chalk.cyan(a.id)}  ${statusColor(`[${a.status}]`)}  ${a.name}  ${chalk.dim(a.role)}`);
  }
  if (detail.escalations.length > 0) {
    console.log();
    console.log(chalk.bold(`Escalations (${detail.escalations.length}):`));
    for (const e of detail.escalations) {
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
