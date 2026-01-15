import { API_BASE_PATH } from "./base";

const getAuthToken = (): string | null => {
    if (typeof window === 'undefined') return null;
    return (window as any).spaceGetToken?.('cimple-gis') || null;
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

export interface Feature {
    id: number;
    name: string;
    description: string;
    color: string;
    feature_type: 'point' | 'line' | 'area';
    geometry_data?: string;
    geometry?: any; // Parsed geometry from geometry_data
    created_at: string;
}

// Normalize geometry to ensure it's in the correct format
function normalizeGeometry(geometry: any, featureType: 'point' | 'line' | 'area'): any {
    if (!geometry) return null;

    // Point: should be [lat, lng]
    if (featureType === 'point') {
        if (Array.isArray(geometry) && geometry.length === 2) {
            const [lat, lng] = geometry;
            if (typeof lat === 'number' && typeof lng === 'number') {
                return [lat, lng];
            }
            // Try to parse if they're strings
            const parsedLat = typeof lat === 'string' ? parseFloat(lat) : lat;
            const parsedLng = typeof lng === 'string' ? parseFloat(lng) : lng;
            if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
                return [parsedLat, parsedLng];
            }
        }
        return null;
    }

    // Line/Area: should be [[lat, lng], [lat, lng], ...]
    if (featureType === 'line' || featureType === 'area') {
        if (!Array.isArray(geometry)) return null;
        
        return geometry.map((coord: any) => {
            // If coord is already a valid [lat, lng] pair
            if (Array.isArray(coord) && coord.length === 2) {
                const [lat, lng] = coord;
                if (typeof lat === 'number' && typeof lng === 'number') {
                    return [lat, lng];
                }
                // Try to parse if they're strings
                const parsedLat = typeof lat === 'string' ? parseFloat(lat) : lat;
                const parsedLng = typeof lng === 'string' ? parseFloat(lng) : lng;
                if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
                    return [parsedLat, parsedLng];
                }
            }
            
            // If coord is a string like "[51.5 -0.1]" or "[51.5, -0.1]"
            if (typeof coord === 'string') {
                // Remove brackets and split by space or comma
                const cleaned = coord.replace(/[\[\]]/g, '').trim();
                const parts = cleaned.split(/[\s,]+/).filter(p => p.length > 0);
                if (parts.length >= 2) {
                    const lat = parseFloat(parts[0]);
                    const lng = parseFloat(parts[1]);
                    if (!isNaN(lat) && !isNaN(lng)) {
                        return [lat, lng];
                    }
                }
            }
            
            return null;
        }).filter((coord: any) => coord !== null && Array.isArray(coord) && coord.length === 2);
    }

    return null;
}

export const featuresApi = {
    list: async (): Promise<Feature[]> => {
        const response = await apiRequest<Feature[]>('/features', { method: 'GET' });
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
        // Parse geometry_data for each feature
        return data.map(feature => {
            // First try to use geometry if it's already parsed
            if (feature.geometry) {
                feature.geometry = normalizeGeometry(feature.geometry, feature.feature_type);
            } else if (feature.geometry_data && feature.geometry_data !== '{}') {
                try {
                    const parsed = JSON.parse(feature.geometry_data);
                    feature.geometry = normalizeGeometry(parsed, feature.feature_type);
                } catch (e) {
                    console.error('Failed to parse geometry:', e);
                }
            }
            return feature;
        });
    },
    
    get: async (id: number): Promise<Feature> => {
        const response = await apiRequest<Feature>(`/features/${id}`, { method: 'GET' });
        if (response.error) {
            throw new Error(response.error);
        }
        const feature = response.data!;
        // First try to use geometry if it's already parsed
        if (feature.geometry) {
            feature.geometry = normalizeGeometry(feature.geometry, feature.feature_type);
        } else if (feature.geometry_data && feature.geometry_data !== '{}') {
            try {
                const parsed = JSON.parse(feature.geometry_data);
                feature.geometry = normalizeGeometry(parsed, feature.feature_type);
            } catch (e) {
                console.error('Failed to parse geometry:', e);
            }
        }
        return feature;
    },
    
    create: async (feature: Partial<Feature>): Promise<Feature> => {
        const response = await apiRequest<Feature>('/features', {
            method: 'POST',
            body: JSON.stringify({
                name: feature.name,
                description: feature.description,
                color: feature.color,
                feature_type: feature.feature_type,
                geometry: feature.geometry,
            }),
        });
        if (response.error) {
            throw new Error(response.error);
        }
        return response.data!;
    },
    
    delete: async (id: number): Promise<void> => {
        const response = await apiRequest<void>(`/features/${id}`, { method: 'DELETE' });
        if (response.error) {
            throw new Error(response.error);
        }
    },
};
