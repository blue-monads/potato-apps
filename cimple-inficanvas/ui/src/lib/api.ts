import { API_BASE_PATH } from "./base";

const getAuthToken = (): string | null => {
    if (typeof window === 'undefined') return null;
    return (window as any).spaceGetToken?.('cimple-inficanvas') || null;
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

    try {
        const response = await fetch(`${API_BASE_PATH}${path}`, {
            ...options,
            headers,
        });

        const data = await response.json().catch(() => ({ error: 'Non-JSON response' }));

        return {
            status: response.status,
            data: response.ok ? data : (undefined as unknown as T),
            error: response.ok ? undefined : (data.error || data.message || `HTTP ${response.status}`),
        };
    } catch (err: any) {
        return {
            status: 0,
            data: undefined as unknown as T,
            error: err?.message || 'Network error',
        };
    }
}

export type CardType = 'text' | 'image' | 'link' | 'quote' | 'list' | 'note';

export interface CheckItem {
    id: string;
    text: string;
    done: boolean;
}

export interface CardData {
    url?: string;
    images?: string[];
    caption?: string;
    domain?: string;
    linkTitle?: string;
    source?: string;
    items?: CheckItem[];
    [key: string]: any;
}

export interface CanvasCard {
    id: number;
    title: string;
    description: string;
    card_type: CardType;
    size_x: number;
    size_y: number;
    position_x: number;
    position_y: number;
    color: string;
    card_data: string | CardData;
    created_at?: string;
    updated_at?: string;
}

export interface CardLink {
    id: number;
    source_card_id: number;
    linked_card_id: number;
    source_handle: 'l' | 'r' | 't' | 'b';
    linked_handle: 'l' | 'r' | 't' | 'b';
    label?: string;
    color?: string;
    created_at?: string;
    updated_at?: string;
}

export const cardsApi = {
    list: async (): Promise<CanvasCard[]> => {
        const res = await apiRequest<CanvasCard[]>('/cards', { method: 'GET' });
        if (res.error) throw new Error(res.error);
        return res.data || [];
    },
    get: async (id: number): Promise<CanvasCard> => {
        const res = await apiRequest<CanvasCard>(`/cards/${id}`, { method: 'GET' });
        if (res.error) throw new Error(res.error);
        return res.data;
    },
    create: async (card: Partial<CanvasCard>): Promise<CanvasCard> => {
        const payload = {
            ...card,
            card_data: typeof card.card_data === 'object' ? JSON.stringify(card.card_data) : (card.card_data || '{}')
        };
        const res = await apiRequest<CanvasCard>('/cards', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        if (res.error) throw new Error(res.error);
        return res.data;
    },
    update: async (id: number, card: Partial<CanvasCard>): Promise<CanvasCard> => {
        const payload = {
            ...card,
            card_data: typeof card.card_data === 'object' ? JSON.stringify(card.card_data) : card.card_data
        };
        const res = await apiRequest<CanvasCard>(`/cards/${id}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });
        if (res.error) throw new Error(res.error);
        return res.data;
    },
    delete: async (id: number): Promise<void> => {
        const res = await apiRequest<void>(`/cards/${id}`, { method: 'DELETE' });
        if (res.error) throw new Error(res.error);
    }
};

export const linksApi = {
    list: async (): Promise<CardLink[]> => {
        const res = await apiRequest<CardLink[]>('/links', { method: 'GET' });
        if (res.error) throw new Error(res.error);
        return res.data || [];
    },
    create: async (link: Partial<CardLink>): Promise<CardLink> => {
        const res = await apiRequest<CardLink>('/links', {
            method: 'POST',
            body: JSON.stringify(link)
        });
        if (res.error) throw new Error(res.error);
        return res.data;
    },
    update: async (id: number, link: Partial<CardLink>): Promise<CardLink> => {
        const res = await apiRequest<CardLink>(`/links/${id}`, {
            method: 'PUT',
            body: JSON.stringify(link)
        });
        if (res.error) throw new Error(res.error);
        return res.data;
    },
    delete: async (id: number): Promise<void> => {
        const res = await apiRequest<void>(`/links/${id}`, { method: 'DELETE' });
        if (res.error) throw new Error(res.error);
    }
};

export const canvasApi = {
    reset: async (): Promise<{ cards: CanvasCard[]; links: CardLink[] }> => {
        const res = await apiRequest<{ cards: CanvasCard[]; links: CardLink[] }>('/reset', { method: 'POST' });
        if (res.error) throw new Error(res.error);
        return res.data;
    }
};