import { loadConfig } from './config.js';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly body: string,
  ) {
    super(`API error ${status}: ${body || statusText}`);
    this.name = 'ApiError';
  }
}

export class AuthenticationError extends ApiError {
  constructor(statusText: string, body: string) {
    super(401, statusText, body);
    this.name = 'AuthenticationError';
  }
}

export interface ApiRequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

// --- API response types ---

export interface Project {
  id: string;
  name: string;
  repoUrl: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Epic {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface McpConnector {
  id: string;
  projectId: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  epicId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

// --- API Client ---

export class ApiClient {
  private baseUrl: string | undefined;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl;
  }

  private async resolveBaseUrl(): Promise<string> {
    if (this.baseUrl) return this.baseUrl;
    const config = await loadConfig();
    return config.apiUrl;
  }

  private async getToken(): Promise<string | undefined> {
    const config = await loadConfig();
    return config.token;
  }

  async request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const baseUrl = await this.resolveBaseUrl();
    const token = await this.getToken();
    const url = `${baseUrl}${path}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (response.status === 401) {
      const body = await response.text().catch(() => '');
      throw new AuthenticationError(
        response.statusText,
        body || 'Unauthorized. Run `ship auth login` to authenticate.',
      );
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new ApiError(response.status, response.statusText, body);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  // --- Projects ---

  async listProjects(): Promise<Project[]> {
    const data = await this.request<{ projects: Project[] } | Project[]>('/api/projects');
    return Array.isArray(data) ? data : data.projects;
  }

  getProject(id: string): Promise<Project> {
    return this.request<Project>(`/api/projects/${encodeURIComponent(id)}`);
  }

  createProject(data: { name: string; repoUrl: string; description?: string }): Promise<Project> {
    return this.request<Project>('/api/projects', { method: 'POST', body: data });
  }

  importProject(repoUrl: string): Promise<Project> {
    return this.request<Project>('/api/projects/import', { method: 'POST', body: { repoUrl } });
  }

  deleteProject(id: string): Promise<void> {
    return this.request<void>(`/api/projects/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  // --- Epics ---

  listEpics(projectId: string): Promise<Epic[]> {
    return this.request<Epic[]>(`/api/projects/${encodeURIComponent(projectId)}/epics`);
  }

  getEpic(epicId: string): Promise<Epic> {
    return this.request<Epic>(`/api/epics/${encodeURIComponent(epicId)}`);
  }

  createEpic(projectId: string, data: { title: string; description?: string }): Promise<Epic> {
    return this.request<Epic>(`/api/projects/${encodeURIComponent(projectId)}/epics`, {
      method: 'POST',
      body: data,
    });
  }

  // --- Sessions ---

  listSessions(epicId: string): Promise<Session[]> {
    return this.request<Session[]>(`/api/epics/${encodeURIComponent(epicId)}/sessions`);
  }

  getSession(sessionId: string): Promise<Session> {
    return this.request<Session>(`/api/sessions/${encodeURIComponent(sessionId)}`);
  }

  // --- MCP Connectors ---

  listConnectors(projectId: string): Promise<McpConnector[]> {
    return this.request<McpConnector[]>(
      `/api/projects/${encodeURIComponent(projectId)}/mcp-connectors`,
    );
  }

  addConnector(
    projectId: string,
    data: { name: string; type: string; config: Record<string, unknown> },
  ): Promise<McpConnector> {
    return this.request<McpConnector>(
      `/api/projects/${encodeURIComponent(projectId)}/mcp-connectors`,
      { method: 'POST', body: data },
    );
  }

  updateConnector(
    projectId: string,
    connectorId: string,
    data: Partial<{ name: string; type: string; config: Record<string, unknown>; enabled: boolean }>,
  ): Promise<McpConnector> {
    return this.request<McpConnector>(
      `/api/projects/${encodeURIComponent(projectId)}/mcp-connectors/${encodeURIComponent(connectorId)}`,
      { method: 'PUT', body: data },
    );
  }

  removeConnector(projectId: string, connectorId: string): Promise<void> {
    return this.request<void>(
      `/api/projects/${encodeURIComponent(projectId)}/mcp-connectors/${encodeURIComponent(connectorId)}`,
      { method: 'DELETE' },
    );
  }

  toggleConnector(projectId: string, connectorId: string): Promise<McpConnector> {
    return this.request<McpConnector>(
      `/api/projects/${encodeURIComponent(projectId)}/mcp-connectors/${encodeURIComponent(connectorId)}/toggle`,
      { method: 'PATCH' },
    );
  }
}

let defaultClient: ApiClient | undefined;

export function getApiClient(): ApiClient {
  if (!defaultClient) {
    defaultClient = new ApiClient();
  }
  return defaultClient;
}
