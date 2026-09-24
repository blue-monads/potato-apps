import { API_BASE_PATH } from "./base";

const getAuthToken = (): string | null => {
    if (typeof window === 'undefined') return null;
    return (window as any).spaceGetToken?.('cimple-doks') || null;
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

export interface Author {
    name: string;
    quotes: string[];
}



export interface RawAuthor {
    name: string;
    slug: string;
    quotes: string;
}

export type RawAuthorEntry = Record<string, RawAuthor>;

export const authorsApi = {
    list: async (): Promise<Record<string, Author>> => {
        const response = await apiRequest<RawAuthor[]>('/author', { method: 'GET' });
        if (response.error) {
            throw new Error(response.error);
        }
        const data = response.data || [];
        const final = {} as Record<string, Author>;

        // Parse quotes JSON strings
        data.map((entry) => {
            const quotes = JSON.parse(entry.quotes || '[]') as string[];

            final[entry.slug] = {
                name: entry.name,
                quotes,
            }}
        );

        return final;
    },
};