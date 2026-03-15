import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { MapContainer, TileLayer, Marker, Polyline, Polygon } from 'react-leaflet';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Layers, Trash2, Plus } from 'lucide-react';
import { BASE_PATH } from '../../lib/base';
import { featuresApi, type Feature } from '../../lib/featuresApi';

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

    useEffect(() => {
        loadFeatures();
    }, []);

    const loadFeatures = async () => {
        try {
            setLoading(true);
            const data = await featuresApi.list();
            setFeatures(data);
        } catch (error) {
            console.error('Failed to load features:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this feature?')) {
            return;
        }
        try {
            await featuresApi.delete(id);
            setFeatures(features.filter(f => f.id !== id));
        } catch (error) {
            console.error('Failed to delete feature:', error);
            alert('Failed to delete feature');
        }
    };

    return (
        <div className="h-full flex flex-col">
            <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Layers className="w-6 h-6 text-gray-700" />
                        <h1 className="text-2xl font-bold text-gray-900">Features</h1>
                    </div>
                    <button
                        onClick={() => navigate(`${BASE_PATH}create-feature`)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        New Feature
                    </button>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                    View and manage Eventmap features (points, lines, areas)
                </p>
            </div>

            <div className="flex-1 grid grid-cols-2 gap-6 p-6">
                {/* Feature List */}
                <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4">Feature List</h2>
                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            <div className="text-center text-gray-500 py-8">
                                <p>Loading features...</p>
                            </div>
                        ) : features.length === 0 ? (
                            <div className="text-center text-gray-500 py-8">
                                <Layers className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                <p>No features yet</p>
                                <p className="text-sm mt-1">Create your first feature</p>
                                <button
                                    onClick={() => navigate(`${BASE_PATH}create-feature`)}
                                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                                >
                                    Create Feature
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {features.map((feature) => (
                                    <div
                                        key={feature.id}
                                        className="p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-medium text-gray-900 truncate">{feature.name}</h3>
                                                <p className="text-sm text-gray-500 capitalize">{feature.feature_type}</p>
                                                {feature.description && (
                                                    <p className="text-xs text-gray-400 mt-1 line-clamp-2">{feature.description}</p>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => handleDelete(feature.id)}
                                                className="p-1 text-red-500 hover:text-red-700 ml-2"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Map */}
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col">
                    <div className="p-2 border-b border-gray-200 bg-gray-50">
                        <h3 className="text-sm font-semibold text-gray-800">Map View</h3>
                    </div>
                    <div className="flex-1" style={{ minHeight: '400px' }}>
                        <MapContainer
                            center={[51.505, -0.09]}
                            zoom={13}
                            style={{ height: '100%', width: '100%' }}
                            scrollWheelZoom={true}
                        >
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                            
                            {/* Display saved features */}
                            {features.map((feature) => {
                                if (!feature.geometry) return null;
                                
                                if (feature.feature_type === 'point') {
                                    return (
                                        <Marker
                                            key={feature.id}
                                            position={feature.geometry}
                                            icon={L.icon({
                                                iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
                                                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
                                                iconSize: [25, 41],
                                                iconAnchor: [12, 41],
                                            })}
                                        />
                                    );
                                } else if (feature.feature_type === 'line') {
                                    return (
                                        <Polyline
                                            key={feature.id}
                                            positions={feature.geometry}
                                            color={feature.color}
                                            weight={3}
                                        />
                                    );
                                } else if (feature.feature_type === 'area') {
                                    return (
                                        <Polygon
                                            key={feature.id}
                                            positions={[...feature.geometry, feature.geometry[0]]}
                                            color={feature.color}
                                            fillColor={feature.color}
                                            fillOpacity={0.3}
                                            weight={2}
                                        />
                                    );
                                }
                                return null;
                            })}
                        </MapContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FeatureEditor;
