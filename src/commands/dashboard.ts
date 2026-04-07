import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getApiClient } from '../lib/api-client.js';

export const dashboardCommand = new Command('dashboard')
  .description('Show dashboard overview of commit, agent, and blocker stats')
  .option('--since <date>', 'Start date for stats (ISO 8601 or YYYY-MM-DD)')
  .option('--json', 'Output as JSON')
  .action(async (opts: { since?: string; json?: boolean }) => {
    const since = opts.since ?? defaultSince();
    const spinner = ora('Fetching dashboard stats...').start();
    try {
      const client = getApiClient();
      const stats = await client.getDashboardStats(since);
      spinner.stop();

      if (opts.json) {
        console.log(JSON.stringify({ since, ...stats }, null, 2));
        return;
      }

      const efficiency =
        stats.storiesTotal > 0
          ? Math.round((stats.storiesCompleted / stats.storiesTotal) * 100)
          : 0;

      console.log(chalk.bold('Dashboard Overview') + chalk.dim(`  (since ${since})`));
      console.log();

      console.log(chalk.bold.underline('Commits'));
      console.log(`  Stories completed  ${chalk.cyan(stats.storiesCompleted)}`);
      console.log(`  Stories total      ${chalk.cyan(stats.storiesTotal)}`);
      console.log();

      console.log(chalk.bold.underline('Agents'));
      console.log(`  Active sessions    ${chalk.cyan(stats.activeSessions)}`);
      console.log(`  Total agents       ${chalk.cyan(stats.totalAgents)}`);
      console.log(`  Efficiency         ${chalk.cyan(efficiency + '%')}`);
      console.log();

      console.log(chalk.bold.underline('Blockers'));
      const escalationColor = stats.pendingEscalations > 0 ? chalk.yellow : chalk.green;
      console.log(`  Pending escalations  ${escalationColor(stats.pendingEscalations)}`);
    } catch (err) {
      spinner.fail('Failed to fetch dashboard stats.');
      console.error(chalk.red(String(err)));
      process.exitCode = 1;
    }
  });

function defaultSince(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}
