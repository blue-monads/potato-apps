import { API_BASE_PATH, isInsideIframe } from "./base";
import { uploadSpaceFile, type SpaceFile } from "./spaceFile";

export * from "./spaceFile";
export { isInsideIframe };

export const getAuthToken = (): string | null => {
    if (typeof window === 'undefined') return null;
    return (window as any).spaceGetToken?.('potato-chat') || null;
};

export interface ApiResponse<T> {
    status: number;
    data: T;
    error?: string;
}

export async function apiRequest<T>(
    path: string,
    options?: RequestInit
): Promise<ApiResponse<T>> {
    const token = getAuthToken();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options?.headers as Record<string, string> || {}),
    };

    if (token) {
        headers['Authorization'] = token;
    }

    const response = await fetch(`${API_BASE_PATH}${path}`, {
        ...options,
        headers,
    });

    const data = await response.json().catch(() => ({ error: 'Unknown error' }));

    return {
        status: response.status,
        data: response.ok ? data : undefined as T,
        error: response.ok ? undefined : (data.error || `HTTP ${response.status}`),
    };
}

export interface User {
    id: number;
    name: string;
    email?: string;
    associated_channel?: number;
    is_self: boolean;
    is_online: boolean;
}

export interface Channel {
    id: number;
    name: string;
    description: string;
    visibility: string;
    type: string;
    created_by_user_id: number;
    created_at: string;
    max_messages: number;
    read_max: number;
    unread_count?: number;
    is_admin?: boolean;
}

export interface Reaction {
    id: number;
    user_id: number;
    reaction: string;
    created_at?: string;
}

export interface FileAttachment {
    id: number;
    file_url_or_id: string;
    ftype: string;
    file_name?: string;
    file_size?: number;
}

export interface ReplyPreview {
    id: number;
    message: string;
    from_user_id: number;
}

export interface Message {
    id: number;
    channel_id: number;
    from_user_id: number;
    message: string;
    created_at: string;
    updated_at?: string;
    is_edited?: boolean;
    is_deleted?: boolean;
    thread_id?: number;
    reply_to_message_id?: number;
    reply_to?: ReplyPreview;
    files?: FileAttachment[];
    reactions?: Reaction[];
}

export interface ChannelMember {
    user_id: number;
    name: string;
    email: string;
    is_admin: boolean;
    joined_at: string;
    is_online: boolean;
    is_self: boolean;
}

export interface LoadData {
    users: User[];
    channels: Channel[];
    ws_token: string;
    connId: string;
    current_user_id?: number;
}

export const getFileDownloadUrl = (fileUrlOrId: string) => {
    return `/zz/api/core/space_file/download/${encodeURIComponent(fileUrlOrId)}`;
};

export const getFilePreviewUrl = (fileUrlOrId: string) => {
    return `/zz/api/core/space_file/preview/${encodeURIComponent(fileUrlOrId)}`;
};

export const isImageFile = (file: FileAttachment): boolean => {
    if (file.ftype === 'image') return true;
    const name = file.file_name?.toLowerCase() || '';
    return /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(name);
};

export const formatFileSize = (bytes?: number): string => {
    if (!bytes || bytes <= 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const getUserProfileImageUrl = (userId: number | string, name?: string): string => {
    const safeName = name && name.trim() ? encodeURIComponent(name.trim().replace(/\s+/g, '_')) : 'user';
    return `/zz/profileImage/${userId}/${safeName}`;
};

export const getAirtableAvatar = (id: number, name?: string) => {
    const styles = [
        { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
        { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200' },
        { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
        { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' },
        { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200' },
        { bg: 'bg-cyan-100', text: 'text-cyan-800', border: 'border-cyan-200' },
        { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200' },
        { bg: 'bg-teal-100', text: 'text-teal-800', border: 'border-teal-200' },
    ];
    const key = (name && name.length > 0) ? name.charCodeAt(0) + Number(id || 0) : Number(id || 0);
    const style = styles[Math.abs(key) % styles.length];
    const initial = (name && name.trim().length > 0) ? name.trim().charAt(0).toUpperCase() : 'U';
    return { ...style, initial };
};

export const coreApi = {
    load: async (): Promise<LoadData> => {
        const response = await apiRequest<LoadData>('/load', { method: 'GET' });
        if (response.error) throw new Error(response.error);
        const final = response.data;

        if (typeof final.channels === "object" && !Array.isArray(final.channels)) {
            final.channels = Object.values(final.channels);
        }

        if (typeof final.users === "object" && !Array.isArray(final.users)) {
            final.users = Object.values(final.users);
        }

        return final;
    }
};

export const usersApi = {
    list: async (): Promise<User[]> => {
        const response = await apiRequest<User[]>('/user', { method: 'GET' });
        if (response.error) throw new Error(response.error);
        return Array.isArray(response.data) ? response.data : [];
    },
    startDirectChat: async (userId: number): Promise<{ channel_id: number }> => {
        const response = await apiRequest<{ channel_id: number }>('/start_direct_chat', {
            method: 'POST',
            body: JSON.stringify({ user_id: userId })
        });
        if (response.error) throw new Error(response.error);
        return response.data;
    }
};

export const channelsApi = {
    list: async (): Promise<Channel[]> => {
        const response = await apiRequest<Channel[]>('/channel', { method: 'GET' });
        if (response.error) throw new Error(response.error);
        return Array.isArray(response.data) ? response.data : [];
    },
    listDirect: async (): Promise<Channel[]> => {
        const response = await apiRequest<Channel[]>('/channel_direct', { method: 'GET' });
        if (response.error) throw new Error(response.error);
        return Array.isArray(response.data) ? response.data : [];
    },
    create: async (name: string, description: string = "", visibility: string = "public"): Promise<{ id: number }> => {
        const response = await apiRequest<{ id: number }>('/channel', {
            method: 'POST',
            body: JSON.stringify({ name, description, visibility })
        });
        if (response.error) throw new Error(response.error);
        return response.data;
    },
    delete: async (channelId: number): Promise<void> => {
        const response = await apiRequest<void>(`/channel/${channelId}`, {
            method: 'DELETE'
        });
        if (response.error) throw new Error(response.error);
    },
    invite: async (channelId: number, userId: number): Promise<void> => {
        const response = await apiRequest<void>(`/channel/${channelId}/invite`, {
            method: 'POST',
            body: JSON.stringify({ user_id: userId })
        });
        if (response.error) throw new Error(response.error);
    },
    getMembers: async (channelId: number): Promise<ChannelMember[]> => {
        const response = await apiRequest<ChannelMember[]>(`/channel/${channelId}/members`, {
            method: 'GET'
        });
        if (response.error) throw new Error(response.error);
        return Array.isArray(response.data) ? response.data : [];
    },
    leave: async (channelId: number): Promise<void> => {
        const response = await apiRequest<void>(`/channel/${channelId}/leave`, {
            method: 'POST'
        });
        if (response.error) throw new Error(response.error);
    },
    removeMember: async (channelId: number, targetUserId: number): Promise<void> => {
        const response = await apiRequest<void>(`/channel/${channelId}/member/${targetUserId}`, {
            method: 'DELETE'
        });
        if (response.error) throw new Error(response.error);
    },
    markRead: async (channelId: number, messageId?: number): Promise<void> => {
        await apiRequest<void>(`/channel/${channelId}/read`, {
            method: 'POST',
            body: JSON.stringify({ message_id: messageId })
        }).catch(() => {});
    }
};

const getWSToken = async (): Promise<string> => {
    const response = await apiRequest<{ token: string }>('/ws_token', {
        method: 'GET'
    });
    if (response.error) throw new Error(response.error);
    return response.data.token;
};

export const getWSURL = async (explicitToken?: string): Promise<string> => {
    const token = explicitToken || await getWSToken();
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/zz/api/capabilities/potato-chat/xWebsocket?token=${encodeURIComponent(token)}`;
};

export const messagesApi = {
    load: async (channelId: number, limit: number = 100, offset: number = 0): Promise<Message[]> => {
        const response = await apiRequest<Message[]>(`/channel/${channelId}/load?limit=${limit}&offset=${offset}`, {
            method: 'GET'
        });
        if (response.error) throw new Error(response.error);
        return Array.isArray(response.data) ? response.data : [];
    },
    send: async (
        channelId: number, 
        message: string, 
        files?: (string | FileAttachment | SpaceFile)[], 
        replyToMessageId?: number
    ): Promise<Message> => {
        const response = await apiRequest<Message>(`/channel/${channelId}/message`, {
            method: 'POST',
            body: JSON.stringify({
                message,
                files,
                reply_to_message_id: replyToMessageId
            })
        });
        if (response.error) throw new Error(response.error);
        return response.data;
    },
    toggleReaction: async (channelId: number, messageId: number, reaction: string): Promise<{ action: string; reactions: Reaction[] }> => {
        const response = await apiRequest<{ action: string; reactions: Reaction[] }>(`/channel/${channelId}/message/${messageId}/reaction`, {
            method: 'POST',
            body: JSON.stringify({ reaction })
        });
        if (response.error) throw new Error(response.error);
        return response.data;
    },
    delete: async (channelId: number, messageId: number): Promise<void> => {
        const response = await apiRequest<void>(`/channel/${channelId}/message/${messageId}`, {
            method: 'DELETE'
        });
        if (response.error) throw new Error(response.error);
    },
    edit: async (channelId: number, messageId: number, message: string): Promise<void> => {
        const response = await apiRequest<void>(`/channel/${channelId}/message/${messageId}`, {
            method: 'PUT',
            body: JSON.stringify({ message })
        });
        if (response.error) throw new Error(response.error);
    },
    sendTyping: async (channelId: number): Promise<void> => {
        await apiRequest<void>(`/channel/${channelId}/typing`, {
            method: 'POST'
        }).catch(() => {});
    },
    uploadFile: async (channelId: number, file: File): Promise<{ token?: string; file?: SpaceFile }> => {
        try {
            // Primary: Use Potatoverse Space Files API (/zz/api/core/space_file/upload)
            const spaceFile = await uploadSpaceFile(file, `potato-chat/channel_${channelId}`);
            return { token: spaceFile.id, file: spaceFile };
        } catch (spaceErr) {
            console.warn('Direct space file upload failed, falling back to channel upload endpoint:', spaceErr);
            const formData = new FormData();
            formData.append('file', file);

            let fileType = 'file';
            if (file.type.startsWith('image/')) fileType = 'image';
            else if (file.type.startsWith('video/')) fileType = 'video';
            else if (file.type.startsWith('audio/')) fileType = 'audio';
            else if (file.type.includes('pdf')) fileType = 'pdf';

            const token = getAuthToken();
            const headers: Record<string, string> = {};
            if (token) {
                headers['Authorization'] = token;
            }

            const query = new URLSearchParams({
                file_type: fileType,
                file_name: file.name,
                file_size: String(file.size)
            });

            const response = await fetch(`${API_BASE_PATH}/channel/${channelId}/upload?${query.toString()}`, {
                method: 'POST',
                body: formData,
                headers
            });

            const data = await response.json().catch(() => ({ error: 'Upload failed' }));
            if (!response.ok) {
                throw new Error(data.error || `HTTP ${response.status}`);
            }

            return { token: data.token };
        }
    }
};