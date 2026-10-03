import { API_BASE_PATH } from "./base";

export interface CalEvent {
  id: number;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  all_day: number | boolean;
  tag_id: string;
  color_type: string;
  created_at?: string;
  updated_at?: string;
}

export interface CalTag {
  id: string;
  name: string;
  color: string;
  created_at?: string;
}

export interface CreateEventInput {
  title: string;
  description?: string;
  start_date: string;
  end_date?: string;
  all_day?: boolean | number;
  tag_id?: string;
  color_type?: string;
}

export interface UpdateEventInput {
  title?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  all_day?: boolean | number;
  tag_id?: string;
  color_type?: string;
}

const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return (window as any).spaceGetToken?.('cimple-calender') || null;
};

interface ApiResponse<T> {
  status: number;
  data: T;
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

  const response = await fetch(`${API_BASE_PATH}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({ error: 'Unknown response' }));

  return {
    status: response.status,
    data: response.ok ? data : (undefined as unknown as T),
    error: response.ok ? undefined : (data.error || `HTTP ${response.status}`),
  };
}

// LocalStorage fallback helpers for development & offline resilience
const LOCAL_EVENTS_KEY = 'cimple-cal-events';
const LOCAL_TAGS_KEY = 'cimple-cal-tags';

export const DEFAULT_TAGS: CalTag[] = [
  { id: 'work', name: 'Work', color: '#46a86a' },
  { id: 'personal', name: 'Personal', color: '#df8b4c' },
  { id: 'focus', name: 'Focus', color: '#9b6ad0' },
  { id: 'other', name: 'Other', color: '#7c8795' },
];

function getLocalEvents(): CalEvent[] {
  try {
    const raw = localStorage.getItem(LOCAL_EVENTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLocalEvents(events: CalEvent[]) {
  try {
    localStorage.setItem(LOCAL_EVENTS_KEY, JSON.stringify(events));
  } catch (e) {
    console.error('Failed to save to local storage', e);
  }
}

function getLocalTags(): CalTag[] {
  try {
    const raw = localStorage.getItem(LOCAL_TAGS_KEY);
    if (!raw) return DEFAULT_TAGS;
    const parsed = JSON.parse(raw);
    return parsed.length > 0 ? parsed : DEFAULT_TAGS;
  } catch {
    return DEFAULT_TAGS;
  }
}

function saveLocalTags(tags: CalTag[]) {
  try {
    localStorage.setItem(LOCAL_TAGS_KEY, JSON.stringify(tags));
  } catch (e) {
    console.error('Failed to save tags to local storage', e);
  }
}

export const eventsApi = {
  list: async (params?: { tag_id?: string; start_date?: string; end_date?: string; q?: string }): Promise<CalEvent[]> => {
    try {
      const query = new URLSearchParams();
      if (params?.tag_id && params.tag_id !== 'all') query.append('tag_id', params.tag_id);
      if (params?.start_date) query.append('start_date', params.start_date);
      if (params?.end_date) query.append('end_date', params.end_date);
      if (params?.q) query.append('q', params.q);

      const qs = query.toString();
      const res = await apiRequest<CalEvent[]>(`/events${qs ? `?${qs}` : ''}`, { method: 'GET' });
      if (!res.error && Array.isArray(res.data)) {
        saveLocalEvents(res.data);
        return res.data;
      }
    } catch {
      // fallback
    }

    // Fallback to local
    let events = getLocalEvents();
    if (params?.tag_id && params.tag_id !== 'all') {
      events = events.filter(e => e.tag_id === params.tag_id);
    }
    if (params?.q) {
      const q = params.q.toLowerCase();
      events = events.filter(e => (e.title || '').toLowerCase().includes(q) || (e.description || '').toLowerCase().includes(q));
    }
    return events;
  },

  get: async (id: number): Promise<CalEvent> => {
    try {
      const res = await apiRequest<CalEvent>(`/events/${id}`, { method: 'GET' });
      if (!res.error && res.data) return res.data;
    } catch {}

    const found = getLocalEvents().find(e => e.id === id);
    if (!found) throw new Error('Event not found');
    return found;
  },

  create: async (data: CreateEventInput): Promise<CalEvent> => {
    try {
      const res = await apiRequest<CalEvent>('/events', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (!res.error && res.data) {
        const events = getLocalEvents();
        events.push(res.data);
        saveLocalEvents(events);
        return res.data;
      }
    } catch {}

    // Fallback
    const newEvent: CalEvent = {
      id: Date.now(),
      title: data.title,
      description: data.description || '',
      start_date: data.start_date,
      end_date: data.end_date || data.start_date,
      all_day: data.all_day ? 1 : 0,
      tag_id: data.tag_id || 'other',
      color_type: data.color_type || 'default',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const events = getLocalEvents();
    events.push(newEvent);
    saveLocalEvents(events);
    return newEvent;
  },

  update: async (id: number, data: UpdateEventInput): Promise<CalEvent> => {
    try {
      const res = await apiRequest<CalEvent>(`/events/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      if (!res.error && res.data) {
        const events = getLocalEvents().map(e => e.id === id ? res.data : e);
        saveLocalEvents(events);
        return res.data;
      }
    } catch {}

    // Fallback
    const events = getLocalEvents();
    const idx = events.findIndex(e => e.id === id);
    if (idx === -1) throw new Error('Event not found');
    events[idx] = {
      ...events[idx],
      ...data,
      all_day: data.all_day !== undefined ? (data.all_day ? 1 : 0) : events[idx].all_day,
      updated_at: new Date().toISOString(),
    };
    saveLocalEvents(events);
    return events[idx];
  },

  delete: async (id: number): Promise<void> => {
    try {
      await apiRequest(`/events/${id}`, { method: 'DELETE' });
    } catch {}

    const events = getLocalEvents().filter(e => e.id !== id);
    saveLocalEvents(events);
  },
};

export const tagsApi = {
  list: async (): Promise<CalTag[]> => {
    try {
      const res = await apiRequest<CalTag[]>('/tags', { method: 'GET' });
      if (!res.error && Array.isArray(res.data) && res.data.length > 0) {
        saveLocalTags(res.data);
        return res.data;
      }
    } catch {}

    return getLocalTags();
  },

  create: async (data: { id?: string; name: string; color: string }): Promise<CalTag> => {
    try {
      const res = await apiRequest<CalTag>('/tags', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (!res.error && res.data) {
        const tags = getLocalTags();
        tags.push(res.data);
        saveLocalTags(tags);
        return res.data;
      }
    } catch {}

    const newTag: CalTag = {
      id: data.id || `tag-${Date.now()}`,
      name: data.name,
      color: data.color || '#4f6ef7',
    };
    const tags = getLocalTags();
    tags.push(newTag);
    saveLocalTags(tags);
    return newTag;
  },

  update: async (id: string, data: { name?: string; color?: string }): Promise<CalTag> => {
    try {
      const res = await apiRequest<CalTag>(`/tags/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      if (!res.error && res.data) {
        const tags = getLocalTags().map(t => t.id === id ? res.data : t);
        saveLocalTags(tags);
        return res.data;
      }
    } catch {}

    const tags = getLocalTags();
    const idx = tags.findIndex(t => t.id === id);
    if (idx === -1) throw new Error('Tag not found');
    tags[idx] = { ...tags[idx], ...data };
    saveLocalTags(tags);
    return tags[idx];
  },

  delete: async (id: string): Promise<void> => {
    try {
      await apiRequest(`/tags/${id}`, { method: 'DELETE' });
    } catch {}

    const tags = getLocalTags().filter(t => t.id !== id);
    saveLocalTags(tags);
  },
};

export const setupApi = {
  runSetup: async (): Promise<{ message: string }> => {
    const res = await apiRequest<{ message: string }>('/setup', { method: 'POST' });
    if (res.error) throw new Error(res.error);
    return res.data;
  },
};