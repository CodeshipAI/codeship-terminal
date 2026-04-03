import { loadConfig } from './config.js';

export interface CliAuthInitResponse {
  authUrl: string;
  state: string;
}

export interface CliAuthPollResponse {
  status: 'pending' | 'complete' | 'error';
  token?: string;
  user?: {
    sub: string;
    email: string;
    name: string;
    avatarUrl?: string;
    provider: string;
  };
  error?: string;
}

export async function initiateCliAuth(): Promise<CliAuthInitResponse> {
  const config = await loadConfig();
  const url = new URL('/api/auth/cli/initiate', config.apiUrl);

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Failed to initiate auth (${response.status}): ${text || response.statusText}`);
  }

  return response.json() as Promise<CliAuthInitResponse>;
}

export async function pollForToken(state: string): Promise<CliAuthPollResponse> {
  const config = await loadConfig();
  const url = new URL(`/api/auth/cli/poll/${state}`, config.apiUrl);

  const response = await fetch(url.toString());

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Poll failed (${response.status}): ${text || response.statusText}`);
  }

  return response.json() as Promise<CliAuthPollResponse>;
}

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 120_000;

export async function waitForAuth(state: string): Promise<CliAuthPollResponse> {
  const start = Date.now();

  while (Date.now() - start < POLL_TIMEOUT_MS) {
    const result = await pollForToken(state);

    if (result.status === 'complete') {
      return result;
    }

    if (result.status === 'error') {
      throw new Error(`Authentication failed: ${result.error || 'unknown error'}`);
    }

    // status === 'pending', wait and retry
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error('Authentication timed out after 2 minutes.');
}
