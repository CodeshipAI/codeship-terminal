import { describe, it, expect } from 'vitest';
import { generatePKCE, buildAuthorizationUrl } from '../lib/oauth.js';

describe('OAuth PKCE', () => {
  it('generates a code verifier of sufficient length', () => {
    const pkce = generatePKCE();
    expect(pkce.codeVerifier.length).toBeGreaterThanOrEqual(43);
  });

  it('generates a code challenge different from the verifier', () => {
    const pkce = generatePKCE();
    expect(pkce.codeChallenge).not.toBe(pkce.codeVerifier);
  });

  it('generates a unique state on each call', () => {
    const a = generatePKCE();
    const b = generatePKCE();
    expect(a.state).not.toBe(b.state);
  });

  it('generates base64url-safe strings', () => {
    const pkce = generatePKCE();
    const base64urlPattern = /^[A-Za-z0-9_-]+$/;
    expect(pkce.codeVerifier).toMatch(base64urlPattern);
    expect(pkce.codeChallenge).toMatch(base64urlPattern);
  });
});

describe('buildAuthorizationUrl', () => {
  it('builds a valid authorization URL with all required params', () => {
    const url = buildAuthorizationUrl({
      redirectUri: 'http://127.0.0.1:9876/callback',
      codeChallenge: 'test-challenge',
      state: 'test-state',
      apiUrl: 'https://api.codeship.ai',
    });

    const parsed = new URL(url);
    expect(parsed.origin).toBe('https://api.codeship.ai');
    expect(parsed.pathname).toBe('/oauth/authorize');
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('client_id')).toBe('codeship-cli');
    expect(parsed.searchParams.get('redirect_uri')).toBe('http://127.0.0.1:9876/callback');
    expect(parsed.searchParams.get('code_challenge')).toBe('test-challenge');
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
    expect(parsed.searchParams.get('state')).toBe('test-state');
    expect(parsed.searchParams.get('scope')).toBe('read write');
  });
});
