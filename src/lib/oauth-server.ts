import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';

export interface CallbackResult {
  code: string;
  state: string;
}

export interface OAuthCallbackServer {
  port: number;
  server: Server;
  waitForCallback(): Promise<CallbackResult>;
  close(): void;
}

const SUCCESS_HTML = `<!DOCTYPE html>
<html><head><title>Codeship CLI</title><style>
body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }
.card { background: white; padding: 2rem 3rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center; }
h1 { color: #22c55e; margin-bottom: 0.5rem; }
p { color: #666; }
</style></head><body>
<div class="card"><h1>Authenticated!</h1><p>You can close this window and return to the terminal.</p></div>
</body></html>`;

const ERROR_HTML = `<!DOCTYPE html>
<html><head><title>Codeship CLI</title><style>
body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }
.card { background: white; padding: 2rem 3rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center; }
h1 { color: #ef4444; margin-bottom: 0.5rem; }
p { color: #666; }
</style></head><body>
<div class="card"><h1>Authentication Failed</h1><p>Something went wrong. Please try again.</p></div>
</body></html>`;

export async function startCallbackServer(preferredPort = 9876): Promise<OAuthCallbackServer> {
  return new Promise((resolve, reject) => {
    let callbackResolve: (result: CallbackResult) => void;
    let callbackReject: (err: Error) => void;

    const callbackPromise = new Promise<CallbackResult>((res, rej) => {
      callbackResolve = res;
      callbackReject = rej;
    });

    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      if (!req.url?.startsWith('/callback')) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const url = new URL(req.url, `http://localhost`);
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(ERROR_HTML);
        callbackReject(new Error(`OAuth error: ${error}`));
        return;
      }

      if (!code || !state) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(ERROR_HTML);
        callbackReject(new Error('Missing code or state in callback'));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(SUCCESS_HTML);
      callbackResolve({ code, state });
    });

    server.on('error', reject);

    server.listen(preferredPort, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : preferredPort;

      resolve({
        port,
        server,
        waitForCallback: () => callbackPromise,
        close: () => server.close(),
      });
    });
  });
}
