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

    const data = await response.json().catch(() => ({ error: 'Unknown error' }));

    return {
        status: response.status,
        data: response.ok ? data : undefined as T,
        error: response.ok ? undefined : (data.error || `HTTP ${response.status}`),
    };
}

export interface Event {
    id: number;
    title: string;
    info: string;
    event_type_id: number | null;
    event_data: string;
    lat: number;
    lng: number;
    event_start: string | null;
    event_end: string | null;
    created_at: string;
}

export const eventsApi = {
    list: async (): Promise<Event[]> => {
        const response = await apiRequest<Event[]>('/events', { method: 'GET' });
        if (response.error) {
            throw new Error(response.error);
        }
        return response.data || [];
    },
    
    get: async (id: number): Promise<Event> => {
        const response = await apiRequest<Event>(`/events/${id}`, { method: 'GET' });
        if (response.error) {
            throw new Error(response.error);
        }
        return response.data!;
    },
    
    create: async (event: Partial<Event>): Promise<Event> => {
        const response = await apiRequest<Event>('/events', {
            method: 'POST',
            body: JSON.stringify(event),
        });
        if (response.error) {
            throw new Error(response.error);
        }
        return response.data!;
    },
};

export interface GetWsTokenResponse {
    easyws_cap_token: string;
    conn_id: string;
}

export const getWsToken = async (): Promise<GetWsTokenResponse> => {
    const response = await apiRequest<GetWsTokenResponse>('/get-ws-token', { method: 'GET' });
    if (response.error) {
        throw new Error(response.error);
    }
    return response.data!;
};