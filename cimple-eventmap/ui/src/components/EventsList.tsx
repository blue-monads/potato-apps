import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { eventsApi, type Event } from '../lib/eventsApi';
import { eventTypesApi } from '../lib/eventTypesApi';
import type { EventType } from '../lib/eventTypesApi';
import { BASE_PATH } from '../lib/base';
import { EventCard } from './EventCard';
import { EventDetailModal } from './EventDetailModal';
import { EventsListEmpty } from './EventsListEmpty';
import { EventsListHeader } from './EventsListHeader';
import { LoadMoreSection } from './LoadMoreSection';

const PAGE_SIZE = 10;

export interface EventsListProps {
  selectedEventId?: number | null;
  onEventClick?: (event: Event) => void;
  showHeader?: boolean;
  showCreateButton?: boolean;
  className?: string;
  /** If provided, use this instead of loading events */
  events?: Event[];
  /** If provided, use this instead of loading event types */
  eventTypes?: EventType[];
  /** When using external events (e.g. Maps page): show Load more and call this when clicked */
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}

function formatDateDefault(dateString: string | null): string {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleString();
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

  const useExternalData =
    externalEvents !== undefined || externalEventTypes !== undefined;
  const displayEvents = useExternalData ? externalEvents ?? [] : events;
  const displayEventTypes = useExternalData ? externalEventTypes ?? [] : eventTypes;

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
    return displayEventTypes.find((t) => t.id === eventTypeId) ?? null;
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
    if (
      useExternalData ||
      loadingMore ||
      !hasMore ||
      displayEvents.length === 0
    )
      return;
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
  }, [useExternalData, loadingMore, hasMore, displayEvents]);

  const handleNavigateCreate = useCallback(() => {
    navigate(`${BASE_PATH}create-event`);
  }, [navigate]);

  const handleEventClick = useCallback(
    (event: Event) => {
      onEventClick?.(event);
    },
    [onEventClick]
  );

  const showLoadMore =
    (!useExternalData && hasMore) ||
    (useExternalData === true && externalHasMore && externalOnLoadMore);
  const loadMoreLoading = useExternalData ? externalLoadingMore : loadingMore;
  const handleLoadMore = useExternalData ? externalOnLoadMore : loadMore;

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {showHeader && (
        <EventsListHeader
          showCreateButton={showCreateButton}
          onNavigateCreate={handleNavigateCreate}
        />
      )}

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-gray-500">
            Loading events...
          </div>
        ) : displayEvents.length === 0 ? (
          <EventsListEmpty
            showCreateButton={showCreateButton}
            onNavigateCreate={handleNavigateCreate}
          />
        ) : (
          <div
            className={
              showHeader
                ? 'divide-y divide-gray-100'
                : 'space-y-4 p-4'
            }
          >
            {displayEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                eventType={getEventType(event.event_type_id)}
                isSelected={selectedEventId === event.id}
                compact={showHeader}
                formatDate={formatDateDefault}
                onViewPanel={setEventInModal}
                onCardClick={handleEventClick}
              />
            ))}
            {showLoadMore && handleLoadMore && (
              <LoadMoreSection
                loading={loadMoreLoading ?? false}
                onLoadMore={handleLoadMore}
              />
            )}
          </div>
        )}
      </div>

      {eventInModal && (
        <EventDetailModal
          event={eventInModal}
          eventType={getEventType(eventInModal.event_type_id)}
          onClose={() => setEventInModal(null)}
          formatDate={formatDateDefault}
        />
      )}
    </div>
  );
};

export default EventsList;
