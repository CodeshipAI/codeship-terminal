import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import open from 'open';
import { startCallbackServer } from '../lib/oauth-server.js';
import { generatePKCE, buildAuthorizationUrl, exchangeCodeForToken } from '../lib/oauth.js';
import { setToken, clearToken, isAuthenticated, getToken } from '../lib/auth-store.js';
import { loadConfig } from '../lib/config.js';

const LOGIN_TIMEOUT_MS = 120_000;

export const authCommand = new Command('auth')
  .description('Authenticate with Codeship');

authCommand
  .command('login')
  .description('Log in to Codeship via OAuth browser flow')
  .option('--no-browser', 'Print the URL instead of opening the browser')
  .option('--port <port>', 'Port for the local callback server', '9876')
  .action(async (options) => {
    const alreadyLoggedIn = await isAuthenticated();
    if (alreadyLoggedIn) {
      console.log(chalk.yellow('Already logged in. Run "ship auth logout" first to re-authenticate.'));
      return;
    }

    const port = parseInt(options.port, 10);
    const spinner = ora('Starting authentication...').start();

    let callbackServer;
    try {
      callbackServer = await startCallbackServer(port);
    } catch (err) {
      spinner.fail('Failed to start local callback server.');
      console.error(chalk.red(`Could not bind to port ${port}. Is another process using it?`));
      process.exitCode = 1;
      return;
    }

    const pkce = generatePKCE();
    const redirectUri = `http://127.0.0.1:${callbackServer.port}/callback`;
    const config = await loadConfig();

    const authUrl = buildAuthorizationUrl({
      redirectUri,
      codeChallenge: pkce.codeChallenge,
      state: pkce.state,
      apiUrl: config.apiUrl,
    });

    if (options.browser === false) {
      spinner.stop();
      console.log(`\nOpen this URL in your browser to authenticate:\n\n  ${chalk.cyan(authUrl)}\n`);
    } else {
      spinner.text = 'Opening browser for authentication...';
      await open(authUrl);
      spinner.text = 'Waiting for browser authentication...';
    }

    const timeout = setTimeout(() => {
      callbackServer.close();
      spinner.fail('Authentication timed out after 2 minutes.');
      process.exitCode = 1;
    }, LOGIN_TIMEOUT_MS);

    try {
      const result = await callbackServer.waitForCallback();

      if (result.state !== pkce.state) {
        throw new Error('OAuth state mismatch — possible CSRF attack.');
      }

      spinner.text = 'Exchanging code for token...';

      const tokenResponse = await exchangeCodeForToken({
        code: result.code,
        codeVerifier: pkce.codeVerifier,
        redirectUri,
      });

      await setToken(tokenResponse.access_token);
      spinner.succeed(chalk.green('Successfully logged in to Codeship!'));
    } catch (err) {
      spinner.fail('Authentication failed.');
      console.error(chalk.red(err instanceof Error ? err.message : String(err)));
      process.exitCode = 1;
    } finally {
      clearTimeout(timeout);
      callbackServer.close();
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
