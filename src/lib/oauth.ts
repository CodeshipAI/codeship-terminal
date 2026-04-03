import { randomBytes, createHash } from 'node:crypto';
import { loadConfig } from './config.js';

export interface PKCEChallenge {
  codeVerifier: string;
  codeChallenge: string;
  state: string;
}

export function generatePKCE(): PKCEChallenge {
  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
  const state = randomBytes(16).toString('hex');

  return { codeVerifier, codeChallenge, state };
}

export function buildAuthorizationUrl(params: {
  redirectUri: string;
  codeChallenge: string;
  state: string;
  apiUrl: string;
}): string {
  const authUrl = new URL('/oauth/authorize', params.apiUrl);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', 'codeship-cli');
  authUrl.searchParams.set('redirect_uri', params.redirectUri);
  authUrl.searchParams.set('code_challenge', params.codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('state', params.state);
  authUrl.searchParams.set('scope', 'read write');
  return authUrl.toString();
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
}

export async function exchangeCodeForToken(params: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<TokenResponse> {
  const config = await loadConfig();
  const tokenUrl = new URL('/oauth/token', config.apiUrl);

  const response = await fetch(tokenUrl.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: 'codeship-cli',
      code: params.code,
      code_verifier: params.codeVerifier,
      redirect_uri: params.redirectUri,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Token exchange failed (${response.status}): ${text || response.statusText}`);
  }

  return response.json() as Promise<TokenResponse>;
}
