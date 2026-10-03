export interface SpaceFile {
  id: string;
  name: string;
  size: number;
  mime?: string;
  path?: string;
  url?: string;
  download_url?: string;
  is_folder?: boolean;
}

/**
 * Retrieves the Potatoverse Space token from libspace.js or localStorage
 */
export function getSpaceToken(): string | null {
  if (typeof window === 'undefined') return null;
  const win = window as any;
  return (
    win.spaceGetToken?.('potato-chat') ||
    win.spaceGetToken?.() ||
    localStorage.getItem('potato-chat_space_token') ||
    localStorage.getItem('space_token') ||
    null
  );
}

/**
 * Normalizes an image path or URL into a viewable preview URL
 */
export function getFilePreviewUrl(fileIdOrUrl?: string): string {
  if (!fileIdOrUrl) return '';
  const trimmed = fileIdOrUrl.trim();
  if (
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/zz/')
  ) {
    return trimmed;
  }
  const cleanId = trimmed.replace(/^\/+/, '');
  return `/zz/api/core/space_file/preview/${cleanId}`;
}

/**
 * Gets the direct download URL for a file
 */
export function getFileDownloadUrl(fileIdOrUrl?: string): string {
  if (!fileIdOrUrl) return '';
  const trimmed = fileIdOrUrl.trim();
  if (
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://')
  ) {
    return trimmed;
  }
  if (trimmed.startsWith('/zz/api/core/space_file/preview/')) {
    return trimmed.replace('/preview/', '/download/');
  }
  const cleanId = trimmed.replace(/^\/+/, '');
  return `/zz/api/core/space_file/download/${cleanId}`;
}

/**
 * Checks whether the libspace.js file picker modal is available in current window
 */
export function hasSpaceFilePicker(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as any;
  return typeof win.spaceFilePicker === 'function';
}

/**
 * Opens the Potatoverse Space File Picker modal from libspace.js
 */
export function openSpaceFilePicker(onSelect: (file: SpaceFile) => void): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as any;
  if (!win.spaceFilePicker) return false;

  const token = getSpaceToken() || '';
  const picker = win.spaceFilePicker(token);
  if (!picker || typeof picker.showModal !== 'function') return false;

  picker.showModal((file: any) => {
    if (file && !file.is_folder) {
      const id = file.id || (file.path ? `${file.path}/${file.name}`.replace(/^\/+/, '') : file.name);
      onSelect({
        id,
        name: file.name || id.split('/').pop() || 'file',
        size: file.size || 0,
        mime: file.mime || '',
        path: file.path || '',
        url: getFilePreviewUrl(id),
        download_url: getFileDownloadUrl(id),
      });
    }
  });

  return true;
}

/**
 * Uploads a file via Potatoverse Space File API (/zz/api/core/space_file/upload)
 */
export async function uploadSpaceFile(file: File, folderPath: string = 'potato-chat/uploads'): Promise<SpaceFile> {
  const token = getSpaceToken();
  const cleanPath = folderPath ? folderPath.replace(/^\/+|\/+$/g, '') : '';

  const formData = new FormData();
  formData.append('files', file);
  formData.append('filename', file.name);

  const url = new URL('/zz/api/core/space_file/upload', window.location.origin);
  if (cleanPath) {
    url.searchParams.set('path', cleanPath);
  }

  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = token;
  }

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers,
    body: formData,
  });

  if (response.ok) {
    const data = await response.json();
    const rawId = data.file_id || data.id || file.name;
    const fileId = cleanPath && !rawId.startsWith(cleanPath) && !rawId.includes('/')
      ? `${cleanPath}/${rawId}`
      : rawId;

    return {
      id: fileId,
      name: file.name,
      size: file.size,
      mime: file.type || 'application/octet-stream',
      url: getFilePreviewUrl(fileId),
      download_url: getFileDownloadUrl(fileId),
    };
  } else {
    const errText = await response.text();
    throw new Error(`Upload failed (${response.status}): ${errText}`);
  }
}
