import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { eventsApi, type Event, type EventImage } from '../lib/eventsApi';
import { eventTypesApi } from '../lib/eventTypesApi';
import { type EventType } from '../lib/eventTypesApi';
import { Clock, ChevronLeft, ChevronRight, MapPin, PanelRightOpen, Plus, X } from 'lucide-react';
import { BASE_PATH, CORE_API_BASE_PATH } from '../lib/base';


function eventImageSrc(imageUrl: string): string {
    if (imageUrl.startsWith('http')) return imageUrl;
    return `${CORE_API_BASE_PATH}/space_file/download/${encodeURIComponent(imageUrl)}`;
}

const PAGE_SIZE = 10;

const PLACEHOLDER_SVG = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56"><rect fill="#f3f4f6" width="56" height="56"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#9ca3af" font-size="10">?</text></svg>');

function EventImageTile({ img, alt, className }: { img: EventImage; alt: string; className?: string }) {
    return (
        <img
            src={eventImageSrc(img.image_url)}
            alt={alt}
            className={`w-full h-full object-cover rounded-md border border-gray-200 bg-gray-100 ${className ?? ''}`}
            loading="lazy"
            onError={(e) => { e.currentTarget.src = PLACEHOLDER_SVG; }}
        />
    );
}

function EventImagesCollage({ images, title }: { images: EventImage[]; title: string }) {
    const n = images.length;
    if (n === 0) return null;

    const alt = title || 'Event image';

    if (n === 1) {
        return (
            <div className="mt-2 w-full aspect-video max-h-32 rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
                <EventImageTile img={images[0]} alt={alt} />
            </div>
        );
    }

    if (n === 2) {
        return (
            <div className="mt-2 grid grid-cols-2 gap-1.5 w-full max-h-28 rounded-lg overflow-hidden">
                {images.slice(0, 2).map((img) => (
                    <div key={img.event_image_id} className="aspect-[4/3] min-h-0 bg-gray-100 rounded-md overflow-hidden border border-gray-200">
                        <EventImageTile img={img} alt={alt} />
                    </div>
                ))}
            </div>
        );
    }

    if (n === 3) {
        return (
            <div className="mt-2 grid grid-cols-2 gap-1.5 w-full max-h-28 rounded-lg overflow-hidden" style={{ gridTemplateRows: '1fr 1fr' }}>
                <div className="row-span-2 min-h-0 bg-gray-100 rounded-l-md overflow-hidden border border-gray-200">
                    <EventImageTile img={images[0]} alt={alt} />
                </div>
                {images.slice(1, 3).map((img) => (
                    <div key={img.event_image_id} className="min-h-0 bg-gray-100 rounded-r-md overflow-hidden border border-gray-200">
                        <EventImageTile img={img} alt={alt} />
                    </div>
                ))}
            </div>
        );
    }

    // 4+ images: 2x2 montage, 4th cell shows +N if more than 4
    const show = images.slice(0, 4);
    const extra = n - 4;

    return (
        <div className="mt-2 grid grid-cols-2 gap-1.5 w-full max-h-64 rounded-lg overflow-hidden">
            {show.map((img, i) => (
                <div
                    key={img.event_image_id}
                    className="relative aspect-[4/3] min-h-0 bg-gray-100 rounded-md overflow-hidden border border-gray-200"
                >
                    <EventImageTile img={img} alt={alt} />
                    {i === 3 && extra > 0 && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-md">
                            <span className="text-white text-sm font-medium">+{extra}</span>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

function EventDetailModal({
    event,
    eventType,
    onClose,
    formatDate,
}: {
    event: Event;
    eventType: EventType | null;
    onClose: () => void;
    formatDate: (date: string | null) => string;
}) {
    const images = event.images ?? [];
    const [imageIndex, setImageIndex] = useState(0);
    const hasImages = images.length > 0;
    const canGoPrev = hasImages && images.length > 1;
    const canGoNext = hasImages && images.length > 1;

    const goPrev = useCallback(() => {
        if (!canGoPrev) return;
        setImageIndex((i) => (i - 1 + images.length) % images.length);
    }, [canGoPrev, images.length]);

    const goNext = useCallback(() => {
        if (!canGoNext) return;
        setImageIndex((i) => (i + 1) % images.length);
    }, [canGoNext, images.length]);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
                return;
            }
            if (e.key === 'ArrowLeft') {
                goPrev();
                return;
            }
            if (e.key === 'ArrowRight') {
                goNext();
                return;
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose, goPrev, goNext]);

    // Reset image index when event changes
    useEffect(() => {
        setImageIndex(0);
    }, [event.id]);

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label="Event details"
        >
            <div
                className="bg-white rounded-xl shadow-xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-4 border-b border-gray-200 shrink-0">
                    <h2 className="text-lg font-semibold text-gray-900 truncate pr-2">
                        {event.title || 'Untitled Event'}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {eventType && (
                        <p className="text-sm text-gray-600 flex items-center gap-1.5">
                            <i
                                className={`fa ${eventType.icon.startsWith('fa-') ? eventType.icon : `fa-${eventType.icon}`}`}
                                style={{ color: eventType.color || '#3B82F6' }}
                            />
                            <span>{eventType.name}</span>
                        </p>
                    )}
                    <p className="text-gray-700 text-sm">{event.info || 'No description'}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatDate(event.created_at)}</span>
                    </div>
                    {event.lat !== 0 && event.lng !== 0 && (
                        <div className="text-gray-500 text-xs flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            <span>{event.lat.toFixed(4)}, {event.lng.toFixed(4)}</span>
                        </div>
                    )}

                    {hasImages && (
                        <div className="relative mt-4 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                            <div className="aspect-video flex items-center justify-center min-h-48">
                                <img
                                    key={images[imageIndex].event_image_id}
                                    src={eventImageSrc(images[imageIndex].image_url)}
                                    alt={event.title ? `${event.title} image ${imageIndex + 1}` : 'Event image'}
                                    className="max-w-full max-h-[50vh] w-auto h-auto object-contain"
                                    onError={(e) => { e.currentTarget.src = PLACEHOLDER_SVG; }}
                                />
                            </div>
                            {images.length > 1 && (
                                <>
                                    <button
                                        type="button"
                                        onClick={goPrev}
                                        className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                                        aria-label="Previous image"
                                        disabled={!canGoPrev}
                                    >
                                        <ChevronLeft className="w-5 h-5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={goNext}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                                        aria-label="Next image"
                                        disabled={!canGoNext}
                                    >
                                        <ChevronRight className="w-5 h-5" />
                                    </button>
                                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-1 rounded-full bg-black/50 text-white text-xs">
                                        {imageIndex + 1} / {images.length}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

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
    const [eventInModal, setEventInModal] = useState<Event | null>(null);

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
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-gray-500 text-xs">{`#${event.id}`}</span>
                                                {eventType && (
                                                    <i
                                                        className={`fa ${eventType.icon.startsWith('fa-') ? eventType.icon : `fa-${eventType.icon}`} text-lg mt-0.5`}
                                                        style={{ color: eventType.color || '#3B82F6' }}
                                                    />
                                                )}
                                                <h3 className={`font-semibold text-gray-900 flex-1 min-w-0 ${showHeader ? 'truncate' : 'text-lg'}`}>
                                                    {event.title || 'Untitled Event'}
                                                </h3>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEventInModal(event);
                                                    }}
                                                    className="shrink-0 flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                                                    title="View in panel"
                                                    aria-label="View event in panel"
                                                >
                                                    <PanelRightOpen className="w-3.5 h-3.5" />
                                                    View
                                                </button>
                                            </div>
                                            <p className={`text-gray-600 mt-1 ${showHeader ? 'text-sm line-clamp-2' : 'text-sm'}`}>
                                                {event.info || 'No description'}
                                            </p>
                                            {event.images && event.images.length > 0 && (
                                                <EventImagesCollage images={event.images} title={event.title || 'Event'} />
                                            )}
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

            {eventInModal && (
                <EventDetailModal
                    event={eventInModal}
                    eventType={getEventType(eventInModal.event_type_id)}
                    onClose={() => setEventInModal(null)}
                    formatDate={formatDate}
                />
            )}
        </div>
    );
};

export default EventsList;
