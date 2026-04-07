import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
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
      console.log(chalk.bold(`Sessions for project ${projectId}:`));
      for (const epic of epics) {
        const statusColor = epic.status === 'active' || epic.status === 'running' ? chalk.green : chalk.dim;
        const title = epic.name ?? epic.title ?? 'Unnamed';
        const progress = epic.storyProgress ? ` (${epic.storyProgress.completed}/${epic.storyProgress.total} stories)` : '';
        console.log(`  ${chalk.cyan(epic.id)}  ${title}  ${statusColor(`[${epic.status}]`)}${progress}`);
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
  .option('--claude-credentials <path>', 'Path to Claude credentials JSON file (default: ~/claude-credentials.json)')
  .option('--no-claude-credentials', 'Skip Claude credential injection')
  .action(async (projectId: string, options: { title: string; description?: string; claudeCredentials?: string | false }) => {
    const spinner = ora('Creating epic...').start();
    try {
      let claudeCredentials: string | undefined;

      if (options.claudeCredentials !== false) {
        const credPath = typeof options.claudeCredentials === 'string'
          ? options.claudeCredentials
          : join(homedir(), 'claude-credentials.json');
        const isDefaultPath = typeof options.claudeCredentials !== 'string';
        try {
          const raw = await readFile(credPath, 'utf-8');
          // Validate it parses as JSON
          JSON.parse(raw);
          claudeCredentials = raw.trim();
          spinner.stop();
          console.log(chalk.blue(`ℹ  Injecting Claude credentials from ${credPath}`));
          spinner.start('Creating epic...');
        } catch (err: unknown) {
          if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
            // File doesn't exist — silently skip if using default path, error if explicit
            if (!isDefaultPath) {
              spinner.fail(`Claude credentials file not found: ${credPath}`);
              console.error(chalk.red(`File not found: ${credPath}`));
              process.exitCode = 1;
              return;
            }
          } else if (err instanceof SyntaxError) {
            spinner.fail('Claude credentials file is malformed JSON.');
            console.error(chalk.red(`Invalid JSON in credentials file: ${credPath}`));
            process.exitCode = 1;
            return;
          } else {
            spinner.fail('Failed to read Claude credentials file.');
            console.error(chalk.red(String(err)));
            process.exitCode = 1;
            return;
          }
        }
      }

      const client = getApiClient();
      const epic = await client.createEpic(projectId, {
        title: options.title,
        description: options.description,
        claudeCredentials,
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
      const statusColor = epic.status === 'active' || epic.status === 'running' ? chalk.green : chalk.dim;
      console.log(`${chalk.cyan(epic.id)}  ${epic.name ?? epic.title ?? 'Unnamed'}  ${statusColor(epic.status)}`);
    } catch (err) {
      spinner.fail('Failed to fetch epic status.');
      console.error(chalk.red(String(err)));
      process.exitCode = 1;
    }
  });

function printEpic(epic: Epic): void {
  console.log(`  ${chalk.bold('ID:')}          ${epic.id}`);
  console.log(`  ${chalk.bold('Name:')}        ${epic.name ?? epic.title ?? 'Unnamed'}`);
  if (epic.description) {
    console.log(`  ${chalk.bold('Description:')} ${epic.description}`);
  }
  console.log(`  ${chalk.bold('Status:')}      ${epic.status}`);
  console.log(`  ${chalk.bold('Project:')}     ${epic.projectId}`);
  if (epic.storyProgress) {
    console.log(`  ${chalk.bold('Stories:')}     ${epic.storyProgress.completed}/${epic.storyProgress.total}`);
  }
  if (epic.agentCount !== undefined) {
    console.log(`  ${chalk.bold('Agents:')}      ${epic.agentCount}`);
  }
  console.log(`  ${chalk.bold('Created:')}     ${epic.createdAt}`);
}
