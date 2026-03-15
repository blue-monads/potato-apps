import { API_BASE_PATH } from "./base";

const getAuthToken = (): string | null => {
    if (typeof window === 'undefined') return null;
    return (window as any).spaceGetToken?.('cimple-eventmap') || null;
};

interface ApiResponse<T> {
    status: number;
    data: T;
    error?: string;
}

async function apiRequest<T>(
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

    const data = await response.json().catch(() => ({ error: 'Unknown error' }));

    return {
        status: response.status,
        data: response.ok ? data : undefined as T,
        error: response.ok ? undefined : (data.error || `HTTP ${response.status}`),
    };
}

export interface EventType {
    id: number;
    name: string;
    event_type: string;
    icon: string;
    color: string;
    created_at: string;
}

export const eventTypesApi = {
    list: async (): Promise<EventType[]> => {
        const response = await apiRequest<EventType[]>('/event-types', { method: 'GET' });
        if (response.error) {
            throw new Error(response.error);
        }
        const data = response.data;
        if (!data) {
            return [];
        }
        if (!Array.isArray(data)) {
            console.warn('API returned non-array data:', data);
            return [];
        }
        return data;
    },
    
    get: async (id: number): Promise<EventType> => {
        const response = await apiRequest<EventType>(`/event-types/${id}`, { method: 'GET' });
        if (response.error) {
            throw new Error(response.error);
        }
        return response.data!;
    },
    
    create: async (eventType: Partial<EventType>): Promise<EventType> => {
        const response = await apiRequest<EventType>('/event-types', {
            method: 'POST',
            body: JSON.stringify(eventType),
        });
        if (response.error) {
            throw new Error(response.error);
        }
        return response.data!;
    },
};
