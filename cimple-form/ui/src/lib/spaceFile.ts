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
  return (window as any).spaceGetToken?.('cimple-form') || null;
}

export function getFilePreviewUrl(fileId: string): string {
  if (!fileId) return '';
  if (fileId.startsWith('blob:') || fileId.startsWith('data:') || fileId.startsWith('http://') || fileId.startsWith('https://')) {
    return fileId;
  }
  return `/zz/api/core/space_file/preview/${fileId}`;
}

export function getFileDownloadUrl(fileId: string): string {
  if (!fileId) return '';
  if (fileId.startsWith('blob:') || fileId.startsWith('data:') || fileId.startsWith('http://') || fileId.startsWith('https://')) {
    return fileId;
  }
  return `/zz/api/core/space_file/download/${fileId}`;
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
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
    lower.endsWith('.svg')
  );
}

export function getFileIconClass(nameOrMime?: string): string {
  if (!nameOrMime) return 'fa-solid fa-file';
  const lower = nameOrMime.toLowerCase();

  if (isImageFile(lower)) return 'fa-solid fa-file-image text-rose-500';
  if (lower.includes('pdf') || lower.endsWith('.pdf')) return 'fa-solid fa-file-pdf text-red-500';
  if (lower.includes('word') || lower.endsWith('.doc') || lower.endsWith('.docx')) return 'fa-solid fa-file-word text-blue-500';
  if (lower.includes('sheet') || lower.includes('excel') || lower.endsWith('.xls') || lower.endsWith('.xlsx') || lower.endsWith('.csv')) {
    return 'fa-solid fa-file-excel text-emerald-600';
  }
  if (lower.includes('zip') || lower.includes('tar') || lower.includes('rar') || lower.includes('gz')) {
    return 'fa-solid fa-file-zipper text-amber-500';
  }
  if (lower.startsWith('video/') || lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov')) {
    return 'fa-solid fa-file-video text-purple-500';
  }
  if (lower.startsWith('audio/') || lower.endsWith('.mp3') || lower.endsWith('.wav') || lower.endsWith('.ogg')) {
    return 'fa-solid fa-file-audio text-yellow-500';
  }
  if (lower.endsWith('.js') || lower.endsWith('.ts') || lower.endsWith('.json') || lower.endsWith('.html') || lower.endsWith('.css')) {
    return 'fa-solid fa-file-code text-cyan-600';
  }
  return 'fa-solid fa-file-lines text-gray-500';
}

/**
 * Opens Potatoverse File Picker from libspace.js
 */
export function openSpaceFilePicker(onSelect: (file: SpaceFile) => void): boolean {
  if (typeof window === 'undefined') return false;
  const token = getSpaceToken();
  if (!token) return false;

  const win = window as any;
  if (!win.spaceFilePicker) return false;

  const picker = win.spaceFilePicker(token);
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
 * Directly uploads a file via Potatoverse space file API
 */
export async function uploadSpaceFile(file: File, currentPath: string = 'submissions'): Promise<SpaceFile> {
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
    console.warn("Direct space file upload failed, checking fallback:", err);
  }

  // If token is missing and server upload was not reachable, provide safe local object URL fallback
  if (!token) {
    const objectUrl = URL.createObjectURL(file);
    const mockId = cleanPath ? `${cleanPath}/${file.name}` : file.name;
    return {
      id: `local-${Date.now()}-${mockId}`,
      name: file.name,
      size: file.size,
      mime: file.type || 'application/octet-stream',
      url: objectUrl,
      download_url: objectUrl,
    };
  }

  throw new Error('Upload failed: server error or invalid response');
}
