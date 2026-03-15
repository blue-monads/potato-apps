import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Polygon, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Menu, X } from 'lucide-react';
import { eventsApi, type Event } from '../../lib/eventsApi';
import { eventTypesApi } from '../../lib/eventTypesApi';
import { type EventType } from '../../lib/eventTypesApi';
import { featuresApi, type Feature } from '../../lib/featuresApi';
import { getWsToken } from '../../lib/api';
import EventsList from '../../components/EventsList';

// Fix for default marker icons in React-Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Component to handle map view updates
function MapViewUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
    const map = useMap();
    
    useEffect(() => {
        map.setView(center, zoom);
    }, [center, zoom, map]);
    
    return null;
}

const EVENT_PAGE_SIZE = 1000;

const Maps = () => {
    const [events, setEvents] = useState<Event[]>([]);
    const [eventTypes, setEventTypes] = useState<EventType[]>([]);
    const [features, setFeatures] = useState<Feature[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingMoreEvents, setLoadingMoreEvents] = useState(false);
    const [hasMoreEvents, setHasMoreEvents] = useState(true);
    const [showEventsList, setShowEventsList] = useState(true);
    const [mapCenter, setMapCenter] = useState<[number, number]>([51.505, -0.09]);
    const [mapZoom, setMapZoom] = useState(13);
    const markerRefs = useRef<{ [key: number]: L.Marker }>({});
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        loadEvents();
        loadEventTypes();
        loadFeatures();
        connectWebSocket();

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
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
            setHasMoreEvents(true);
            const data = await eventsApi.query();
            const eventsArray = Array.isArray(data) ? data : [];
            setEvents(eventsArray);
            setHasMoreEvents(eventsArray.length >= EVENT_PAGE_SIZE);

            // Set map center to first event or default
            if (eventsArray.length > 0 && eventsArray[0].lat !== 0 && eventsArray[0].lng !== 0) {
                setMapCenter([eventsArray[0].lat, eventsArray[0].lng]);
            }
        } catch (error) {
            console.error('Failed to load events:', error);
            setEvents([]);
        } finally {
            setLoading(false);
        }
    };

    const loadMoreEvents = async () => {
        if (loadingMoreEvents || !hasMoreEvents || events.length === 0) return;
        const last = events[events.length - 1];
        try {
            setLoadingMoreEvents(true);
            const data = await eventsApi.query({ offset_id: last.id });
            const next = Array.isArray(data) ? data : [];
            setEvents((prev) => [...prev, ...next]);
            setHasMoreEvents(next.length >= EVENT_PAGE_SIZE);
        } catch (error) {
            console.error('Failed to load more events:', error);
        } finally {
            setLoadingMoreEvents(false);
        }
    };

    const loadFeatures = async () => {
        try {
            const data = await featuresApi.list();
            setFeatures(data);
        } catch (error) {
            console.error('Failed to load features:', error);
            setFeatures([]);
        }
    };

    const connectWebSocket = async () => {
        try {
            const tokenResponse = await getWsToken();
            const token = tokenResponse.easyws_cap_token;

            // Build WebSocket URL
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.host;
            const wsUrl = `${protocol}//${host}/zz/api/capabilities/cimple-eventmap/easy-ws?token=${encodeURIComponent(token)}`;

            // Create WebSocket connection
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('[Maps] WebSocket connected');
            };

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    // Handle broadcast messages (type: "sbroadcast")
                    if (message.type === 'sbroadcast' && message.data) {
                        // Parse the data field which contains the actual message
                        const dataMessage = typeof message.data === 'string' 
                            ? JSON.parse(message.data) 
                            : message.data;
                        handleWebSocketMessage(dataMessage);
                    }
                } catch (error) {
                    console.error('[Maps] Failed to parse WebSocket message:', error, event.data);
                }
            };

            ws.onerror = (error) => {
                console.error('[Maps] WebSocket error:', error);
            };

            ws.onclose = () => {
                console.log('[Maps] WebSocket disconnected');
                // Attempt to reconnect after 3 seconds
                setTimeout(() => {
                    if (wsRef.current?.readyState === WebSocket.CLOSED) {
                        connectWebSocket();
                    }
                }, 3000);
            };
        } catch (error) {
            console.error('[Maps] Failed to connect WebSocket:', error);
        }
    };

    const handleWebSocketMessage = (message: any) => {
        if (!message.type || !message.data) {
            return;
        }

        switch (message.type) {
            case 'event_created':
                const newEvent = message.data as Event;
                setEvents(prev => {
                    // Check if event already exists
                    if (prev.find(e => e.id === newEvent.id)) {
                        return prev;
                    }
                    return [...prev, newEvent];
                });
                break;

            case 'event_type_created':
                const newEventType = message.data as EventType;
                setEventTypes(prev => {
                    // Check if event type already exists
                    if (prev.find(et => et.id === newEventType.id)) {
                        return prev;
                    }
                    return [...prev, newEventType];
                });
                break;

            case 'feature_created':
                const newFeature = message.data as Feature;
                // Parse geometry if needed
                if (newFeature.geometry_data && newFeature.geometry_data !== '{}') {
                    try {
                        newFeature.geometry = JSON.parse(newFeature.geometry_data);
                    } catch (e) {
                        console.error('Failed to parse feature geometry:', e);
                    }
                }
                setFeatures(prev => {
                    // Check if feature already exists
                    if (prev.find(f => f.id === newFeature.id)) {
                        return prev;
                    }
                    return [...prev, newFeature];
                });
                break;

            default:
                console.log('[Maps] Unknown WebSocket message type:', message.type);
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

    return (
        <div className="flex h-screen w-full">
            {/* Sidebar with Events List */}
            {showEventsList && (
                <div className="w-80 bg-white border-r border-gray-200 transition-all duration-300">
                    <EventsList
                        selectedEventId={selectedEvent?.id || null}
                        onEventClick={handleEventClick}
                        showHeader={true}
                        showCreateButton={false}
                        events={events}
                        eventTypes={eventTypes}
                        hasMore={hasMoreEvents}
                        loadingMore={loadingMoreEvents}
                        onLoadMore={loadMoreEvents}
                    />
                </div>
            )}

            {/* Map */}
            <div className="flex-1 relative">
                {/* Toggle button for events list */}
                <button
                    onClick={() => setShowEventsList(!showEventsList)}
                    className="absolute top-20 left-3 z-[1000] bg-white hover:bg-gray-50 border border-gray-300 rounded-lg p-2 shadow-md transition-colors flex items-center gap-2"
                    title={showEventsList ? 'Hide events list' : 'Show events list'}
                >
                    {showEventsList ? (
                        <>
                            <X className="w-4 h-4 text-gray-700" />
                        </>
                    ) : (
                        <>
                            <Menu className="w-4 h-4 text-gray-700" />
                        </>
                    )}
                </button>
                
                {loading && (
                    <div className="absolute top-16 left-4 z-[1000] bg-white px-4 py-2 rounded-lg shadow-md">
                        <div className="text-sm text-gray-600">Loading map...</div>
                    </div>
                )}
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
                                eventHandlers={{
                                    click: () => handleEventClick(event),
                                }}
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
                
                {/* Display features */}
                {features.map((feature) => {
                    if (!feature.geometry) return null;
                    
                    // Validate geometry before rendering
                    const isValidPoint = (geom: any): geom is [number, number] => {
                        return Array.isArray(geom) && 
                               geom.length === 2 && 
                               typeof geom[0] === 'number' && 
                               typeof geom[1] === 'number' &&
                               !isNaN(geom[0]) && 
                               !isNaN(geom[1]);
                    };

                    const isValidLineOrArea = (geom: any): geom is [number, number][] => {
                        return Array.isArray(geom) && 
                               geom.length > 0 && 
                               geom.every((p: any) => 
                                   Array.isArray(p) && 
                                   p.length === 2 && 
                                   typeof p[0] === 'number' && 
                                   typeof p[1] === 'number' &&
                                   !isNaN(p[0]) && 
                                   !isNaN(p[1])
                               );
                    };
                    
                    if (feature.feature_type === 'point') {
                        if (!isValidPoint(feature.geometry)) {
                            console.warn('Invalid point geometry for feature:', feature.id, feature.geometry);
                            return null;
                        }
                        return (
                            <Marker
                                key={`feature-${feature.id}`}
                                position={feature.geometry}
                                icon={L.divIcon({
                                    className: 'custom-feature-icon',
                                    html: `
                                        <div style="
                                            width: 24px;
                                            height: 24px;
                                            background-color: ${feature.color};
                                            border: 2px solid white;
                                            border-radius: 50%;
                                            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                                        "></div>
                                    `,
                                    iconSize: [24, 24],
                                    iconAnchor: [12, 12],
                                    popupAnchor: [0, -12],
                                })}
                            >
                                <Popup>
                                    <div className="p-2">
                                        <h3 className="font-semibold text-sm mb-1">{feature.name}</h3>
                                        <p className="text-xs text-gray-600 mt-1">{feature.description || 'No description'}</p>
                                        <div className="text-xs text-gray-400 mt-2 capitalize">
                                            {feature.feature_type}
                                        </div>
                                    </div>
                                </Popup>
                            </Marker>
                        );
                    } else if (feature.feature_type === 'line') {
                        if (!isValidLineOrArea(feature.geometry) || feature.geometry.length < 2) {
                            console.warn('Invalid line geometry for feature:', feature.id, feature.geometry);
                            return null;
                        }
                        return (
                            <Polyline
                                key={`feature-${feature.id}`}
                                positions={feature.geometry}
                                color={feature.color}
                                weight={3}
                            >
                                <Tooltip permanent={false} direction="top" opacity={0.9}>
                                    <div className="p-1">
                                        <h3 className="font-semibold text-xs mb-0.5">{feature.name}</h3>
                                        {feature.description && (
                                            <p className="text-xs text-gray-600">{feature.description}</p>
                                        )}
                                    </div>
                                </Tooltip>
                            </Polyline>
                        );
                    } else if (feature.feature_type === 'area') {
                        if (!isValidLineOrArea(feature.geometry) || feature.geometry.length < 3) {
                            console.warn('Invalid area geometry for feature:', feature.id, feature.geometry);
                            return null;
                        }
                        return (
                            <Polygon
                                key={`feature-${feature.id}`}
                                positions={[...feature.geometry, feature.geometry[0]]}
                                color={feature.color}
                                fillColor={feature.color}
                                fillOpacity={0.3}
                                weight={2}
                            >
                                <Tooltip permanent={false} direction="top" opacity={0.9}>
                                    <div className="p-1">
                                        <h3 className="font-semibold text-xs mb-0.5">{feature.name}</h3>
                                        {feature.description && (
                                            <p className="text-xs text-gray-600">{feature.description}</p>
                                        )}
                                    </div>
                                </Tooltip>
                            </Polygon>
                        );
                    }
                    return null;
                })}
                </MapContainer>
            </div>
        </div>
    );
};

export default Maps;
