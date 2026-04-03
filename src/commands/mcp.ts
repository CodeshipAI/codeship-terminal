import { Command } from 'commander';

export const mcpCommand = new Command('mcp')
  .description('Manage MCP connectors');

mcpCommand
  .command('list')
  .description('List MCP connectors for a project')
  .argument('<project-id>', 'Project ID')
  .action((projectId: string) => {
    console.log(`mcp list ${projectId} - not yet implemented`);
  });

mcpCommand
  .command('add')
  .description('Add a new MCP connector')
  .argument('<project-id>', 'Project ID')
  .action((projectId: string) => {
    console.log(`mcp add ${projectId} - not yet implemented`);
  });

mcpCommand
  .command('update')
  .description('Update an MCP connector')
  .argument('<connector-id>', 'Connector ID')
  .action((connectorId: string) => {
    console.log(`mcp update ${connectorId} - not yet implemented`);
  });

mcpCommand
  .command('remove')
  .description('Remove an MCP connector')
  .argument('<connector-id>', 'Connector ID')
  .action((connectorId: string) => {
    console.log(`mcp remove ${connectorId} - not yet implemented`);
  });

mcpCommand
  .command('toggle')
  .description('Enable or disable an MCP connector')
  .argument('<connector-id>', 'Connector ID')
  .action((connectorId: string) => {
    console.log(`mcp toggle ${connectorId} - not yet implemented`);
  });
