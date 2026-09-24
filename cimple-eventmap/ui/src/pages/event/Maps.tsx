import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { 
    MapContainer, 
    TileLayer, 
    Marker, 
    Popup, 
    Polyline, 
    Polygon, 
    Tooltip, 
    useMap, 
    useMapEvents 
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
    MousePointer, 
    MapPin, 
    Tag, 
    Ruler, 
    Route, 
    MoveRight, 
    Hexagon, 
    Square, 
    Circle as CircleIcon, 
    Eye, 
    EyeOff, 
    Trash2, 
    Edit3, 
    Plus, 
    Search, 
    X, 
    Check, 
    RotateCcw, 
    Calendar, 
    ExternalLink,
    Crosshair,
    Image as ImageIcon,
    Folder,
    FolderPlus,
    FolderOpen,
    FolderInput,
    ChevronRight,
    ChevronDown
} from 'lucide-react';
import { eventsApi, type Event } from '../../lib/eventsApi';
import { eventTypesApi, type EventType } from '../../lib/eventTypesApi';
import { featuresApi, type Feature, isValidPoint, isValidLine, isValidArea, normalizeGeometry } from '../../lib/featuresApi';
import { getWsToken } from '../../lib/api';
import { Header } from '../../components/Header';
import { BASE_PATH } from '../../lib/base';
import { useNavigate } from 'react-router';

export interface FeatureGroup {
    id: string;
    name: string;
    collapsed?: boolean;
    visible?: boolean;
}

// Fix for default Leaflet marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Standard FontAwesome icons for markers
const FA_ICONS = [
    { icon: 'fa-location-dot', name: 'Pin' },
    { icon: 'fa-house', name: 'Home' },
    { icon: 'fa-building', name: 'Building' },
    { icon: 'fa-star', name: 'Star' },
    { icon: 'fa-heart', name: 'Heart' },
    { icon: 'fa-flag', name: 'Flag' },
    { icon: 'fa-camera', name: 'Camera' },
    { icon: 'fa-car', name: 'Car' },
    { icon: 'fa-bicycle', name: 'Bike' },
    { icon: 'fa-person-walking', name: 'Walk' },
    { icon: 'fa-utensils', name: 'Food' },
    { icon: 'fa-mug-hot', name: 'Cafe' },
    { icon: 'fa-tree', name: 'Park' },
    { icon: 'fa-mountain-sun', name: 'Mountain' },
    { icon: 'fa-water', name: 'Water' },
    { icon: 'fa-plane', name: 'Airport' },
    { icon: 'fa-train', name: 'Train' },
    { icon: 'fa-bus', name: 'Bus' },
    { icon: 'fa-hospital', name: 'Hospital' },
    { icon: 'fa-school', name: 'School' },
    { icon: 'fa-store', name: 'Store' },
    { icon: 'fa-cart-shopping', name: 'Shop' },
    { icon: 'fa-paw', name: 'Pet' },
    { icon: 'fa-wifi', name: 'Wi-Fi' },
    { icon: 'fa-circle-info', name: 'Info' },
    { icon: 'fa-bell', name: 'Alert' },
    { icon: 'fa-triangle-exclamation', name: 'Warning' },
    { icon: 'fa-fire', name: 'Hazard' },
    { icon: 'fa-shield-halved', name: 'Security' },
    { icon: 'fa-crosshairs', name: 'Target' },
    { icon: 'fa-gas-pump', name: 'Fuel' },
    { icon: 'fa-circle-question', name: 'Help' },
];

type ToolMode = 
    | 'select' 
    | 'marker' 
    | 'label' 
    | 'line' 
    | 'arrow' 
    | 'polygon' 
    | 'rectangle' 
    | 'circle' 
    | 'ruler';

// Distance calculation
function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const R = 6371008.8;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dPhi = toRad(b.lat - a.lat);
    const dLambda = toRad(b.lng - a.lng);
    const sinPhi = Math.sin(dPhi / 2);
    const sinLambda = Math.sin(dLambda / 2);
    const h = sinPhi * sinPhi + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLambda * sinLambda;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function formatDistance(meters: number): string {
    if (meters < 1000) return `${meters.toFixed(meters < 100 ? 1 : 0)} m`;
    if (meters < 10000) return `${(meters / 1000).toFixed(2)} km`;
    return `${(meters / 1000).toFixed(1)} km`;
}

// Spherical great-circle points
function sphericalPoints(a: [number, number], b: [number, number], steps = 32): [number, number][] {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const toDeg = (r: number) => (r * 180) / Math.PI;

    const lat1 = toRad(a[0]), lon1 = toRad(a[1]);
    const lat2 = toRad(b[0]), lon2 = toRad(b[1]);

    const d = 2 * Math.asin(Math.sqrt(
        Math.pow(Math.sin((lat1 - lat2) / 2), 2) +
        Math.cos(lat1) * Math.cos(lat2) * Math.pow(Math.sin((lon1 - lon2) / 2), 2)
    ));

    if (d < 1e-6) return [a, b];

    const points: [number, number][] = [];
    for (let i = 0; i <= steps; i++) {
        const f = i / steps;
        const A = Math.sin((1 - f) * d) / Math.sin(d);
        const B = Math.sin(f * d) / Math.sin(d);
        const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
        const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
        const z = A * Math.sin(lat1) + B * Math.sin(lat2);
        const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
        const lon = Math.atan2(y, x);
        points.push([toDeg(lat), toDeg(lon)]);
    }
    return points;
}

// Leaflet map controller & event listener
function MapController({
    onMapClick,
    onMouseMove,
    center,
    zoom
}: {
    onMapClick: (lat: number, lng: number) => void;
    onMouseMove: (lat: number, lng: number) => void;
    center: [number, number];
    zoom: number;
}) {
    const map = useMap();

    useEffect(() => {
        if (center[0] !== 0 && center[1] !== 0) {
            map.setView(center, zoom);
        }
    }, [center, zoom, map]);

    useMapEvents({
        click(e) {
            onMapClick(e.latlng.lat, e.latlng.lng);
        },
        mousemove(e) {
            onMouseMove(e.latlng.lat, e.latlng.lng);
        },
    });

    return null;
}

export const Maps: React.FC = () => {
    const navigate = useNavigate();

    // Data State
    const [events, setEvents] = useState<Event[]>([]);
    const [eventTypes, setEventTypes] = useState<EventType[]>([]);
    const [features, setFeatures] = useState<Feature[]>([]);
    const [hiddenFeatures, setHiddenFeatures] = useState<Set<number>>(new Set());

    // UI State
    const [loading, setLoading] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [eventsOpen, setEventsOpen] = useState(false);
    const [activeMode, setActiveMode] = useState<ToolMode>('select');
    const [cursorCoords, setCursorCoords] = useState<[number, number] | null>(null);
    const [mapCenter, setMapCenter] = useState<[number, number]>([27.7172, 85.3240]);
    const [mapZoom, setMapZoom] = useState(13);
    const [searchEventsText, setSearchEventsText] = useState('');
    const [selectedEventTypeId, setSelectedEventTypeId] = useState<number | null>(null);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [searchFeaturesText, setSearchFeaturesText] = useState('');

    // Feature Groups (Folders) State
    const [groups, setGroups] = useState<FeatureGroup[]>(() => {
        try {
            const saved = localStorage.getItem('cimple_eventmap_feature_groups');
            if (saved) return JSON.parse(saved);
        } catch (_) {}
        return [];
    });
    const [folderModalOpen, setFolderModalOpen] = useState(false);
    const [folderModalMode, setFolderModalMode] = useState<'create' | 'rename'>('create');
    const [folderModalTargetId, setFolderModalTargetId] = useState<string | null>(null);
    const [folderInputName, setFolderInputName] = useState('');
    const [moveMenuFeatureId, setMoveMenuFeatureId] = useState<number | null>(null);

    // Persist groups
    useEffect(() => {
        try {
            localStorage.setItem('cimple_eventmap_feature_groups', JSON.stringify(groups));
        } catch (_) {}
    }, [groups]);

    // Drawing Temp State
    const [tempPoints, setTempPoints] = useState<[number, number][]>([]);
    const [rulerPoints, setRulerPoints] = useState<[number, number][]>([]);

    // Modals State
    const [markerModalOpen, setMarkerModalOpen] = useState(false);
    const [pendingCoords, setPendingCoords] = useState<[number, number] | null>(null);
    const [markerForm, setMarkerForm] = useState({
        name: '',
        notes: '',
        color: '#4f46e5',
        icon: 'fa-location-dot',
        groupId: '',
    });

    const [labelModalOpen, setLabelModalOpen] = useState(false);
    const [labelForm, setLabelForm] = useState({
        text: '',
        color: '#1e293b',
        bgColor: '#ffffff',
        groupId: '',
    });

    const [shapeSaveModalOpen, setShapeSaveModalOpen] = useState(false);
    const [pendingShape, setPendingShape] = useState<{
        type: 'line' | 'area';
        geometry: any;
    } | null>(null);
    const [shapeForm, setShapeForm] = useState({
        name: '',
        description: '',
        color: '#3b82f6',
        groupId: '',
    });

    const [editingFeature, setEditingFeature] = useState<Feature | null>(null);
    const [editForm, setEditForm] = useState({
        name: '',
        description: '',
        color: '#3b82f6',
        groupId: '',
    });

    const wsRef = useRef<WebSocket | null>(null);
    const mapRef = useRef<L.Map | null>(null);

    // Initial load & window event listeners
    useEffect(() => {
        loadData();
        connectWebSocket();

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setMarkerModalOpen(false);
                setLabelModalOpen(false);
                setShapeSaveModalOpen(false);
                setEditingFeature(null);
                setFolderModalOpen(false);
                setMoveMenuFeatureId(null);
                setTempPoints([]);
                setActiveMode('select');
            }
        };
        const handleClickOutside = () => {
            setMoveMenuFeatureId(null);
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('click', handleClickOutside);

        return () => {
            if (wsRef.current) wsRef.current.close();
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('click', handleClickOutside);
        };
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [eventsData, typesData, featuresData] = await Promise.all([
                eventsApi.query().catch(() => []),
                eventTypesApi.list().catch(() => []),
                featuresApi.list().catch(() => []),
            ]);

            setEvents(Array.isArray(eventsData) ? eventsData : []);
            setEventTypes(Array.isArray(typesData) ? typesData : []);
            setFeatures(Array.isArray(featuresData) ? featuresData : []);

            // Set map center if events or features exist
            if (eventsData && eventsData.length > 0 && eventsData[0].lat !== 0) {
                setMapCenter([eventsData[0].lat, eventsData[0].lng]);
            } else if (featuresData && featuresData.length > 0 && featuresData[0].geometry) {
                const g = featuresData[0].geometry;
                if (Array.isArray(g) && typeof g[0] === 'number') {
                    setMapCenter([g[0], g[1]]);
                } else if (Array.isArray(g) && Array.isArray(g[0])) {
                    setMapCenter([g[0][0], g[0][1]]);
                }
            }
        } catch (err) {
            console.error('Error loading map data:', err);
        } finally {
            setLoading(false);
        }
    };

    const connectWebSocket = async () => {
        try {
            const tokenResponse = await getWsToken();
            const token = tokenResponse.easyws_cap_token;
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.host;
            const wsUrl = `${protocol}//${host}/zz/api/capabilities/cimple-eventmap/easy-ws?token=${encodeURIComponent(token)}`;

            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    if (message.type === 'sbroadcast' && message.data) {
                        const dataMessage = typeof message.data === 'string' ? JSON.parse(message.data) : message.data;
                        if (dataMessage.type === 'event_created') {
                            setEvents((prev) => [dataMessage.data, ...prev]);
                        } else if (dataMessage.type === 'feature_created') {
                            const raw = dataMessage.data;
                            if (raw) {
                                if (!raw.geometry && raw.geometry_data) {
                                    try { raw.geometry = JSON.parse(raw.geometry_data); } catch (e) {}
                                }
                                raw.geometry = normalizeGeometry(raw.geometry, raw.feature_type);
                                setFeatures((prev) => [...prev, raw]);
                            }
                        } else if (dataMessage.type === 'feature_deleted') {
                            setFeatures((prev) => prev.filter((f) => f.id !== dataMessage.data?.id));
                        }
                    }
                } catch (e) {
                    console.error('WebSocket parse error:', e);
                }
            };
        } catch (e) {
            console.warn('Could not connect WebSocket:', e);
        }
    };

    // Fit all bounds
    const handleFitBounds = useCallback(() => {
        const coords: [number, number][] = [];
        events.forEach((e) => {
            if (e.lat && e.lng) coords.push([e.lat, e.lng]);
        });
        features.forEach((f) => {
            if (!f.geometry) return;
            if (f.feature_type === 'point' && Array.isArray(f.geometry)) {
                coords.push(f.geometry as [number, number]);
            } else if (Array.isArray(f.geometry)) {
                f.geometry.forEach((p: any) => {
                    if (Array.isArray(p)) coords.push(p as [number, number]);
                });
            }
        });

        if (coords.length > 0 && mapRef.current) {
            const bounds = L.latLngBounds(coords.map((c) => L.latLng(c[0], c[1])));
            mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
        }
    }, [events, features]);

    // Export map data
    const handleExport = () => {
        const data = {
            exportedAt: new Date().toISOString(),
            features,
            featureGroups: groups,
            events,
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `eventmap-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Import map data
    const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            if (Array.isArray(data.features)) {
                for (const f of data.features) {
                    await featuresApi.create(f);
                }
            }
            if (Array.isArray(data.featureGroups)) {
                setGroups((prev) => {
                    const existingIds = new Set(prev.map((g) => g.id));
                    const merged = [...prev];
                    for (const g of data.featureGroups) {
                        if (g && g.id && !existingIds.has(g.id)) {
                            merged.push(g);
                            existingIds.add(g.id);
                        }
                    }
                    return merged;
                });
            }
            loadData();
            alert('Import completed successfully!');
        } catch (e) {
            console.error('Import failed:', e);
            alert('Failed to import map data.');
        }
    };

    // Clear features
    const handleClear = async () => {
        if (!confirm('Are you sure you want to delete all saved features? This cannot be undone.')) return;
        try {
            await Promise.all(features.map((f) => featuresApi.delete(f.id)));
            setFeatures([]);
            setTempPoints([]);
            setRulerPoints([]);
        } catch (e) {
            console.error('Failed to clear features:', e);
        }
    };

    // Map Click Handler depending on mode
    const handleMapClick = (lat: number, lng: number) => {
        const point: [number, number] = [lat, lng];

        if (activeMode === 'marker') {
            setPendingCoords(point);
            setMarkerForm({
                name: 'New Marker',
                notes: '',
                color: '#4f46e5',
                icon: 'fa-location-dot',
                groupId: '',
            });
            setMarkerModalOpen(true);
            return;
        }

        if (activeMode === 'label') {
            setPendingCoords(point);
            setLabelForm({
                text: 'New Label',
                color: '#1e293b',
                bgColor: '#ffffff',
                groupId: '',
            });
            setLabelModalOpen(true);
            return;
        }

        if (activeMode === 'ruler') {
            setRulerPoints((prev) => [...prev, point]);
            return;
        }

        if (activeMode === 'line') {
            const next = [...tempPoints, point];
            setTempPoints(next);
            if (next.length >= 2) {
                // Auto prompt save or click check
            }
            return;
        }

        if (activeMode === 'arrow') {
            if (tempPoints.length === 0) {
                setTempPoints([point]);
            } else {
                const curved = sphericalPoints(tempPoints[0], point, 32);
                setPendingShape({ type: 'line', geometry: curved });
                setShapeForm({ name: 'Directional Arrow', description: 'Curved Arrow', color: '#6366f1', groupId: '' });
                setShapeSaveModalOpen(true);
                setTempPoints([]);
            }
            return;
        }

        if (activeMode === 'rectangle') {
            if (tempPoints.length === 0) {
                setTempPoints([point]);
            } else {
                const p1 = tempPoints[0];
                const p2 = point;
                const rectPoints: [number, number][] = [
                    p1,
                    [p1[0], p2[1]],
                    p2,
                    [p2[0], p1[1]],
                ];
                setPendingShape({ type: 'area', geometry: rectPoints });
                setShapeForm({ name: 'Rectangle Area', description: 'Custom area shape', color: '#10b981', groupId: '' });
                setShapeSaveModalOpen(true);
                setTempPoints([]);
            }
            return;
        }

        if (activeMode === 'circle') {
            if (tempPoints.length === 0) {
                setTempPoints([point]);
            } else {
                const center = tempPoints[0];
                const radius = distanceMeters({ lat: center[0], lng: center[1] }, { lat: point[0], lng: point[1] });
                // Generate a circle polygon with 36 points
                const circlePoints: [number, number][] = [];
                for (let i = 0; i < 36; i++) {
                    const angle = (i * 10 * Math.PI) / 180;
                    const dLat = (radius / 111320) * Math.cos(angle);
                    const dLng = (radius / (111320 * Math.cos((center[0] * Math.PI) / 180))) * Math.sin(angle);
                    circlePoints.push([center[0] + dLat, center[1] + dLng]);
                }
                setPendingShape({ type: 'area', geometry: circlePoints });
                setShapeForm({ 
                    name: `Circle (${formatDistance(radius)})`, 
                    description: `Circle area with radius ${formatDistance(radius)}`, 
                    color: '#8b5cf6',
                    groupId: '',
                });
                setShapeSaveModalOpen(true);
                setTempPoints([]);
            }
            return;
        }

        if (activeMode === 'polygon') {
            setTempPoints((prev) => [...prev, point]);
            return;
        }
    };

    // Finish multi-point line
    const finishLine = () => {
        if (tempPoints.length < 2) return;
        setPendingShape({ type: 'line', geometry: tempPoints });
        setShapeForm({ name: 'Line Path', description: 'Custom polyline path', color: '#3b82f6', groupId: '' });
        setShapeSaveModalOpen(true);
        setTempPoints([]);
    };

    // Finish multi-point polygon
    const finishPolygon = () => {
        if (tempPoints.length < 3) return;
        setPendingShape({ type: 'area', geometry: tempPoints });
        setShapeForm({ name: 'Area Polygon', description: 'Custom boundary area', color: '#059669', groupId: '' });
        setShapeSaveModalOpen(true);
        setTempPoints([]);
    };

    // Save newly drawn Marker
    const handleSaveMarker = async () => {
        if (!pendingCoords || !markerForm.name.trim()) return;
        try {
            const descObj: any = {
                notes: markerForm.notes,
                icon: markerForm.icon,
                type: 'marker',
            };
            if (markerForm.groupId) {
                descObj.groupId = markerForm.groupId;
            }
            const created = await featuresApi.create({
                name: markerForm.name,
                description: JSON.stringify(descObj),
                color: markerForm.color,
                feature_type: 'point',
                geometry: pendingCoords,
            });
            setFeatures((prev) => [...prev, created]);
            setMarkerModalOpen(false);
            setPendingCoords(null);
            setActiveMode('select');
        } catch (e) {
            console.error('Failed to create marker:', e);
            alert('Could not save marker.');
        }
    };

    // Save newly drawn Label
    const handleSaveLabel = async () => {
        if (!pendingCoords || !labelForm.text.trim()) return;
        try {
            const descObj: any = {
                text: labelForm.text,
                bgColor: labelForm.bgColor,
                type: 'label',
            };
            if (labelForm.groupId) {
                descObj.groupId = labelForm.groupId;
            }
            const created = await featuresApi.create({
                name: labelForm.text,
                description: JSON.stringify(descObj),
                color: labelForm.color,
                feature_type: 'point',
                geometry: pendingCoords,
            });
            setFeatures((prev) => [...prev, created]);
            setLabelModalOpen(false);
            setPendingCoords(null);
            setActiveMode('select');
        } catch (e) {
            console.error('Failed to create label:', e);
            alert('Could not save label.');
        }
    };

    // Save newly drawn Shape (line / area)
    const handleSaveShape = async () => {
        if (!pendingShape || !shapeForm.name.trim()) return;
        try {
            const descObj: any = {
                notes: shapeForm.description,
                type: pendingShape.type,
            };
            if (shapeForm.groupId) {
                descObj.groupId = shapeForm.groupId;
            }
            const created = await featuresApi.create({
                name: shapeForm.name,
                description: JSON.stringify(descObj),
                color: shapeForm.color,
                feature_type: pendingShape.type,
                geometry: pendingShape.geometry,
            });
            setFeatures((prev) => [...prev, created]);
            setShapeSaveModalOpen(false);
            setPendingShape(null);
            setActiveMode('select');
        } catch (e) {
            console.error('Failed to save feature:', e);
            alert('Could not save shape.');
        }
    };

    // Save edited Feature
    const handleSaveEdit = async () => {
        if (!editingFeature) return;
        try {
            const meta = getFeatureMeta(editingFeature);
            let descObj: any = {};
            if (editingFeature.description && editingFeature.description.startsWith('{')) {
                try {
                    descObj = JSON.parse(editingFeature.description);
                } catch (_) {
                    descObj = {};
                }
            }
            descObj.notes = editForm.description;
            descObj.icon = meta.icon;
            if (meta.isLabel) {
                descObj.type = 'label';
                descObj.text = editForm.name;
                descObj.bgColor = meta.labelBg;
            } else if (editingFeature.feature_type === 'point') {
                descObj.type = 'marker';
            }
            if (editForm.groupId) {
                descObj.groupId = editForm.groupId;
            } else {
                delete descObj.groupId;
            }

            const updated = await featuresApi.update(editingFeature.id, {
                name: editForm.name,
                description: JSON.stringify(descObj),
                color: editForm.color,
            });
            setFeatures((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
            setEditingFeature(null);
        } catch (e) {
            console.error('Failed to update feature:', e);
            alert('Could not update feature.');
        }
    };

    // Delete Feature
    const handleDeleteFeature = async (id: number) => {
        if (!confirm('Are you sure you want to delete this feature?')) return;
        try {
            await featuresApi.delete(id);
            setFeatures((prev) => prev.filter((f) => f.id !== id));
            if (editingFeature?.id === id) setEditingFeature(null);
        } catch (e) {
            console.error('Failed to delete feature:', e);
            alert('Could not delete feature.');
        }
    };

    // Folder (FeatureGroup) management functions
    const openCreateFolderModal = () => {
        setFolderModalMode('create');
        setFolderModalTargetId(null);
        setFolderInputName('');
        setFolderModalOpen(true);
    };

    const openRenameFolderModal = (group: FeatureGroup) => {
        setFolderModalMode('rename');
        setFolderModalTargetId(group.id);
        setFolderInputName(group.name);
        setFolderModalOpen(true);
    };

    const handleSaveFolderModal = () => {
        const trimmed = folderInputName.trim();
        if (!trimmed) return;
        if (folderModalMode === 'create') {
            const newGroup: FeatureGroup = {
                id: `fg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                name: trimmed,
                collapsed: false,
                visible: true,
            };
            setGroups((prev) => [...prev, newGroup]);
        } else if (folderModalMode === 'rename' && folderModalTargetId) {
            setGroups((prev) =>
                prev.map((g) => (g.id === folderModalTargetId ? { ...g, name: trimmed } : g))
            );
        }
        setFolderModalOpen(false);
    };

    const handleDeleteFolder = async (groupId: string) => {
        const targetGroup = groups.find((g) => g.id === groupId);
        if (!confirm(`Delete folder "${targetGroup?.name || 'Folder'}"? Features in this folder will become ungrouped.`)) {
            return;
        }

        setGroups((prev) => prev.filter((g) => g.id !== groupId));

        // In background, clear groupId from features belonging to this folder
        const affected = features.filter((f) => getFeatureMeta(f).groupId === groupId);
        for (const feat of affected) {
            try {
                let descObj: any = {};
                if (feat.description && feat.description.startsWith('{')) {
                    try {
                        descObj = JSON.parse(feat.description);
                    } catch (_) {
                        descObj = { notes: feat.description };
                    }
                } else {
                    descObj = { notes: feat.description || '' };
                }
                delete descObj.groupId;
                const updated = await featuresApi.update(feat.id, {
                    name: feat.name,
                    description: JSON.stringify(descObj),
                    color: feat.color,
                });
                setFeatures((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
            } catch (e) {
                console.error('Failed to ungroup feature during folder deletion:', e);
            }
        }
    };

    const handleToggleFolderCollapse = (groupId: string) => {
        setGroups((prev) =>
            prev.map((g) => (g.id === groupId ? { ...g, collapsed: !g.collapsed } : g))
        );
    };

    const handleToggleFolderVisibility = (groupId: string) => {
        setGroups((prev) =>
            prev.map((g) => (g.id === groupId ? { ...g, visible: g.visible === false ? true : false } : g))
        );
    };

    const handleMoveFeature = async (featureId: number, targetGroupId: string | null) => {
        const feat = features.find((f) => f.id === featureId);
        if (!feat) return;
        try {
            let descObj: any = {};
            if (feat.description && feat.description.startsWith('{')) {
                try {
                    descObj = JSON.parse(feat.description);
                } catch (_) {
                    descObj = { notes: feat.description };
                }
            } else {
                descObj = { notes: feat.description || '' };
            }

            if (targetGroupId) {
                descObj.groupId = targetGroupId;
            } else {
                delete descObj.groupId;
            }

            const updated = await featuresApi.update(feat.id, {
                name: feat.name,
                description: JSON.stringify(descObj),
                color: feat.color,
            });
            setFeatures((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
        } catch (e) {
            console.error('Failed to move feature to folder:', e);
            alert('Could not move feature.');
        }
    };

    const zoomToFeature = (feat: Feature) => {
        if (feat.geometry) {
            if (feat.feature_type === 'point' && Array.isArray(feat.geometry)) {
                setMapCenter(feat.geometry as [number, number]);
                setMapZoom(16);
            } else if (Array.isArray(feat.geometry) && feat.geometry.length > 0) {
                const first = feat.geometry[0];
                if (Array.isArray(first)) {
                    setMapCenter(first as [number, number]);
                    setMapZoom(15);
                }
            }
        }
    };

    // Total measured distance for ruler
    const totalRulerDistance = useMemo(() => {
        if (rulerPoints.length < 2) return 0;
        let total = 0;
        for (let i = 0; i < rulerPoints.length - 1; i++) {
            total += distanceMeters(
                { lat: rulerPoints[i][0], lng: rulerPoints[i][1] },
                { lat: rulerPoints[i + 1][0], lng: rulerPoints[i + 1][1] }
            );
        }
        return total;
    }, [rulerPoints]);

    // Parse feature metadata (icon, label, notes, groupId)
    const getFeatureMeta = (feature: Feature) => {
        let icon = 'fa-location-dot';
        let notes = feature.description || '';
        let isLabel = false;
        let labelBg = '#ffffff';
        let groupId: string | undefined = undefined;

        if (feature.description && feature.description.startsWith('{')) {
            try {
                const parsed = JSON.parse(feature.description);
                if (parsed.icon) icon = parsed.icon;
                if (parsed.notes !== undefined) notes = parsed.notes;
                if (parsed.groupId) groupId = parsed.groupId;
                if (parsed.type === 'label') {
                    isLabel = true;
                    if (parsed.bgColor) labelBg = parsed.bgColor;
                }
            } catch (_) {}
        }
        return { icon, notes, isLabel, labelBg, groupId };
    };

    // Check if feature should be rendered on the Leaflet map
    const isFeatureVisibleOnMap = useCallback((feat: Feature) => {
        if (hiddenFeatures.has(feat.id)) return false;
        const meta = getFeatureMeta(feat);
        if (meta.groupId) {
            const parentGroup = groups.find((g) => g.id === meta.groupId);
            if (parentGroup && parentGroup.visible === false) return false;
        }
        return true;
    }, [hiddenFeatures, groups]);

    // Filtered events
    const filteredEvents = useMemo(() => {
        return events.filter((e) => {
            const matchesType = !selectedEventTypeId || e.event_type_id === selectedEventTypeId;
            const matchesText = !searchEventsText.trim() || 
                (e.title && e.title.toLowerCase().includes(searchEventsText.toLowerCase())) ||
                (e.info && e.info.toLowerCase().includes(searchEventsText.toLowerCase()));
            return matchesType && matchesText;
        });
    }, [events, selectedEventTypeId, searchEventsText]);

    // Filtered features
    const filteredFeatures = useMemo(() => {
        if (!searchFeaturesText.trim()) return features;
        const lower = searchFeaturesText.toLowerCase();
        return features.filter((f) => 
            f.name.toLowerCase().includes(lower) ||
            (f.description && f.description.toLowerCase().includes(lower))
        );
    }, [features, searchFeaturesText]);

    // Partition features into grouped folders and ungrouped root
    const { groupedFeatures, ungroupedFeatures } = useMemo(() => {
        const grouped = new Map<string, Feature[]>();
        groups.forEach((g) => grouped.set(g.id, []));
        const ungrouped: Feature[] = [];

        filteredFeatures.forEach((feat) => {
            const meta = getFeatureMeta(feat);
            if (meta.groupId && grouped.has(meta.groupId)) {
                grouped.get(meta.groupId)!.push(feat);
            } else {
                ungrouped.push(feat);
            }
        });

        return { groupedFeatures: grouped, ungroupedFeatures: ungrouped };
    }, [filteredFeatures, groups]);

    // Helper to render an individual feature row in the tree
    const renderFeatureItem = (feat: Feature, isParentFolderHidden: boolean = false) => {
        const meta = getFeatureMeta(feat);
        const isDirectlyHidden = hiddenFeatures.has(feat.id);
        const isHidden = isDirectlyHidden || isParentFolderHidden;

        return (
            <div
                key={feat.id}
                onClick={() => {
                    zoomToFeature(feat);
                    setEditingFeature(feat);
                    setEditForm({
                        name: feat.name,
                        description: meta.notes || '',
                        color: feat.color || '#3b82f6',
                        groupId: meta.groupId || '',
                    });
                }}
                className={`p-1.5 rounded-lg border flex items-center justify-between text-left cursor-pointer transition-all ${
                    isHidden
                        ? 'opacity-50 bg-gray-50 border-gray-100'
                        : 'bg-white border-gray-200 hover:border-indigo-200 hover:bg-indigo-50/30'
                }`}
            >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div 
                        className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-white shadow-2xs"
                        style={{ backgroundColor: feat.color || '#4f46e5' }}
                    >
                        {feat.feature_type === 'point' ? (
                            <i className={`fa ${meta.icon} text-[11px]`}></i>
                        ) : feat.feature_type === 'line' ? (
                            <Route className="w-3 h-3" />
                        ) : (
                            <Hexagon className="w-3 h-3" />
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className={`text-xs font-semibold text-gray-900 truncate ${isHidden ? 'line-through' : ''}`}>
                            {feat.name}
                        </div>
                        <div className="text-[10px] text-gray-400 capitalize">
                            {feat.feature_type}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {/* Move to Folder Quick Dropdown */}
                    <div className="relative">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setMoveMenuFeatureId(moveMenuFeatureId === feat.id ? null : feat.id);
                            }}
                            className="p-1 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50"
                            title="Move to folder..."
                        >
                            <FolderInput className="w-3.5 h-3.5" />
                        </button>

                        {moveMenuFeatureId === feat.id && (
                            <div 
                                className="absolute right-0 top-full mt-1 w-44 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50 animate-in fade-in"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="px-2.5 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                                    Move to folder
                                </div>
                                <button
                                    onClick={() => {
                                        handleMoveFeature(feat.id, null);
                                        setMoveMenuFeatureId(null);
                                    }}
                                    className={`w-full px-2.5 py-1.5 text-left text-xs flex items-center gap-2 hover:bg-indigo-50 hover:text-indigo-600 ${
                                        !meta.groupId ? 'font-bold text-indigo-600 bg-indigo-50/50' : 'text-gray-700'
                                    }`}
                                >
                                    <span className="text-gray-400 font-mono text-[11px]">/</span>
                                    <span className="truncate">None (Ungrouped)</span>
                                </button>
                                {groups.map((g) => (
                                    <button
                                        key={g.id}
                                        onClick={() => {
                                            handleMoveFeature(feat.id, g.id);
                                            setMoveMenuFeatureId(null);
                                        }}
                                        className={`w-full px-2.5 py-1.5 text-left text-xs flex items-center gap-2 hover:bg-indigo-50 hover:text-indigo-600 ${
                                            meta.groupId === g.id ? 'font-bold text-indigo-600 bg-indigo-50/50' : 'text-gray-700'
                                        }`}
                                    >
                                        <Folder className="w-3 h-3 text-amber-500 shrink-0" />
                                        <span className="truncate">{g.name}</span>
                                    </button>
                                ))}
                                <div className="border-t border-gray-100 mt-1 pt-1">
                                    <button
                                        onClick={() => {
                                            setMoveMenuFeatureId(null);
                                            openCreateFolderModal();
                                        }}
                                        className="w-full px-2.5 py-1 text-left text-[11px] text-indigo-600 hover:bg-indigo-50 flex items-center gap-1.5 font-medium"
                                    >
                                        <FolderPlus className="w-3 h-3" />
                                        <span>New Folder...</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => {
                            setHiddenFeatures((prev) => {
                                const next = new Set(prev);
                                if (next.has(feat.id)) next.delete(feat.id);
                                else next.add(feat.id);
                                return next;
                            });
                        }}
                        className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                        title={isDirectlyHidden ? 'Show feature' : 'Hide feature'}
                    >
                        {isDirectlyHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                    <button
                        onClick={() => handleDeleteFeature(feat.id)}
                        className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                        title="Delete feature"
                    >
                        <Trash2 className="w-3 h-3" />
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="h-screen w-screen flex flex-col overflow-hidden bg-slate-50">
            {/* Sleek Top Header */}
            <Header
                sidebarOpen={sidebarOpen}
                onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                eventsOpen={eventsOpen}
                onToggleEvents={() => setEventsOpen(!eventsOpen)}
                eventsCount={events.length}
                featuresCount={features.length}
                statusText={loading ? 'Loading...' : 'Synced'}
                onFitBounds={handleFitBounds}
                onExport={handleExport}
                onImport={handleImport}
                onClear={handleClear}
            />

            {/* Main Workspace Body */}
            <div className="flex-1 flex overflow-hidden relative">
                {/* Left Side: Tools & Layers Panel */}
                {sidebarOpen && (
                    <aside className="w-72 sm:w-80 h-full bg-white border-r border-gray-200 flex flex-col z-20 shadow-sm shrink-0">
                        {/* Tools Section */}
                        <div className="p-3 border-b border-gray-200 bg-slate-50/50">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">
                                Tools
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                                <button
                                    onClick={() => { setActiveMode('select'); setTempPoints([]); }}
                                    className={`flex items-center gap-2 px-2.5 py-2 text-xs font-semibold rounded-lg border transition-all ${
                                        activeMode === 'select'
                                            ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs'
                                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
                                    }`}
                                >
                                    <MousePointer className="w-3.5 h-3.5" />
                                    <span>Select</span>
                                </button>
                                <button
                                    onClick={() => { setActiveMode('marker'); setTempPoints([]); }}
                                    className={`flex items-center gap-2 px-2.5 py-2 text-xs font-semibold rounded-lg border transition-all ${
                                        activeMode === 'marker'
                                            ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs'
                                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
                                    }`}
                                >
                                    <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                                    <span>Marker</span>
                                </button>
                                <button
                                    onClick={() => { setActiveMode('label'); setTempPoints([]); }}
                                    className={`flex items-center gap-2 px-2.5 py-2 text-xs font-semibold rounded-lg border transition-all ${
                                        activeMode === 'label'
                                            ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs'
                                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
                                    }`}
                                >
                                    <Tag className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Label</span>
                                </button>
                                <button
                                    onClick={() => { setActiveMode('ruler'); setTempPoints([]); }}
                                    className={`flex items-center gap-2 px-2.5 py-2 text-xs font-semibold rounded-lg border transition-all ${
                                        activeMode === 'ruler'
                                            ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs'
                                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
                                    }`}
                                >
                                    <Ruler className="w-3.5 h-3.5 text-amber-600" />
                                    <span>Ruler</span>
                                </button>
                            </div>

                            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mt-3 mb-2">
                                Draw Shapes
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                                <button
                                    onClick={() => { setActiveMode('line'); setTempPoints([]); }}
                                    className={`flex items-center gap-2 px-2.5 py-2 text-xs font-semibold rounded-lg border transition-all ${
                                        activeMode === 'line'
                                            ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs'
                                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
                                    }`}
                                >
                                    <Route className="w-3.5 h-3.5 text-blue-600" />
                                    <span>Line</span>
                                </button>
                                <button
                                    onClick={() => { setActiveMode('arrow'); setTempPoints([]); }}
                                    className={`flex items-center gap-2 px-2.5 py-2 text-xs font-semibold rounded-lg border transition-all ${
                                        activeMode === 'arrow'
                                            ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs'
                                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
                                    }`}
                                >
                                    <MoveRight className="w-3.5 h-3.5 text-indigo-600" />
                                    <span>Arrow</span>
                                </button>
                                <button
                                    onClick={() => { setActiveMode('polygon'); setTempPoints([]); }}
                                    className={`flex items-center gap-2 px-2.5 py-2 text-xs font-semibold rounded-lg border transition-all ${
                                        activeMode === 'polygon'
                                            ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs'
                                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
                                    }`}
                                >
                                    <Hexagon className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Polygon</span>
                                </button>
                                <button
                                    onClick={() => { setActiveMode('rectangle'); setTempPoints([]); }}
                                    className={`flex items-center gap-2 px-2.5 py-2 text-xs font-semibold rounded-lg border transition-all ${
                                        activeMode === 'rectangle'
                                            ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs'
                                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
                                    }`}
                                >
                                    <Square className="w-3.5 h-3.5 text-teal-600" />
                                    <span>Rectangle</span>
                                </button>
                                <button
                                    onClick={() => { setActiveMode('circle'); setTempPoints([]); }}
                                    className={`flex items-center gap-2 px-2.5 py-2 text-xs font-semibold rounded-lg border transition-all col-span-2 ${
                                        activeMode === 'circle'
                                            ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs'
                                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
                                    }`}
                                >
                                    <CircleIcon className="w-3.5 h-3.5 text-purple-600" />
                                    <span>Circle Area</span>
                                </button>
                            </div>

                            {/* Multi-point drawing active helper banner */}
                            {tempPoints.length > 0 && (
                                <div className="mt-2.5 p-2 bg-indigo-50 border border-indigo-200 rounded-lg text-xs flex items-center justify-between text-indigo-900">
                                    <span>{tempPoints.length} point{tempPoints.length === 1 ? '' : 's'} placed</span>
                                    <div className="flex items-center gap-1">
                                        {activeMode === 'line' && tempPoints.length >= 2 && (
                                            <button 
                                                onClick={finishLine}
                                                className="px-2 py-0.5 bg-indigo-600 text-white rounded text-[11px] font-semibold hover:bg-indigo-700"
                                            >
                                                Done
                                            </button>
                                        )}
                                        {activeMode === 'polygon' && tempPoints.length >= 3 && (
                                            <button 
                                                onClick={finishPolygon}
                                                className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[11px] font-semibold hover:bg-emerald-700"
                                            >
                                                Close
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => setTempPoints([])}
                                            className="p-1 text-gray-500 hover:text-red-600"
                                            title="Cancel drawing"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Features Tree List */}
                        <div className="flex-1 flex flex-col overflow-hidden">
                            <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between bg-white">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-gray-800">Features</span>
                                    <span className="text-[10px] font-semibold bg-gray-100 text-gray-600 px-1.5 py-0.2 rounded-full">
                                        {features.length}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={openCreateFolderModal}
                                        className="flex items-center gap-1 px-1.5 py-1 rounded text-xs font-medium text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 border border-gray-200 hover:border-indigo-200 transition-colors"
                                        title="Create new folder"
                                    >
                                        <FolderPlus className="w-3.5 h-3.5 text-amber-500" />
                                        <span className="text-[11px]">Folder</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setActiveMode('marker');
                                            setTempPoints([]);
                                        }}
                                        className="p-1 rounded text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 border border-gray-200"
                                        title="Quick drop marker"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>

                            {/* Search Features */}
                            <div className="p-2 border-b border-gray-100 bg-white">
                                <div className="relative">
                                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                                    <input
                                        type="text"
                                        value={searchFeaturesText}
                                        onChange={(e) => setSearchFeaturesText(e.target.value)}
                                        placeholder="Search features..."
                                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                            {/* Feature Tree Items List */}
                            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                                {filteredFeatures.length === 0 && groups.length === 0 ? (
                                    <div className="py-8 text-center text-gray-400 text-xs px-4">
                                        <Crosshair className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                        <p>No map features yet.</p>
                                        <p className="text-[11px] text-gray-400 mt-1">
                                            Select a tool above to drop a marker or draw a path on the map.
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Folders */}
                                        {groups.map((group) => {
                                            const isFolderHidden = group.visible === false;
                                            const isCollapsed = !!group.collapsed;
                                            const groupFeats = groupedFeatures.get(group.id) || [];

                                            return (
                                                <div key={group.id} className="rounded-xl border border-gray-200 bg-gray-50/40 overflow-hidden">
                                                    {/* Folder Header Row */}
                                                    <div 
                                                        className={`px-2.5 py-1.5 flex items-center justify-between text-xs font-medium cursor-pointer select-none transition-colors ${
                                                            isFolderHidden ? 'opacity-60 bg-gray-100 text-gray-400' : 'hover:bg-gray-100 text-gray-800'
                                                        }`}
                                                        onClick={() => handleToggleFolderCollapse(group.id)}
                                                    >
                                                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                            <span className="text-gray-400 hover:text-gray-600">
                                                                {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                            </span>
                                                            <span className="text-amber-500">
                                                                {isCollapsed ? <Folder className="w-3.5 h-3.5" /> : <FolderOpen className="w-3.5 h-3.5" />}
                                                            </span>
                                                            <span className="truncate text-xs font-bold text-gray-800">
                                                                {group.name}
                                                            </span>
                                                            <span className="text-[10px] text-gray-400 font-semibold ml-0.5 px-1.5 py-0.2 bg-gray-100 rounded-full">
                                                                {groupFeats.length}
                                                            </span>
                                                        </div>

                                                        {/* Folder Actions */}
                                                        <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                                            <button
                                                                onClick={() => handleToggleFolderVisibility(group.id)}
                                                                className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200/60"
                                                                title={isFolderHidden ? "Show folder features on map" : "Hide folder features on map"}
                                                            >
                                                                {isFolderHidden ? <EyeOff className="w-3 h-3 text-gray-400" /> : <Eye className="w-3 h-3 text-gray-600" />}
                                                            </button>
                                                            <button
                                                                onClick={() => openRenameFolderModal(group)}
                                                                className="p-1 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50"
                                                                title="Rename folder"
                                                            >
                                                                <Edit3 className="w-3 h-3" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteFolder(group.id)}
                                                                className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                                                                title="Delete folder (ungroups features)"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Folder Items */}
                                                    {!isCollapsed && (
                                                        <div className="p-1.5 space-y-1 bg-white border-t border-gray-100">
                                                            {groupFeats.length === 0 ? (
                                                                <div className="py-2 px-2 text-[11px] text-gray-400 italic text-center">
                                                                    Folder is empty
                                                                </div>
                                                            ) : (
                                                                groupFeats.map((feat) => renderFeatureItem(feat, isFolderHidden))
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}

                                        {/* Ungrouped features section */}
                                        {ungroupedFeatures.length > 0 && (
                                            <div className="space-y-1">
                                                {groups.length > 0 && (
                                                    <div className="px-2 pt-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                                                        <span>Ungrouped Features</span>
                                                        <span>({ungroupedFeatures.length})</span>
                                                    </div>
                                                )}
                                                {ungroupedFeatures.map((feat) => renderFeatureItem(feat, false))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </aside>
                )}

                {/* Center / Full Map Area */}
                <main className="flex-1 h-full relative overflow-hidden bg-slate-100">
                    <MapContainer
                        center={mapCenter}
                        zoom={mapZoom}
                        style={{ height: '100%', width: '100%' }}
                        scrollWheelZoom={true}
                        ref={(r) => { mapRef.current = r; }}
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <MapController
                            onMapClick={handleMapClick}
                            onMouseMove={(lat, lng) => setCursorCoords([lat, lng])}
                            center={mapCenter}
                            zoom={mapZoom}
                        />

                        {/* Render Saved Features */}
                        {features.map((feat) => {
                            if (!isFeatureVisibleOnMap(feat) || !feat.geometry) return null;
                            const meta = getFeatureMeta(feat);

                            if (feat.feature_type === 'point' && isValidPoint(feat.geometry)) {
                                const pt = feat.geometry;
                                if (meta.isLabel) {
                                    return (
                                        <Marker
                                            key={`f-${feat.id}`}
                                            position={pt}
                                            icon={L.divIcon({
                                                className: 'custom-label-chip',
                                                html: `
                                                    <div style="
                                                        padding: 3px 8px;
                                                        border-radius: 6px;
                                                        background-color: ${meta.labelBg};
                                                        color: ${feat.color || '#1e293b'};
                                                        font-weight: 700;
                                                        font-size: 11px;
                                                        border: 1px solid rgba(0,0,0,0.15);
                                                        box-shadow: 0 2px 6px rgba(0,0,0,0.12);
                                                        white-space: nowrap;
                                                        transform: translate(-50%, -50%);
                                                    ">
                                                        ${feat.name}
                                                    </div>
                                                `,
                                                iconAnchor: [0, 0],
                                            })}
                                        />
                                    );
                                }

                                return (
                                    <Marker
                                        key={`f-${feat.id}`}
                                        position={pt}
                                        icon={L.divIcon({
                                            className: 'custom-marker-pin',
                                            html: `
                                                <div style="
                                                    width: 32px;
                                                    height: 32px;
                                                    border-radius: 50% 50% 50% 0;
                                                    transform: rotate(-45deg);
                                                    background-color: ${feat.color || '#4f46e5'};
                                                    display: flex;
                                                    align-items: center;
                                                    justify-content: center;
                                                    box-shadow: 0 4px 10px rgba(0,0,0,0.25);
                                                    border: 2px solid white;
                                                ">
                                                    <i class="fa ${meta.icon}" style="
                                                        transform: rotate(45deg);
                                                        color: white;
                                                        font-size: 14px;
                                                    "></i>
                                                </div>
                                            `,
                                            iconSize: [32, 32],
                                            iconAnchor: [16, 32],
                                            popupAnchor: [0, -32],
                                        })}
                                    >
                                        <Popup>
                                            <div className="p-2 min-w-[160px]">
                                                <h4 className="font-bold text-sm text-gray-900 mb-1">{feat.name}</h4>
                                                {meta.notes && (
                                                    <p className="text-xs text-gray-600 mb-2">{meta.notes}</p>
                                                )}
                                                <div className="text-[10px] text-gray-400 capitalize">
                                                    Feature Point
                                                </div>
                                            </div>
                                        </Popup>
                                    </Marker>
                                );
                            }

                            if (feat.feature_type === 'line' && isValidLine(feat.geometry)) {
                                return (
                                    <Polyline
                                        key={`f-${feat.id}`}
                                        positions={feat.geometry}
                                        color={feat.color || '#3b82f6'}
                                        weight={4}
                                    >
                                        <Tooltip sticky>{feat.name}</Tooltip>
                                    </Polyline>
                                );
                            }

                            if (feat.feature_type === 'area' && isValidArea(feat.geometry)) {
                                return (
                                    <Polygon
                                        key={`f-${feat.id}`}
                                        positions={feat.geometry}
                                        color={feat.color || '#10b981'}
                                        fillColor={feat.color || '#10b981'}
                                        fillOpacity={0.25}
                                        weight={2}
                                    >
                                        <Tooltip sticky>{feat.name}</Tooltip>
                                    </Polygon>
                                );
                            }
                            return null;
                        })}

                        {/* Render Events */}
                        {events
                            .filter((e) => e.lat !== 0 && e.lng !== 0)
                            .map((evt) => {
                                const evtType = eventTypes.find((t) => t.id === evt.event_type_id);
                                const isSelected = selectedEvent?.id === evt.id;
                                const color = evtType?.color || '#3b82f6';
                                const iconClass = evtType?.icon 
                                    ? (evtType.icon.startsWith('fa-') ? evtType.icon : `fa-${evtType.icon}`)
                                    : 'fa-calendar';

                                return (
                                    <Marker
                                        key={`e-${evt.id}`}
                                        position={[evt.lat, evt.lng]}
                                        icon={L.divIcon({
                                            className: 'custom-event-icon',
                                            html: `
                                                <div style="
                                                    width: ${isSelected ? 36 : 30}px;
                                                    height: ${isSelected ? 36 : 30}px;
                                                    border-radius: 50%;
                                                    background-color: white;
                                                    border: ${isSelected ? 3 : 2}px solid ${isSelected ? '#e11d48' : color};
                                                    display: flex;
                                                    align-items: center;
                                                    justify-content: center;
                                                    box-shadow: 0 4px 12px rgba(0,0,0,0.25);
                                                    transition: transform 0.2s;
                                                ">
                                                    <i class="fa ${iconClass}" style="
                                                        color: ${color};
                                                        font-size: ${isSelected ? 16 : 13}px;
                                                    "></i>
                                                </div>
                                            `,
                                            iconSize: [32, 32],
                                            iconAnchor: [16, 16],
                                            popupAnchor: [0, -16],
                                        })}
                                        eventHandlers={{
                                            click: () => {
                                                setSelectedEvent(evt);
                                                setEventsOpen(true);
                                            },
                                        }}
                                    >
                                        <Popup>
                                            <div className="p-2 min-w-[200px]">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <span 
                                                        className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px]"
                                                        style={{ backgroundColor: color }}
                                                    >
                                                        <i className={`fa ${iconClass}`}></i>
                                                    </span>
                                                    <span className="font-bold text-sm text-gray-900 truncate">
                                                        {evt.title || 'Untitled Event'}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-600 line-clamp-3 mb-2">
                                                    {evt.info || 'No description provided.'}
                                                </p>
                                                {evt.images && evt.images.length > 0 && (
                                                    <div className="text-[10px] text-indigo-600 font-semibold mb-1 flex items-center gap-1">
                                                        <ImageIcon className="w-3 h-3" />
                                                        <span>{evt.images.length} image{evt.images.length === 1 ? '' : 's'} attached</span>
                                                    </div>
                                                )}
                                                <div className="text-[10px] text-gray-400">
                                                    {new Date(evt.created_at).toLocaleString()}
                                                </div>
                                            </div>
                                        </Popup>
                                    </Marker>
                                );
                            })}

                        {/* Temp Active Drawing Shapes */}
                        {tempPoints.length > 0 && (
                            <>
                                {activeMode === 'line' && tempPoints.length >= 2 && (
                                    <Polyline
                                        positions={tempPoints}
                                        color="#3b82f6"
                                        dashArray="6, 6"
                                        weight={3}
                                    />
                                )}
                                {activeMode === 'polygon' && (
                                    <>
                                        {tempPoints.length === 2 && (
                                            <Polyline
                                                positions={tempPoints}
                                                color="#059669"
                                                dashArray="6, 6"
                                                weight={2}
                                            />
                                        )}
                                        {tempPoints.length >= 3 && (
                                            <Polygon
                                                positions={tempPoints}
                                                color="#059669"
                                                dashArray="6, 6"
                                                fillOpacity={0.15}
                                                weight={2}
                                            />
                                        )}
                                    </>
                                )}
                                {tempPoints.map((pt, idx) => (
                                    <Marker
                                        key={`temp-${idx}`}
                                        position={pt}
                                        icon={L.divIcon({
                                            className: 'temp-point-dot',
                                            html: `<div style="width:10px;height:10px;border-radius:50%;background:#4f46e5;border:2px solid white;box-shadow:0 0 5px rgba(0,0,0,0.5)"></div>`,
                                            iconAnchor: [5, 5],
                                        })}
                                    />
                                ))}
                            </>
                        )}

                        {/* Ruler Layer */}
                        {rulerPoints.length > 0 && (
                            <>
                                {rulerPoints.length >= 2 && (
                                    <Polyline
                                        positions={rulerPoints}
                                        color="#d97706"
                                        weight={3}
                                        dashArray="5, 5"
                                    />
                                )}
                                {rulerPoints.map((pt, idx) => (
                                    <Marker
                                        key={`ruler-${idx}`}
                                        position={pt}
                                        icon={L.divIcon({
                                            className: 'ruler-dot',
                                            html: `<div style="width:10px;height:10px;border-radius:50%;background:#d97706;border:2px solid white;"></div>`,
                                            iconAnchor: [5, 5],
                                        })}
                                    />
                                ))}
                            </>
                        )}
                    </MapContainer>

                    {/* Floating HUD: Tool & Coordinates */}
                    <div className="absolute left-3 bottom-3 z-[1000] bg-white/95 backdrop-blur-md border border-gray-200 shadow-md rounded-xl px-3 py-1.5 text-xs flex items-center gap-3 text-gray-700 pointer-events-auto">
                        <div className="flex items-center gap-1.5 font-bold text-indigo-700 capitalize">
                            <Crosshair className="w-3.5 h-3.5" />
                            <span>Tool: {activeMode}</span>
                        </div>
                        {cursorCoords && (
                            <div className="text-gray-500 font-mono text-[11px] border-l border-gray-200 pl-3">
                                {cursorCoords[0].toFixed(5)}, {cursorCoords[1].toFixed(5)}
                            </div>
                        )}
                    </div>

                    {/* Floating Ruler Measurement HUD Card */}
                    {activeMode === 'ruler' && (
                        <div className="absolute top-4 right-4 z-[1000] w-64 bg-white/95 backdrop-blur-md border border-gray-200 rounded-xl shadow-xl p-3">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700">
                                    <Ruler className="w-4 h-4 text-amber-600" />
                                    <span>Distance Meter</span>
                                </div>
                                <span className="text-[10px] text-gray-400 font-mono">
                                    {rulerPoints.length} point{rulerPoints.length === 1 ? '' : 's'}
                                </span>
                            </div>
                            <div className="text-2xl font-black tracking-tight text-gray-900 mb-1">
                                {formatDistance(totalRulerDistance)}
                            </div>
                            <p className="text-[11px] text-gray-500 mb-3">
                                Click anywhere on the map to add distance measurement points.
                            </p>
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => setRulerPoints((prev) => prev.slice(0, -1))}
                                    disabled={rulerPoints.length === 0}
                                    className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                                >
                                    <RotateCcw className="w-3 h-3" />
                                    <span>Undo</span>
                                </button>
                                <button
                                    onClick={() => setRulerPoints([])}
                                    disabled={rulerPoints.length === 0}
                                    className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                                >
                                    <Trash2 className="w-3 h-3" />
                                    <span>Clear</span>
                                </button>
                                <button
                                    onClick={() => { setActiveMode('select'); setRulerPoints([]); }}
                                    className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 shadow-xs"
                                >
                                    <Check className="w-3 h-3" />
                                    <span>Done</span>
                                </button>
                            </div>
                        </div>
                    )}
                </main>

                {/* Right Side: Sliding Events Drawer */}
                {eventsOpen && (
                    <aside className="w-80 sm:w-96 h-full bg-white border-l border-gray-200 flex flex-col z-20 shadow-xl shrink-0 animate-in slide-in-from-right duration-200">
                        {/* Header */}
                        <div className="p-3 border-b border-gray-200 flex items-center justify-between bg-slate-50">
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-indigo-600" />
                                <span className="text-sm font-bold text-gray-900">Events Feed</span>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                                    {filteredEvents.length}
                                </span>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => navigate(`${BASE_PATH}create-event`)}
                                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-rose-600 text-white rounded-lg hover:bg-rose-700 shadow-xs"
                                    title="Open Event Publisher"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Publish</span>
                                </button>
                                <button
                                    onClick={() => setEventsOpen(false)}
                                    className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Search & Event Type Filters */}
                        <div className="p-3 border-b border-gray-100 space-y-2 bg-white">
                            <div className="relative">
                                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                                <input
                                    type="text"
                                    value={searchEventsText}
                                    onChange={(e) => setSearchEventsText(e.target.value)}
                                    placeholder="Search events..."
                                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>

                            {/* Type filter chips */}
                            {eventTypes.length > 0 && (
                                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                                    <button
                                        onClick={() => setSelectedEventTypeId(null)}
                                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all shrink-0 ${
                                            selectedEventTypeId === null
                                                ? 'bg-indigo-600 text-white shadow-xs'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                    >
                                        All
                                    </button>
                                    {eventTypes.map((type) => {
                                        const isSelected = selectedEventTypeId === type.id;
                                        return (
                                            <button
                                                key={type.id}
                                                onClick={() => setSelectedEventTypeId(isSelected ? null : type.id)}
                                                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all shrink-0 flex items-center gap-1.5 border ${
                                                    isSelected
                                                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-bold'
                                                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                                }`}
                                            >
                                                <span 
                                                    className="w-2 h-2 rounded-full" 
                                                    style={{ backgroundColor: type.color || '#3b82f6' }}
                                                ></span>
                                                <span>{type.name}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Events List */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                            {filteredEvents.length === 0 ? (
                                <div className="py-12 text-center text-gray-400 text-xs">
                                    <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                    <p>No events found.</p>
                                    <button
                                        onClick={() => navigate(`${BASE_PATH}create-event`)}
                                        className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>Create First Event</span>
                                    </button>
                                </div>
                            ) : (
                                filteredEvents.map((evt) => {
                                    const type = eventTypes.find((t) => t.id === evt.event_type_id);
                                    const isSelected = selectedEvent?.id === evt.id;

                                    return (
                                        <div
                                            key={evt.id}
                                            onClick={() => {
                                                setSelectedEvent(evt);
                                                if (evt.lat && evt.lng) {
                                                    setMapCenter([evt.lat, evt.lng]);
                                                    setMapZoom(16);
                                                }
                                            }}
                                            className={`p-3 rounded-xl border text-left cursor-pointer transition-all hover:shadow-sm ${
                                                isSelected
                                                    ? 'bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-200'
                                                    : 'bg-white border-gray-200 hover:border-gray-300'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between gap-2 mb-1.5">
                                                {type && (
                                                    <span 
                                                        className="px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1"
                                                        style={{ 
                                                            backgroundColor: `${type.color || '#3b82f6'}15`,
                                                            color: type.color || '#3b82f6',
                                                            border: `1px solid ${type.color || '#3b82f6'}30`
                                                        }}
                                                    >
                                                        <i className={`fa ${type.icon.startsWith('fa-') ? type.icon : `fa-${type.icon}`}`}></i>
                                                        <span>{type.name}</span>
                                                    </span>
                                                )}
                                                <span className="text-[10px] text-gray-400 font-medium">
                                                    {new Date(evt.created_at).toLocaleDateString()}
                                                </span>
                                            </div>

                                            <h4 className="font-bold text-xs text-gray-900 mb-1 line-clamp-1">
                                                {evt.title || 'Untitled Event'}
                                            </h4>
                                            <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                                                {evt.info || 'No description available.'}
                                            </p>

                                            {evt.images && evt.images.length > 0 && (
                                                <div className="flex items-center gap-1.5 overflow-hidden mb-2">
                                                    {evt.images.slice(0, 3).map((img, idx) => (
                                                        <div 
                                                            key={idx} 
                                                            className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden shrink-0"
                                                        >
                                                            <img 
                                                                src={img.image_url} 
                                                                alt="Event attachment" 
                                                                className="w-full h-full object-cover"
                                                                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                                                            />
                                                        </div>
                                                    ))}
                                                    {evt.images.length > 3 && (
                                                        <div className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500 shrink-0">
                                                            +{evt.images.length - 3}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-gray-100 text-indigo-600 font-semibold">
                                                <span>Click to center map</span>
                                                <ExternalLink className="w-3 h-3" />
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </aside>
                )}
            </div>

            {/* In-Place Modal: Add Marker */}
            {markerModalOpen && (
                <div 
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in"
                    onClick={(e) => { if (e.target === e.currentTarget) setMarkerModalOpen(false); }}
                >
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                    <MapPin className="w-4 h-4" />
                                </div>
                                <h3 className="font-bold text-sm text-gray-900">Add Marker</h3>
                            </div>
                            <button
                                onClick={() => setMarkerModalOpen(false)}
                                className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-4 space-y-3.5">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Name *</label>
                                <input
                                    type="text"
                                    value={markerForm.name}
                                    onChange={(e) => setMarkerForm({ ...markerForm, name: e.target.value })}
                                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Marker title"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Notes</label>
                                <textarea
                                    value={markerForm.notes}
                                    onChange={(e) => setMarkerForm({ ...markerForm, notes: e.target.value })}
                                    rows={2}
                                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Optional details or description"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Icon</label>
                                <div className="grid grid-cols-8 gap-1.5 max-h-36 overflow-y-auto p-1 border border-gray-200 rounded-lg bg-gray-50/50">
                                    {FA_ICONS.map((item) => (
                                        <button
                                            key={item.icon}
                                            type="button"
                                            onClick={() => setMarkerForm({ ...markerForm, icon: item.icon })}
                                            className={`aspect-square rounded-lg flex items-center justify-center transition-all ${
                                                markerForm.icon === item.icon
                                                    ? 'bg-indigo-600 text-white shadow-xs'
                                                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                                            }`}
                                            title={item.name}
                                        >
                                            <i className={`fa ${item.icon} text-xs`}></i>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Group / Folder</label>
                                <select
                                    value={markerForm.groupId}
                                    onChange={(e) => setMarkerForm({ ...markerForm, groupId: e.target.value })}
                                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="">None (Ungrouped)</option>
                                    {groups.map((g) => (
                                        <option key={g.id} value={g.id}>
                                            📁 {g.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Marker Color</label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        value={markerForm.color}
                                        onChange={(e) => setMarkerForm({ ...markerForm, color: e.target.value })}
                                        className="w-12 h-8 rounded border border-gray-300 cursor-pointer"
                                    />
                                    <input
                                        type="text"
                                        value={markerForm.color}
                                        onChange={(e) => setMarkerForm({ ...markerForm, color: e.target.value })}
                                        className="flex-1 px-3 py-1.5 text-xs font-mono border border-gray-300 rounded-lg"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
                            <button
                                onClick={() => setMarkerModalOpen(false)}
                                className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-200 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveMarker}
                                className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-xs flex items-center gap-1.5"
                            >
                                <Check className="w-3.5 h-3.5" />
                                <span>Place Marker</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* In-Place Modal: Add Label */}
            {labelModalOpen && (
                <div 
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in"
                    onClick={(e) => { if (e.target === e.currentTarget) setLabelModalOpen(false); }}
                >
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-150">
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                                <Tag className="w-4 h-4 text-emerald-600" />
                                <span>Add Map Label</span>
                            </h3>
                            <button
                                onClick={() => setLabelModalOpen(false)}
                                className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-4 space-y-3">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Label Text</label>
                                <input
                                    type="text"
                                    value={labelForm.text}
                                    onChange={(e) => setLabelForm({ ...labelForm, text: e.target.value })}
                                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                    placeholder="e.g. Area Entrance, Zone A"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Group / Folder</label>
                                <select
                                    value={labelForm.groupId}
                                    onChange={(e) => setLabelForm({ ...labelForm, groupId: e.target.value })}
                                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="">None (Ungrouped)</option>
                                    {groups.map((g) => (
                                        <option key={g.id} value={g.id}>
                                            📁 {g.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">Text Color</label>
                                    <input
                                        type="color"
                                        value={labelForm.color}
                                        onChange={(e) => setLabelForm({ ...labelForm, color: e.target.value })}
                                        className="w-full h-8 rounded border border-gray-300 cursor-pointer"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">Background</label>
                                    <input
                                        type="color"
                                        value={labelForm.bgColor}
                                        onChange={(e) => setLabelForm({ ...labelForm, bgColor: e.target.value })}
                                        className="w-full h-8 rounded border border-gray-300 cursor-pointer"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
                            <button
                                onClick={() => setLabelModalOpen(false)}
                                className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-200 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveLabel}
                                className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-xs flex items-center gap-1.5"
                            >
                                <Check className="w-3.5 h-3.5" />
                                <span>Place Label</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* In-Place Modal: Save Drawn Shape */}
            {shapeSaveModalOpen && pendingShape && (
                <div 
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in"
                    onClick={(e) => { if (e.target === e.currentTarget) { setShapeSaveModalOpen(false); setPendingShape(null); } }}
                >
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-150">
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                                <Route className="w-4 h-4 text-indigo-600" />
                                <span>Save Drawn {pendingShape.type === 'line' ? 'Line' : 'Area'}</span>
                            </h3>
                            <button
                                onClick={() => { setShapeSaveModalOpen(false); setPendingShape(null); }}
                                className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-4 space-y-3">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Name *</label>
                                <input
                                    type="text"
                                    value={shapeForm.name}
                                    onChange={(e) => setShapeForm({ ...shapeForm, name: e.target.value })}
                                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Feature title"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Group / Folder</label>
                                <select
                                    value={shapeForm.groupId}
                                    onChange={(e) => setShapeForm({ ...shapeForm, groupId: e.target.value })}
                                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="">None (Ungrouped)</option>
                                    {groups.map((g) => (
                                        <option key={g.id} value={g.id}>
                                            📁 {g.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Description</label>
                                <textarea
                                    value={shapeForm.description}
                                    onChange={(e) => setShapeForm({ ...shapeForm, description: e.target.value })}
                                    rows={2}
                                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Description or notes"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Color</label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        value={shapeForm.color}
                                        onChange={(e) => setShapeForm({ ...shapeForm, color: e.target.value })}
                                        className="w-12 h-8 rounded border border-gray-300 cursor-pointer"
                                    />
                                    <input
                                        type="text"
                                        value={shapeForm.color}
                                        onChange={(e) => setShapeForm({ ...shapeForm, color: e.target.value })}
                                        className="flex-1 px-3 py-1.5 text-xs font-mono border border-gray-300 rounded-lg"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
                            <button
                                onClick={() => { setShapeSaveModalOpen(false); setPendingShape(null); }}
                                className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-200 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveShape}
                                className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-xs flex items-center gap-1.5"
                            >
                                <Check className="w-3.5 h-3.5" />
                                <span>Save Feature</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* In-Place Modal: Edit Existing Feature */}
            {editingFeature && (
                <div 
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in"
                    onClick={(e) => { if (e.target === e.currentTarget) setEditingFeature(null); }}
                >
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-150">
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                                <Edit3 className="w-4 h-4 text-indigo-600" />
                                <span>Edit Feature</span>
                            </h3>
                            <button
                                onClick={() => setEditingFeature(null)}
                                className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-4 space-y-3">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Name</label>
                                <input
                                    type="text"
                                    value={editForm.name}
                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Group / Folder</label>
                                <select
                                    value={editForm.groupId}
                                    onChange={(e) => setEditForm({ ...editForm, groupId: e.target.value })}
                                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="">None (Ungrouped)</option>
                                    {groups.map((g) => (
                                        <option key={g.id} value={g.id}>
                                            📁 {g.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Description / Notes</label>
                                <textarea
                                    value={editForm.description}
                                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                    rows={2}
                                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Color</label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        value={editForm.color}
                                        onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                                        className="w-12 h-8 rounded border border-gray-300 cursor-pointer"
                                    />
                                    <input
                                        type="text"
                                        value={editForm.color}
                                        onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                                        className="flex-1 px-3 py-1.5 text-xs font-mono border border-gray-300 rounded-lg"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                            <button
                                onClick={() => handleDeleteFeature(editingFeature.id)}
                                className="px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-1"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
                            </button>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setEditingFeature(null)}
                                    className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-200 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveEdit}
                                    className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-xs"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* In-Place Modal: Create / Rename Folder */}
            {folderModalOpen && (
                <div 
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in"
                    onClick={(e) => { if (e.target === e.currentTarget) setFolderModalOpen(false); }}
                >
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-xs w-full overflow-hidden animate-in zoom-in-95 duration-150">
                        <div className="p-3.5 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="font-bold text-xs text-gray-900 flex items-center gap-2">
                                <Folder className="w-4 h-4 text-amber-500" />
                                <span>{folderModalMode === 'create' ? 'Create Feature Folder' : 'Rename Folder'}</span>
                            </h3>
                            <button
                                onClick={() => setFolderModalOpen(false)}
                                className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <div className="p-3.5 space-y-3">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Folder Name *</label>
                                <input
                                    type="text"
                                    autoFocus
                                    value={folderInputName}
                                    onChange={(e) => setFolderInputName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveFolderModal();
                                    }}
                                    className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    placeholder="e.g. Zones, Security, Routes..."
                                />
                            </div>
                        </div>
                        <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
                            <button
                                onClick={() => setFolderModalOpen(false)}
                                className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-200 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveFolderModal}
                                className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-xs flex items-center gap-1.5"
                            >
                                <Check className="w-3.5 h-3.5" />
                                <span>{folderModalMode === 'create' ? 'Create' : 'Save'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Maps;
