import { Clock, MapPin, PanelRightOpen } from 'lucide-react';
import type { Event } from '../../lib/eventsApi';
import type { EventType } from '../../lib/eventTypesApi';
import { EventImagesCollage } from './EventImagesCollage';

function eventTypeIconClass(icon: string): string {
  return icon.startsWith('fa-') ? icon : `fa-${icon}`;
}

export interface EventCardProps {
  event: Event;
  eventType: EventType | null;
  isSelected: boolean;
  /** When true, use compact list style; when false, use card style (e.g. for maps page) */
  compact: boolean;
  formatDate: (date: string | null) => string;
  onViewPanel: (event: Event) => void;
  onCardClick: (event: Event) => void;
}

export function EventCard({
  event,
  eventType,
  isSelected,
  compact,
  formatDate,
  onViewPanel,
  onCardClick,
}: EventCardProps) {
  const containerClass = compact
    ? `p-4 cursor-pointer hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`
    : `bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow ${isSelected ? 'ring-2 ring-blue-500' : ''}`;

  return (
    <div onClick={() => onCardClick(event)} className={containerClass}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-gray-500 text-xs">{`#${event.id}`}</span>
            {eventType && (
              <i
                className={`fa ${eventTypeIconClass(eventType.icon)} text-lg mt-0.5`}
                style={{ color: eventType.color || '#3B82F6' }}
              />
            )}
            <h3
              className={`font-semibold text-gray-900 flex-1 min-w-0 ${compact ? 'truncate' : 'text-lg'}`}
            >
              {event.title || 'Untitled Event'}
            </h3>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onViewPanel(event);
              }}
              className="shrink-0 flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              title="View in panel"
              aria-label="View event in panel"
            >
              <PanelRightOpen className="w-3.5 h-3.5" />
              View
            </button>
          </div>
          <p
            className={`text-gray-600 mt-1 ${compact ? 'text-sm line-clamp-2' : 'text-sm'}`}
          >
            {event.info || 'No description'}
          </p>
          {event.images && event.images.length > 0 && (
            <EventImagesCollage
              images={event.images}
              title={event.title || 'Event'}
            />
          )}
          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
            <Clock className="w-3 h-3" />
            <span>{formatDate(event.created_at)}</span>
          </div>
          {event.lat !== 0 && event.lng !== 0 && (
            <div
              className={`text-gray-400 mt-1 ${compact ? 'text-xs' : 'text-xs flex items-center gap-1'}`}
            >
              {!compact && <MapPin className="w-3 h-3" />}
              <span>
                {event.lat.toFixed(4)}, {event.lng.toFixed(4)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
