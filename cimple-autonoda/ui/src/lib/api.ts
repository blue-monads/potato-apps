import { API_BASE_PATH } from "./base";
import type { EventTrigger, TriggerGraph } from "../types/workflow";

const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return (window as any).spaceGetToken?.('cimple-autonoda') || null;
};

interface ApiResponse<T> {
  status: number;
  data?: T;
  error?: string;
}

export async function apiRequest<T>(
  path: string, 
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = token;
  }

  try {
    const response = await fetch(`${API_BASE_PATH}${path}`, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    return {
      status: response.status,
      data: response.ok ? (data as T) : undefined,
      error: response.ok ? undefined : (data.error || `HTTP ${response.status}`),
    };
  } catch (err: any) {
    return {
      status: 0,
      error: err.message || 'Network request failed',
    };
  }
}

export const autonodaApi = {
  // Setup database migration
  runSetup: async () => {
    return apiRequest<{ message: string }>('/setup', { method: 'POST' });
  },

  // Event Triggers
  listTriggers: async (): Promise<EventTrigger[]> => {
    const res = await apiRequest<EventTrigger[]>('/triggers', { method: 'GET' });
    if (res.error) {
      console.error('Failed to list triggers:', res.error);
      return [];
    }
    return Array.isArray(res.data) ? res.data : [];
  },

  getTrigger: async (id: number): Promise<EventTrigger> => {
    const res = await apiRequest<EventTrigger>(`/triggers/${id}`, { method: 'GET' });
    if (res.error || !res.data) {
      throw new Error(res.error || 'Trigger not found');
    }
    return res.data;
  },

  getTriggerGraph: async (id: number): Promise<TriggerGraph> => {
    const res = await apiRequest<TriggerGraph>(`/triggers/${id}/graph`, { method: 'GET' });
    if (res.error || !res.data) {
      throw new Error(res.error || 'Failed to fetch trigger graph');
    }

    const data = res.data;
    const targets = Array.isArray(data.targets)
      ? data.targets.map(t => ({
          ...t,
          targetMeta: typeof t.targetMeta === 'string' ? JSON.parse(t.targetMeta || '{}') : (t.targetMeta || {})
        }))
      : [];

    return {
      trigger: data.trigger,
      rule_blocks: Array.isArray(data.rule_blocks) ? data.rule_blocks : [],
      rules: Array.isArray(data.rules) ? data.rules : [],
      targets,
    };
  },

  // Save the entire in-memory graph directly to SQLite DB
  saveTriggerGraph: async (id: number, graph: TriggerGraph): Promise<TriggerGraph> => {
    const res = await apiRequest<TriggerGraph>(`/triggers/${id}/graph`, {
      method: 'PUT',
      body: JSON.stringify({
        trigger: graph.trigger,
        rule_blocks: graph.rule_blocks || [],
        rules: graph.rules || [],
        targets: graph.targets || [],
      }),
    });

    if (res.error || !res.data) {
      throw new Error(res.error || 'Failed to save trigger graph to database');
    }

    const data = res.data;
    const targets = Array.isArray(data.targets)
      ? data.targets.map(t => ({
          ...t,
          targetMeta: typeof t.targetMeta === 'string' ? JSON.parse(t.targetMeta || '{}') : (t.targetMeta || {})
        }))
      : [];

    return {
      trigger: data.trigger,
      rule_blocks: Array.isArray(data.rule_blocks) ? data.rule_blocks : [],
      rules: Array.isArray(data.rules) ? data.rules : [],
      targets,
    };
  },

  createTrigger: async (data: Partial<EventTrigger>): Promise<EventTrigger> => {
    const res = await apiRequest<EventTrigger>('/triggers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (res.error || !res.data) {
      throw new Error(res.error || 'Failed to create trigger');
    }
    return res.data;
  },

  updateTrigger: async (id: number, updates: Partial<EventTrigger>): Promise<EventTrigger> => {
    const res = await apiRequest<EventTrigger>(`/triggers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    if (res.error || !res.data) {
      throw new Error(res.error || 'Failed to update trigger');
    }
    return res.data;
  },

  deleteTrigger: async (id: number): Promise<void> => {
    const res = await apiRequest<void>(`/triggers/${id}`, { method: 'DELETE' });
    if (res.error) {
      throw new Error(res.error || 'Failed to delete trigger');
    }
  },
};