import { Command } from 'commander';

export const projectCommand = new Command('project')
  .description('Manage projects');

projectCommand
  .command('create')
  .description('Create a new project')
  .action(() => {
    console.log('project create - not yet implemented');
  });

projectCommand
  .command('list')
  .description('List all projects')
  .action(() => {
    console.log('project list - not yet implemented');
  });

projectCommand
  .command('view')
  .description('View project details')
  .argument('<id>', 'Project ID')
  .action((id: string) => {
    console.log(`project view ${id} - not yet implemented`);
  });

projectCommand
  .command('import')
  .description('Import a project from a GitHub repo URL')
  .argument('<url>', 'GitHub repository URL')
  .action((url: string) => {
    console.log(`project import ${url} - not yet implemented`);
  });

projectCommand
  .command('delete')
  .description('Delete a project')
  .argument('<id>', 'Project ID')
  .action((id: string) => {
    console.log(`project delete ${id} - not yet implemented`);
  });
