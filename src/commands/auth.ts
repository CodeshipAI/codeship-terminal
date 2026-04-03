import { Command } from 'commander';

export const authCommand = new Command('auth')
  .description('Authenticate with Codeship');

authCommand
  .command('login')
  .description('Log in to Codeship via OAuth browser flow')
  .action(() => {
    console.log('auth login - not yet implemented');
  });

authCommand
  .command('logout')
  .description('Log out and clear stored credentials')
  .action(() => {
    console.log('auth logout - not yet implemented');
  });

authCommand
  .command('status')
  .description('Show current authentication status')
  .action(() => {
    console.log('auth status - not yet implemented');
  });
