import type { EventImage } from '../../lib/eventsApi';
import { EventImageTile } from './EventImageTile';

export interface EventImagesCollageProps {
  images: EventImage[];
  title: string;
}

export function EventImagesCollage({ images, title }: EventImagesCollageProps) {
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
          <div
            key={img.event_image_id}
            className="aspect-[4/3] min-h-0 bg-gray-100 rounded-md overflow-hidden border border-gray-200"
          >
            <EventImageTile img={img} alt={alt} />
          </div>
        ))}
      </div>
    );
  }

  if (n === 3) {
    return (
      <div
        className="mt-2 grid grid-cols-2 gap-1.5 w-full max-h-28 rounded-lg overflow-hidden"
        style={{ gridTemplateRows: '1fr 1fr' }}
      >
        <div className="row-span-2 min-h-0 bg-gray-100 rounded-l-md overflow-hidden border border-gray-200">
          <EventImageTile img={images[0]} alt={alt} />
        </div>
        {images.slice(1, 3).map((img) => (
          <div
            key={img.event_image_id}
            className="min-h-0 bg-gray-100 rounded-r-md overflow-hidden border border-gray-200"
          >
            <EventImageTile img={img} alt={alt} />
          </div>
        ))}
      </div>
    );
  }

  const show = images.slice(0, 4);
  const extra = n - 4;

  return (
    <div className="mt-2 grid grid-cols-2 gap-1.5 w-full max-h-64 rounded-lg">
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
