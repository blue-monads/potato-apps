import { useCallback, useEffect, useState } from 'react';
import { Clock, ChevronLeft, ChevronRight, MapPin, X } from 'lucide-react';
import type { Event } from '../../lib/eventsApi';
import type { EventType } from '../../lib/eventTypesApi';
import { eventImageSrc, PLACEHOLDER_SVG } from '../../lib/eventImage';

export interface EventDetailModalProps {
  event: Event;
  eventType: EventType | null;
  onClose: () => void;
  formatDate: (date: string | null) => string;
}

function eventTypeIconClass(icon: string): string {
  return icon.startsWith('fa-') ? icon : `fa-${icon}`;
}

export function EventDetailModal({
  event,
  eventType,
  onClose,
  formatDate,
}: EventDetailModalProps) {
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
        className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden"
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
                className={`fa ${eventTypeIconClass(eventType.icon)}`}
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
              <span>
                {event.lat.toFixed(4)}, {event.lng.toFixed(4)}
              </span>
            </div>
          )}

          {hasImages && (
            <div className="relative mt-4 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
              <div className="aspect-video flex items-center justify-center min-h-48">
                <img
                  key={images[imageIndex].event_image_id}
                  src={eventImageSrc(images[imageIndex].image_url)}
                  alt={
                    event.title
                      ? `${event.title} image ${imageIndex + 1}`
                      : 'Event image'
                  }
                  className="max-w-full max-h-[50vh] w-auto h-auto object-contain"
                  onError={(e) => {
                    e.currentTarget.src = PLACEHOLDER_SVG;
                  }}
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
