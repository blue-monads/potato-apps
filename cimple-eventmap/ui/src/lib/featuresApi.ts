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

export function sanitizePoint(pt: any): [number, number] | null {
    if (!pt) return null;
    if (Array.isArray(pt) && pt.length >= 2) {
        const lat = typeof pt[0] === 'number' ? pt[0] : parseFloat(pt[0]);
        const lng = typeof pt[1] === 'number' ? pt[1] : parseFloat(pt[1]);
        if (!isNaN(lat) && !isNaN(lng)) return [lat, lng];
    }
    if (typeof pt === 'object' && pt !== null) {
        const lat = typeof pt.lat === 'number' ? pt.lat : parseFloat(pt.lat ?? pt.latitude);
        const lng = typeof pt.lng === 'number' ? pt.lng : parseFloat(pt.lng ?? pt.longitude);
        if (!isNaN(lat) && !isNaN(lng)) return [lat, lng];
    }
    if (typeof pt === 'string') {
        const cleaned = pt.replace(/[\[\]]/g, '').trim();
        const parts = cleaned.split(/[\s,]+/).filter(p => p.length > 0);
        if (parts.length >= 2) {
            const lat = parseFloat(parts[0]);
            const lng = parseFloat(parts[1]);
            if (!isNaN(lat) && !isNaN(lng)) return [lat, lng];
        }
    }
    return null;
}

export function isValidPoint(geom: any): geom is [number, number] {
    return Array.isArray(geom) && 
           geom.length === 2 && 
           typeof geom[0] === 'number' && 
           typeof geom[1] === 'number' && 
           !isNaN(geom[0]) && 
           !isNaN(geom[1]);
}

export function isValidLine(geom: any): geom is [number, number][] {
    return Array.isArray(geom) && 
           geom.length >= 2 && 
           geom.every(isValidPoint);
}

export function isValidArea(geom: any): geom is [number, number][] {
    return Array.isArray(geom) && 
           geom.length >= 3 && 
           geom.every(isValidPoint);
}

// Normalize geometry to ensure it's in the correct format and free of nulls
export function normalizeGeometry(geometry: any, featureType: string): any {
    if (!geometry) return null;

    // GeoJSON Feature or Geometry object
    if (typeof geometry === 'object' && !Array.isArray(geometry)) {
        if (geometry.coordinates) {
            geometry = geometry.coordinates;
        } else if (geometry.geometry && geometry.geometry.coordinates) {
            geometry = geometry.geometry.coordinates;
        } else {
            const pt = sanitizePoint(geometry);
            if (pt && featureType === 'point') return pt;
        }
    }

    if (featureType === 'point') {
        return sanitizePoint(geometry);
    }

    if (featureType === 'line' || featureType === 'area') {
        if (!Array.isArray(geometry)) return null;

        // Flatten nested rings if any: [[[lat, lng], ...]] -> [[lat, lng], ...]
        let points = geometry;
        while (Array.isArray(points) && points.length === 1 && Array.isArray(points[0]) && Array.isArray(points[0][0])) {
            points = points[0];
        }

        const result: [number, number][] = [];
        for (const item of points) {
            const pt = sanitizePoint(item);
            if (pt) result.push(pt);
        }

        if (featureType === 'line') {
            return result.length >= 2 ? result : null;
        }
        if (featureType === 'area') {
            return result.length >= 3 ? result : null;
        }
    }

    return null;
}

function processFeature(feature: Feature): Feature {
    if (feature.geometry) {
        feature.geometry = normalizeGeometry(feature.geometry, feature.feature_type);
    } else if (feature.geometry_data && feature.geometry_data !== '{}') {
        try {
            const parsed = JSON.parse(feature.geometry_data);
            feature.geometry = normalizeGeometry(parsed, feature.feature_type);
        } catch (e) {
            console.error('Failed to parse geometry:', e);
            feature.geometry = null;
        }
    } else {
        feature.geometry = null;
    }
    return feature;
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
        return data.map(processFeature);
    },
    
    get: async (id: number): Promise<Feature> => {
        const response = await apiRequest<Feature>(`/features/${id}`, { method: 'GET' });
        if (response.error) {
            throw new Error(response.error);
        }
        return processFeature(response.data!);
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
        return processFeature(response.data!);
    },
    
    update: async (id: number, feature: Partial<Feature>): Promise<Feature> => {
        const response = await apiRequest<Feature>(`/features/${id}`, {
            method: 'PUT',
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
        return processFeature(response.data!);
    },
    
    delete: async (id: number): Promise<void> => {
        const response = await apiRequest<void>(`/features/${id}`, { method: 'DELETE' });
        if (response.error) {
            throw new Error(response.error);
        }
    },
};
