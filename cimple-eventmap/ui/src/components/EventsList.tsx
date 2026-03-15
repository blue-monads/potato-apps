import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { eventsApi, type Event } from '../lib/eventsApi';
import { eventTypesApi } from '../lib/eventTypesApi';
import { type EventType } from '../lib/eventTypesApi';
import { Clock, MapPin, Plus } from 'lucide-react';
import { BASE_PATH } from '../lib/base';

const PAGE_SIZE = 10;

interface EventsListProps {
    selectedEventId?: number | null;
    onEventClick?: (event: Event) => void;
    showHeader?: boolean;
    showCreateButton?: boolean;
    className?: string;
    events?: Event[]; // Optional: if provided, use this instead of loading
    eventTypes?: EventType[]; // Optional: if provided, use this instead of loading
    /** When using external events (e.g. Maps page): show Load more and call this when clicked */
    hasMore?: boolean;
    loadingMore?: boolean;
    onLoadMore?: () => void;
}

const EventsList = ({
    selectedEventId,
    onEventClick,
    showHeader = true,
    showCreateButton = true,
    className = '',
    events: externalEvents,
    eventTypes: externalEventTypes,
    hasMore: externalHasMore,
    loadingMore: externalLoadingMore,
    onLoadMore: externalOnLoadMore,
}: EventsListProps) => {
    const navigate = useNavigate();
    const [events, setEvents] = useState<Event[]>([]);
    const [eventTypes, setEventTypes] = useState<EventType[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    // Use external events/eventTypes if provided, otherwise load them
    const useExternalData = externalEvents !== undefined || externalEventTypes !== undefined;
    const displayEvents = useExternalData ? (externalEvents || []) : events;
    const displayEventTypes = useExternalData ? (externalEventTypes || []) : eventTypes;

    useEffect(() => {
        if (!useExternalData) {
            loadEvents();
            loadEventTypes();
        } else {
            setLoading(false);
        }
    }, [useExternalData]);

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
        return displayEventTypes.find(t => t.id === eventTypeId) || null;
    };

    const loadEvents = useCallback(async () => {
        try {
            setLoading(true);
            setHasMore(true);
            const data = await eventsApi.query();
            const eventsArray = Array.isArray(data) ? data : [];
            setEvents(eventsArray);
            setHasMore(eventsArray.length >= PAGE_SIZE);
        } catch (error) {
            console.error('Failed to load events:', error);
            setEvents([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const loadMore = useCallback(async () => {
        if (useExternalData || loadingMore || !hasMore || displayEvents.length === 0) return;
        const last = displayEvents[displayEvents.length - 1];
        try {
            setLoadingMore(true);
            const data = await eventsApi.query({ offset_id: last.id });
            const next = Array.isArray(data) ? data : [];
            setEvents((prev) => [...prev, ...next]);
            setHasMore(next.length >= PAGE_SIZE);
        } catch (error) {
            console.error('Failed to load more events:', error);
        } finally {
            setLoadingMore(false);
        }
    }, [useExternalData, loadingMore, hasMore, displayEvents.length, displayEvents]);

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleString();
    };

    const handleEventClick = (event: Event) => {
        if (onEventClick) {
            onEventClick(event);
        }
    };

    return (
        <div className={`flex flex-col h-full ${className}`}>
            {showHeader && (
                <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white">
                    <h2 className="text-xl font-semibold text-gray-800">Events</h2>
                    {showCreateButton && (
                        <button
                            onClick={() => navigate(`${BASE_PATH}create-event`)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            New
                        </button>
                    )}
                </div>
            )}

            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="p-4 text-center text-gray-500">Loading events...</div>
                ) : displayEvents.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                        {showCreateButton ? (
                            <>
                                <p className="mb-2">No events yet</p>
                                <button
                                    onClick={() => navigate(`${BASE_PATH}create-event`)}
                                    className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    Create First Event
                                </button>
                            </>
                        ) : (
                            <p>No events yet</p>
                        )}
                    </div>
                ) : (
                    <div className={showHeader ? "divide-y divide-gray-100" : "space-y-4 p-4"}>
                        {displayEvents.map((event) => {
                            const eventType = getEventType(event.event_type_id);
                            const isSelected = selectedEventId === event.id;

                            return (
                                <div
                                    key={event.id}
                                    onClick={() => handleEventClick(event)}
                                    className={`${showHeader
                                        ? `p-4 cursor-pointer hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                                        }`
                                        : `bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow ${isSelected ? 'ring-2 ring-blue-500' : ''
                                        }`
                                        }`}
                                >
                                    <div className="flex items-start gap-3">

                                        <div>
                                            <span className="text-gray-500 text-xs">{`#${event.id}`}</span>
                                            {eventType ? (
                                                <i
                                                    className={`fa ${eventType.icon.startsWith('fa-') ? eventType.icon : `fa-${eventType.icon}`} text-lg mt-0.5`}
                                                    style={{ color: eventType.color || '#3B82F6' }}
                                                ></i>
                                            ) : (
                                                
                                                <i className={"fa fa-map-marker-alt text-lg mt-0.5 text-gray-400"} style={{ color: '#3B82F6' }}></i>

                                            )}

                                        </div>





                                        <div className="flex-1 min-w-0">
                                            <h3 className={`font-semibold text-gray-900 ${showHeader ? 'truncate' : 'text-lg'}`}>
                                                {event.title || 'Untitled Event'}
                                            </h3>
                                            <p className={`text-gray-600 mt-1 ${showHeader ? 'text-sm line-clamp-2' : 'text-sm'}`}>
                                                {event.info || 'No description'}
                                            </p>
                                            <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                                                <Clock className="w-3 h-3" />
                                                <span>{formatDate(event.created_at)}</span>
                                            </div>
                                            {event.lat !== 0 && event.lng !== 0 && (
                                                <div className={`text-gray-400 mt-1 ${showHeader ? 'text-xs' : 'text-xs flex items-center gap-1'}`}>
                                                    {!showHeader && <MapPin className="w-3 h-3" />}
                                                    <span>{event.lat.toFixed(4)}, {event.lng.toFixed(4)}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {((!useExternalData && hasMore) || (useExternalData && externalHasMore && externalOnLoadMore)) && (
                            <div className="p-4 flex justify-center border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={useExternalData ? externalOnLoadMore : loadMore}
                                    disabled={useExternalData ? externalLoadingMore : loadingMore}
                                    className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {(useExternalData ? externalLoadingMore : loadingMore) ? 'Loading…' : 'Load more'}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* <div className="p-4">
                <button className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                    onClick={() => {


                        if (typeof window === 'undefined') return;

                        if (!window.spaceFilePicker) return;
                        if (!window.spaceGetToken) return;

                        const token = window.spaceGetToken('cimple-eventmap');
                        if (!token) return;

                        const picker = window.spaceFilePicker(token);
                        if (!picker) return;
                        picker.showModal((file) => {
                            console.log(file);
                        })

                    }}

                >
                    Show File Picker
                </button>
            </div> */}
        </div>
    );
};

export default EventsList;
