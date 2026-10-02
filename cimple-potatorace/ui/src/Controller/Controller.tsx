import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { Room } from '../lib/api';

const COLORS = ['#7c5cff', '#2ee59d', '#ff6b81', '#ffb84d', '#2f7bff', '#ff6bd6'];

interface ControllerProps {
    room: Room;
    connId: string;
    ws: WebSocket | null;
    onLeave: () => void;
}

export default function Controller({ room, connId, ws, onLeave }: ControllerProps) {
    const players = Array.isArray(room.players) ? room.players : [];
    const playerIndex = Math.max(0, players.findIndex(p => p.conn_id === connId));
    const me = players[playerIndex] || players[0];
    const playerColor = COLORS[playerIndex % COLORS.length];

    const [btnA, setBtnA] = useState(false);
    const [btnB, setBtnB] = useState(false);
    const [stickPos, setStickPos] = useState({ x: 0, y: 0 });

    const inputRef = useRef({ x: 0, y: 0, btnA: false, btnB: false });
    const isDraggingRef = useRef(false);
    const stickElRef = useRef<HTMLDivElement | null>(null);
    const lastSentRef = useRef<number>(0);

    const buzz = (ms = 15) => {
        try {
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                navigator.vibrate(ms);
            }
        } catch {
            // ignore
        }
    };

    const sendInput = useCallback((force = false) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        const now = performance.now();
        if (!force && now - lastSentRef.current < 30) return; // ~33fps throttle
        lastSentRef.current = now;

        const cur = inputRef.current;
        const payload = {
            type: 'cbroadcast',
            from_cid: connId,
            data: {
                type: 'player_input',
                room_id: room.id,
                conn_id: connId,
                x: Math.round(cur.x * 100) / 100,
                y: Math.round(cur.y * 100) / 100,
                btnA: cur.btnA,
                btnB: cur.btnB,
            },
        };
        try {
            ws.send(JSON.stringify(payload));
        } catch (e) {
            console.warn('WS send input error', e);
        }
    }, [ws, connId, room.id]);

    // Handle Virtual Joystick pointer events
    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        isDraggingRef.current = true;
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        updateStick(e.clientX, e.clientY);
        buzz(10);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDraggingRef.current) return;
        updateStick(e.clientX, e.clientY);
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        isDraggingRef.current = false;
        try {
            (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
        } catch {
            // ignore
        }
        inputRef.current.x = 0;
        inputRef.current.y = 0;
        setStickPos({ x: 0, y: 0 });
        sendInput(true);
    };

    const updateStick = (clientX: number, clientY: number) => {
        const el = stickElRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const radius = rect.width / 2;

        let dx = clientX - centerX;
        let dy = clientY - centerY;
        const dist = Math.hypot(dx, dy);

        if (dist > radius) {
            dx = (dx / dist) * radius;
            dy = (dy / dist) * radius;
        }

        const normX = dx / radius;
        const normY = dy / radius;

        inputRef.current.x = normX;
        inputRef.current.y = normY;
        setStickPos({ x: dx, y: dy });
        sendInput();
    };

    // Keyboard support for testing on laptop / desktop
    useEffect(() => {
        const keys: Record<string, boolean> = {};

        const updateFromKeys = () => {
            let kx = 0;
            let ky = 0;
            if (keys['ArrowLeft'] || keys['KeyA']) kx -= 1;
            if (keys['ArrowRight'] || keys['KeyD']) kx += 1;
            if (keys['ArrowUp'] || keys['KeyW']) ky -= 1;
            if (keys['ArrowDown'] || keys['KeyS']) ky += 1;

            const isA = !!(keys['Space'] || keys['KeyJ'] || keys['Enter']);
            const isB = !!(keys['ShiftLeft'] || keys['ShiftRight'] || keys['KeyK']);

            inputRef.current.x = kx;
            inputRef.current.y = ky;
            inputRef.current.btnA = isA;
            inputRef.current.btnB = isB;

            setStickPos({ x: kx * 45, y: ky * 45 });
            setBtnA(isA);
            setBtnB(isB);
            sendInput(true);
        };

        const onKeyDown = (e: KeyboardEvent) => {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
                e.preventDefault();
            }
            if (!keys[e.code]) {
                keys[e.code] = true;
                updateFromKeys();
            }
        };

        const onKeyUp = (e: KeyboardEvent) => {
            if (keys[e.code]) {
                keys[e.code] = false;
                updateFromKeys();
            }
        };

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        };
    }, [sendInput]);

    // Button A Press
    const handleBtnADown = () => {
        buzz(20);
        inputRef.current.btnA = true;
        setBtnA(true);
        sendInput(true);
    };

    const handleBtnAUp = () => {
        inputRef.current.btnA = false;
        setBtnA(false);
        sendInput(true);
    };

    // Button B Press
    const handleBtnBDown = () => {
        buzz(20);
        inputRef.current.btnB = true;
        setBtnB(true);
        sendInput(true);
    };

    const handleBtnBUp = () => {
        inputRef.current.btnB = false;
        setBtnB(false);
        sendInput(true);
    };

    return (
        <div style={containerStyle}>
            {/* Top Bar */}
            <div style={topBarStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: playerColor,
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: 16,
                        boxShadow: `0 0 12px ${playerColor}88`,
                    }}>
                        🥔
                    </div>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: 15, color: '#f1f3ff' }}>
                            Player {playerIndex + 1}
                        </div>
                        <div style={{ fontSize: 11, color: '#8c93b8' }}>
                            {me?.is_host ? '👑 Admin' : 'Player'} · Code: <strong style={{ color: '#7c5cff' }}>{room.code}</strong>
                        </div>
                    </div>
                </div>

                <button
                    onClick={onLeave}
                    style={{
                        background: '#ffffff10',
                        border: '1px solid #2a2f4a',
                        color: '#8c93b8',
                        padding: '6px 14px',
                        borderRadius: 10,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                    }}
                >
                    Leave
                </button>
            </div>

            {/* Instruction hint */}
            <div style={{ textAlign: 'center', marginTop: 12, color: '#8c93b8', fontSize: 12 }}>
                👀 Look at the <strong style={{ color: '#2ee59d' }}>TV / Main Screen</strong> to race!
            </div>

            {/* Joystick Area */}
            <div style={stickWrapperStyle}>
                <div
                    ref={stickElRef}
                    style={stickBaseStyle}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                >
                    {/* Center ring */}
                    <div style={centerRingStyle} />
                    {/* Draggable Knob */}
                    <div
                        style={{
                            ...knobStyle,
                            background: playerColor,
                            boxShadow: `0 4px 20px ${playerColor}aa`,
                            transform: `translate(${stickPos.x}px, ${stickPos.y}px)`,
                        }}
                    >
                        🥔
                    </div>
                </div>
                <div style={stickLabelStyle}>STEER / MOVE</div>
            </div>

            {/* Action Buttons Area */}
            <div style={buttonAreaStyle}>
                {/* Button B - Brake / Hop */}
                <button
                    style={{
                        ...actionBtnStyle,
                        background: btnB ? '#1e5fcc' : '#2f7bff',
                        transform: btnB ? 'scale(0.92)' : 'scale(1)',
                        boxShadow: btnB ? '0 0 25px #2f7bffee' : '0 6px 20px #2f7bff66',
                    }}
                    onPointerDown={handleBtnBDown}
                    onPointerUp={handleBtnBUp}
                    onPointerCancel={handleBtnBUp}
                >
                    <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1 }}>B</div>
                    <div style={{ fontSize: 10, opacity: 0.85, marginTop: 4, letterSpacing: '0.05em' }}>BRAKE</div>
                </button>

                {/* Button A - Boost / Gas */}
                <button
                    style={{
                        ...actionBtnStyle,
                        background: btnA ? '#b53036' : '#e5484d',
                        transform: btnA ? 'scale(0.92)' : 'scale(1)',
                        boxShadow: btnA ? '0 0 25px #e5484dee' : '0 6px 20px #e5484d66',
                    }}
                    onPointerDown={handleBtnADown}
                    onPointerUp={handleBtnAUp}
                    onPointerCancel={handleBtnAUp}
                >
                    <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1 }}>A</div>
                    <div style={{ fontSize: 10, opacity: 0.85, marginTop: 4, letterSpacing: '0.05em' }}>BOOST 🚀</div>
                </button>
            </div>
        </div>
    );
}

// ── Controller Styles ──────────────────────────────────────────────────────────
const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    width: '100%',
    background: '#0a0c18',
    color: '#f1f3ff',
    display: 'flex',
    flexDirection: 'column',
    padding: '16px 20px 30px',
    boxSizing: 'border-box',
    touchAction: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    overflow: 'hidden',
    position: 'relative',
};

const topBarStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    background: '#171a2b',
    borderRadius: 14,
    border: '1px solid #2a2f4a',
};

const stickWrapperStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px 0',
};

const stickBaseStyle: React.CSSProperties = {
    width: 200,
    height: 200,
    borderRadius: '50%',
    background: 'radial-gradient(circle, #171a2b 0%, #0d0f1a 100%)',
    border: '3px solid #2a2f4a',
    position: 'relative',
    display: 'grid',
    placeItems: 'center',
    touchAction: 'none',
    cursor: 'grab',
    boxShadow: 'inset 0 4px 20px #00000088, 0 8px 30px #00000066',
};

const centerRingStyle: React.CSSProperties = {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: '50%',
    border: '1px dashed #ffffff20',
    pointerEvents: 'none',
};

const knobStyle: React.CSSProperties = {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: '50%',
    display: 'grid',
    placeItems: 'center',
    fontSize: 28,
    color: '#fff',
    pointerEvents: 'none',
    transition: 'transform 0.04s ease-out',
    border: '3px solid #ffffff44',
};

const stickLabelStyle: React.CSSProperties = {
    marginTop: 14,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.15em',
    color: '#8c93b8',
};

const buttonAreaStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: '10px 0 20px',
    gap: 20,
};

const actionBtnStyle: React.CSSProperties = {
    width: 100,
    height: 100,
    borderRadius: '50%',
    border: '3px solid #ffffff33',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    touchAction: 'none',
    transition: 'transform 0.08s, background 0.08s, box-shadow 0.08s',
    outline: 'none',
};
