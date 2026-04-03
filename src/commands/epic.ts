import { Command } from 'commander';

export const epicCommand = new Command('epic')
  .description('Manage epics and sessions');

epicCommand
  .command('create')
  .description('Create a new epic')
  .argument('<project-id>', 'Project ID')
  .action((projectId: string) => {
    console.log(`epic create ${projectId} - not yet implemented`);
  });

epicCommand
  .command('list')
  .description('List epics for a project')
  .argument('<project-id>', 'Project ID')
  .action((projectId: string) => {
    console.log(`epic list ${projectId} - not yet implemented`);
  });

epicCommand
  .command('view')
  .description('View epic details')
  .argument('<epic-id>', 'Epic ID')
  .action((epicId: string) => {
    console.log(`epic view ${epicId} - not yet implemented`);
  });

epicCommand
  .command('status')
  .description('Show compact epic status')
  .argument('<epic-id>', 'Epic ID')
  .action((epicId: string) => {
    console.log(`epic status ${epicId} - not yet implemented`);
  });
