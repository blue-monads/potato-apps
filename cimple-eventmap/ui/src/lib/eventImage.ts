import { CORE_API_BASE_PATH } from './base';

export const PLACEHOLDER_SVG =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56"><rect fill="#f3f4f6" width="56" height="56"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#9ca3af" font-size="10">?</text></svg>'
  );

export function eventImageSrc(imageUrl: string): string {
  if (imageUrl.startsWith('http')) return imageUrl;
  return `${CORE_API_BASE_PATH}/space_file/download/${encodeURIComponent(imageUrl)}`;
}
