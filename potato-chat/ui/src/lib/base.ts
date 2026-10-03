export const BASE_PATH = "/zz/space/potato-chat";
export const API_BASE_PATH = '/zz/api/space/potato-chat';

export const isInsideIframe = (): boolean => {
    try {
        return typeof window !== 'undefined' && window.self !== window.top;
    } catch {
        return true;
    }
};