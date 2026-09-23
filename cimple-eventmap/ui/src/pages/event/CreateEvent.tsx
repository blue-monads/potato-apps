import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { eventsApi } from '../../lib/eventsApi';
import { eventTypesApi, type EventType } from '../../lib/eventTypesApi';
import { MapPin, X, Plus, ImagePlus, Crosshair, ArrowLeft, Check, Sparkles, AlertCircle } from 'lucide-react';
import { BASE_PATH } from '../../lib/base';
import { Header } from '../../components/Header';

interface SpaceFile {
    id: string;
    name: string;
    path?: string;
    size?: number;
    mime?: string;
    is_folder?: boolean;
}

// Fix default leaflet marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
    useMapEvents({
        click: (e) => {
            onMapClick(e.latlng.lat, e.latlng.lng);
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
    const [imageUrls, setImageUrls] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [mapCenter, setMapCenter] = useState<[number, number]>([27.7172, 85.3240]);
    const [mapZoom] = useState(13);

    useEffect(() => {
        const loadEventTypes = async () => {
            try {
                const types = await eventTypesApi.list();
                setEventTypes(types);
                if (types.length > 0) {
                    setFormData((prev) => ({ ...prev, event_type_id: types[0].id }));
                }
            } catch (err: any) {
                console.error('Failed to load event types:', err);
            } finally {
                setLoadingEventTypes(false);
            }
        };
        loadEventTypes();
    }, []);

    const handleMapClick = (lat: number, lng: number) => {
        setFormData((prev) => ({
            ...prev,
            lat: parseFloat(lat.toFixed(6)),
            lng: parseFloat(lng.toFixed(6)),
        }));
        setError(null);
    };

    const openImagePicker = () => {
        if (typeof window === 'undefined') return;
        const win = window as unknown as { spaceFilePicker?: (token: string) => { showModal: (cb: (file: SpaceFile) => void) => void }; spaceGetToken?: (app: string) => string | null };
        if (!win.spaceFilePicker || !win.spaceGetToken) return;
        const token = win.spaceGetToken('cimple-eventmap');
        if (!token) return;
        const picker = win.spaceFilePicker(token);
        if (!picker) return;
        picker.showModal((file: SpaceFile) => {
            if (file.is_folder) return;
            const url = file.id || (file.path ? `${file.path}/${file.name}`.replace(/^\/+/, '') : file.name);
            if (url && !imageUrls.includes(url)) {
                setImageUrls((prev) => [...prev, url]);
            }
        });
    };

    const removeImage = (index: number) => {
        setImageUrls((prev) => prev.filter((_, i) => i !== index));
    };

    const selectedType = eventTypes.find((t) => t.id === formData.event_type_id);

    const createMarkerIcon = (): L.DivIcon => {
        const iconClass = selectedType?.icon
            ? (selectedType.icon.startsWith('fa-') ? selectedType.icon : `fa-${selectedType.icon}`)
            : 'fa-calendar';
        const color = selectedType?.color || '#6366f1';

        return L.divIcon({
            className: 'custom-event-pin-pulse',
            html: `
                <div style="
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    background: white;
                    border: 3px solid ${color};
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 16px rgba(0,0,0,0.35);
                    position: relative;
                ">
                    <i class="fa ${iconClass}" style="color: ${color}; font-size: 15px;"></i>
                    <div style="
                        position: absolute;
                        bottom: -6px;
                        width: 8px;
                        height: 8px;
                        background: ${color};
                        transform: rotate(45deg);
                    "></div>
                </div>
            `,
            iconSize: [36, 42],
            iconAnchor: [18, 42],
            popupAnchor: [0, -42],
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(false);

        try {
            if (!formData.title.trim()) {
                setError('Event title is required');
                setLoading(false);
                return;
            }

            if (formData.lat === 0 && formData.lng === 0) {
                setError('Please click on the map to set event location coordinates');
                setLoading(false);
                return;
            }

            await eventsApi.create({
                title: formData.title,
                info: formData.info,
                event_type_id: formData.event_type_id,
                lat: formData.lat,
                lng: formData.lng,
                image_urls: imageUrls.length > 0 ? imageUrls : undefined,
            });

            setSuccess(true);
            setTimeout(() => {
                navigate(`${BASE_PATH}maps`);
            }, 1000);
        } catch (err: any) {
            setError(err.message || 'Failed to publish event');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-screen w-full flex flex-col bg-[#f7f8fa] text-gray-900 overflow-hidden font-sans">
            <Header />

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
                {/* Left Studio Form Column */}
                <div className="w-full md:w-[460px] lg:w-[500px] shrink-0 bg-white border-r border-gray-200 flex flex-col h-full shadow-xs z-10">
                    {/* Header */}
                    <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                                <Sparkles className="w-4 h-4" />
                            </div>
                            <div>
                                <h1 className="text-sm font-bold text-gray-900 tracking-tight">Event Publisher</h1>
                                <p className="text-xs text-gray-500">Broadcast geotagged map events</p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => navigate(`${BASE_PATH}maps`)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium border border-gray-200 shadow-2xs transition-colors cursor-pointer"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            <span>Map</span>
                        </button>
                    </div>

                    {/* Scrollable Form Body */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {error && (
                            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5">
                                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                                <span>{error}</span>
                            </div>
                        )}

                        {success && (
                            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2.5">
                                <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                                <span>Event published successfully! Redirecting...</span>
                            </div>
                        )}

                        <form id="event-form" onSubmit={handleSubmit} className="space-y-4">
                            {/* Title */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                    Event Title <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    placeholder="e.g. City Marathon 2026, Street Food Fest..."
                                    required
                                />
                            </div>

                            {/* Category Selector */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-xs font-semibold text-gray-700">
                                        Category / Type
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => navigate(`${BASE_PATH}create-event-type`)}
                                        className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 font-medium cursor-pointer"
                                    >
                                        <Plus className="w-3 h-3" />
                                        <span>New Type</span>
                                    </button>
                                </div>

                                {loadingEventTypes ? (
                                    <div className="text-xs text-gray-500 py-3">Loading event types...</div>
                                ) : eventTypes.length === 0 ? (
                                    <div className="p-3 rounded-lg bg-gray-50 border border-dashed border-gray-300 text-center">
                                        <p className="text-xs text-gray-500 mb-2">No event types created yet</p>
                                        <button
                                            type="button"
                                            onClick={() => navigate(`${BASE_PATH}create-event-type`)}
                                            className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold rounded-lg cursor-pointer transition-colors"
                                        >
                                            Create Category
                                        </button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                                        {eventTypes.map((t) => {
                                            const isSelected = formData.event_type_id === t.id;
                                            const iconClass = t.icon
                                                ? (t.icon.startsWith('fa-') ? t.icon : `fa-${t.icon}`)
                                                : 'fa-calendar';
                                            const color = t.color || '#6366f1';

                                            return (
                                                <button
                                                    key={t.id}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, event_type_id: t.id })}
                                                    className={`p-2 rounded-lg text-left border flex items-center gap-2 transition-all cursor-pointer ${
                                                        isSelected
                                                            ? 'bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-200 text-indigo-900'
                                                            : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-800'
                                                    }`}
                                                >
                                                    <div
                                                        className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-white text-[11px] shadow-2xs"
                                                        style={{ backgroundColor: color }}
                                                    >
                                                        <i className={`fa ${iconClass}`}></i>
                                                    </div>
                                                    <span className="text-xs font-medium truncate flex-1">
                                                        {t.name}
                                                    </span>
                                                    {isSelected && (
                                                        <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                    Description / Details
                                </label>
                                <textarea
                                    value={formData.info}
                                    onChange={(e) => setFormData({ ...formData, info: e.target.value })}
                                    rows={3}
                                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                                    placeholder="Write a clear brief description for visitors..."
                                />
                            </div>

                            {/* Location Geotag HUD Card */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                    Geotag Location <span className="text-rose-500">*</span>
                                </label>

                                {formData.lat === 0 && formData.lng === 0 ? (
                                    <div className="p-3.5 rounded-lg border border-dashed border-gray-300 bg-gray-50/70 text-center">
                                        <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-1.5">
                                            <MapPin className="w-3.5 h-3.5" />
                                        </div>
                                        <p className="text-xs font-semibold text-indigo-600">Click on the map to set pin</p>
                                        <p className="text-[11px] text-gray-500 mt-0.5">Use the interactive map on the right</p>
                                    </div>
                                ) : (
                                    <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
                                                <MapPin className="w-3.5 h-3.5" />
                                            </div>
                                            <div>
                                                <div className="text-xs font-mono font-bold text-gray-800">
                                                    {formData.lat.toFixed(5)}, {formData.lng.toFixed(5)}
                                                </div>
                                                <div className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                    <span>Location pinned</span>
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, lat: 0, lng: 0 })}
                                            className="px-2 py-1 text-gray-500 hover:text-rose-600 text-xs rounded hover:bg-gray-100 transition-colors cursor-pointer"
                                        >
                                            Reset
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Image Attachments */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-xs font-semibold text-gray-700">
                                        Media & Attachments
                                    </label>
                                    <span className="text-[11px] text-gray-500">Space Files</span>
                                </div>

                                <div className="space-y-2">
                                    <button
                                        type="button"
                                        onClick={openImagePicker}
                                        className="w-full py-2 px-3 border border-dashed border-gray-300 hover:border-indigo-400 rounded-lg bg-gray-50 hover:bg-indigo-50/30 text-gray-600 hover:text-indigo-600 text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer"
                                    >
                                        <ImagePlus className="w-4 h-4" />
                                        <span>Select Space Files / Photos</span>
                                    </button>

                                    {imageUrls.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                            {imageUrls.map((url, idx) => (
                                                <div
                                                    key={`${url}-${idx}`}
                                                    className="px-2.5 py-1 rounded-md bg-gray-100 border border-gray-200 text-xs text-gray-700 flex items-center gap-2 max-w-[200px]"
                                                >
                                                    <span className="truncate">{url.split('/').pop() || `Image ${idx + 1}`}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeImage(idx)}
                                                        className="text-gray-400 hover:text-rose-600 cursor-pointer"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </form>
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="p-3.5 border-t border-gray-200 bg-white flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => navigate(`${BASE_PATH}maps`)}
                            className="px-3.5 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-medium transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            form="event-form"
                            disabled={loading}
                            className="flex-1 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-2xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                        >
                            {loading ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span>Publish Event Now</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Right Interactive Map Canvas */}
                <div className="flex-1 h-full relative bg-gray-100">
                    <MapContainer
                        center={mapCenter}
                        zoom={mapZoom}
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
                                position={[formData.lat, formData.lng]}
                                icon={createMarkerIcon()}
                            />
                        )}
                    </MapContainer>

                    {/* Floating Map HUD Banner */}
                    <div className="absolute top-4 left-4 z-[900] pointer-events-none">
                        <div className="bg-white/95 backdrop-blur-md border border-gray-200 px-3 py-1.5 rounded-lg shadow-md flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                            <span className="text-xs font-medium text-gray-700">
                                {formData.lat !== 0 ? 'Location Pinned • Click map to reposition' : 'Click anywhere on map to pin location'}
                            </span>
                        </div>
                    </div>

                    {formData.lat !== 0 && (
                        <div className="absolute bottom-5 right-5 z-[900]">
                            <button
                                type="button"
                                onClick={() => setMapCenter([formData.lat, formData.lng])}
                                className="px-3 py-1.5 rounded-lg bg-white/95 backdrop-blur-md hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-medium shadow-md flex items-center gap-2 transition-all cursor-pointer"
                            >
                                <Crosshair className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Center on Pin</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CreateEvent;
