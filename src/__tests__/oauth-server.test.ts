import { describe, it, expect, afterEach } from 'vitest';
import { startCallbackServer, type OAuthCallbackServer } from '../lib/oauth-server.js';

describe('OAuth callback server', () => {
  let server: OAuthCallbackServer | undefined;

  afterEach(() => {
    server?.close();
    server = undefined;
  });

  it('starts on the requested port', async () => {
    server = await startCallbackServer(0); // port 0 = random available
    expect(server.port).toBeGreaterThan(0);
  });

  it('resolves with code and state on successful callback', async () => {
    server = await startCallbackServer(0);

    const callbackPromise = server.waitForCallback();

    const res = await fetch(
      `http://127.0.0.1:${server.port}/callback?code=test-code&state=test-state`,
    );
    expect(res.status).toBe(200);

    const result = await callbackPromise;
    expect(result.code).toBe('test-code');
    expect(result.state).toBe('test-state');
  });

  it('returns success HTML page on valid callback', async () => {
    server = await startCallbackServer(0);

    // Consume the callback promise to avoid unhandled rejection
    server.waitForCallback().catch(() => {});

    const res = await fetch(
      `http://127.0.0.1:${server.port}/callback?code=abc&state=xyz`,
    );
    const html = await res.text();
    expect(html).toContain('Authenticated');
  });

  it('rejects on OAuth error response', async () => {
    server = await startCallbackServer(0);

    const callbackPromise = server.waitForCallback();
    // Attach catch immediately to prevent unhandled rejection
    const errorPromise = callbackPromise.catch((err: Error) => err);

    await fetch(
      `http://127.0.0.1:${server.port}/callback?error=access_denied`,
    );

    const err = await errorPromise;
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain('OAuth error: access_denied');
  });

  it('rejects when code or state is missing', async () => {
    server = await startCallbackServer(0);

    const callbackPromise = server.waitForCallback();
    // Attach catch immediately to prevent unhandled rejection
    const errorPromise = callbackPromise.catch((err: Error) => err);

    await fetch(`http://127.0.0.1:${server.port}/callback?code=abc`);

    const err = await errorPromise;
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain('Missing code or state');
  });

  it('returns 404 for non-callback paths', async () => {
    server = await startCallbackServer(0);

    const res = await fetch(`http://127.0.0.1:${server.port}/other`);
    expect(res.status).toBe(404);
  });
});
