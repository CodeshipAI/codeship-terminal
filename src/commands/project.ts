import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import inquirer from 'inquirer';
import { getApiClient, AuthenticationError } from '../lib/api-client.js';
import { isAuthenticated } from '../lib/auth-store.js';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

async function requireAuth(): Promise<boolean> {
  if (!(await isAuthenticated())) {
    console.error(chalk.red('Not authenticated. Run `ship auth login` to log in.'));
    return false;
  }
  return true;
}

function handleError(err: unknown): void {
  if (err instanceof AuthenticationError) {
    console.error(chalk.red('Not authenticated. Run `ship auth login` to log in.'));
  } else if (err instanceof Error) {
    console.error(chalk.red(`Error: ${err.message}`));
  } else {
    console.error(chalk.red('An unexpected error occurred.'));
  }
  process.exitCode = 1;
}

export const projectCommand = new Command('project')
  .description('Manage projects');

projectCommand
  .command('list')
  .description('List all projects')
  .option('--json', 'Output as JSON')
  .action(async (options: { json?: boolean }) => {
    if (!(await requireAuth())) return;
    try {
      const projects = await getApiClient().listProjects();
      if (projects.length === 0) {
        console.log(chalk.yellow('No projects found.'));
        return;
      }
      if (options.json) {
        console.log(JSON.stringify(projects, null, 2));
        return;
      }
      const table = new Table({
        head: [
          chalk.bold('ID'),
          chalk.bold('Name'),
          chalk.bold('Repo URL'),
          chalk.bold('Created'),
        ],
      });
      for (const p of projects) {
        table.push([p.id, p.name, p.repoUrl ?? '', formatDate(p.createdAt)]);
      }
      console.log(table.toString());
    } catch (err) {
      handleError(err);
    }
  });

projectCommand
  .command('create')
  .description('Create a new project')
  .option('--name <name>', 'Project name')
  .option('--repo <url>', 'GitHub repository URL')
  .option('--description <desc>', 'Project description')
  .action(async (options: { name?: string; repo?: string; description?: string }) => {
    if (!(await requireAuth())) return;
    try {
      let { name, repo, description } = options;

      // If flags not provided, fall back to interactive prompts
      if (!name || !repo) {
        const answers = await inquirer.prompt([
          ...(!name ? [{
            type: 'input' as const,
            name: 'name',
            message: 'Project name:',
            validate: (v: string) => v.trim().length > 0 || 'Name is required',
          }] : []),
          ...(!repo ? [{
            type: 'input' as const,
            name: 'repoUrl',
            message: 'GitHub repository URL:',
            validate: (v: string) => v.trim().length > 0 || 'Repository URL is required',
          }] : []),
          ...(!description ? [{
            type: 'input' as const,
            name: 'description',
            message: 'Description (optional):',
          }] : []),
        ]);
        name = name ?? answers.name;
        repo = repo ?? answers.repoUrl;
        description = description ?? answers.description;
      }

      const project = await getApiClient().createProject({
        name: name!.trim(),
        repoUrl: repo!.trim(),
        description: description?.trim() || undefined,
      });

      console.log(chalk.green(`\nProject created successfully!`));
      console.log(`  ID:   ${project.id}`);
      console.log(`  Name: ${project.name}`);
      console.log(`  Repo: ${project.repoUrl}`);
    } catch (err) {
      handleError(err);
    }
  });

projectCommand
  .command('import')
  .description('Import a project from a GitHub repository')
  .option('--repo <url>', 'GitHub repository URL')
  .action(async (options: { repo?: string }) => {
    if (!(await requireAuth())) return;
    try {
      let repoUrl = options.repo;

      if (!repoUrl) {
        const answers = await inquirer.prompt([{
          type: 'input',
          name: 'repoUrl',
          message: 'GitHub repository URL:',
          validate: (v: string) => v.trim().length > 0 || 'Repository URL is required',
        }]);
        repoUrl = answers.repoUrl;
      }

      const project = await getApiClient().importProject(repoUrl!.trim());

      console.log(chalk.green(`\nProject imported successfully!`));
      console.log(`  ID:   ${project.id}`);
      console.log(`  Name: ${project.name}`);
      console.log(`  Repo: ${project.repoUrl}`);
    } catch (err) {
      handleError(err);
    }
  });

projectCommand
  .command('view')
  .description('View project details')
  .argument('<id>', 'Project ID')
  .option('--json', 'Output as JSON')
  .action(async (id: string, options: { json?: boolean }) => {
    if (!(await requireAuth())) return;
    try {
      const project = await getApiClient().getProject(id);

      if (options.json) {
        console.log(JSON.stringify(project, null, 2));
        return;
      }

      console.log(chalk.bold(`\nProject: ${project.name}`));
      console.log(`  ID:          ${project.id}`);
      console.log(`  Repo URL:    ${project.repoUrl}`);
      if (project.description) {
        console.log(`  Description: ${project.description}`);
      }
      console.log(`  Created:     ${formatDate(project.createdAt)}`);
      console.log(`  Updated:     ${formatDate(project.updatedAt)}`);
    } catch (err) {
      handleError(err);
    }
  });

projectCommand
  .command('delete')
  .description('Delete a project')
  .argument('<id>', 'Project ID')
  .option('--yes', 'Skip confirmation prompt')
  .action(async (id: string, options: { yes?: boolean }) => {
    if (!(await requireAuth())) return;
    try {
      if (!options.yes) {
        const { confirmed } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmed',
            message: `Are you sure you want to delete project ${chalk.red(id)}? This cannot be undone.`,
            default: false,
          },
        ]);

        if (!confirmed) {
          console.log(chalk.yellow('Deletion cancelled.'));
          return;
        }
      }

      await getApiClient().deleteProject(id);
      console.log(chalk.green(`Project ${id} deleted successfully.`));
    } catch (err) {
      handleError(err);
    }
  });
