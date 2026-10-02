import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'react-router'
import { BASE_PATH } from '../lib/base'
import { getRoomView, buildWsUrl, roomsApi, normalizeRoom } from '../lib/api'
import type { Room } from '../lib/api'

const COLORS = ['#7c5cff', '#2ee59d', '#ff6b81', '#ffb84d', '#2f7bff', '#ff6bd6']

function avatarColor(i: number) { return COLORS[i % COLORS.length] }

interface PlayerState {
    conn_id: string;
    user_id: number;
    name: string;
    color: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number;
    score: number;
    boosting: boolean;
    hopping: boolean;
}

interface Coin {
    id: number;
    x: number;
    y: number;
    collected: boolean;
}

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
    life: number;
    maxLife: number;
    size: number;
}

export default function TV() {
    const { roomId } = useParams<{ roomId: string }>()
    const [room, setRoom] = useState<Room | null>(null)
    const [countdown, setCountdown] = useState<number | null>(null)
    const [starting, setStarting] = useState(false)
    const [scores, setScores] = useState<Record<string, number>>({})

    const wsRef = useRef<WebSocket | null>(null)
    const didConnect = useRef(false)
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const canvasRef = useRef<HTMLCanvasElement | null>(null)

    // Player inputs received from controllers over WS
    const inputsRef = useRef<Record<string, { x: number; y: number; btnA: boolean; btnB: boolean }>>({})
    const playersRef = useRef<PlayerState[]>([])
    const coinsRef = useRef<Coin[]>([])
    const particlesRef = useRef<Particle[]>([])
    const animFrameRef = useRef<number | null>(null)

    const id = Number(roomId)
    const wsToken = new URLSearchParams(window.location.search).get('token') ?? ''

    // fetch room via public endpoint (no auth required)
    useEffect(() => {
        if (!id) return
        getRoomView(id).then(setRoom).catch(console.warn)
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

                    // 1. Check if client sent controller input via cbroadcast
                    if (raw.type === 'cbroadcast' && raw.data) {
                        const d = typeof raw.data === 'string' ? JSON.parse(raw.data) : raw.data
                        if (d.type === 'player_input' && d.room_id === id && d.conn_id) {
                            inputsRef.current[d.conn_id] = {
                                x: d.x || 0,
                                y: d.y || 0,
                                btnA: !!d.btnA,
                                btnB: !!d.btnB,
                            }
                        }
                        return
                    }

                    // 2. Server broadcast events
                    let inner = raw
                    if ((raw.type === 'sbroadcast' || raw.type === 'spublish') && raw.data != null) {
                        inner = typeof raw.data === 'string' ? JSON.parse(raw.data) : raw.data
                    }

                    // If inner itself contains player_input (forwarded broadcast)
                    if (inner.type === 'player_input' && inner.room_id === id && inner.conn_id) {
                        inputsRef.current[inner.conn_id] = {
                            x: inner.x || 0,
                            y: inner.y || 0,
                            btnA: !!inner.btnA,
                            btnB: !!inner.btnB,
                        }
                        return
                    }

                    if (inner.room_id !== id) return
                    const data: Room = normalizeRoom(inner.data)!

                    if (['player_joined', 'player_left', 'ready_changed', 'game_reset'].includes(inner.type)) {
                        setRoom(() => data)
                        if (inner.type === 'game_reset') {
                            setCountdown(null)
                        }
                    } else if (inner.type === 'game_started') {
                        setRoom(() => data)
                        // start 3-2-1 GO countdown
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
        }
    }, [connectWs])

    // Initialize players and coins when entering "playing" status
    useEffect(() => {
        if (!room || room.status !== 'playing') {
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
            return
        }

        const width = 1200
        const height = 700
        const currentPlayers = Array.isArray(room.players) ? room.players : []

        // Spawn players in starting grid
        playersRef.current = currentPlayers.map((p, i) => ({
            conn_id: p.conn_id,
            user_id: p.user_id,
            name: `Player ${i + 1}`,
            color: avatarColor(i),
            x: 120 + (i % 2) * 80,
            y: 200 + Math.floor(i / 2) * 160,
            vx: 0,
            vy: 0,
            angle: 0,
            score: 0,
            boosting: false,
            hopping: false,
        }))

        // Spawn golden collectible potatoes
        coinsRef.current = Array.from({ length: 6 }).map((_, i) => ({
            id: i,
            x: 350 + Math.random() * (width - 450),
            y: 100 + Math.random() * (height - 200),
            collected: false,
        }))

        particlesRef.current = []

        // Game Loop
        let lastTime = performance.now()

        const loop = (time: number) => {
            const dt = Math.min((time - lastTime) / 1000, 0.1)
            lastTime = time

            const canvas = canvasRef.current
            if (canvas) {
                const ctx = canvas.getContext('2d')
                if (ctx) {
                    updateAndRender(ctx, width, height, dt)
                }
            }

            animFrameRef.current = requestAnimationFrame(loop)
        }

        animFrameRef.current = requestAnimationFrame(loop)

        return () => {
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
        }
    }, [room?.status, room?.players])

    const updateAndRender = (ctx: CanvasRenderingContext2D, W: number, H: number, dt: number) => {
        // Clear background with racing arena styling
        ctx.fillStyle = '#0a0d1a'
        ctx.fillRect(0, 0, W, H)

        // Draw track boundary / asphalt floor
        ctx.strokeStyle = '#242a4a'
        ctx.lineWidth = 4
        ctx.strokeRect(30, 30, W - 60, H - 60)

        // Draw arena grid lines
        ctx.strokeStyle = '#ffffff08'
        ctx.lineWidth = 1
        for (let x = 60; x < W; x += 60) {
            ctx.beginPath()
            ctx.moveTo(x, 30)
            ctx.lineTo(x, H - 30)
            ctx.stroke()
        }
        for (let y = 60; y < H; y += 60) {
            ctx.beginPath()
            ctx.moveTo(30, y)
            ctx.lineTo(W - 30, y)
            ctx.stroke()
        }

        // Draw Start / Finish line
        ctx.fillStyle = '#ffffff22'
        for (let y = 140; y < 480; y += 20) {
            ctx.fillRect(220, y, 10, 10)
            ctx.fillRect(230, y + 10, 10, 10)
        }

        // Update and draw particles
        const newParticles: Particle[] = []
        for (const p of particlesRef.current) {
            p.x += p.vx
            p.y += p.vy
            p.life -= dt
            if (p.life > 0) {
                const alpha = p.life / p.maxLife
                ctx.fillStyle = p.color + Math.floor(alpha * 255).toString(16).padStart(2, '0')
                ctx.beginPath()
                ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2)
                ctx.fill()
                newParticles.push(p)
            }
        }
        particlesRef.current = newParticles

        // Update and draw golden coins / stars
        for (const coin of coinsRef.current) {
            // Draw glowing golden star / potato
            ctx.save()
            ctx.shadowColor = '#ffb84d'
            ctx.shadowBlur = 15
            ctx.font = '28px system-ui'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText('⭐', coin.x, coin.y)
            ctx.restore()
        }

        // Update and draw each player potato
        const currentScores: Record<string, number> = {}

        playersRef.current.forEach((p) => {
            const inp = inputsRef.current[p.conn_id] || { x: 0, y: 0, btnA: false, btnB: false }

            // Physics calculation
            const maxSpeed = inp.btnA ? 420 : 250 // Boost button speeds up
            const accel = inp.btnA ? 1200 : 700
            const friction = inp.btnB ? 0.88 : 0.94 // Brake button slows down rapidly

            p.vx += inp.x * accel * dt
            p.vy += inp.y * accel * dt

            // Apply friction
            p.vx *= Math.pow(friction, dt * 60)
            p.vy *= Math.pow(friction, dt * 60)

            // Clamp max speed
            const currentSpeed = Math.hypot(p.vx, p.vy)
            if (currentSpeed > maxSpeed) {
                p.vx = (p.vx / currentSpeed) * maxSpeed
                p.vy = (p.vy / currentSpeed) * maxSpeed
            }

            p.x += p.vx * dt
            p.y += p.vy * dt

            // Bounce off boundaries
            const radius = 24
            if (p.x < 30 + radius) { p.x = 30 + radius; p.vx = -p.vx * 0.6 }
            if (p.x > W - 30 - radius) { p.x = W - 30 - radius; p.vx = -p.vx * 0.6 }
            if (p.y < 30 + radius) { p.y = 30 + radius; p.vy = -p.vy * 0.6 }
            if (p.y > H - 30 - radius) { p.y = H - 30 - radius; p.vy = -p.vy * 0.6 }

            // Angle follows velocity
            if (currentSpeed > 10) {
                p.angle = Math.atan2(p.vy, p.vx)
            }

            // Spawn boost sparks
            if (inp.btnA && Math.random() < 0.6) {
                particlesRef.current.push({
                    x: p.x - Math.cos(p.angle) * 20,
                    y: p.y - Math.sin(p.angle) * 20,
                    vx: -p.vx * 0.3 + (Math.random() - 0.5) * 60,
                    vy: -p.vy * 0.3 + (Math.random() - 0.5) * 60,
                    color: '#e5484d',
                    life: 0.35,
                    maxLife: 0.35,
                    size: 8,
                })
            }

            // Check coin collision
            for (const coin of coinsRef.current) {
                if (Math.hypot(p.x - coin.x, p.y - coin.y) < 36) {
                    p.score += 10
                    // Respawn coin
                    coin.x = 100 + Math.random() * (W - 200)
                    coin.y = 80 + Math.random() * (H - 160)

                    // Coin particles
                    for (let k = 0; k < 10; k++) {
                        const ang = Math.random() * Math.PI * 2
                        const spd = 60 + Math.random() * 120
                        particlesRef.current.push({
                            x: coin.x,
                            y: coin.y,
                            vx: Math.cos(ang) * spd,
                            vy: Math.sin(ang) * spd,
                            color: '#ffb84d',
                            life: 0.5,
                            maxLife: 0.5,
                            size: 6,
                        })
                    }
                }
            }

            currentScores[p.conn_id] = p.score

            // ── Render Potato Racer ──────────────────────────────────────────
            ctx.save()
            ctx.translate(p.x, p.y)

            // Potato Aura / Glow
            ctx.beginPath()
            ctx.arc(0, 0, radius + 4, 0, Math.PI * 2)
            ctx.fillStyle = p.color + '44'
            ctx.fill()
            ctx.strokeStyle = p.color
            ctx.lineWidth = 3
            ctx.stroke()

            // Rotate potato icon to facing direction
            ctx.save()
            ctx.rotate(p.angle)
            ctx.font = '36px system-ui'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText('🥔', 0, 0)
            ctx.restore()

            // Name Tag above potato
            ctx.font = 'bold 12px system-ui'
            ctx.fillStyle = '#fff'
            ctx.textAlign = 'center'
            ctx.fillText(p.name, 0, -radius - 8)

            // Score below potato
            ctx.font = '900 11px system-ui'
            ctx.fillStyle = '#ffb84d'
            ctx.fillText(`${p.score} pts`, 0, radius + 14)

            ctx.restore()
        })

        setScores(currentScores)
    }

    const handleHostStart = async () => {
        if (!room) return
        setStarting(true)
        try {
            await roomsApi.startGame(id)
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

    // ── GAME ARENA: Runs only on the TV screen! ──────────────────────────────
    if (room.status === 'playing') {
        return (
            <div style={tvWrap}>
                {countdown != null && (
                    <div style={bigOverlay}>{countdown === 0 ? 'GO!' : countdown}</div>
                )}

                {/* Game Top HUD */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ fontSize: 28 }}>🥔</div>
                        <div>
                            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#f1f3ff', letterSpacing: '0.1em' }}>
                                POTATO ARENA RACE
                            </h1>
                            <div style={{ fontSize: 12, color: '#8c93b8' }}>
                                Room: <strong style={{ color: '#7c5cff' }}>{room.code}</strong> · Collect ⭐ Stars to win!
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
                                    padding: '6px 12px',
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
                                padding: '6px 12px',
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

                {/* Canvas Game Arena */}
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
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
            {/* header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2%' }}>
                <h2 style={{ margin: 0, fontSize: 'clamp(11px,1.8vw,17px)', letterSpacing: '0.15em', color: '#8c93b8', fontWeight: 600, textTransform: 'uppercase' }}>
                    📺 TV DISPLAY · {room.name || 'Potato Race'} &nbsp;·&nbsp; {room.player_count}/{room.max_players} players
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
                    📱 Join on new tab
                </a>
            </div>

            {/* join instructions & giant code */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5%', margin: '2% 0' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <div style={qrBox}>
                        <QRPattern />
                    </div>
                    <div style={{ fontSize: 'clamp(8px,1.2vw,12px)', color: '#8c93b8', textAlign: 'center', maxWidth: 100 }}>
                        {window.location.host}
                    </div>
                </div>

                <div>
                    <div style={{ fontSize: 'clamp(11px,1.6vw,15px)', color: '#8c93b8', letterSpacing: '0.1em', marginBottom: 4 }}>
                        Open the app on your phone and enter:
                    </div>
                    <div style={{
                        fontSize: 'clamp(44px,11vw,110px)',
                        fontWeight: 900,
                        letterSpacing: '0.15em',
                        color: '#7c5cff',
                        lineHeight: 1,
                        textShadow: '0 0 50px #7c5cffaa',
                    }}>
                        {room.code}
                    </div>
                    <div style={{ fontSize: 'clamp(11px,1.4vw,14px)', color: '#8c93b8', marginTop: 8 }}>
                        URL: <span style={{ color: '#f1f3ff' }}>{gameURL}</span>
                    </div>
                </div>
            </div>

            {/* 4 Player Slots */}
            <div style={slotsGrid}>
                {Array.from({ length: room.max_players }).map((_, i) => {
                    const p = players[i]
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
                                {p.is_host ? '👑 ADMIN' : p.ready ? 'READY ✓' : 'WAITING…'}
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

            {/* TV Actions & Status Bar */}
            <div style={{ marginTop: 'auto', paddingTop: '3%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                {room.player_count > 0 && (
                    <button
                        onClick={handleHostStart}
                        disabled={starting || !allReady}
                        style={{
                            padding: '14px 32px',
                            borderRadius: 14,
                            border: 'none',
                            fontWeight: 800,
                            fontSize: 'clamp(13px, 1.8vw, 18px)',
                            cursor: allReady ? 'pointer' : 'not-allowed',
                            background: allReady ? 'var(--ok)' : '#ffffff14',
                            color: allReady ? '#06281b' : 'var(--mut)',
                            transition: 'all 0.2s',
                            boxShadow: allReady ? '0 0 30px #2ee59d88' : 'none',
                        }}
                    >
                        {starting ? 'Starting…' : allReady ? '🚀 Start Race Now!' : 'Waiting for players to ready up…'}
                    </button>
                )}

                <div style={{ textAlign: 'center', fontSize: 'clamp(10px,1.5vw,14px)', color: '#8c93b8' }}>
                    {room.player_count === 0
                        ? <span>No players yet. Enter the code on your phone to join! <span style={{ color: '#7c5cff' }}>🥔</span></span>
                        : allReady
                            ? <span style={{ color: '#2ee59d', fontWeight: 700 }}>✓ All players ready — start from TV or Admin phone!</span>
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
    padding: '3%',
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
    background: '#0009',
    zIndex: 10,
    color: '#fff',
    pointerEvents: 'none',
}
