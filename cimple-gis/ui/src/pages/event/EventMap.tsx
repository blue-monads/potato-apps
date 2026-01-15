import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useNavigate } from 'react-router';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { eventsApi, type Event } from '../../lib/eventsApi';
import { eventTypesApi } from '../../lib/eventTypesApi';
import { type EventType } from '../../lib/eventTypesApi';

import { Clock, MapPin, Plus } from 'lucide-react';
import { BASE_PATH } from '../../lib/base';

// Fix for default marker icons in React-Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Component to handle map view updates when event is selected
function MapViewUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
    const map = useMap();
    
    useEffect(() => {
        map.setView(center, zoom);
    }, [center, zoom, map]);
    
    return null;
}

const EventMap = () => {
    const navigate = useNavigate();
    const [events, setEvents] = useState<Event[]>([]);
    const [eventTypes, setEventTypes] = useState<EventType[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [loading, setLoading] = useState(true);
    const [mapCenter, setMapCenter] = useState<[number, number]>([51.505, -0.09]);
    const [mapZoom, setMapZoom] = useState(13);
    const markerRefs = useRef<{ [key: number]: L.Marker }>({});

    useEffect(() => {
        loadEvents();
        loadEventTypes();
    }, []);

    const loadEventTypes = async () => {
        try {
            const types = await eventTypesApi.list();
            setEventTypes(types);
        } catch (error) {
            console.error('Failed to load event types:', error);
        }
    };

    const getEventType = (eventTypeId: number | null): EventType | null => {
        if (!eventTypeId) return null;
        return eventTypes.find(t => t.id === eventTypeId) || null;
    };

    const loadEvents = async () => {
        try {
            setLoading(true);
            const data = await eventsApi.list();
            // Ensure data is an array before setting
            const eventsArray = Array.isArray(data) ? data : [];
            setEvents(eventsArray);
            
            // Set map center to first event or default
            if (eventsArray.length > 0 && eventsArray[0].lat !== 0 && eventsArray[0].lng !== 0) {
                setMapCenter([eventsArray[0].lat, eventsArray[0].lng]);
            }
        } catch (error) {
            console.error('Failed to load events:', error);
            setEvents([]); // Set empty array on error
        } finally {
            setLoading(false);
        }
    };

    const handleEventClick = (event: Event) => {
        setSelectedEvent(event);
        
        if (event.lat !== 0 && event.lng !== 0) {
            const newCenter: [number, number] = [event.lat, event.lng];
            setMapCenter(newCenter);
            setMapZoom(15);
            
            // Highlight the marker
            const marker = markerRefs.current[event.id];
            if (marker) {
                marker.openPopup();
                marker.setIcon(createEventTypeIcon(event, true));
            }
        }
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleString();
    };

    // Create custom icon from event type
    const createEventTypeIcon = (event: Event, isSelected: boolean = false): L.Icon | L.DivIcon => {
        const eventType = getEventType(event.event_type_id);
        
        if (!eventType) {
            // Default marker if no event type
            return L.icon({
                iconUrl: isSelected 
                    ? 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png'
                    : 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            });
        }

        const iconClass = eventType.icon.startsWith('fa-') ? eventType.icon : `fa-${eventType.icon}`;
        const iconColor = eventType.color || '#3B82F6';
        const size = isSelected ? 32 : 28;
        const borderWidth = isSelected ? 3 : 2;
        const borderColor = isSelected ? '#EF4444' : iconColor;

        // Create a custom HTML icon with FontAwesome
        return L.divIcon({
            className: 'custom-event-type-icon',
            html: `
                <div style="
                    width: ${size}px;
                    height: ${size}px;
                    background-color: white;
                    border: ${borderWidth}px solid ${borderColor};
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                ">
                    <i class="fa ${iconClass}" style="
                        color: ${iconColor};
                        font-size: ${isSelected ? '18px' : '16px'};
                    "></i>
                </div>
            `,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
            popupAnchor: [0, -size / 2],
        });
    };

    return (
        <div className="flex h-screen w-full">
            {/* Sidebar with Event Feed */}
            <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-800">Event Feed</h2>
                    <button
                        onClick={() => navigate(`${BASE_PATH}create-event`)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        New
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="p-4 text-center text-gray-500">Loading events...</div>
                    ) : events.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">No events yet</div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {events.map((event) => (
                                <div
                                    key={event.id}
                                    onClick={() => handleEventClick(event)}
                                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                                        selectedEvent?.id === event.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                                    }`}
                                >
                                    <div className="flex items-start gap-3">
                                        {(() => {
                                            const eventType = getEventType(event.event_type_id);
                                            if (eventType) {
                                                return (
                                                    <i 
                                                        className={`fa ${eventType.icon.startsWith('fa-') ? eventType.icon : `fa-${eventType.icon}`} text-lg mt-0.5`}
                                                        style={{ color: eventType.color || '#3B82F6' }}
                                                    ></i>
                                                );
                                            }
                                            return (
                                                <MapPin className={`w-5 h-5 mt-0.5 ${
                                                    selectedEvent?.id === event.id ? 'text-blue-500' : 'text-gray-400'
                                                }`} />
                                            );
                                        })()}
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-gray-900 truncate">
                                                {event.title || 'Untitled Event'}
                                            </h3>
                                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                                {event.info || 'No description'}
                                            </p>
                                            <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                                                <Clock className="w-3 h-3" />
                                                <span>{formatDate(event.created_at)}</span>
                                            </div>
                                            {event.lat !== 0 && event.lng !== 0 && (
                                                <div className="text-xs text-gray-400 mt-1">
                                                    {event.lat.toFixed(4)}, {event.lng.toFixed(4)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Map */}
            <div className="flex-1 relative">
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
                    <MapViewUpdater center={mapCenter} zoom={mapZoom} />
                    
                    {events
                        .filter(event => event.lat !== 0 && event.lng !== 0)
                        .map((event) => {
                            const isSelected = selectedEvent?.id === event.id;
                            const icon = createEventTypeIcon(event, isSelected);

                            return (
                                <Marker
                                    key={event.id}
                                    position={[event.lat, event.lng]}
                                    icon={icon}
                                    ref={(ref: L.Marker | null) => {
                                        if (ref) {
                                            markerRefs.current[event.id] = ref;
                                        }
                                    }}
                                >
                                    <Popup>
                                        <div className="p-2">
                                            <div className="flex items-center gap-2 mb-1">
                                                {(() => {
                                                    const eventType = getEventType(event.event_type_id);
                                                    if (eventType) {
                                                        return (
                                                            <i 
                                                                className={`fa ${eventType.icon.startsWith('fa-') ? eventType.icon : `fa-${eventType.icon}`}`}
                                                                style={{ color: eventType.color || '#3B82F6' }}
                                                            ></i>
                                                        );
                                                    }
                                                    return null;
                                                })()}
                                                <h3 className="font-semibold text-sm">{event.title || 'Untitled Event'}</h3>
                                            </div>
                                            <p className="text-xs text-gray-600 mt-1">{event.info || 'No description'}</p>
                                            <div className="text-xs text-gray-400 mt-2">
                                                {formatDate(event.created_at)}
                                            </div>
                                        </div>
                                    </Popup>
                                </Marker>
                            );
                        })}
                </MapContainer>
            </div>
        </div>
    );
};

export default EventMap;
