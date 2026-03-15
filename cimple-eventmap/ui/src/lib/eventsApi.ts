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

export interface EventImage {
    event_image_id: number;
    image_url: string;
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
    images?: EventImage[];
}


export const eventsApi = {
    /** Chronological feed: pass offset_id (last visible id) to load older events when scrolling down. */
    query: async (params?: { offset_id?: number }): Promise<Event[]> => {
        const body = params?.offset_id != null ? { offset_id: params.offset_id } : {};
        const response = await apiRequest<Event[]>('/event_query', {
            method: 'POST',
            body: JSON.stringify(body),
        });
        if (response.error) {
            throw new Error(response.error);
        }
        const data = response.data;
        if (!data) return [];
        if (!Array.isArray(data)) {
            console.warn('API returned non-array data:', data);            
            return [];
        }

        data.forEach(event => {

            // if images is not an array but object, convert it to an array
            if (typeof event.images === 'object' && event.images !== null) {
                event.images = Object.values(event.images);
            }

            event.images = event.images?.map(image => ({
                event_image_id: image.event_image_id,
                image_url: image.image_url,
            }));
        });

        console.log('data', data);


        return data;
    },

    list: async (): Promise<Event[]> => eventsApi.query(),

    get: async (id: number): Promise<Event> => {
        const response = await apiRequest<Event>(`/events/${id}`, { method: 'GET' });
        if (response.error) {
            throw new Error(response.error);
        }
        return response.data!;
    },

    create: async (event: Partial<Event> & { image_urls?: string[] }): Promise<Event> => {
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
