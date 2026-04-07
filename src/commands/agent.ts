import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getApiClient, type Agent, type AgentLog } from '../lib/api-client.js';

export const agentCommand = new Command('agent')
  .description('Manage agents');

agentCommand
  .command('list')
  .description('List agents for a session')
  .argument('<project-id>', 'Project ID')
  .argument('<session-id>', 'Session ID')
  .action(async (projectId: string, sessionId: string) => {
    const spinner = ora('Fetching agents...').start();
    try {
      const client = getApiClient();
      const agents = await client.listAgents(projectId, sessionId);
      spinner.stop();
      if (agents.length === 0) {
        console.log(chalk.dim('No agents found for this session.'));
        return;
      }
      console.log(chalk.bold(`Agents for session ${sessionId}:`));
      for (const agent of agents) {
        const statusColor = agent.status === 'active' ? chalk.green : chalk.dim;
        console.log(
          `  ${chalk.cyan(agent.id)}  ${chalk.yellow(agent.role)}  ${statusColor(`[${agent.status}]`)}  ${chalk.white(agent.name)}`,
        );
      }
    } catch (err) {
      spinner.fail('Failed to fetch agents.');
      console.error(chalk.red(String(err)));
      process.exitCode = 1;
    }
  });

agentCommand
  .command('view')
  .description('View agent details')
  .argument('<project-id>', 'Project ID')
  .argument('<session-id>', 'Session ID')
  .argument('<agent-id>', 'Agent ID')
  .action(async (projectId: string, sessionId: string, agentId: string) => {
    const spinner = ora('Fetching agent...').start();
    try {
      const client = getApiClient();
      const agent = await client.getAgent(projectId, sessionId, agentId);
      spinner.stop();
      printAgent(agent);
    } catch (err) {
      spinner.fail('Failed to fetch agent.');
      console.error(chalk.red(String(err)));
      process.exitCode = 1;
    }
  });

agentCommand
  .command('logs')
  .description('View logs for an agent')
  .argument('<project-id>', 'Project ID')
  .argument('<session-id>', 'Session ID')
  .argument('<agent-id>', 'Agent ID')
  .action(async (projectId: string, sessionId: string, agentId: string) => {
    const spinner = ora('Fetching agent logs...').start();
    try {
      const client = getApiClient();
      const logs = await client.getAgentLogs(projectId, sessionId, agentId);
      spinner.stop();
      if (logs.length === 0) {
        console.log(chalk.dim('No logs found for this agent.'));
        return;
      }
      for (const entry of logs) {
        printLogEntry(entry);
      }
    } catch (err) {
      spinner.fail('Failed to fetch agent logs.');
      console.error(chalk.red(String(err)));
      process.exitCode = 1;
    }
  });

function printAgent(agent: Agent): void {
  console.log(`  ${chalk.bold('ID:')}      ${agent.id}`);
  console.log(`  ${chalk.bold('Name:')}    ${agent.name}`);
  console.log(`  ${chalk.bold('Role:')}    ${agent.role}`);
  console.log(`  ${chalk.bold('Status:')}  ${agent.status}`);
  console.log(`  ${chalk.bold('Session:')} ${agent.sessionId}`);
  console.log(`  ${chalk.bold('Created:')} ${agent.createdAt}`);
  if (agent.updatedAt) {
    console.log(`  ${chalk.bold('Updated:')} ${agent.updatedAt}`);
  }
}

function printLogEntry(entry: AgentLog): void {
  const levelColor =
    entry.level === 'error'
      ? chalk.red
      : entry.level === 'warn'
        ? chalk.yellow
        : chalk.dim;
  console.log(
    `  ${chalk.dim(entry.timestamp)}  ${levelColor(`[${entry.level.toUpperCase()}]`)}  ${entry.message}`,
  );
}
