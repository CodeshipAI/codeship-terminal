import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockLoadConfig = vi.fn();

vi.mock('../lib/config.js', () => ({
  loadConfig: (...args: unknown[]) => mockLoadConfig(...args),
}));

import { ApiClient, ApiError, AuthenticationError } from '../lib/api-client.js';

function mockFetchResponse(status: number, body: unknown, statusText = 'OK') {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  });
}

describe('ApiClient', () => {
  let client: ApiClient;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    mockLoadConfig.mockResolvedValue({
      apiUrl: 'https://test.api.codeship.ai',
      token: 'test-jwt-token',
    });
    client = new ApiClient('https://test.api.codeship.ai');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('sends GET requests with Bearer token', async () => {
    const mockData = [{ id: '1', name: 'Test Project' }];
    globalThis.fetch = mockFetchResponse(200, mockData);

    const result = await client.request('/v1/projects');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://test.api.codeship.ai/v1/projects',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-jwt-token',
          'Content-Type': 'application/json',
        }),
      }),
    );
    expect(result).toEqual(mockData);
  });

  it('sends POST requests with body', async () => {
    const body = { name: 'New Project', repoUrl: 'https://github.com/test/repo' };
    const mockResponse = { id: '2', ...body };
    globalThis.fetch = mockFetchResponse(200, mockResponse);

    const result = await client.request('/v1/projects', { method: 'POST', body });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://test.api.codeship.ai/v1/projects',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(body),
      }),
    );
    expect(result).toEqual(mockResponse);
  });

  it('throws AuthenticationError on 401', async () => {
    globalThis.fetch = mockFetchResponse(401, 'Unauthorized', 'Unauthorized');

    await expect(client.request('/v1/projects')).rejects.toThrow(AuthenticationError);
  });

  it('AuthenticationError message mentions ship auth login', async () => {
    globalThis.fetch = mockFetchResponse(401, '', 'Unauthorized');

    await expect(client.request('/v1/projects')).rejects.toThrow(/ship auth login/);
  });

  it('throws ApiError on other error status codes', async () => {
    globalThis.fetch = mockFetchResponse(500, 'Internal Server Error', 'Internal Server Error');

    await expect(client.request('/v1/projects')).rejects.toThrow(ApiError);
  });

  it('handles 204 No Content responses', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      statusText: 'No Content',
      json: () => Promise.reject(new Error('no body')),
      text: () => Promise.resolve(''),
    });

    const result = await client.request('/v1/projects/123', { method: 'DELETE' });
    expect(result).toBeUndefined();
  });

  it('uses custom base URL when provided', async () => {
    const customClient = new ApiClient('https://custom.api.example.com');
    globalThis.fetch = mockFetchResponse(200, []);

    await customClient.request('/v1/projects');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://custom.api.example.com/v1/projects',
      expect.anything(),
    );
  });

  it('falls back to config base URL when none provided', async () => {
    const defaultClient = new ApiClient();
    globalThis.fetch = mockFetchResponse(200, []);

    await defaultClient.request('/v1/projects');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://test.api.codeship.ai/v1/projects',
      expect.anything(),
    );
  });

  it('omits Authorization header when no token', async () => {
    mockLoadConfig.mockResolvedValue({ apiUrl: 'https://test.api.codeship.ai' });
    globalThis.fetch = mockFetchResponse(200, []);

    await client.request('/v1/projects');

    const callHeaders = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].headers;
    expect(callHeaders).not.toHaveProperty('Authorization');
  });

  describe('typed methods', () => {
    beforeEach(() => {
      globalThis.fetch = mockFetchResponse(200, []);
    });

    it('listProjects calls GET /v1/projects', async () => {
      await client.listProjects();
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/projects'),
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('getProject calls GET /v1/projects/:id', async () => {
      globalThis.fetch = mockFetchResponse(200, { id: '123' });
      await client.getProject('123');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/projects/123'),
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('createProject calls POST /v1/projects', async () => {
      globalThis.fetch = mockFetchResponse(200, { id: '1' });
      await client.createProject({ name: 'Test', repoUrl: 'https://github.com/test/repo' });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/projects'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('deleteProject calls DELETE /v1/projects/:id', async () => {
      globalThis.fetch = mockFetchResponse(204, undefined);
      await client.deleteProject('123');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/projects/123'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('listEpics calls GET /v1/projects/:id/epics', async () => {
      await client.listEpics('proj-1');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/projects/proj-1/epics'),
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('listConnectors calls GET /v1/projects/:id/connectors', async () => {
      await client.listConnectors('proj-1');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/projects/proj-1/connectors'),
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('toggleConnector calls PATCH with enabled flag', async () => {
      globalThis.fetch = mockFetchResponse(200, { id: 'c1', enabled: true });
      await client.toggleConnector('c1', true);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/connectors/c1'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ enabled: true }),
        }),
      );
    });
  });
});
