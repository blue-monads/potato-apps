import { useEffect, useRef, useCallback } from 'react';
import { buildWsUrl, getWsToken } from './api';

export interface WsMessage {
    type: string;
    data?: any;
}

export type WsHandler = (msg: WsMessage) => void;

/**
 * Returns a stable connect function. Call it once after getting conn_id.
 * The returned ws ref stays live; cleanup happens on unmount.
 */
export function useWs(onMessage: WsHandler) {
    const wsRef = useRef<WebSocket | null>(null);
    const handlerRef = useRef<WsHandler>(onMessage);
    handlerRef.current = onMessage;

    const connect = useCallback(async () => {
        if (wsRef.current && wsRef.current.readyState < 2) return; // already open/connecting
        try {
            const { token } = await getWsToken();
            const ws = new WebSocket(buildWsUrl(token));
            wsRef.current = ws;
            ws.onmessage = (ev) => {
                try {
                    const raw = JSON.parse(ev.data);
                    // xEasyWS wraps broadcast/publish in { type: "sbroadcast"|"spublish", data: ... }
                    if ((raw.type === 'sbroadcast' || raw.type === 'spublish') && raw.data) {
                        const inner =
                            typeof raw.data === 'string' ? JSON.parse(raw.data) : raw.data;
                        handlerRef.current(inner);
                    } else {
                        handlerRef.current(raw);
                    }
                } catch (e) {
                    console.warn('WS parse error', e);
                }
            };
            ws.onerror = (e) => console.warn('WS error', e);
        } catch (e) {
            console.warn('WS connect failed', e);
        }
    }, []);

    const send = useCallback((msg: object) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(msg));
        }
    }, []);

    useEffect(() => {
        return () => {
            wsRef.current?.close();
        };
    }, []);

    return { connect, send, wsRef };
}
