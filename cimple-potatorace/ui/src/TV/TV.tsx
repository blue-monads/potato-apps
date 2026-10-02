import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'react-router'
import { BASE_PATH } from '../lib/base'
import { getRoomView, buildWsUrl } from '../lib/api'
import type { Room } from '../lib/api'

const COLORS = ['#7c5cff', '#2ee59d', '#ff6b81', '#ffb84d', '#2f7bff', '#ff6bd6']

function avatarColor(i: number) { return COLORS[i % COLORS.length] }

export default function TV() {
    const { roomId } = useParams<{ roomId: string }>()
    const [room, setRoom] = useState<Room | null>(null)
    const [countdown, setCountdown] = useState<number | null>(null)
    const wsRef = useRef<WebSocket | null>(null)
    const didConnect = useRef(false)
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const id = Number(roomId)
    // WS token passed via URL by the lobby (e.g. ?token=xxx)
    const wsToken = new URLSearchParams(window.location.search).get('token') ?? ''

    // fetch room via public endpoint (no auth required)
    useEffect(() => {
        if (!id) return
        getRoomView(id).then(setRoom).catch(console.warn)
    }, [id])

    // WS for live updates – uses token from URL
    const connectWs = useCallback(async () => {
        if (didConnect.current || !wsToken) return
        didConnect.current = true
        try {
            const ws = new WebSocket(buildWsUrl(wsToken))
            wsRef.current = ws
            ws.onmessage = (ev) => {
                try {
                    const raw = JSON.parse(ev.data)
                    let inner = raw
                    if ((raw.type === 'sbroadcast' || raw.type === 'spublish') && raw.data != null) {
                        inner = typeof raw.data === 'string' ? JSON.parse(raw.data) : raw.data
                    }
                    if (inner.room_id !== id) return
                    const data: Room = inner.data
                    if (['player_joined', 'player_left', 'ready_changed'].includes(inner.type)) {
                        setRoom(() => data)
                    } else if (inner.type === 'game_started') {
                        setRoom(() => data)
                        // countdown 3-2-1 GO
                        setCountdown(3)
                        let n = 3
                        countdownRef.current = setInterval(() => {
                            n--
                            if (n <= 0) {
                                clearInterval(countdownRef.current!)
                                setCountdown(null)
                            } else {
                                setCountdown(n)
                            }
                        }, 900)
                    }
                } catch (e) {
                    console.warn('WS parse error', e)
                }
            }
            ws.onerror = e => console.warn('WS error', e)
            ws.onclose = () => { didConnect.current = false }
        } catch (e) {
            console.warn('WS connect failed', e)
        }
    }, [id, wsToken])

    useEffect(() => {
        connectWs()
        return () => {
            wsRef.current?.close()
            if (countdownRef.current) clearInterval(countdownRef.current)
        }
    }, [connectWs])

    if (!room) return (
        <div style={{ background: '#0d0f1a', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8c93b8' }}>
            Loading…
        </div>
    )

    const readyCount = room.players.filter(p => p.is_host || p.ready).length
    const allReady = readyCount === room.player_count && room.player_count >= 2
    const gameURL = `${window.location.origin}${BASE_PATH}`

    // ── Game started ──────────────────────────────────────────────────────────
    if (room.status === 'playing') {
        return (
            <div style={tvWrap}>
                {countdown != null && (
                    <div style={bigOverlay}>{countdown === 0 ? 'GO!' : countdown}</div>
                )}
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 'clamp(60px,12vw,120px)', lineHeight: 1 }}>🥔</div>
                    <h1 style={{ margin: '12px 0 4px', fontSize: 'clamp(28px,5vw,56px)', fontWeight: 900, letterSpacing: '0.15em', color: '#2ee59d' }}>
                        RACE STARTED!
                    </h1>
                    <p style={{ color: '#8c93b8', fontSize: 'clamp(12px,2vw,18px)' }}>{room.name}</p>
                </div>
                <div style={slotsGrid}>
                    {room.players.map((p, i) => (
                        <div key={p.conn_id} style={{ ...slot, borderColor: avatarColor(i) }}>
                            <div style={{ width: '34%', aspectRatio: '1', borderRadius: '50%', background: avatarColor(i), margin: '0 auto 10%' }} />
                            <div style={{ fontSize: 'clamp(11px,1.8vw,18px)', fontWeight: 700 }}>Player {i + 1}</div>
                            <div style={{ fontSize: 'clamp(9px,1.4vw,14px)', color: '#2ee59d', marginTop: 4 }}>🏁 Racing</div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    // ── Lobby / waiting ───────────────────────────────────────────────────────
    return (
        <div style={tvWrap}>
            {/* header */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: '3%' }}>
                <h2 style={{ margin: 0, fontSize: 'clamp(10px,1.6vw,16px)', letterSpacing: '0.15em', color: '#8c93b8', fontWeight: 600, textTransform: 'uppercase' }}>
                    {room.name || 'Potato Race'} &nbsp;·&nbsp; {room.player_count}/{room.max_players} players &nbsp;·&nbsp; {readyCount} ready
                </h2>
            </div>

            {/* join instructions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5%', marginBottom: '3%' }}>
                {/* QR placeholder / domain */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <div style={qrBox}>
                        <QRPattern />
                    </div>
                    <div style={{ fontSize: 'clamp(8px,1.2vw,12px)', color: '#8c93b8', textAlign: 'center', maxWidth: 100 }}>
                        {window.location.host}
                    </div>
                </div>

                {/* code */}
                <div>
                    <div style={{ fontSize: 'clamp(10px,1.5vw,14px)', color: '#8c93b8', letterSpacing: '0.1em', marginBottom: 6 }}>
                        Open the app and enter code:
                    </div>
                    <div style={{
                        fontSize: 'clamp(40px,10vw,100px)',
                        fontWeight: 900,
                        letterSpacing: '0.15em',
                        color: '#7c5cff',
                        lineHeight: 1,
                        textShadow: '0 0 40px #7c5cff88',
                    }}>
                        {room.code}
                    </div>
                    <div style={{ fontSize: 'clamp(10px,1.3vw,13px)', color: '#8c93b8', marginTop: 8 }}>
                        or visit: <span style={{ color: '#f1f3ff' }}>{gameURL}</span>
                    </div>
                </div>
            </div>

            {/* player slots */}
            <div style={slotsGrid}>
                {Array.from({ length: room.max_players }).map((_, i) => {
                    const p = room.players[i]
                    return p ? (
                        <div key={p.conn_id} style={{ ...slot, borderStyle: 'solid', borderColor: avatarColor(i), background: '#ffffff08' }}>
                            <div style={{ width: '34%', aspectRatio: '1', borderRadius: '50%', background: avatarColor(i), margin: '0 auto 8%', boxShadow: `0 0 20px ${avatarColor(i)}88` }} />
                            <div style={{ fontSize: 'clamp(11px,1.8vw,18px)', fontWeight: 700 }}>Player {i + 1}</div>
                            <div style={{
                                fontSize: 'clamp(9px,1.4vw,14px)',
                                fontWeight: 700,
                                marginTop: 4,
                                color: (p.is_host || p.ready) ? '#2ee59d' : '#8c93b8',
                            }}>
                                {p.is_host ? 'HOST' : p.ready ? 'READY ✓' : 'WAITING…'}
                            </div>
                        </div>
                    ) : (
                        <div key={`empty-${i}`} style={{ ...slot, borderStyle: 'dashed', borderColor: '#2a2f4a', color: '#8c93b8' }}>
                            <div style={{ width: '34%', aspectRatio: '1', borderRadius: '50%', border: '2px dashed #2a2f4a', margin: '0 auto 8%' }} />
                            <div style={{ fontSize: 'clamp(10px,1.6vw,16px)' }}>Waiting…</div>
                        </div>
                    )
                })}
            </div>

            {/* status bar */}
            <div style={{ marginTop: 'auto', paddingTop: '3%', textAlign: 'center', fontSize: 'clamp(10px,1.5vw,15px)', color: '#8c93b8' }}>
                {allReady
                    ? <span style={{ color: '#2ee59d', fontWeight: 700 }}>✓ All players ready — host can start the race!</span>
                    : <span>Waiting for players to join and ready up… <span style={{ color: '#7c5cff' }}>🥔</span></span>
                }
            </div>
        </div>
    )
}

// ── tiny SVG QR-ish pattern (decorative) ──────────────────────────────────────
function QRPattern() {
    return (
        <svg viewBox="0 0 21 21" width="100%" height="100%" style={{ imageRendering: 'pixelated' }}>
            {/* top-left finder */}
            <rect x="0" y="0" width="7" height="7" fill="#fff" />
            <rect x="1" y="1" width="5" height="5" fill="#000" />
            <rect x="2" y="2" width="3" height="3" fill="#fff" />
            {/* top-right finder */}
            <rect x="14" y="0" width="7" height="7" fill="#fff" />
            <rect x="15" y="1" width="5" height="5" fill="#000" />
            <rect x="16" y="2" width="3" height="3" fill="#fff" />
            {/* bottom-left finder */}
            <rect x="0" y="14" width="7" height="7" fill="#fff" />
            <rect x="1" y="15" width="5" height="5" fill="#000" />
            <rect x="2" y="16" width="3" height="3" fill="#fff" />
            {/* data dots */}
            {[8,10,12,9,11,13,8,10,12].map((x, i) => (
                <rect key={i} x={x} y={8 + (i % 3)} width="1" height="1" fill="#fff" />
            ))}
            {[8,10,12,8,12].map((y, i) => (
                <rect key={i + 20} x={8 + (i % 4)} y={y} width="1" height="1" fill="#fff" />
            ))}
        </svg>
    )
}

// ── styles ────────────────────────────────────────────────────────────────────
const tvWrap: React.CSSProperties = {
    minHeight: '100vh',
    width: '100%',
    background: 'radial-gradient(circle at 20% 0, #241a5c 0, transparent 55%), #0a0c18',
    color: '#f1f3ff',
    display: 'flex',
    flexDirection: 'column',
    padding: '4%',
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    boxSizing: 'border-box',
    position: 'relative',
    overflow: 'hidden',
}

const slotsGrid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '2.5%',
    marginTop: 'auto',
}

const slot: React.CSSProperties = {
    border: '2px solid',
    borderRadius: '12px',
    padding: '8% 4%',
    textAlign: 'center',
    fontSize: 'clamp(10px,1.7vw,15px)',
    transition: 'all 0.3s',
}

const qrBox: React.CSSProperties = {
    width: 'clamp(50px,8vw,90px)',
    aspectRatio: '1',
    background: '#000',
    borderRadius: 6,
    padding: 4,
    border: '3px solid #fff',
}

const bigOverlay: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'grid',
    placeItems: 'center',
    fontSize: 'clamp(80px,20vw,200px)',
    fontWeight: 900,
    background: '#000a',
    zIndex: 10,
    color: '#fff',
}
