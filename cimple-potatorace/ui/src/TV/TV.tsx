import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'react-router'
import { BASE_PATH } from '../lib/base'
import { getRoomView, buildWsUrl, roomsApi, normalizeRoom } from '../lib/api'
import type { Room } from '../lib/api'
import { registry, AVAILABLE_GAMES } from '../lib/gamesRegistry'
import type { GameInstance } from '../lib/gamesRegistry'

const COLORS = ['#7c5cff', '#2ee59d', '#ff6b81', '#ffb84d', '#2f7bff', '#ff6bd6']

function avatarColor(i: number) { return COLORS[i % COLORS.length] }

export default function TV() {
    const { roomId } = useParams<{ roomId: string }>()
    const [room, setRoom] = useState<Room | null>(null)
    const [countdown, setCountdown] = useState<number | null>(null)
    const [starting, setStarting] = useState(false)
    const [scores, setScores] = useState<Record<string, number>>({})
    const [selectedGameId, setSelectedGameId] = useState<string>('stupid-race')
    const [gameLoading, setGameLoading] = useState(false)

    const wsRef = useRef<WebSocket | null>(null)
    const didConnect = useRef(false)
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const gameInstanceRef = useRef<GameInstance | null>(null)

    const id = Number(roomId)
    const wsToken = new URLSearchParams(window.location.search).get('token') ?? ''

    // fetch room via public endpoint
    useEffect(() => {
        if (!id) return
        getRoomView(id).then(r => {
            setRoom(r)
            if (r.game_id) setSelectedGameId(r.game_id)
        }).catch(console.warn)
    }, [id])

    // WS for live updates
    const connectWs = useCallback(async () => {
        if (didConnect.current || !wsToken) return
        didConnect.current = true
        try {
            const ws = new WebSocket(buildWsUrl(wsToken))
            wsRef.current = ws
            ws.onmessage = (ev) => {
                try {
                    const raw = JSON.parse(ev.data)

                    // 1. Controller player_input via cbroadcast
                    if (raw.type === 'cbroadcast' && raw.data) {
                        const d = typeof raw.data === 'string' ? JSON.parse(raw.data) : raw.data
                        if (d.type === 'player_input' && d.room_id === id && d.conn_id) {
                            gameInstanceRef.current?.onPlayerInput(d.conn_id, d)
                        }
                        return
                    }

                    // 2. Server broadcast events
                    let inner = raw
                    if ((raw.type === 'sbroadcast' || raw.type === 'spublish') && raw.data != null) {
                        inner = typeof raw.data === 'string' ? JSON.parse(raw.data) : raw.data
                    }

                    if (inner.type === 'player_input' && inner.room_id === id && inner.conn_id) {
                        gameInstanceRef.current?.onPlayerInput(inner.conn_id, inner)
                        return
                    }

                    if (inner.room_id !== id) return
                    const data: Room = normalizeRoom(inner.data)!

                    if (['player_joined', 'player_left', 'ready_changed', 'game_reset'].includes(inner.type)) {
                        setRoom(() => data)
                        if (inner.type === 'game_reset') {
                            setCountdown(null)
                            gameInstanceRef.current?.destroy()
                            gameInstanceRef.current = null
                        }
                    } else if (inner.type === 'game_started') {
                        setRoom(() => data)
                        if (data.game_id) setSelectedGameId(data.game_id)

                        // 3-2-1 countdown
                        setCountdown(3)
                        let n = 3
                        if (countdownRef.current) clearInterval(countdownRef.current)
                        countdownRef.current = setInterval(() => {
                            n--
                            if (n <= 0) {
                                clearInterval(countdownRef.current!)
                                setCountdown(0)
                                setTimeout(() => setCountdown(null), 800)
                            } else {
                                setCountdown(n)
                            }
                        }, 800)
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
            gameInstanceRef.current?.destroy()
        }
    }, [connectWs])

    // Instantiate selected game when room status is "playing"
    useEffect(() => {
        if (!room || room.status !== 'playing') {
            gameInstanceRef.current?.destroy()
            gameInstanceRef.current = null
            return
        }

        const activeGameId = room.game_id || selectedGameId || 'stupid-race'
        setGameLoading(true)

        registry.loadGameScript(activeGameId)
            .then(GameClass => {
                if (!canvasRef.current) return

                const players = Array.isArray(room.players) ? room.players : []
                const instance = new GameClass({
                    canvas: canvasRef.current,
                    room,
                    players,
                    onScoreUpdate: (newScores: Record<string, number>) => setScores(newScores),
                    onGameOver: (winner: any) => console.log('Game over:', winner),
                })
                gameInstanceRef.current = instance
            })
            .catch(err => {
                console.error(`Failed to load game ${activeGameId}:`, err)
            })
            .finally(() => {
                setGameLoading(false)
            })

        return () => {
            gameInstanceRef.current?.destroy()
            gameInstanceRef.current = null
        }
    }, [room?.status, room?.game_id])

    const handleHostStart = async () => {
        if (!room) return
        setStarting(true)
        try {
            await roomsApi.startGame(id, undefined, selectedGameId)
        } catch (e: any) {
            console.error('TV host start error:', e)
        } finally {
            setStarting(false)
        }
    }

    const handleResetLobby = async () => {
        if (!room) return
        try {
            await roomsApi.resetGame(id)
        } catch (e: any) {
            console.error('Reset game error:', e)
        }
    }

    if (!room) return (
        <div style={{ background: '#0d0f1a', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8c93b8' }}>
            Loading…
        </div>
    )

    const players = Array.isArray(room.players) ? room.players : []
    const readyCount = players.filter(p => p.is_host || p.ready).length
    const allReady = readyCount === room.player_count && room.player_count >= 1
    const gameURL = `${window.location.origin}${BASE_PATH}`

    const activeGameMeta = registry.get(room.game_id || selectedGameId) || AVAILABLE_GAMES[0]

    // ── GAME ARENA VIEW (Runs only on TV Screen!) ─────────────────────────────
    if (room.status === 'playing') {
        return (
            <div style={tvWrap}>
                {countdown != null && (
                    <div style={bigOverlay}>{countdown === 0 ? 'GO!' : countdown}</div>
                )}

                {/* Top HUD */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ fontSize: 32 }}>{activeGameMeta.icon}</div>
                        <div>
                            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#f1f3ff', letterSpacing: '0.1em' }}>
                                {activeGameMeta.name.toUpperCase()}
                            </h1>
                            <div style={{ fontSize: 12, color: '#8c93b8' }}>
                                Room: <strong style={{ color: '#7c5cff' }}>{room.code}</strong> · {activeGameMeta.description}
                            </div>
                        </div>
                    </div>

                    {/* Live Scoreboard */}
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        {players.map((p, i) => (
                            <div
                                key={p.conn_id}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '6px 14px',
                                    borderRadius: 10,
                                    background: '#171a2b',
                                    border: `2px solid ${avatarColor(i)}`,
                                }}
                            >
                                <span style={{ width: 10, height: 10, borderRadius: '50%', background: avatarColor(i) }} />
                                <span style={{ fontSize: 12, fontWeight: 700 }}>P{i + 1}</span>
                                <span style={{ fontSize: 13, fontWeight: 900, color: '#ffb84d' }}>
                                    {scores[p.conn_id] ?? 0}
                                </span>
                            </div>
                        ))}

                        <button
                            onClick={handleResetLobby}
                            style={{
                                background: '#ffffff14',
                                border: '1px solid #2a2f4a',
                                color: '#8c93b8',
                                padding: '6px 14px',
                                borderRadius: 8,
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: 'pointer',
                                marginLeft: 8,
                            }}
                        >
                            ↺ Lobby
                        </button>
                    </div>
                </div>

                {/* Game Canvas */}
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
                    {gameLoading && (
                        <div style={{ position: 'absolute', color: '#8c93b8', fontSize: 16 }}>
                            Loading {activeGameMeta.name}…
                        </div>
                    )}
                    <canvas
                        ref={canvasRef}
                        width={1200}
                        height={700}
                        style={{
                            maxWidth: '100%',
                            maxHeight: '80vh',
                            borderRadius: 16,
                            boxShadow: '0 10px 40px #000000aa',
                            background: '#0a0d1a',
                        }}
                    />
                </div>
            </div>
        )
    }

    // ── LOBBY / WAITING SCREEN (TV Display) ──────────────────────────────────
    return (
        <div style={tvWrap}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5%' }}>
                <h2 style={{ margin: 0, fontSize: 'clamp(11px,1.8vw,16px)', letterSpacing: '0.15em', color: '#8c93b8', fontWeight: 600, textTransform: 'uppercase' }}>
                    📺 TV DISPLAY · {room.name || 'Potato Room'} &nbsp;·&nbsp; {room.player_count}/{room.max_players} players
                </h2>

                <a
                    href={`${BASE_PATH}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                        fontSize: 12,
                        padding: '6px 12px',
                        borderRadius: 8,
                        background: '#ffffff10',
                        border: '1px solid #2a2f4a',
                        color: '#8c93b8',
                        textDecoration: 'none',
                        fontWeight: 700,
                    }}
                >
                    📱 Open Controller in new tab
                </a>
            </div>

            {/* Room Code & QR banner */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4%', marginBottom: '2%' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <div style={qrBox}>
                        <QRPattern />
                    </div>
                    <div style={{ fontSize: 'clamp(8px,1.2vw,12px)', color: '#8c93b8', textAlign: 'center', maxWidth: 100 }}>
                        {window.location.host}
                    </div>
                </div>

                <div>
                    <div style={{ fontSize: 'clamp(11px,1.5vw,14px)', color: '#8c93b8', letterSpacing: '0.1em', marginBottom: 2 }}>
                        Open on your phone and enter:
                    </div>
                    <div style={{
                        fontSize: 'clamp(40px,9vw,90px)',
                        fontWeight: 900,
                        letterSpacing: '0.15em',
                        color: '#7c5cff',
                        lineHeight: 1,
                        textShadow: '0 0 50px #7c5cffaa',
                    }}>
                        {room.code}
                    </div>
                    <div style={{ fontSize: 'clamp(10px,1.3vw,13px)', color: '#8c93b8', marginTop: 4 }}>
                        URL: <span style={{ color: '#f1f3ff' }}>{gameURL}</span>
                    </div>
                </div>
            </div>

            {/* ── Game Selection Section ── */}
            <div style={{ marginBottom: '2%' }}>
                <div style={{ fontSize: 'clamp(11px, 1.4vw, 13px)', fontWeight: 800, color: '#8c93b8', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>
                    🎮 Select Game to Play
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                    {AVAILABLE_GAMES.map(g => {
                        const isSelected = selectedGameId === g.id
                        return (
                            <div
                                key={g.id}
                                onClick={() => setSelectedGameId(g.id)}
                                style={{
                                    padding: '14px 18px',
                                    borderRadius: 14,
                                    cursor: 'pointer',
                                    background: isSelected ? '#1e1c38' : '#121526',
                                    border: isSelected ? '2px solid #7c5cff' : '2px solid #2a2f4a',
                                    boxShadow: isSelected ? '0 0 25px #7c5cff66' : 'none',
                                    transition: 'all 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 14,
                                }}
                            >
                                <div style={{ fontSize: 36, flexShrink: 0 }}>{g.icon}</div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ fontWeight: 800, fontSize: 15, color: isSelected ? '#fff' : '#c8cfee' }}>
                                            {g.name}
                                        </div>
                                        {isSelected && (
                                            <span style={{ fontSize: 10, fontWeight: 900, background: '#7c5cff', color: '#fff', padding: '2px 8px', borderRadius: 8 }}>
                                                SELECTED ✓
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: 12, color: '#8c93b8', marginTop: 4, lineHeight: 1.3 }}>
                                        {g.description}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#2ee59d', marginTop: 6, fontWeight: 700 }}>
                                        A: {g.btnALabel} &nbsp;|&nbsp; B: {g.btnBLabel}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* 4 Player Slots */}
            <div style={slotsGrid}>
                {Array.from({ length: room.max_players }).map((_, i) => {
                    const p = players[i]
                    return p ? (
                        <div key={p.conn_id} style={{ ...slot, borderStyle: 'solid', borderColor: avatarColor(i), background: '#ffffff08' }}>
                            <div style={{ width: '30%', aspectRatio: '1', borderRadius: '50%', background: avatarColor(i), margin: '0 auto 8%', boxShadow: `0 0 20px ${avatarColor(i)}88` }} />
                            <div style={{ fontSize: 'clamp(11px,1.8vw,16px)', fontWeight: 700 }}>Player {i + 1}</div>
                            <div style={{
                                fontSize: 'clamp(9px,1.3vw,13px)',
                                fontWeight: 700,
                                marginTop: 4,
                                color: (p.is_host || p.ready) ? '#2ee59d' : '#8c93b8',
                            }}>
                                {p.is_host ? '👑 ADMIN' : p.ready ? 'READY ✓' : 'WAITING…'}
                            </div>
                        </div>
                    ) : (
                        <div key={`empty-${i}`} style={{ ...slot, borderStyle: 'dashed', borderColor: '#2a2f4a', color: '#8c93b8' }}>
                            <div style={{ width: '30%', aspectRatio: '1', borderRadius: '50%', border: '2px dashed #2a2f4a', margin: '0 auto 8%' }} />
                            <div style={{ fontSize: 'clamp(10px,1.5vw,15px)' }}>Waiting…</div>
                        </div>
                    )
                })}
            </div>

            {/* TV Actions & Status Bar */}
            <div style={{ marginTop: 'auto', paddingTop: '2%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                {room.player_count > 0 && (
                    <button
                        onClick={handleHostStart}
                        disabled={starting || !allReady}
                        style={{
                            padding: '14px 36px',
                            borderRadius: 14,
                            border: 'none',
                            fontWeight: 900,
                            fontSize: 'clamp(13px, 1.8vw, 18px)',
                            cursor: allReady ? 'pointer' : 'not-allowed',
                            background: allReady ? 'var(--ok)' : '#ffffff14',
                            color: allReady ? '#06281b' : 'var(--mut)',
                            transition: 'all 0.2s',
                            boxShadow: allReady ? '0 0 30px #2ee59d88' : 'none',
                        }}
                    >
                        {starting ? 'Starting…' : allReady ? `🚀 Launch ${activeGameMeta.name}!` : 'Waiting for players to ready up…'}
                    </button>
                )}

                <div style={{ textAlign: 'center', fontSize: 'clamp(10px,1.4vw,13px)', color: '#8c93b8' }}>
                    {room.player_count === 0
                        ? <span>No players yet. Enter code <strong style={{ color: '#7c5cff' }}>{room.code}</strong> on phone to join! <span style={{ color: '#7c5cff' }}>🥔</span></span>
                        : allReady
                            ? <span style={{ color: '#2ee59d', fontWeight: 700 }}>✓ All players ready — click Launch or start from Admin phone!</span>
                            : <span>Waiting for all players to tap "I'm Ready" on their phones…</span>
                    }
                </div>
            </div>
        </div>
    )
}

// ── tiny SVG QR-ish pattern (decorative) ──────────────────────────────────────
function QRPattern() {
    return (
        <svg viewBox="0 0 21 21" width="100%" height="100%" style={{ imageRendering: 'pixelated' }}>
            <rect x="0" y="0" width="7" height="7" fill="#fff" />
            <rect x="1" y="1" width="5" height="5" fill="#000" />
            <rect x="2" y="2" width="3" height="3" fill="#fff" />
            <rect x="14" y="0" width="7" height="7" fill="#fff" />
            <rect x="15" y="1" width="5" height="5" fill="#000" />
            <rect x="16" y="2" width="3" height="3" fill="#fff" />
            <rect x="0" y="14" width="7" height="7" fill="#fff" />
            <rect x="1" y="15" width="5" height="5" fill="#000" />
            <rect x="2" y="16" width="3" height="3" fill="#fff" />
            {[8, 10, 12, 9, 11, 13, 8, 10, 12].map((x, i) => (
                <rect key={i} x={x} y={8 + (i % 3)} width="1" height="1" fill="#fff" />
            ))}
            {[8, 10, 12, 8, 12].map((y, i) => (
                <rect key={i + 20} x={8 + (i % 4)} y={y} width="1" height="1" fill="#fff" />
            ))}
        </svg>
    )
}

// ── TV Styles ─────────────────────────────────────────────────────────────────
const tvWrap: React.CSSProperties = {
    minHeight: '100vh',
    width: '100%',
    background: 'radial-gradient(circle at 20% 0, #241a5c 0, transparent 55%), #0a0c18',
    color: '#f1f3ff',
    display: 'flex',
    flexDirection: 'column',
    padding: '2.5% 3.5%',
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    boxSizing: 'border-box',
    position: 'relative',
    overflow: 'hidden',
}

const slotsGrid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '2%',
    marginTop: 'auto',
}

const slot: React.CSSProperties = {
    border: '2px solid',
    borderRadius: '12px',
    padding: '6% 4%',
    textAlign: 'center',
    fontSize: 'clamp(10px,1.6vw,14px)',
    transition: 'all 0.3s',
}

const qrBox: React.CSSProperties = {
    width: 'clamp(44px,7vw,80px)',
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
    background: '#0009',
    zIndex: 10,
    color: '#fff',
    pointerEvents: 'none',
}
