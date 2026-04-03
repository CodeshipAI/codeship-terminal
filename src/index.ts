#!/usr/bin/env node

import { Command } from 'commander';
import { authCommand } from './commands/auth.js';
import { configCommand } from './commands/config.js';
import { projectCommand } from './commands/project.js';
import { epicCommand } from './commands/epic.js';
import { sessionsCommand } from './commands/sessions.js';
import { mcpCommand } from './commands/mcp.js';

const program = new Command();

program
  .name('ship')
  .description('Codeship CLI - manage projects, epics, and deployments from the terminal')
  .version('0.1.0');

program.addCommand(authCommand);
program.addCommand(configCommand);
program.addCommand(projectCommand);
program.addCommand(epicCommand);
program.addCommand(sessionsCommand);
program.addCommand(mcpCommand);

program.parse();
