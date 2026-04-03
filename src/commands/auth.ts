import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import open from 'open';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { initiateCliAuth, waitForAuth } from '../lib/oauth.js';
import { setToken, clearToken, isAuthenticated, getToken } from '../lib/auth-store.js';

async function installClaudeSkill(): Promise<boolean> {
  const skillDir = path.join(os.homedir(), '.claude', 'skills', 'codeship');
  const skillPath = path.join(skillDir, 'SKILL.md');

  try {
    await fs.access(skillPath);
    return false; // already installed
  } catch {
    // skill doesn't exist yet — install it
  }

  const skillContent = `---
name: codeship
description: "Manage Codeship projects, epics, sessions, and MCP connectors via the ship CLI. Use when the user asks about their Codeship projects, wants to create/import projects, manage epics, or configure MCP connectors."
allowed-tools: Bash(ship *)
---

# Codeship CLI Skill

You have access to the \`ship\` CLI to manage Codeship projects and resources.

## Authentication

Check auth status first:
\`\`\`bash
ship auth status
\`\`\`

If not authenticated, instruct the user to run \`ship auth login\`.

## Commands Reference

### Projects
\`\`\`bash
ship project list                    # List all projects
ship project create                  # Interactive project creation
ship project import                  # Import from GitHub repo
ship project view <project-id>       # View project details
ship project delete <project-id>     # Delete a project
\`\`\`

### Epics
\`\`\`bash
ship epic list <project-id>                      # List epics
ship epic create <project-id>                     # Create an epic
ship epic view <project-id> <epic-id>             # View epic details + stories
ship epic start <project-id> <epic-id>            # Start an epic session
\`\`\`

### Sessions
\`\`\`bash
ship sessions list <epic-id>          # List sessions for an epic
ship sessions view <session-id>       # View session details
\`\`\`

### MCP Connectors
\`\`\`bash
ship mcp list <project-id>                           # List connectors
ship mcp add <project-id>                            # Add connector (interactive)
ship mcp add <project-id> --template                 # Add from template
ship mcp remove <project-id> <connector-id>          # Remove connector
ship mcp toggle <project-id> <connector-id>          # Enable/disable connector
\`\`\`

### Configuration
\`\`\`bash
ship config set api-url <url>         # Set API base URL
ship config get api-url               # Show current API URL
\`\`\`

## Guidelines

- Always check \`ship auth status\` before running other commands
- For interactive commands (create, import, add), inform the user that prompts will appear in the terminal
- Display command output directly to the user
- If a command fails with an auth error, tell the user to run \`ship auth login\`
`;

  try {
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(skillPath, skillContent, 'utf-8');
    return true;
  } catch {
    return false;
  }
}

export const authCommand = new Command('auth')
  .description('Authenticate with Codeship');

authCommand
  .command('login')
  .description('Log in to Codeship via OAuth browser flow')
  .option('--no-browser', 'Print the URL instead of opening the browser')
  .action(async (options) => {
    const alreadyLoggedIn = await isAuthenticated();
    if (alreadyLoggedIn) {
      console.log(chalk.yellow('Already logged in. Run "ship auth logout" first to re-authenticate.'));
      return;
    }

    const spinner = ora('Starting authentication...').start();

    let authData;
    try {
      authData = await initiateCliAuth();
    } catch (err) {
      spinner.fail('Failed to initiate authentication.');
      console.error(chalk.red(err instanceof Error ? err.message : String(err)));
      process.exitCode = 1;
      return;
    }

    if (options.browser === false) {
      spinner.stop();
      console.log(`\nOpen this URL in your browser to authenticate:\n\n  ${chalk.cyan(authData.authUrl)}\n`);
    } else {
      spinner.text = 'Opening browser for authentication...';
      await open(authData.authUrl);
      spinner.text = 'Waiting for browser authentication (polling)...';
    }

    try {
      const result = await waitForAuth(authData.state);

      if (!result.token) {
        throw new Error('No token received from server.');
      }

      await setToken(result.token);
      spinner.succeed(chalk.green('Successfully logged in to Codeship!'));

      if (result.user) {
        console.log(chalk.dim(`  Signed in as ${result.user.name} (${result.user.email})`));
      }

      const skillInstalled = await installClaudeSkill();
      if (skillInstalled) {
        console.log();
        console.log(chalk.cyan('  ✓ Claude Code skill installed'));
        console.log(chalk.dim('    All Claude agents can now use /codeship to manage your projects.'));
      }
    } catch (err) {
      spinner.fail('Authentication failed.');
      console.error(chalk.red(err instanceof Error ? err.message : String(err)));
      process.exitCode = 1;
    }
  });

authCommand
  .command('logout')
  .description('Log out and clear stored credentials')
  .action(async () => {
    const loggedIn = await isAuthenticated();
    if (!loggedIn) {
      console.log(chalk.yellow('Not currently logged in.'));
      return;
    }

    await clearToken();
    console.log(chalk.green('Logged out successfully.'));
  });

authCommand
  .command('status')
  .description('Show current authentication status')
  .action(async () => {
    const loggedIn = await isAuthenticated();
    if (loggedIn) {
      const token = await getToken();
      const masked = token ? `${token.slice(0, 8)}...${token.slice(-4)}` : '';
      console.log(chalk.green('Authenticated'));
      console.log(`  Token: ${masked}`);
    } else {
      console.log(chalk.yellow('Not authenticated. Run "ship auth login" to log in.'));
    }
  });
