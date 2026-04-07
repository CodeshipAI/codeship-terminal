import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getApiClient, type Message } from '../lib/api-client.js';

export const msgCommand = new Command('msg')
  .description('Send and receive messages with agents');

msgCommand
  .command('send')
  .description('Send a message to a session or agent')
  .argument('<project-id>', 'Project ID')
  .argument('<session-id>', 'Session ID')
  .requiredOption('--content <content>', 'Message content')
  .option('--agent-id <agent-id>', 'Target agent ID')
  .action(async (projectId: string, sessionId: string, options: { content: string; agentId?: string }) => {
    const spinner = ora('Sending message...').start();
    try {
      const client = getApiClient();
      const message = await client.sendMessage(projectId, sessionId, {
        content: options.content,
        agentId: options.agentId,
      });
      spinner.succeed(`Message sent: ${chalk.cyan(message.id)}`);
      printMessage(message);
    } catch (err) {
      spinner.fail('Failed to send message.');
      console.error(chalk.red(String(err)));
      process.exitCode = 1;
    }
  });

msgCommand
  .command('list')
  .description('List messages in a session')
  .argument('<project-id>', 'Project ID')
  .argument('<session-id>', 'Session ID')
  .option('--agent-id <agent-id>', 'Filter by agent ID')
  .action(async (projectId: string, sessionId: string, options: { agentId?: string }) => {
    const spinner = ora('Fetching messages...').start();
    try {
      const client = getApiClient();
      const messages = await client.listMessages(projectId, sessionId, options.agentId);
      spinner.stop();
      if (messages.length === 0) {
        console.log(chalk.dim('No messages found.'));
        return;
      }
      console.log(chalk.bold(`Messages for session ${sessionId}:`));
      for (const message of messages) {
        console.log(
          `  ${chalk.cyan(message.id)}  ${chalk.bold(message.sender)}  ${chalk.dim(message.createdAt)}`,
        );
        console.log(`    ${message.content}`);
      }
    } catch (err) {
      spinner.fail('Failed to fetch messages.');
      console.error(chalk.red(String(err)));
      process.exitCode = 1;
    }
  });

msgCommand
  .command('read')
  .description('Read a specific message')
  .argument('<project-id>', 'Project ID')
  .argument('<session-id>', 'Session ID')
  .argument('<message-id>', 'Message ID')
  .action(async (projectId: string, sessionId: string, messageId: string) => {
    const spinner = ora('Fetching message...').start();
    try {
      const client = getApiClient();
      const message = await client.getMessage(projectId, sessionId, messageId);
      spinner.stop();
      printMessage(message);
    } catch (err) {
      spinner.fail('Failed to fetch message.');
      console.error(chalk.red(String(err)));
      process.exitCode = 1;
    }
  });

function printMessage(message: Message): void {
  console.log(`  ${chalk.bold('ID:')}      ${message.id}`);
  console.log(`  ${chalk.bold('Session:')} ${message.sessionId}`);
  console.log(`  ${chalk.bold('Sender:')}  ${message.sender}`);
  if (message.agentId) {
    console.log(`  ${chalk.bold('Agent:')}   ${message.agentId}`);
  }
  console.log(`  ${chalk.bold('Content:')} ${message.content}`);
  console.log(`  ${chalk.bold('Created:')} ${message.createdAt}`);
}
