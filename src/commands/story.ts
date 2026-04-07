import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import inquirer from 'inquirer';
import ora from 'ora';
import { getApiClient, ApiError, AuthenticationError, type Story } from '../lib/api-client.js';

const VALID_STATUSES = [
  'draft',
  'estimated',
  'planned',
  'in_progress',
  'review',
  'qa',
  'pr_submitted',
  'merged',
] as const;

function statusColor(status: string): string {
  switch (status) {
    case 'merged':
      return chalk.green(status);
    case 'in_progress':
      return chalk.blue(status);
    case 'review':
    case 'qa':
    case 'pr_submitted':
      return chalk.yellow(status);
    case 'draft':
      return chalk.dim(status);
    default:
      return chalk.white(status);
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function handleError(err: unknown): void {
  if (err instanceof AuthenticationError) {
    console.error(chalk.red('Not authenticated. Run `ship auth login` to log in.'));
  } else if (err instanceof ApiError && err.status === 409) {
    console.error(chalk.red(`Conflict: ${err.body || err.message}`));
    console.error(chalk.yellow(`Valid statuses: ${VALID_STATUSES.join(' → ')}`));
  } else if (err instanceof Error) {
    console.error(chalk.red(`Error: ${err.message}`));
  } else {
    console.error(chalk.red('An unexpected error occurred.'));
  }
  process.exitCode = 1;
}

function printStory(story: Story): void {
  console.log(`  ${chalk.bold('ID:')}          ${story.id}`);
  console.log(`  ${chalk.bold('Title:')}       ${story.title}`);
  if (story.description) {
    console.log(`  ${chalk.bold('Description:')} ${story.description}`);
  }
  console.log(`  ${chalk.bold('Status:')}      ${statusColor(story.status)}`);
  if (story.assignee) {
    console.log(`  ${chalk.bold('Assignee:')}    ${story.assignee}`);
  }
  if (story.complexity !== undefined) {
    console.log(`  ${chalk.bold('Complexity:')}  ${story.complexity}`);
  }
  console.log(`  ${chalk.bold('Session:')}     ${story.sessionId}`);
  console.log(`  ${chalk.bold('Created:')}     ${formatDate(story.createdAt)}`);
  console.log(`  ${chalk.bold('Updated:')}     ${formatDate(story.updatedAt)}`);
}

export function createStoryCommand(): Command {
  const cmd = new Command('story')
    .description('Manage stories in a session');
  registerStorySubcommands(cmd);
  return cmd;
}

export const storyCommand = createStoryCommand();

function registerStorySubcommands(storyCmd: Command): void {

// --- list ---

storyCmd
  .command('list')
  .description('List stories in a session')
  .argument('<project-id>', 'Project ID')
  .argument('<session-id>', 'Session ID')
  .option('--status <status>', 'Filter by status')
  .option('--json', 'Output as JSON')
  .action(async (projectId: string, sessionId: string, options: { status?: string; json?: boolean }) => {
    const spinner = ora('Fetching stories...').start();
    try {
      const client = getApiClient();
      let stories = await client.listStories(projectId, sessionId);

      if (options.status) {
        stories = stories.filter((s) => s.status === options.status);
      }

      spinner.stop();

      if (stories.length === 0) {
        console.log(chalk.dim('No stories found.'));
        return;
      }

      if (options.json) {
        console.log(JSON.stringify(stories, null, 2));
        return;
      }

      const table = new Table({
        head: [
          chalk.bold('ID'),
          chalk.bold('Title'),
          chalk.bold('Status'),
          chalk.bold('Complexity'),
          chalk.bold('Assignee'),
        ],
      });

      for (const s of stories) {
        table.push([
          s.id,
          s.title,
          statusColor(s.status),
          s.complexity !== undefined ? String(s.complexity) : '',
          s.assignee ?? '',
        ]);
      }

      console.log(table.toString());
    } catch (err) {
      spinner.fail('Failed to fetch stories.');
      handleError(err);
    }
  });

// --- create ---

storyCmd
  .command('create')
  .description('Create a new story')
  .argument('<project-id>', 'Project ID')
  .argument('<session-id>', 'Session ID')
  .option('--title <title>', 'Story title')
  .option('--description <desc>', 'Story description')
  .option('--complexity <n>', 'Complexity points', parseInt)
  .action(async (projectId: string, sessionId: string, options: { title?: string; description?: string; complexity?: number }) => {
    try {
      let { title, description, complexity } = options;

      if (!title) {
        const answers = await inquirer.prompt([
          {
            type: 'input' as const,
            name: 'title',
            message: 'Story title:',
            validate: (v: string) => v.trim().length > 0 || 'Title is required',
          },
          ...(!description ? [{
            type: 'input' as const,
            name: 'description',
            message: 'Description (optional):',
          }] : []),
          ...(complexity === undefined ? [{
            type: 'number' as const,
            name: 'complexity',
            message: 'Complexity points (optional):',
          }] : []),
        ]);
        title = title ?? answers.title;
        description = description ?? answers.description;
        complexity = complexity ?? (answers.complexity || undefined);
      }

      const spinner = ora('Creating story...').start();
      const client = getApiClient();
      const story = await client.createStory(projectId, sessionId, {
        title: title!.trim(),
        description: description?.trim() || undefined,
        complexity,
      });
      spinner.succeed(`Story created: ${chalk.cyan(story.id)}`);
      printStory(story);
    } catch (err) {
      handleError(err);
    }
  });

// --- view ---

storyCmd
  .command('view')
  .description('View story details')
  .argument('<project-id>', 'Project ID')
  .argument('<session-id>', 'Session ID')
  .argument('<story-id>', 'Story ID')
  .option('--json', 'Output as JSON')
  .action(async (projectId: string, sessionId: string, storyId: string, options: { json?: boolean }) => {
    const spinner = ora('Fetching story...').start();
    try {
      const client = getApiClient();
      const stories = await client.listStories(projectId, sessionId);
      const story = stories.find((s) => s.id === storyId);
      spinner.stop();

      if (!story) {
        console.error(chalk.red(`Story ${storyId} not found.`));
        process.exitCode = 1;
        return;
      }

      if (options.json) {
        console.log(JSON.stringify(story, null, 2));
        return;
      }

      printStory(story);
    } catch (err) {
      spinner.fail('Failed to fetch story.');
      handleError(err);
    }
  });

// --- update ---

storyCmd
  .command('update')
  .description('Update a story')
  .argument('<project-id>', 'Project ID')
  .argument('<session-id>', 'Session ID')
  .argument('<story-id>', 'Story ID')
  .option('--title <title>', 'New title')
  .option('--description <desc>', 'New description')
  .option('--complexity <n>', 'New complexity', parseInt)
  .action(async (projectId: string, sessionId: string, storyId: string, options: { title?: string; description?: string; complexity?: number }) => {
    const updates: Record<string, unknown> = {};
    if (options.title !== undefined) updates.title = options.title;
    if (options.description !== undefined) updates.description = options.description;
    if (options.complexity !== undefined) updates.complexity = options.complexity;

    if (Object.keys(updates).length === 0) {
      console.error(chalk.yellow('No updates specified. Use --title, --description, or --complexity.'));
      process.exitCode = 1;
      return;
    }

    const spinner = ora('Updating story...').start();
    try {
      const client = getApiClient();
      const story = await client.updateStory(projectId, sessionId, storyId, updates as Partial<{ title: string; description: string; complexity: number }>);
      spinner.succeed('Story updated.');
      printStory(story);
    } catch (err) {
      spinner.fail('Failed to update story.');
      handleError(err);
    }
  });

// --- delete ---

storyCmd
  .command('delete')
  .description('Delete a story')
  .argument('<project-id>', 'Project ID')
  .argument('<session-id>', 'Session ID')
  .argument('<story-id>', 'Story ID')
  .option('--yes', 'Skip confirmation prompt')
  .action(async (projectId: string, sessionId: string, storyId: string, options: { yes?: boolean }) => {
    try {
      if (!options.yes) {
        const { confirmed } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmed',
            message: `Are you sure you want to delete story ${chalk.red(storyId)}? This cannot be undone.`,
            default: false,
          },
        ]);

        if (!confirmed) {
          console.log(chalk.yellow('Deletion cancelled.'));
          return;
        }
      }

      const spinner = ora('Deleting story...').start();
      const client = getApiClient();
      await client.deleteStory(projectId, sessionId, storyId);
      spinner.succeed(`Story ${storyId} deleted.`);
    } catch (err) {
      handleError(err);
    }
  });

// --- move ---

storyCmd
  .command('move')
  .description('Transition story status')
  .argument('<project-id>', 'Project ID')
  .argument('<session-id>', 'Session ID')
  .argument('<story-id>', 'Story ID')
  .requiredOption('--status <status>', 'Target status')
  .action(async (projectId: string, sessionId: string, storyId: string, options: { status: string }) => {
    if (!VALID_STATUSES.includes(options.status as typeof VALID_STATUSES[number])) {
      console.error(chalk.red(`Invalid status: ${options.status}`));
      console.error(chalk.yellow(`Valid statuses: ${VALID_STATUSES.join(' → ')}`));
      process.exitCode = 1;
      return;
    }

    const spinner = ora(`Moving story to ${options.status}...`).start();
    try {
      const client = getApiClient();
      const story = await client.updateStoryStatus(projectId, sessionId, storyId, options.status);
      spinner.succeed(`Story moved to ${statusColor(story.status)}.`);
    } catch (err) {
      spinner.fail('Failed to move story.');
      handleError(err);
    }
  });

} // end registerStorySubcommands
