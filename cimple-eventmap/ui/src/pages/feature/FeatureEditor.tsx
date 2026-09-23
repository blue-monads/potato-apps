import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { MapContainer, TileLayer, Marker, Polyline, Polygon, Tooltip } from 'react-leaflet';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
    Layers, 
    Trash2, 
    Plus, 
    Search, 
    MapPin, 
    Route, 
    Hexagon
} from 'lucide-react';
import { BASE_PATH } from '../../lib/base';
import { featuresApi, type Feature, isValidPoint, isValidLine, isValidArea } from '../../lib/featuresApi';
import { Header } from '../../components/Header';

// Fix for default marker icons in React-Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const FeatureEditor = () => {
    const navigate = useNavigate();
    const [features, setFeatures] = useState<Feature[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedType, setSelectedType] = useState<string | null>(null);
    const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
    const [mapCenter, setMapCenter] = useState<[number, number]>([27.7172, 85.3240]);
    const [mapZoom, setMapZoom] = useState(13);
    const mapRef = useRef<L.Map | null>(null);

    useEffect(() => {
        loadFeatures();
    }, []);

    const loadFeatures = async () => {
        try {
            setLoading(true);
            const data = await featuresApi.list();
            const list = Array.isArray(data) ? data : [];
            setFeatures(list);

            if (list.length > 0 && list[0].geometry) {
                const g = list[0].geometry;
                if (isValidPoint(g)) {
                    setMapCenter(g);
                } else if (Array.isArray(g) && g.length > 0 && isValidPoint(g[0])) {
                    setMapCenter(g[0]);
                }
            }
        } catch (error) {
            console.error('Failed to load features:', error);
            setFeatures([]);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this feature?')) return;
        try {
            await featuresApi.delete(id);
            setFeatures((prev) => prev.filter((f) => f.id !== id));
            if (selectedFeature?.id === id) setSelectedFeature(null);
        } catch (error) {
            console.error('Failed to delete feature:', error);
            alert('Failed to delete feature');
        }
    };

    const handleFocusFeature = (feature: Feature) => {
        setSelectedFeature(feature);
        if (!feature.geometry) return;

        if (isValidPoint(feature.geometry)) {
            setMapCenter(feature.geometry);
            setMapZoom(15);
            if (mapRef.current) {
                mapRef.current.setView(feature.geometry, 15);
            }
        } else if (isValidLine(feature.geometry) || isValidArea(feature.geometry)) {
            const first = feature.geometry[0];
            setMapCenter(first);
            setMapZoom(14);
            if (mapRef.current) {
                mapRef.current.setView(first, 14);
            }
        }
    };

    const filteredFeatures = features.filter((f) => {
        const matchesSearch = 
            f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (f.description && f.description.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesType = selectedType === null || f.feature_type === selectedType;
        return matchesSearch && matchesType;
    });

    const pointCount = features.filter((f) => f.feature_type === 'point').length;
    const lineCount = features.filter((f) => f.feature_type === 'line').length;
    const areaCount = features.filter((f) => f.feature_type === 'area').length;

    return (
        <div className="h-screen w-full flex flex-col bg-[#f7f8fa] text-gray-900 overflow-hidden font-sans">
            <Header />

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
                {/* Left Features Sidebar */}
                <div className="w-full md:w-[420px] lg:w-[460px] shrink-0 bg-white border-r border-gray-200 flex flex-col h-full shadow-xs z-10">
                    {/* Header */}
                    <div className="p-4 border-b border-gray-200 bg-white">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                                    <Layers className="w-4 h-4" />
                                </div>
                                <div>
                                    <h1 className="text-sm font-bold text-gray-900 tracking-tight">Feature Library</h1>
                                    <p className="text-xs text-gray-500">Map points, lines & spatial boundaries</p>
                                </div>
                            </div>

                            <button
                                onClick={() => navigate(`${BASE_PATH}create-feature`)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-all cursor-pointer"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>New</span>
                            </button>
                        </div>

                        {/* Search Input */}
                        <div className="relative mb-2.5">
                            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search features..."
                                className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>

                        {/* Type Filters */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                            <button
                                onClick={() => setSelectedType(null)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                                    selectedType === null
                                        ? 'bg-indigo-50 border border-indigo-200 text-indigo-700 font-semibold'
                                        : 'bg-white text-gray-600 hover:text-gray-900 border border-gray-200 hover:bg-gray-50'
                                }`}
                            >
                                All ({features.length})
                            </button>
                            <button
                                onClick={() => setSelectedType(selectedType === 'point' ? null : 'point')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-all cursor-pointer ${
                                    selectedType === 'point'
                                        ? 'bg-indigo-50 border border-indigo-200 text-indigo-700 font-semibold'
                                        : 'bg-white text-gray-600 hover:text-gray-900 border border-gray-200 hover:bg-gray-50'
                                }`}
                            >
                                <MapPin className="w-3 h-3 text-indigo-600" />
                                <span>Points ({pointCount})</span>
                            </button>
                            <button
                                onClick={() => setSelectedType(selectedType === 'line' ? null : 'line')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-all cursor-pointer ${
                                    selectedType === 'line'
                                        ? 'bg-indigo-50 border border-indigo-200 text-indigo-700 font-semibold'
                                        : 'bg-white text-gray-600 hover:text-gray-900 border border-gray-200 hover:bg-gray-50'
                                }`}
                            >
                                <Route className="w-3 h-3 text-blue-600" />
                                <span>Lines ({lineCount})</span>
                            </button>
                            <button
                                onClick={() => setSelectedType(selectedType === 'area' ? null : 'area')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-all cursor-pointer ${
                                    selectedType === 'area'
                                        ? 'bg-indigo-50 border border-indigo-200 text-indigo-700 font-semibold'
                                        : 'bg-white text-gray-600 hover:text-gray-900 border border-gray-200 hover:bg-gray-50'
                                }`}
                            >
                                <Hexagon className="w-3 h-3 text-emerald-600" />
                                <span>Areas ({areaCount})</span>
                            </button>
                        </div>
                    </div>

                    {/* Features Scrollable List */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                        {loading ? (
                            <div className="py-12 text-center text-xs text-gray-400">Loading features...</div>
                        ) : filteredFeatures.length === 0 ? (
                            <div className="py-16 text-center text-gray-400">
                                <Layers className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                <p className="text-xs font-semibold text-gray-600">No features found</p>
                                <p className="text-[11px] text-gray-400 mt-0.5">Create points, paths or areas</p>
                            </div>
                        ) : (
                            filteredFeatures.map((f) => {
                                const isSelected = selectedFeature?.id === f.id;
                                const color = f.color || '#3b82f6';

                                return (
                                    <div
                                        key={f.id}
                                        onClick={() => handleFocusFeature(f)}
                                        className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                                            isSelected
                                                ? 'bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-200 text-gray-900'
                                                : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-800'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5 truncate flex-1">
                                            <div
                                                className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 text-white shadow-2xs"
                                                style={{ backgroundColor: color }}
                                            >
                                                {f.feature_type === 'point' && <MapPin className="w-3.5 h-3.5" />}
                                                {f.feature_type === 'line' && <Route className="w-3.5 h-3.5" />}
                                                {f.feature_type === 'area' && <Hexagon className="w-3.5 h-3.5" />}
                                            </div>

                                            <div className="truncate flex-1">
                                                <h3 className="text-xs font-semibold text-gray-900 truncate">
                                                    {f.name}
                                                </h3>
                                                <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-0.5">
                                                    <span className="capitalize text-gray-600 font-medium">
                                                        {f.feature_type}
                                                    </span>
                                                    {f.feature_type === 'point' && isValidPoint(f.geometry) && (
                                                        <span>{f.geometry[0].toFixed(3)}, {f.geometry[1].toFixed(3)}</span>
                                                    )}
                                                    {(f.feature_type === 'line' || f.feature_type === 'area') && Array.isArray(f.geometry) && (
                                                        <span>{f.geometry.length} vertices</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete(f.id);
                                                }}
                                                className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                                title="Delete Feature"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Right Interactive Map View */}
                <div className="flex-1 h-full relative bg-gray-100">
                    <MapContainer
                        center={mapCenter}
                        zoom={mapZoom}
                        style={{ height: '100%', width: '100%' }}
                        scrollWheelZoom={true}
                        ref={mapRef}
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />

                        {features.map((feature) => {
                            if (!feature.geometry) return null;

                            if (feature.feature_type === 'point' && isValidPoint(feature.geometry)) {
                                return (
                                    <Marker
                                        key={feature.id}
                                        position={feature.geometry}
                                        icon={L.divIcon({
                                            className: 'custom-feature-dot',
                                            html: `
                                                <div style="
                                                    width: 28px;
                                                    height: 28px;
                                                    border-radius: 50%;
                                                    background-color: ${feature.color || '#4f46e5'};
                                                    border: 2px solid white;
                                                    display: flex;
                                                    align-items: center;
                                                    justify-content: center;
                                                    box-shadow: 0 4px 10px rgba(0,0,0,0.3);
                                                    color: white;
                                                ">
                                                    <i class="fa fa-location-dot" style="font-size: 13px;"></i>
                                                </div>
                                            `,
                                            iconSize: [28, 28],
                                            iconAnchor: [14, 14],
                                        })}
                                    >
                                        <Tooltip sticky>{feature.name}</Tooltip>
                                    </Marker>
                                );
                            } else if (feature.feature_type === 'line' && isValidLine(feature.geometry)) {
                                return (
                                    <Polyline
                                        key={feature.id}
                                        positions={feature.geometry}
                                        color={feature.color || '#3b82f6'}
                                        weight={4}
                                    >
                                        <Tooltip sticky>{feature.name}</Tooltip>
                                    </Polyline>
                                );
                            } else if (feature.feature_type === 'area' && isValidArea(feature.geometry)) {
                                return (
                                    <Polygon
                                        key={feature.id}
                                        positions={feature.geometry}
                                        color={feature.color || '#10b981'}
                                        fillColor={feature.color || '#10b981'}
                                        fillOpacity={0.25}
                                        weight={2}
                                    >
                                        <Tooltip sticky>{feature.name}</Tooltip>
                                    </Polygon>
                                );
                            }
                            return null;
                        })}
                    </MapContainer>

                    {/* HUD Overlay */}
                    <div className="absolute top-4 left-4 z-[900]">
                        <div className="bg-white/95 backdrop-blur-md border border-gray-200 px-3 py-1.5 rounded-lg shadow-md flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                            <span className="text-xs font-medium text-gray-700">
                                {features.length} Features on Map
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FeatureEditor;
