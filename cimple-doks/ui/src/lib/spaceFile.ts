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

export function getSpaceToken(): string | null {
  if (typeof window === 'undefined') return null;
  return (window as any).spaceGetToken?.('cimple-doks') || null;
}

export function getFilePreviewUrl(fileId: string): string {
  if (!fileId) return '';
  if (
    fileId.startsWith('blob:') ||
    fileId.startsWith('data:') ||
    fileId.startsWith('http://') ||
    fileId.startsWith('https://')
  ) {
    return fileId;
  }
  return `/zz/api/core/space_file/preview/${fileId}`;
}

export function getFileDownloadUrl(fileId: string): string {
  if (!fileId) return '';
  if (
    fileId.startsWith('blob:') ||
    fileId.startsWith('data:') ||
    fileId.startsWith('http://') ||
    fileId.startsWith('https://')
  ) {
    return fileId;
  }
  return `/zz/api/core/space_file/download/${fileId}`;
}

export function isImageFile(nameOrMime?: string): boolean {
  if (!nameOrMime) return false;
  const lower = nameOrMime.toLowerCase();
  return (
    lower.startsWith('image/') ||
    lower.endsWith('.png') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.gif') ||
    lower.endsWith('.webp') ||
    lower.endsWith('.svg') ||
    lower.endsWith('.avif')
  );
}

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
  const token = getSpaceToken();
  const win = window as any;
  if (!win.spaceFilePicker) return false;

  const picker = win.spaceFilePicker(token || '');
  if (!picker || typeof picker.showModal !== 'function') return false;

  picker.showModal((file: any) => {
    if (file && !file.is_folder) {
      const id = file.id || (file.path ? `${file.path}/${file.name}`.replace(/^\/+/, '') : file.name);
      onSelect({
        id,
        name: file.name,
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
 * Uploads a file via Potatoverse Space File API, with data URL fallback
 */
export async function uploadSpaceFile(file: File, currentPath: string = 'doks'): Promise<SpaceFile> {
  const token = getSpaceToken();
  const cleanPath = currentPath ? currentPath.replace(/^\/+|\/+$/g, '') : '';

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

  try {
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
    }
  } catch (err) {
    console.warn('Direct space file upload failed, using FileReader fallback:', err);
  }

  // Fallback: Read file as Data URL
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      resolve({
        id: `local-${Date.now()}-${file.name}`,
        name: file.name,
        size: file.size,
        mime: file.type,
        url: dataUrl || URL.createObjectURL(file),
        download_url: dataUrl || URL.createObjectURL(file),
      });
    };
    reader.readAsDataURL(file);
  });
}
