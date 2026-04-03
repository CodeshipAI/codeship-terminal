import { Command } from 'commander';
import * as readline from 'node:readline';
import { getApiClient } from '../lib/api-client.js';

// --- Helpers ---

function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

function promptSecret(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    process.stdout.write(question);
    // Disable echo by writing directly to stdout and not echoing input
    let value = '';
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    const onData = (char: string) => {
      if (char === '\r' || char === '\n') {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', onData);
        rl.close();
        process.stdout.write('\n');
        resolve(value);
      } else if (char === '\u0003') {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', onData);
        rl.close();
        process.exit(1);
      } else if (char === '\u007f') {
        value = value.slice(0, -1);
        process.stdout.write('\b \b');
      } else {
        value += char;
        process.stdout.write('*');
      }
    };
    process.stdin.on('data', onData);
  });
}

function parseKeyValuePairs(input: string): Record<string, string> {
  if (!input) return {};
  const result: Record<string, string> = {};
  for (const pair of input.split(',')) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx > 0) {
      const k = pair.slice(0, eqIdx).trim();
      const v = pair.slice(eqIdx + 1).trim();
      if (k) result[k] = v;
    }
  }
  return result;
}

function printTable(rows: string[][], headers: string[]): void {
  const colWidths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)),
  );

  const separator = colWidths.map((w) => '-'.repeat(w + 2)).join('+');
  const headerRow =
    '| ' + headers.map((h, i) => h.padEnd(colWidths[i])).join(' | ') + ' |';

  console.log(separator);
  console.log(headerRow);
  console.log(separator);
  for (const row of rows) {
    const line =
      '| ' + row.map((cell, i) => (cell ?? '').padEnd(colWidths[i])).join(' | ') + ' |';
    console.log(line);
  }
  console.log(separator);
}

// --- Templates ---

interface ConnectorTemplate {
  name: string;
  type: 'http' | 'stdio';
  description: string;
  defaultConfig: Record<string, unknown>;
}

const CONNECTOR_TEMPLATES: ConnectorTemplate[] = [
  {
    name: 'GitHub HTTP',
    type: 'http',
    description: 'GitHub MCP connector via HTTP',
    defaultConfig: { url: 'https://api.github.com/mcp', headers: {} },
  },
  {
    name: 'OpenAI HTTP',
    type: 'http',
    description: 'OpenAI MCP connector via HTTP',
    defaultConfig: { url: 'https://api.openai.com/mcp', headers: {} },
  },
  {
    name: 'Local stdio',
    type: 'stdio',
    description: 'Local process via stdio',
    defaultConfig: { command: '', env: {} },
  },
  {
    name: 'Custom HTTP',
    type: 'http',
    description: 'Custom HTTP MCP connector',
    defaultConfig: { url: '', headers: {} },
  },
];

// --- Commands ---

export const mcpCommand = new Command('mcp').description('Manage MCP connectors');

mcpCommand
  .command('list')
  .description('List MCP connectors for a project')
  .argument('<project-id>', 'Project ID')
  .action(async (projectId: string) => {
    const client = getApiClient();
    try {
      const connectors = await client.listConnectors(projectId);
      if (connectors.length === 0) {
        console.log('No connectors found for this project.');
        return;
      }
      const rows = connectors.map((c) => [c.name, c.type, c.enabled ? 'yes' : 'no']);
      printTable(rows, ['Name', 'Type', 'Enabled']);
    } catch (err) {
      console.error('Error listing connectors:', (err as Error).message);
      process.exit(1);
    }
  });

mcpCommand
  .command('add')
  .description('Add a new MCP connector')
  .argument('<project-id>', 'Project ID')
  .option('--template', 'Choose from available templates')
  .action(async (projectId: string, opts: { template?: boolean }) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    try {
      let type: 'http' | 'stdio';
      let name: string;
      let config: Record<string, unknown> = {};

      if (opts.template) {
        // Show template selection
        console.log('\nAvailable templates:');
        CONNECTOR_TEMPLATES.forEach((t, i) => {
          console.log(`  ${i + 1}. [${t.type}] ${t.name} - ${t.description}`);
        });
        const choice = await prompt(rl, '\nSelect template number: ');
        const idx = parseInt(choice, 10) - 1;
        if (isNaN(idx) || idx < 0 || idx >= CONNECTOR_TEMPLATES.length) {
          console.error('Invalid selection.');
          rl.close();
          process.exit(1);
        }
        const tpl = CONNECTOR_TEMPLATES[idx];
        type = tpl.type;
        config = { ...tpl.defaultConfig };
        console.log(`\nUsing template: ${tpl.name}`);
      } else {
        // Interactive type selection
        console.log('\nConnector type:');
        console.log('  1. http');
        console.log('  2. stdio');
        const typeChoice = await prompt(rl, 'Select type [1/2]: ');
        if (typeChoice === '1') {
          type = 'http';
        } else if (typeChoice === '2') {
          type = 'stdio';
        } else {
          console.error('Invalid type selection.');
          rl.close();
          process.exit(1);
        }
      }

      name = await prompt(rl, 'Connector name: ');
      if (!name) {
        console.error('Name is required.');
        rl.close();
        process.exit(1);
      }

      if (type === 'http') {
        const url = await prompt(rl, 'URL: ');
        config.url = url;

        const addHeaders = await prompt(rl, 'Add headers? [y/N]: ');
        if (addHeaders.toLowerCase() === 'y') {
          rl.close();
          const headersInput = await promptSecret('Headers (key=value,key2=value2): ');
          config.headers = parseKeyValuePairs(headersInput);
          // Reopen rl is not needed — we're done collecting input
          const client = getApiClient();
          const connector = await client.addConnector(projectId, { name, type, config });
          console.log(`\nConnector "${connector.name}" added (id: ${connector.id})`);
          return;
        }
      } else {
        const command = await prompt(rl, 'Command: ');
        config.command = command;

        const addEnv = await prompt(rl, 'Add environment variables? [y/N]: ');
        if (addEnv.toLowerCase() === 'y') {
          rl.close();
          const envInput = await promptSecret('Env vars (KEY=value,KEY2=value2): ');
          config.env = parseKeyValuePairs(envInput);
          const client = getApiClient();
          const connector = await client.addConnector(projectId, { name, type, config });
          console.log(`\nConnector "${connector.name}" added (id: ${connector.id})`);
          return;
        }
      }

      rl.close();
      const client = getApiClient();
      const connector = await client.addConnector(projectId, { name, type, config });
      console.log(`\nConnector "${connector.name}" added (id: ${connector.id})`);
    } catch (err) {
      rl.close();
      console.error('Error adding connector:', (err as Error).message);
      process.exit(1);
    }
  });

mcpCommand
  .command('remove')
  .description('Remove an MCP connector')
  .argument('<project-id>', 'Project ID')
  .argument('<connector-id>', 'Connector ID')
  .action(async (projectId: string, connectorId: string) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      const answer = await prompt(
        rl,
        `Remove connector "${connectorId}" from project "${projectId}"? [y/N]: `,
      );
      rl.close();
      if (answer.toLowerCase() !== 'y') {
        console.log('Cancelled.');
        return;
      }
      const client = getApiClient();
      await client.removeConnector(connectorId);
      console.log('Connector removed.');
    } catch (err) {
      rl.close();
      console.error('Error removing connector:', (err as Error).message);
      process.exit(1);
    }
  });

mcpCommand
  .command('toggle')
  .description('Enable or disable an MCP connector')
  .argument('<project-id>', 'Project ID')
  .argument('<connector-id>', 'Connector ID')
  .action(async (projectId: string, connectorId: string) => {
    const client = getApiClient();
    try {
      // Fetch current state to know what to toggle
      const connectors = await client.listConnectors(projectId);
      const connector = connectors.find((c) => c.id === connectorId);
      if (!connector) {
        console.error(`Connector "${connectorId}" not found in project "${projectId}".`);
        process.exit(1);
      }
      const newEnabled = !connector.enabled;
      const updated = await client.toggleConnector(connectorId, newEnabled);
      console.log(
        `Connector "${updated.name}" is now ${updated.enabled ? 'enabled' : 'disabled'}.`,
      );
    } catch (err) {
      console.error('Error toggling connector:', (err as Error).message);
      process.exit(1);
    }
  });

mcpCommand
  .command('update')
  .description('Update an MCP connector')
  .argument('<connector-id>', 'Connector ID')
  .action((connectorId: string) => {
    console.log(`mcp update ${connectorId} - not yet implemented`);
  });
