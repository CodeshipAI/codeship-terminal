import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getApiClient, type Epic } from '../lib/api-client.js';

export const epicCommand = new Command('epic')
  .description('Manage epics and sessions');

epicCommand
  .command('list')
  .description('List epics for a project')
  .argument('<project-id>', 'Project ID')
  .action(async (projectId: string) => {
    const spinner = ora('Fetching epics...').start();
    try {
      const client = getApiClient();
      const epics = await client.listEpics(projectId);
      spinner.stop();
      if (epics.length === 0) {
        console.log(chalk.dim('No epics found for this project.'));
        return;
      }
      console.log(chalk.bold(`Epics for project ${projectId}:`));
      for (const epic of epics) {
        const statusColor = epic.status === 'active' ? chalk.green : chalk.dim;
        console.log(`  ${chalk.cyan(epic.id)}  ${epic.title}  ${statusColor(`[${epic.status}]`)}`);
      }
    } catch (err) {
      spinner.fail('Failed to fetch epics.');
      console.error(chalk.red(String(err)));
      process.exitCode = 1;
    }
  });

epicCommand
  .command('create')
  .description('Create a new epic')
  .argument('<project-id>', 'Project ID')
  .requiredOption('--title <title>', 'Epic title')
  .option('--description <description>', 'Epic description')
  .action(async (projectId: string, options: { title: string; description?: string }) => {
    const spinner = ora('Creating epic...').start();
    try {
      const client = getApiClient();
      const epic = await client.createEpic(projectId, {
        title: options.title,
        description: options.description,
      });
      spinner.succeed(`Epic created: ${chalk.cyan(epic.id)}`);
      printEpic(epic);
    } catch (err) {
      spinner.fail('Failed to create epic.');
      console.error(chalk.red(String(err)));
      process.exitCode = 1;
    }
  });

epicCommand
  .command('view')
  .description('View epic details')
  .argument('<epic-id>', 'Epic ID')
  .action(async (epicId: string) => {
    const spinner = ora('Fetching epic...').start();
    try {
      const client = getApiClient();
      const epic = await client.getEpic(epicId);
      spinner.stop();
      printEpic(epic);
    } catch (err) {
      spinner.fail('Failed to fetch epic.');
      console.error(chalk.red(String(err)));
      process.exitCode = 1;
    }
  });

epicCommand
  .command('status')
  .description('Show compact epic status')
  .argument('<epic-id>', 'Epic ID')
  .action(async (epicId: string) => {
    const spinner = ora('Fetching epic status...').start();
    try {
      const client = getApiClient();
      const epic = await client.getEpic(epicId);
      spinner.stop();
      const statusColor = epic.status === 'active' ? chalk.green : chalk.dim;
      console.log(`${chalk.cyan(epic.id)}  ${epic.title}  ${statusColor(epic.status)}`);
    } catch (err) {
      spinner.fail('Failed to fetch epic status.');
      console.error(chalk.red(String(err)));
      process.exitCode = 1;
    }
  });

function printEpic(epic: Epic): void {
  console.log(`  ${chalk.bold('ID:')}          ${epic.id}`);
  console.log(`  ${chalk.bold('Title:')}       ${epic.title}`);
  if (epic.description) {
    console.log(`  ${chalk.bold('Description:')} ${epic.description}`);
  }
  console.log(`  ${chalk.bold('Status:')}      ${epic.status}`);
  console.log(`  ${chalk.bold('Project:')}     ${epic.projectId}`);
  console.log(`  ${chalk.bold('Created:')}     ${epic.createdAt}`);
}
