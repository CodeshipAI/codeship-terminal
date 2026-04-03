import { Command } from 'commander';
import chalk from 'chalk';
import {
  loadConfig,
  setConfigValue,
  getConfigValue,
  resetConfig,
  getConfigPath,
  isValidConfigKey,
  type ConfigKey,
} from '../lib/config.js';

export const configCommand = new Command('config')
  .description('Manage CLI configuration');

configCommand
  .command('set')
  .description('Set a configuration value')
  .argument('<key>', 'Configuration key (e.g. api-url)')
  .argument('<value>', 'Configuration value')
  .action(async (key: string, value: string) => {
    if (!isValidConfigKey(key)) {
      console.error(chalk.red(`Unknown config key: ${key}`));
      console.error(`Valid keys: api-url`);
      process.exitCode = 1;
      return;
    }
    await setConfigValue(key as ConfigKey, value);
    console.log(chalk.green(`Set ${key} = ${value}`));
  });

configCommand
  .command('get')
  .description('Show current configuration')
  .argument('[key]', 'Configuration key (omit to show all)')
  .action(async (key?: string) => {
    if (key) {
      if (!isValidConfigKey(key)) {
        console.error(chalk.red(`Unknown config key: ${key}`));
        process.exitCode = 1;
        return;
      }
      const value = await getConfigValue(key as ConfigKey);
      console.log(value ?? '');
    } else {
      const config = await loadConfig();
      console.log(chalk.bold('Current configuration:'));
      console.log(`  api-url: ${config.apiUrl}`);
      console.log(`  token:   ${config.token ? chalk.green('set') : chalk.dim('not set')}`);
      console.log(chalk.dim(`\n  Config file: ${getConfigPath()}`));
    }
  });

configCommand
  .command('reset')
  .description('Reset configuration to defaults')
  .action(async () => {
    await resetConfig();
    console.log(chalk.green('Configuration reset to defaults.'));
  });
