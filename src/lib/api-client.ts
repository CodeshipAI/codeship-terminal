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
  name: string;
  title?: string;
  description?: string;
  status: string;
  storyProgress?: { total: number; completed: number };
  agentCount?: number;
  createdAt: string;
  updatedAt?: string;
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

export interface Story {
  id: string;
  sessionId: string;
  title: string;
  description?: string;
  status: string;
  assignee?: string;
  complexity?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Agent {
  id: string;
  sessionId: string;
  name: string;
  role: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AgentLog {
  id: string;
  agentId: string;
  level: string;
  message: string;
  timestamp: string;
}

export interface Escalation {
  id: string;
  sessionId: string;
  agentId?: string;
  title: string;
  description?: string;
  status: string;
  resolution?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Message {
  id: string;
  sessionId: string;
  agentId?: string;
  sender: string;
  content: string;
  createdAt: string;
}

export interface DashboardStats {
  activeSessions: number;
  totalAgents: number;
  pendingEscalations: number;
  storiesCompleted: number;
  storiesTotal: number;
}

export interface SessionDetail {
  session: Session;
  stories: Story[];
  agents: Agent[];
  escalations: Escalation[];
}

export interface ActivityEntry {
  id: string;
  sessionId: string;
  type: string;
  description: string;
  timestamp: string;
}

export interface SessionCosts {
  sessionId: string;
  totalCost: number;
  breakdown: { agentId: string; cost: number }[];
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

  async listEpics(projectId: string): Promise<Epic[]> {
    const data = await this.request<{ sessions: Epic[] } | Epic[]>(
      `/api/projects/${encodeURIComponent(projectId)}/sessions`,
    );
    return Array.isArray(data) ? data : data.sessions;
  }

  getEpic(epicId: string): Promise<Epic> {
    return this.request<Epic>(`/api/epics/${encodeURIComponent(epicId)}`);
  }

  createEpic(projectId: string, data: { title: string; description?: string; claudeCredentials?: string }): Promise<Epic> {
    const body: Record<string, unknown> = {
      name: data.title,
      requirementTitle: data.title,
      requirementDescription: data.description || data.title,
    };
    if (data.claudeCredentials !== undefined) {
      body.claudeCredentials = data.claudeCredentials;
    }
    return this.request<Epic>(`/api/projects/${encodeURIComponent(projectId)}/sessions`, {
      method: 'POST',
      body,
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

  // --- Stories ---

  async listStories(projectId: string, sessionId: string): Promise<Story[]> {
    const data = await this.request<{ stories: Story[] } | Story[]>(
      `/api/projects/${encodeURIComponent(projectId)}/sessions/${encodeURIComponent(sessionId)}/stories`,
    );
    return Array.isArray(data) ? data : data.stories;
  }

  createStory(
    projectId: string,
    sessionId: string,
    data: { title: string; description?: string; complexity?: number },
  ): Promise<Story> {
    return this.request<Story>(
      `/api/projects/${encodeURIComponent(projectId)}/sessions/${encodeURIComponent(sessionId)}/stories`,
      { method: 'POST', body: data },
    );
  }

  updateStory(
    projectId: string,
    sessionId: string,
    storyId: string,
    data: Partial<{ title: string; description: string; complexity: number }>,
  ): Promise<Story> {
    return this.request<Story>(
      `/api/projects/${encodeURIComponent(projectId)}/sessions/${encodeURIComponent(sessionId)}/stories/${encodeURIComponent(storyId)}`,
      { method: 'PUT', body: data },
    );
  }

  updateStoryStatus(
    projectId: string,
    sessionId: string,
    storyId: string,
    status: string,
  ): Promise<Story> {
    return this.request<Story>(
      `/api/projects/${encodeURIComponent(projectId)}/sessions/${encodeURIComponent(sessionId)}/stories/${encodeURIComponent(storyId)}/status`,
      { method: 'PATCH', body: { status } },
    );
  }

  deleteStory(projectId: string, sessionId: string, storyId: string): Promise<void> {
    return this.request<void>(
      `/api/projects/${encodeURIComponent(projectId)}/sessions/${encodeURIComponent(sessionId)}/stories/${encodeURIComponent(storyId)}`,
      { method: 'DELETE' },
    );
  }

  // --- Agents ---

  async listAgents(projectId: string, sessionId: string): Promise<Agent[]> {
    const data = await this.request<{ agents: Agent[] } | Agent[]>(
      `/api/projects/${encodeURIComponent(projectId)}/sessions/${encodeURIComponent(sessionId)}/agents`,
    );
    return Array.isArray(data) ? data : data.agents;
  }

  getAgent(projectId: string, sessionId: string, agentId: string): Promise<Agent> {
    return this.request<Agent>(
      `/api/projects/${encodeURIComponent(projectId)}/sessions/${encodeURIComponent(sessionId)}/agents/${encodeURIComponent(agentId)}`,
    );
  }

  getAgentLogs(projectId: string, sessionId: string, agentId: string): Promise<AgentLog[]> {
    return this.request<AgentLog[]>(
      `/api/projects/${encodeURIComponent(projectId)}/sessions/${encodeURIComponent(sessionId)}/agents/${encodeURIComponent(agentId)}/logs`,
    );
  }

  // --- Messaging ---

  async listMessages(projectId: string, sessionId: string, agentId?: string): Promise<Message[]> {
    const base = `/api/projects/${encodeURIComponent(projectId)}/sessions/${encodeURIComponent(sessionId)}/messages`;
    const url = agentId ? `${base}?agentId=${encodeURIComponent(agentId)}` : base;
    const data = await this.request<{ messages: Message[] } | Message[]>(url);
    return Array.isArray(data) ? data : data.messages;
  }

  sendMessage(
    projectId: string,
    sessionId: string,
    data: { content: string; agentId?: string },
  ): Promise<Message> {
    return this.request<Message>(
      `/api/projects/${encodeURIComponent(projectId)}/sessions/${encodeURIComponent(sessionId)}/messages`,
      { method: 'POST', body: { body: data.content, toAgent: data.agentId ?? 'all' } },
    );
  }

  getMessage(projectId: string, sessionId: string, messageId: string): Promise<Message> {
    return this.request<Message>(
      `/api/projects/${encodeURIComponent(projectId)}/sessions/${encodeURIComponent(sessionId)}/messages/${encodeURIComponent(messageId)}`,
    );
  }

  // --- Escalations ---

  async listEscalations(projectId: string, sessionId: string): Promise<Escalation[]> {
    const data = await this.request<{ escalations: Escalation[] } | Escalation[]>(
      `/api/projects/${encodeURIComponent(projectId)}/sessions/${encodeURIComponent(sessionId)}/escalations`,
    );
    return Array.isArray(data) ? data : data.escalations;
  }

  resolveEscalation(
    projectId: string,
    sessionId: string,
    escalationId: string,
    resolution: string,
  ): Promise<Escalation> {
    return this.request<Escalation>(
      `/api/projects/${encodeURIComponent(projectId)}/sessions/${encodeURIComponent(sessionId)}/escalations/${encodeURIComponent(escalationId)}/resolve`,
      { method: 'POST', body: { resolution } },
    );
  }

  // --- Dashboard ---

  async getDashboardStats(since?: string): Promise<DashboardStats> {
    const query = since ? `?since=${encodeURIComponent(since)}` : '';
    const [commits, agents, blockers] = await Promise.all([
      this.request<Record<string, unknown>>(`/api/dashboard/stats/commits${query}`),
      this.request<Record<string, unknown>>(`/api/dashboard/stats/agents${query}`),
      this.request<Record<string, unknown>>(`/api/dashboard/stats/blockers${query}`),
    ]);
    return {
      storiesCompleted: (commits.storiesCompleted ?? commits.completed ?? 0) as number,
      storiesTotal: (commits.storiesTotal ?? commits.total ?? 0) as number,
      activeSessions: (agents.activeSessions ?? 0) as number,
      totalAgents: (agents.totalAgents ?? 0) as number,
      pendingEscalations: (blockers.pendingEscalations ?? 0) as number,
    };
  }

  async getSessionActivity(projectId: string, sessionId: string): Promise<ActivityEntry[]> {
    const data = await this.request<{ activity: ActivityEntry[] } | ActivityEntry[]>(
      `/api/projects/${encodeURIComponent(projectId)}/sessions/${encodeURIComponent(sessionId)}/activity`,
    );
    return Array.isArray(data) ? data : data.activity;
  }

  getSessionCosts(projectId: string, sessionId: string): Promise<SessionCosts> {
    return this.request<SessionCosts>(
      `/api/projects/${encodeURIComponent(projectId)}/sessions/${encodeURIComponent(sessionId)}/costs`,
    );
  }

  // --- Session Poll ---

  pollSession(projectId: string, sessionId: string): Promise<SessionDetail> {
    return this.request<SessionDetail>(
      `/api/projects/${encodeURIComponent(projectId)}/sessions/${encodeURIComponent(sessionId)}/poll`,
    );
  }

  async pollSessionEtag(
    projectId: string,
    sessionId: string,
    etag?: string,
  ): Promise<{ data: SessionDetail | null; etag?: string }> {
    const baseUrl = await this.resolveBaseUrl();
    const token = await this.getToken();
    const url = `${baseUrl}/api/projects/${encodeURIComponent(projectId)}/sessions/${encodeURIComponent(sessionId)}/poll`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (etag) headers['If-None-Match'] = etag;

    const response = await fetch(url, { headers });

    if (response.status === 304) {
      return { data: null, etag };
    }

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

    const newEtag = response.headers.get('ETag') ?? undefined;
    const data = (await response.json()) as SessionDetail;
    return { data, etag: newEtag };
  }
}

let defaultClient: ApiClient | undefined;

export function getApiClient(): ApiClient {
  if (!defaultClient) {
    defaultClient = new ApiClient();
  }
  return defaultClient;
}
