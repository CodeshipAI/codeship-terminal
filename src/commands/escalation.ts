import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getApiClient, type Escalation } from '../lib/api-client.js';

export const escalationCommand = new Command('escalation')
  .description('Manage escalations for blocked agents');

escalationCommand
  .command('list')
  .description('List escalations for a session')
  .argument('<project-id>', 'Project ID')
  .argument('<session-id>', 'Session ID')
  .action(async (projectId: string, sessionId: string) => {
    const spinner = ora('Fetching escalations...').start();
    try {
      const client = getApiClient();
      const escalations = await client.listEscalations(projectId, sessionId);
      spinner.stop();
      if (escalations.length === 0) {
        console.log(chalk.dim('No escalations found for this session.'));
        return;
      }
      console.log(chalk.bold(`Escalations for session ${sessionId}:`));
      for (const escalation of escalations) {
        const statusColor = escalation.status === 'open' ? chalk.yellow : chalk.dim;
        console.log(
          `  ${chalk.cyan(escalation.id)}  ${escalation.title}  ${statusColor(`[${escalation.status}]`)}`,
        );
        if (escalation.agentId) {
          console.log(`    ${chalk.dim('Agent:')} ${escalation.agentId}`);
        }
      }
    } catch (err) {
      spinner.fail('Failed to fetch escalations.');
      console.error(chalk.red(String(err)));
      process.exitCode = 1;
    }
  });

escalationCommand
  .command('resolve')
  .description('Resolve an escalation')
  .argument('<project-id>', 'Project ID')
  .argument('<session-id>', 'Session ID')
  .argument('<escalation-id>', 'Escalation ID')
  .requiredOption('--resolution <resolution>', 'Resolution message')
  .action(async (projectId: string, sessionId: string, escalationId: string, options: { resolution: string }) => {
    const spinner = ora('Resolving escalation...').start();
    try {
      const client = getApiClient();
      const escalation = await client.resolveEscalation(projectId, sessionId, escalationId, options.resolution);
      spinner.succeed(`Escalation resolved: ${chalk.cyan(escalation.id)}`);
      printEscalation(escalation);
    } catch (err) {
      spinner.fail('Failed to resolve escalation.');
      console.error(chalk.red(String(err)));
      process.exitCode = 1;
    }
  });

function printEscalation(escalation: Escalation): void {
  console.log(`  ${chalk.bold('ID:')}          ${escalation.id}`);
  console.log(`  ${chalk.bold('Title:')}       ${escalation.title}`);
  if (escalation.description) {
    console.log(`  ${chalk.bold('Description:')} ${escalation.description}`);
  }
  console.log(`  ${chalk.bold('Status:')}      ${escalation.status}`);
  if (escalation.agentId) {
    console.log(`  ${chalk.bold('Agent:')}       ${escalation.agentId}`);
  }
  if (escalation.resolution) {
    console.log(`  ${chalk.bold('Resolution:')} ${escalation.resolution}`);
  }
  console.log(`  ${chalk.bold('Created:')}     ${escalation.createdAt}`);
}
