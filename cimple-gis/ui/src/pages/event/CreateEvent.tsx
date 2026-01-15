import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { eventsApi } from '../../lib/eventsApi';
import { eventTypesApi } from '../../lib/eventTypesApi';
import { type EventType } from '../../lib/eventTypesApi';
import { MapPin, Save, X, Plus } from 'lucide-react';
import { BASE_PATH } from '../../lib/base';

// Fix for default marker icons in React-Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Component to handle map clicks
function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
    useMapEvents({
        click: (e) => {
            const { lat, lng } = e.latlng;
            onMapClick(lat, lng);
        },
    });
    return null;
}

const CreateEvent = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [eventTypes, setEventTypes] = useState<EventType[]>([]);
    const [loadingEventTypes, setLoadingEventTypes] = useState(true);
    const [formData, setFormData] = useState({
        title: '',
        info: '',
        event_type_id: null as number | null,
        lat: 0,
        lng: 0,
    });
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [mapCenter, setMapCenter] = useState<[number, number]>([51.505, -0.09]);

    // Load event types on mount
    useEffect(() => {
        const loadEventTypes = async () => {
            try {
                const types = await eventTypesApi.list();
                setEventTypes(types);
            } catch (err: any) {
                console.error('Failed to load event types:', err);
            } finally {
                setLoadingEventTypes(false);
            }
        };
        loadEventTypes();
    }, []);

    // Update map center when coordinates change
    useEffect(() => {
        if (formData.lat !== 0 && formData.lng !== 0) {
            setMapCenter([formData.lat, formData.lng]);
        }
    }, [formData.lat, formData.lng]);

    const handleMapClick = (lat: number, lng: number) => {
        setFormData({
            ...formData,
            lat: parseFloat(lat.toFixed(6)),
            lng: parseFloat(lng.toFixed(6)),
        });
        setError(null);
    };

    // Create custom icon from selected event type
    const createMarkerIcon = (): L.Icon | L.DivIcon => {
        const selectedType = eventTypes.find(t => t.id === formData.event_type_id);
        
        if (!selectedType) {
            // Default marker if no event type selected
            return L.icon({
                iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            });
        }

        const iconClass = selectedType.icon.startsWith('fa-') ? selectedType.icon : `fa-${selectedType.icon}`;
        const iconColor = selectedType.color || '#3B82F6';
        const size = 28;

        // Create a custom HTML icon with FontAwesome
        return L.divIcon({
            className: 'custom-event-type-icon',
            html: `
                <div style="
                    width: ${size}px;
                    height: ${size}px;
                    background-color: white;
                    border: 2px solid ${iconColor};
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                ">
                    <i class="fa ${iconClass}" style="
                        color: ${iconColor};
                        font-size: 16px;
                    "></i>
                </div>
            `,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
            popupAnchor: [0, -size / 2],
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(false);

        try {
            if (!formData.title.trim()) {
                setError('Title is required');
                setLoading(false);
                return;
            }

            if (formData.lat === 0 && formData.lng === 0) {
                setError('Please select a location on the map');
                setLoading(false);
                return;
            }

            await eventsApi.create({
                title: formData.title,
                info: formData.info,
                event_type_id: formData.event_type_id,
                lat: formData.lat,
                lng: formData.lng,
            });

            setSuccess(true);
            setTimeout(() => {
                navigate(`${BASE_PATH}events`);
            }, 1500);
        } catch (err: any) {
            setError(err.message || 'Failed to create event');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Create New Event</h1>
                <button
                    onClick={() => navigate(`${BASE_PATH}events`)}
                    className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <X className="w-4 h-4" />
                    Cancel
                </button>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                    {error}
                </div>
            )}

            {success && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg">
                    Event created successfully! Redirecting...
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                        Title *
                    </label>
                    <input
                        type="text"
                        id="title"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter event title"
                        required
                    />
                </div>

                <div>
                    <label htmlFor="info" className="block text-sm font-medium text-gray-700 mb-2">
                        Description
                    </label>
                    <textarea
                        id="info"
                        value={formData.info}
                        onChange={(e) => setFormData({ ...formData, info: e.target.value })}
                        rows={4}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter event description"
                    />
                </div>

                <div>
                    <div className="flex items-center justify-between mb-3">
                        <label className="block text-sm font-medium text-gray-700">
                            Event Type <span className="text-xs text-gray-500 font-normal">(optional)</span>
                        </label>
                        <button
                            type="button"
                            onClick={() => navigate(`${BASE_PATH}create-event-type`)}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                            <Plus className="w-3 h-3" />
                            New Type
                        </button>
                    </div>
                    {loadingEventTypes ? (
                        <div className="w-full px-4 py-8 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 text-center">
                            Loading event types...
                        </div>
                    ) : eventTypes.length === 0 ? (
                        <div className="w-full px-4 py-8 border border-gray-300 rounded-lg bg-gray-50 text-center">
                            <p className="text-gray-500 mb-3">No event types available</p>
                            <button
                                type="button"
                                onClick={() => navigate(`${BASE_PATH}create-event-type`)}
                                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Create First Event Type
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {/* Option to clear selection */}
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, event_type_id: null })}
                                className={`w-full px-4 py-3 border-2 rounded-lg transition-all text-left ${
                                    formData.event_type_id === null
                                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full border-2 border-gray-300 flex items-center justify-center bg-gray-100">
                                        <span className="text-gray-400 text-xs">None</span>
                                    </div>
                                    <div>
                                        <div className="font-medium text-gray-900">No Event Type</div>
                                        <div className="text-xs text-gray-500">Continue without a specific type</div>
                                    </div>
                                </div>
                            </button>

                            {/* Event Type Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {eventTypes.map((type) => {
                                    const isSelected = formData.event_type_id === type.id;
                                    const iconClass = type.icon.startsWith('fa-') ? type.icon : `fa-${type.icon}`;
                                    
                                    return (
                                        <button
                                            key={type.id}
                                            type="button"
                                            onClick={() => setFormData({ 
                                                ...formData, 
                                                event_type_id: isSelected ? null : type.id 
                                            })}
                                            className={`px-4 py-3 border-2 rounded-lg transition-all text-left ${
                                                isSelected
                                                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                                                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div 
                                                    className="w-10 h-10 rounded-full flex items-center justify-center"
                                                    style={{ 
                                                        backgroundColor: isSelected 
                                                            ? `${type.color || '#3B82F6'}20` 
                                                            : `${type.color || '#3B82F6'}15`
                                                    }}
                                                >
                                                    <i 
                                                        className={`fa ${iconClass} text-lg`}
                                                        style={{ color: type.color || '#3B82F6' }}
                                                    ></i>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-gray-900">{type.name}</div>
                                                    {type.event_type && (
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                                                                {type.event_type}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                                {isSelected && (
                                                    <div className="flex-shrink-0">
                                                        <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                                                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Location * <span className="text-xs text-gray-500 font-normal">(Click on the map to select)</span>
                    </label>
                    
                    {/* Map Input */}
                    <div className="mb-4 border border-gray-300 rounded-lg overflow-hidden" style={{ height: '300px' }}>
                        <MapContainer
                            center={mapCenter}
                            zoom={13}
                            style={{ height: '100%', width: '100%' }}
                            scrollWheelZoom={true}
                        >
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                            <MapClickHandler onMapClick={handleMapClick} />
                            {formData.lat !== 0 && formData.lng !== 0 && (
                                <Marker 
                                    key={`${formData.lat}-${formData.lng}-${formData.event_type_id || 'none'}`}
                                    position={[formData.lat, formData.lng]} 
                                    icon={createMarkerIcon()} 
                                />
                            )}
                        </MapContainer>
                    </div>

                    {/* Coordinate Display/Input */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="lat" className="block text-xs text-gray-500 mb-1">
                                Latitude
                            </label>
                            <input
                                type="number"
                                id="lat"
                                step="any"
                                value={formData.lat}
                                onChange={(e) => {
                                    const lat = parseFloat(e.target.value) || 0;
                                    setFormData({ ...formData, lat });
                                    if (lat !== 0) {
                                        setMapCenter([lat, formData.lng || mapCenter[1]]);
                                    }
                                }}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="e.g., 51.505"
                            />
                        </div>
                        <div>
                            <label htmlFor="lng" className="block text-xs text-gray-500 mb-1">
                                Longitude
                            </label>
                            <input
                                type="number"
                                id="lng"
                                step="any"
                                value={formData.lng}
                                onChange={(e) => {
                                    const lng = parseFloat(e.target.value) || 0;
                                    setFormData({ ...formData, lng });
                                    if (lng !== 0) {
                                        setMapCenter([formData.lat || mapCenter[0], lng]);
                                    }
                                }}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="e.g., -0.09"
                            />
                        </div>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                        <MapPin className="w-3 h-3 inline mr-1" />
                        Click on the map above to select a location, or enter coordinates manually
                    </p>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                    <button
                        type="button"
                        onClick={() => navigate(`${BASE_PATH}events`)}
                        className="px-6 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Save className="w-4 h-4" />
                        {loading ? 'Creating...' : 'Create Event'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CreateEvent;
