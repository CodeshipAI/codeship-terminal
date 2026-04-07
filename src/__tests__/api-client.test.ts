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

    // --- Stories ---

    it('listStories calls GET /sessions/:sid/stories', async () => {
      await client.listStories('p1', 's1');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/projects/p1/sessions/s1/stories'),
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('createStory calls POST /sessions/:sid/stories', async () => {
      globalThis.fetch = mockFetchResponse(200, { id: 'st1' });
      await client.createStory('p1', 's1', { title: 'New Story' });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/projects/p1/sessions/s1/stories'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('updateStory calls PUT /stories/:storyId', async () => {
      globalThis.fetch = mockFetchResponse(200, { id: 'st1' });
      await client.updateStory('p1', 's1', 'st1', { title: 'Updated' });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/sessions/s1/stories/st1'),
        expect.objectContaining({ method: 'PUT' }),
      );
    });

    it('updateStoryStatus calls PATCH /stories/:storyId/status', async () => {
      globalThis.fetch = mockFetchResponse(200, { id: 'st1', status: 'done' });
      await client.updateStoryStatus('p1', 's1', 'st1', 'done');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/stories/st1/status'),
        expect.objectContaining({ method: 'PATCH' }),
      );
    });

    it('deleteStory calls DELETE /stories/:storyId', async () => {
      globalThis.fetch = mockFetchResponse(204, undefined);
      await client.deleteStory('p1', 's1', 'st1');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/sessions/s1/stories/st1'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    // --- Agents ---

    it('listAgents calls GET /sessions/:sid/agents', async () => {
      await client.listAgents('p1', 's1');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/sessions/s1/agents'),
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('getAgent calls GET /agents/:agentId', async () => {
      globalThis.fetch = mockFetchResponse(200, { id: 'a1' });
      await client.getAgent('p1', 's1', 'a1');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/agents/a1'),
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('getAgentLogs calls GET /agents/:agentId/logs', async () => {
      await client.getAgentLogs('p1', 's1', 'a1');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/agents/a1/logs'),
        expect.objectContaining({ method: 'GET' }),
      );
    });

    // --- Messaging ---

    it('listMessages calls GET /sessions/:sid/messages', async () => {
      await client.listMessages('p1', 's1');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/sessions/s1/messages'),
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('listMessages with agentId includes query param', async () => {
      await client.listMessages('p1', 's1', 'a1');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/messages?agentId=a1'),
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('sendMessage calls POST /sessions/:sid/messages', async () => {
      globalThis.fetch = mockFetchResponse(200, { id: 'm1' });
      await client.sendMessage('p1', 's1', { content: 'hello' });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/sessions/s1/messages'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('getMessage calls GET /messages/:msgId', async () => {
      globalThis.fetch = mockFetchResponse(200, { id: 'm1' });
      await client.getMessage('p1', 's1', 'm1');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/messages/m1'),
        expect.objectContaining({ method: 'GET' }),
      );
    });

    // --- Escalations ---

    it('listEscalations calls GET /sessions/:sid/escalations', async () => {
      await client.listEscalations('p1', 's1');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/sessions/s1/escalations'),
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('resolveEscalation calls POST /escalations/:id/resolve', async () => {
      globalThis.fetch = mockFetchResponse(200, { id: 'e1', status: 'resolved' });
      await client.resolveEscalation('p1', 's1', 'e1', 'Fixed it');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/escalations/e1/resolve'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    // --- Dashboard ---

    it('getDashboardStats calls GET /dashboard/stats', async () => {
      globalThis.fetch = mockFetchResponse(200, { activeSessions: 2 });
      await client.getDashboardStats();
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/dashboard/stats'),
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('getDashboardStats with since includes query param', async () => {
      globalThis.fetch = mockFetchResponse(200, { activeSessions: 1 });
      await client.getDashboardStats('2024-01-01');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/dashboard/stats?since=2024-01-01'),
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('getSessionActivity calls GET /sessions/:sid/activity', async () => {
      await client.getSessionActivity('p1', 's1');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/sessions/s1/activity'),
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('getSessionCosts calls GET /sessions/:sid/costs', async () => {
      globalThis.fetch = mockFetchResponse(200, { sessionId: 's1', totalCost: 0 });
      await client.getSessionCosts('p1', 's1');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/sessions/s1/costs'),
        expect.objectContaining({ method: 'GET' }),
      );
    });

    // --- Session Poll ---

    it('pollSession calls GET /sessions/:sid/poll', async () => {
      globalThis.fetch = mockFetchResponse(200, { session: {}, stories: [], agents: [], escalations: [] });
      await client.pollSession('p1', 's1');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/sessions/s1/poll'),
        expect.objectContaining({ method: 'GET' }),
      );
    });
  });
});
