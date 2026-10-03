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
        win.spaceGetToken?.('cimple-books') ||
        win.spaceGetToken?.() ||
        localStorage.getItem('cimple-books_space_token') ||
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
 * Checks if a filename or MIME type corresponds to an image
 */
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
        lower.endsWith('.avif') ||
        lower.endsWith('.bmp') ||
        lower.endsWith('.ico')
    );
}

/**
 * Checks if a filename or path corresponds to a PDF
 */
export function isPdfFile(nameOrPath?: string): boolean {
    if (!nameOrPath) return false;
    const lower = nameOrPath.toLowerCase();
    return lower.endsWith('.pdf') || lower.includes('/pdf');
}

/**
 * Extracts a readable file name from a path or URL
 */
export function getFileName(fileIdOrUrl?: string): string {
    if (!fileIdOrUrl) return 'Attachment';
    const clean = fileIdOrUrl.split('?')[0];
    const parts = clean.split('/');
    return parts[parts.length - 1] || 'Attachment';
}

/**
 * Parses an attachments string (comma-separated or JSON array) into an array of file URLs or paths
 */
export function parseAttachments(attachmentsStr?: string): string[] {
    if (!attachmentsStr) return [];
    const trimmed = attachmentsStr.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
            const arr = JSON.parse(trimmed);
            if (Array.isArray(arr)) {
                return arr.map((s) => String(s).trim()).filter(Boolean);
            }
        } catch {
            // fallback to comma separated
        }
    }
    return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * Serializes an array of attachments into a comma-separated string
 */
export function serializeAttachments(attachments: string[]): string {
    return attachments.map((s) => s.trim()).filter(Boolean).join(',');
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
export async function uploadSpaceFile(file: File, folderPath: string = 'cimple-books/products'): Promise<SpaceFile> {
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
        } else {
            const errText = await response.text();
            throw new Error(`Upload failed (${response.status}): ${errText}`);
        }
    } catch (err: any) {
        console.warn('Direct space file upload error:', err);
        // Fallback: Read file as Data URL so user is not blocked if offline/testing
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target?.result as string;
                resolve({
                    id: `local-${Date.now()}-${file.name}`,
                    name: file.name,
                    size: file.size,
                    mime: file.type || 'image/png',
                    url: dataUrl,
                    download_url: dataUrl,
                });
            };
            reader.readAsDataURL(file);
        });
    }
}
