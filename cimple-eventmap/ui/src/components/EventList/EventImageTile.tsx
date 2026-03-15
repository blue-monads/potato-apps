import type { EventImage } from '../../lib/eventsApi';
import { eventImageSrc, PLACEHOLDER_SVG } from '../../lib/eventImage';

export interface EventImageTileProps {
  img: EventImage;
  alt: string;
  className?: string;
}

export function EventImageTile({ img, alt, className }: EventImageTileProps) {
  return (
    <img
      src={eventImageSrc(img.image_url)}
      alt={alt}
      className={`w-full h-full object-cover rounded-md border border-gray-200 bg-gray-100 ${className ?? ''}`}
      loading="lazy"
      onError={(e) => {
        e.currentTarget.src = PLACEHOLDER_SVG;
      }}
    />
  );
}
