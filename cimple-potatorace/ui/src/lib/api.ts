import { API_BASE_PATH, WS_CAP_PATH } from "./base";

// ─── auth helpers ──────────────────────────────────────────────────────────────

const getAuthToken = (): string | null => {
    if (typeof window === 'undefined') return null;
    return (window as any).spaceGetToken?.('cimple-potatorace') || null;
};

// ─── generic fetch ─────────────────────────────────────────────────────────────

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

// ─── types ─────────────────────────────────────────────────────────────────────

export interface Player {
    user_id: number;
    conn_id: string;
    ready: boolean;
    is_host: boolean;
}

export interface Room {
    id: number;
    code: string;
    name: string;
    host_user_id: number;
    status: 'waiting' | 'playing' | 'finished';
    max_players: number;
    player_count: number;
    players: Player[];
    created_at: string;
}

export interface WsTokenResponse {
    token: string;
    conn_id: string;
}

// ─── WS token ─────────────────────────────────────────────────────────────────

export const getWsToken = async (): Promise<WsTokenResponse> => {
    const response = await apiRequest<WsTokenResponse>('/ws-token', { method: 'GET' });
    if (response.error) throw new Error(response.error);
    return response.data!;
};

export const buildWsUrl = (token: string): string => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}${WS_CAP_PATH}?token=${encodeURIComponent(token)}`;
};

export function normalizeRoom(room: Room | null | undefined): Room | null {
    if (!room) return null;
    if (!Array.isArray(room.players)) {
        room.players = [];
    }
    return room;
}

// ─── rooms API ─────────────────────────────────────────────────────────────────

export const roomsApi = {
    list: async (): Promise<Room[]> => {
        const res = await apiRequest<Room[]>('/rooms', { method: 'GET' });
        if (res.error) throw new Error(res.error);
        return (res.data || []).map(r => normalizeRoom(r)!);
    },

    create: async (payload: { name: string; conn_id: string; max_players?: number }): Promise<Room> => {
        const res = await apiRequest<Room>('/rooms', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        if (res.error) throw new Error(res.error);
        return normalizeRoom(res.data)!;
    },

    get: async (id: number): Promise<Room> => {
        const res = await apiRequest<Room>(`/rooms/${id}`, { method: 'GET' });
        if (res.error) throw new Error(res.error);
        return normalizeRoom(res.data)!;
    },

    joinByCode: async (code: string): Promise<Room> => {
        const res = await apiRequest<Room>('/rooms/join', {
            method: 'POST',
            body: JSON.stringify({ code }),
        });
        if (res.error) throw new Error(res.error);
        return normalizeRoom(res.data)!;
    },

    join: async (roomId: number, conn_id: string): Promise<Room> => {
        const res = await apiRequest<Room>(`/rooms/${roomId}/join`, {
            method: 'POST',
            body: JSON.stringify({ conn_id }),
        });
        if (res.error) throw new Error(res.error);
        return normalizeRoom(res.data)!;
    },

    leave: async (roomId: number, conn_id: string): Promise<void> => {
        await apiRequest<void>(`/rooms/${roomId}/leave`, {
            method: 'POST',
            body: JSON.stringify({ conn_id }),
        });
    },

    setReady: async (roomId: number, ready: boolean, conn_id: string): Promise<Room> => {
        const res = await apiRequest<Room>(`/rooms/${roomId}/ready`, {
            method: 'POST',
            body: JSON.stringify({ ready, conn_id }),
        });
        if (res.error) throw new Error(res.error);
        return normalizeRoom(res.data)!;
    },

    startGame: async (roomId: number, conn_id?: string): Promise<Room> => {
        const res = await apiRequest<Room>(`/rooms/${roomId}/start`, {
            method: 'POST',
            body: JSON.stringify({ conn_id }),
        });
        if (res.error) throw new Error(res.error);
        return normalizeRoom(res.data)!;
    },

    resetGame: async (roomId: number): Promise<Room> => {
        const res = await apiRequest<Room>(`/rooms/${roomId}/reset`, {
            method: 'POST',
        });
        if (res.error) throw new Error(res.error);
        return normalizeRoom(res.data)!;
    },
};

// ─── public (no-auth) room view for TV screen ──────────────────────────────────
export const getRoomView = async (roomId: number): Promise<Room> => {
    const response = await fetch(`${API_BASE_PATH}/rooms/${roomId}/view`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return normalizeRoom(data)!;
};