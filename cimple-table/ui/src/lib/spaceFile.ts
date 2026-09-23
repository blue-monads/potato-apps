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
  const win = window as any;
  return (
    win.spaceGetToken?.('cimple-table') ||
    win.spaceGetToken?.('cimple-form') ||
    win.spaceGetToken?.() ||
    localStorage.getItem('cimple-table_space_token') ||
    localStorage.getItem('space_token') ||
    null
  );
}

export function normalizeSpaceFileUrl(url?: string): string {
  if (!url) return '';
  return url.replace(/\/zz\/api\/core\/space_file\/preview\//g, '/zz/api/core/space_file/download/');
}

export function getFilePreviewUrl(fileId: string): string {
  if (!fileId) return '';
  if (
    fileId.startsWith('blob:') ||
    fileId.startsWith('data:') ||
    fileId.startsWith('http://') ||
    fileId.startsWith('https://')
  ) {
    return normalizeSpaceFileUrl(fileId);
  }
  return `/zz/api/core/space_file/download/${fileId}`;
}

export function getFileDownloadUrl(fileId: string): string {
  if (!fileId) return '';
  if (
    fileId.startsWith('blob:') ||
    fileId.startsWith('data:') ||
    fileId.startsWith('http://') ||
    fileId.startsWith('https://')
  ) {
    return normalizeSpaceFileUrl(fileId);
  }
  return `/zz/api/core/space_file/download/${fileId}`;
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  if (i < 0 || i >= sizes.length) return `${bytes} B`;
  return `${Math.round((bytes / Math.pow(k, i)) * 10) / 10} ${sizes[i]}`;
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
    lower.endsWith('.bmp') ||
    lower.endsWith('.ico')
  );
}

export function getFileIconClass(nameOrMime?: string): string {
  if (!nameOrMime) return 'fa-solid fa-file text-slate-500';
  const lower = nameOrMime.toLowerCase();

  if (isImageFile(lower)) return 'fa-solid fa-file-image text-rose-500';
  if (lower.includes('pdf') || lower.endsWith('.pdf')) return 'fa-solid fa-file-pdf text-red-500';
  if (lower.includes('word') || lower.endsWith('.doc') || lower.endsWith('.docx')) return 'fa-solid fa-file-word text-blue-500';
  if (lower.includes('sheet') || lower.includes('excel') || lower.endsWith('.xls') || lower.endsWith('.xlsx') || lower.endsWith('.csv')) {
    return 'fa-solid fa-file-excel text-emerald-600';
  }
  if (lower.includes('zip') || lower.includes('tar') || lower.includes('rar') || lower.includes('gz') || lower.endsWith('.7z')) {
    return 'fa-solid fa-file-zipper text-amber-500';
  }
  if (lower.startsWith('video/') || lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov') || lower.endsWith('.mkv')) {
    return 'fa-solid fa-file-video text-purple-500';
  }
  if (lower.startsWith('audio/') || lower.endsWith('.mp3') || lower.endsWith('.wav') || lower.endsWith('.ogg')) {
    return 'fa-solid fa-file-audio text-yellow-500';
  }
  if (lower.endsWith('.js') || lower.endsWith('.ts') || lower.endsWith('.json') || lower.endsWith('.html') || lower.endsWith('.css') || lower.endsWith('.py') || lower.endsWith('.sql')) {
    return 'fa-solid fa-file-code text-cyan-600';
  }
  return 'fa-solid fa-file-lines text-slate-500';
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
export async function uploadSpaceFile(file: File, currentPath: string = ''): Promise<SpaceFile> {
  const token = getSpaceToken();

  // If token is missing, provide a safe local object URL fallback
  if (!token) {
    const objectUrl = URL.createObjectURL(file);
    return {
      id: `local-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: file.name,
      size: file.size,
      mime: file.type || 'application/octet-stream',
      url: objectUrl,
      download_url: objectUrl,
    };
  }

  const formData = new FormData();
  formData.append('files', file);
  formData.append('filename', file.name);

  const url = new URL('/zz/api/core/space_file/upload', window.location.origin);
  if (currentPath) {
    url.searchParams.set('path', currentPath);
  }

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Authorization': token,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Upload failed: ${errorText || response.statusText}`);
  }

  const data = await response.json();
  const fileId = data.file_id || data.id || file.name;

  return {
    id: fileId,
    name: file.name,
    size: file.size,
    mime: file.type || 'application/octet-stream',
    url: getFilePreviewUrl(fileId),
    download_url: getFileDownloadUrl(fileId),
  };
}

export function parseFileValue(raw: any): SpaceFile | null {
  if (!raw) return null;
  if (typeof raw === 'object' && raw !== null) {
    if (raw.url || raw.id || raw.name) {
      const id = String(raw.id || raw.name || raw.url);
      return {
        id,
        name: raw.name || id.split('/').pop() || 'file',
        size: Number(raw.size) || 0,
        mime: raw.mime || '',
        url: raw.url || getFilePreviewUrl(id),
        download_url: raw.download_url || getFileDownloadUrl(id),
      };
    }
    return null;
  }
  if (typeof raw !== 'string') return null;
  const str = raw.trim();
  if (!str) return null;

  // Try JSON
  if (str.startsWith('{') && str.endsWith('}')) {
    try {
      const parsed = JSON.parse(str);
      if (parsed && typeof parsed === 'object') {
        const id = String(parsed.id || parsed.name || parsed.url || '');
        const rawUrl = parsed.url || getFilePreviewUrl(id);
        const rawDownload = parsed.download_url || getFileDownloadUrl(id);
        return {
          id,
          name: parsed.name || id.split('/').pop() || 'file',
          size: Number(parsed.size) || 0,
          mime: parsed.mime || '',
          url: normalizeSpaceFileUrl(rawUrl),
          download_url: normalizeSpaceFileUrl(rawDownload),
        };
      }
    } catch {
      // not JSON, fallback to string parsing
    }
  }

  // Raw URL
  if (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('data:') || str.startsWith('blob:')) {
    let name = 'file';
    try {
      const u = new URL(str, window.location.origin);
      const seg = u.pathname.split('/').filter(Boolean).pop();
      if (seg) name = decodeURIComponent(seg);
    } catch {
      name = str.split('/').pop()?.split('?')[0] || str;
    }
    const cleanUrl = normalizeSpaceFileUrl(str);
    return {
      id: str,
      name,
      size: 0,
      mime: '',
      url: cleanUrl,
      download_url: cleanUrl,
    };
  }

  // File ID or path
  const name = str.split('/').pop() || str;
  return {
    id: str,
    name,
    size: 0,
    mime: '',
    url: getFilePreviewUrl(str),
    download_url: getFileDownloadUrl(str),
  };
}

export function serializeFileValue(file: SpaceFile | null): string {
  if (!file) return '';
  return JSON.stringify({
    id: file.id,
    name: file.name,
    size: file.size,
    mime: file.mime || '',
    url: file.url || getFilePreviewUrl(file.id),
    download_url: file.download_url || getFileDownloadUrl(file.id),
  });
}
