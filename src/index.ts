#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { authCommand } from './commands/auth.js';
import { configCommand } from './commands/config.js';
import { projectCommand } from './commands/project.js';
import { epicCommand } from './commands/epic.js';
import { sessionsCommand } from './commands/sessions.js';
import { mcpCommand } from './commands/mcp.js';

const LOGO = `
${chalk.bold.hex('#4F8EF7')(`    ██████╗ ██████╗ ██████╗ ███████╗███████╗██╗  ██╗██╗██████╗ `)}
${chalk.bold.hex('#5A96F8')(`   ██╔════╝██╔═══██╗██╔══██╗██╔════╝██╔════╝██║  ██║██║██╔══██╗`)}
${chalk.bold.hex('#6A9FF9')(`   ██║     ██║   ██║██║  ██║█████╗  ███████╗███████║██║██████╔╝`)}
${chalk.bold.hex('#7AA8FA')(`   ██║     ██║   ██║██║  ██║██╔══╝  ╚════██║██╔══██║██║██╔═══╝ `)}
${chalk.bold.hex('#8AB1FB')(`   ╚██████╗╚██████╔╝██████╔╝███████╗███████║██║  ██║██║██║     `)}
${chalk.bold.hex('#9ABAFC')(`    ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝╚══════╝╚═╝  ╚═╝╚═╝╚═╝     `)}

${chalk.hex('#6A9FF9')(`          ⛵  ~~~~~~~~~~~~~~~~~~~~~~~~~~~  ⛵`)}
${chalk.dim(`              Ship code. Not configs.`)}
`;

const WELCOME = `
  ${chalk.bold('Codeship')} is an AI-powered development platform that turns your
  ideas into production-ready code. Create projects, define epics,
  and let AI agents build, test, and deploy your software.

  ${chalk.bold.underline('Getting Started')}

  ${chalk.hex('#6A9FF9')('1.')} Authenticate with your Codeship account:

     ${chalk.cyan('$ ship auth login')}

     This opens your browser for OAuth sign-in (GitHub or Google).
     Once approved, your session is stored locally.

  ${chalk.hex('#6A9FF9')('2.')} Create or import a project:

     ${chalk.cyan('$ ship project create')}
     ${chalk.cyan('$ ship project import')}

  ${chalk.hex('#6A9FF9')('3.')} Start building:

     ${chalk.cyan('$ ship epic create <project-id>')}
     ${chalk.cyan('$ ship mcp add <project-id>')}

  Run ${chalk.cyan('ship <command> --help')} for details on any command.
`;

const program = new Command();

program
  .name('ship')
  .description('Codeship CLI - manage projects, epics, and deployments from the terminal')
  .version('0.1.0')
  .action(() => {
    console.log(LOGO);
    console.log(WELCOME);
    program.outputHelp();
  });

program.addCommand(authCommand);
program.addCommand(configCommand);
program.addCommand(projectCommand);
program.addCommand(epicCommand);
program.addCommand(sessionsCommand);
program.addCommand(mcpCommand);

program.parse();
