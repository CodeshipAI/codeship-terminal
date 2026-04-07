import { createHash, randomBytes } from 'node:crypto';
import { loadConfig } from './config.js';

export interface PKCEParams {
  codeVerifier: string;
  codeChallenge: string;
  state: string;
}

function base64urlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function generatePKCE(): PKCEParams {
  const codeVerifier = base64urlEncode(randomBytes(48));
  const codeChallenge = base64urlEncode(createHash('sha256').update(codeVerifier).digest());
  const state = base64urlEncode(randomBytes(24));
  return { codeVerifier, codeChallenge, state };
}

export function buildAuthorizationUrl(params: {
  redirectUri: string;
  codeChallenge: string;
  state: string;
  apiUrl: string;
}): string {
  const url = new URL('/oauth/authorize', params.apiUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', 'codeship-cli');
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('code_challenge', params.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', params.state);
  url.searchParams.set('scope', 'read write');
  return url.toString();
}

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
