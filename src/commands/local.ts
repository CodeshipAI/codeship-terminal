import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig, setConfigValue, resetConfig } from '../lib/config.js';

const DEFAULT_LOCAL_PORT = 3000;
const PRODUCTION_API_URL = 'https://api.codeship.tech';

function isLocalUrl(url: string): boolean {
  return url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1');
}

export const localCommand = new Command('local')
  .description('Manage local development mode');

localCommand
  .command('start')
  .description('Switch CLI to local development server')
  .option('-p, --port <port>', 'Local server port', String(DEFAULT_LOCAL_PORT))
  .action(async (options: { port: string }) => {
    const port = parseInt(options.port, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      console.error(chalk.red(`Invalid port: ${options.port}`));
      process.exitCode = 1;
      return;
    }
    const localUrl = `http://localhost:${port}`;
    await setConfigValue('api-url', localUrl);
    console.log(chalk.green(`Local development mode enabled.`));
    console.log(`  API URL: ${chalk.cyan(localUrl)}`);
    console.log(chalk.dim(`  Run ${chalk.cyan('ship local stop')} to switch back to production.`));
  });

localCommand
  .command('stop')
  .description('Switch CLI back to production API')
  .action(async () => {
    await resetConfig();
    console.log(chalk.green(`Local development mode disabled.`));
    console.log(`  API URL: ${chalk.cyan(PRODUCTION_API_URL)}`);
  });

localCommand
  .command('status')
  .description('Show current local development mode status')
  .action(async () => {
    const config = await loadConfig();
    const local = isLocalUrl(config.apiUrl);
    if (local) {
      console.log(`${chalk.bold('Mode:')}   ${chalk.green('local')}`);
      console.log(`${chalk.bold('API URL:')} ${chalk.cyan(config.apiUrl)}`);
    } else {
      console.log(`${chalk.bold('Mode:')}   ${chalk.dim('production')}`);
      console.log(`${chalk.bold('API URL:')} ${config.apiUrl}`);
    }
  });
