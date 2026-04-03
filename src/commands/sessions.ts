import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getApiClient, type Session } from '../lib/api-client.js';

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

function printSession(session: Session): void {
  console.log(`  ${chalk.bold('ID:')}      ${session.id}`);
  console.log(`  ${chalk.bold('Epic:')}    ${session.epicId}`);
  console.log(`  ${chalk.bold('Status:')}  ${session.status}`);
  console.log(`  ${chalk.bold('Created:')} ${session.createdAt}`);
  console.log(`  ${chalk.bold('Updated:')} ${session.updatedAt}`);
}
