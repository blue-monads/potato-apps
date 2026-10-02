import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router'
import { BASE_PATH } from '../lib/base'
import { roomsApi, buildWsUrl, getWsToken, normalizeRoom } from '../lib/api'
import type { Room, Player } from '../lib/api'
import Controller from '../Controller/Controller'

const AVATAR_COLORS = ['#7c5cff', '#2ee59d', '#ffb84d', '#e5484d', '#2f7bff', '#ff6bd6']

function avatarColor(uid: number) {
    return AVATAR_COLORS[uid % AVATAR_COLORS.length]
}

function Avatar({ uid, size = 36 }: { uid: number; size?: number }) {
    return (
        <div style={{
            width: size, height: size, borderRadius: '50%',
            background: avatarColor(uid),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: size * 0.45, fontWeight: 800, color: '#fff',
            flexShrink: 0,
        }}>
            {uid % 9 + 1}
        </div>
    )
}

function PlayerSlot({ player, isSelf }: { player: Player; isSelf: boolean }) {
    return (
        <div
            className="flex items-center gap-3 rounded-xl p-3 transition-all"
            style={{
                background: 'var(--panel)',
                border: `2px solid ${isSelf ? 'var(--acc)' : 'var(--line)'}`,
            }}
        >
            <Avatar uid={player.user_id} size={40} />
            <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate">
                    Player {player.user_id}
                    {player.is_host && <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--acc)', color: '#fff' }}>HOST</span>}
                    {isSelf && <span className="ml-2 text-xs" style={{ color: 'var(--mut)' }}>(you)</span>}
                </div>
            </div>
            <div
                className="text-xs font-bold px-2 py-1 rounded-full"
                style={{
                    background: player.is_host || player.ready ? '#2ee59d22' : '#ffffff11',
                    color: player.is_host || player.ready ? 'var(--ok)' : 'var(--mut)',
                }}
            >
                {player.is_host ? 'HOST' : player.ready ? 'READY' : 'WAITING'}
            </div>
        </div>
    )
}

function EmptySlot() {
    return (
        <div
            className="flex items-center gap-3 rounded-xl p-3"
            style={{ border: '2px dashed var(--line)', color: 'var(--mut)' }}
        >
            <div style={{ width: 40, height: 40, borderRadius: '50%', border: '2px dashed var(--line)' }} />
            <span className="text-sm">Waiting for player…</span>
        </div>
    )
}

export default function Lobby() {
    const { roomId } = useParams<{ roomId: string }>()
    const navigate = useNavigate()
    const [room, setRoom] = useState<Room | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [connId] = useState(() => sessionStorage.getItem('pr_conn_id') || '')
    const wsRef = useRef<WebSocket | null>(null)
    const didConnect = useRef(false)

    const id = Number(roomId)

    // fetch initial state
    useEffect(() => {
        if (!id) return
        roomsApi.get(id)
            .then(r => { setRoom(r); setLoading(false) })
            .catch(e => { setError(e.message); setLoading(false) })
    }, [id])

    // connect WS once
    const connectWs = useCallback(() => {
        if (didConnect.current) return
        const savedToken = sessionStorage.getItem('pr_ws_token')
        if (!savedToken) return
        didConnect.current = true
        const ws = new WebSocket(buildWsUrl(savedToken))
        wsRef.current = ws
        ws.onmessage = (ev) => {
            try {
                const raw = JSON.parse(ev.data)

                // xEasyWS wraps broadcast as { type: "sbroadcast", data: "<json-string>" }
                let inner = raw
                if ((raw.type === 'sbroadcast' || raw.type === 'spublish') && raw.data != null) {
                    inner = typeof raw.data === 'string' ? JSON.parse(raw.data) : raw.data
                }

                // ignore events not for this room
                if (inner.room_id !== id) return

                const eventType: string = inner.type
                const data: Room = normalizeRoom(inner.data)!

                if (['player_joined', 'player_left', 'ready_changed', 'game_reset'].includes(eventType)) {
                    setRoom(() => data)
                } else if (eventType === 'game_started') {
                    setRoom(() => data)
                }
            } catch (e) {
                console.warn('WS parse error', e)
            }
        }
        ws.onerror = e => console.warn('WS error', e)
        ws.onclose = () => { didConnect.current = false }
    }, [id, navigate])

    useEffect(() => {
        connectWs()
        return () => {
            wsRef.current?.close()
        }
    }, [connectWs])

    const handleReady = async () => {
        if (!room) return
        const players = Array.isArray(room.players) ? room.players : []
        const me = players.find(p => p.conn_id === connId)
        const currentReady = me?.ready ?? false
        try {
            const updated = await roomsApi.setReady(id, !currentReady, connId)
            setRoom(() => updated)
        } catch (e: any) {
            setError(e.message)
        }
    }

    const handleStart = async () => {
        if (!room) return
        // Optimistic: flip status immediately so the host doesn't wait for the round-trip
        setRoom(prev => prev ? { ...prev, status: 'playing' } : prev)
        try {
            await roomsApi.startGame(id, connId)
        } catch (e: any) {
            // Revert on failure
            setRoom(prev => prev ? { ...prev, status: 'waiting' } : prev)
            setError(e.message)
        }
    }

    const handleLeave = async () => {
        try {
            await roomsApi.leave(id, connId)
        } finally {
            sessionStorage.removeItem('pr_conn_id')
            sessionStorage.removeItem('pr_ws_token')
            navigate(BASE_PATH)
        }
    }

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)', color: 'var(--txt)' }}>
            <p>Loading lobby…</p>
        </div>
    )

    if (error || !room) return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: 'var(--bg)', color: 'var(--txt)' }}>
            <p style={{ color: '#ff6b81' }}>{error || 'Room not found'}</p>
            <button className="btn ghost" onClick={() => navigate(BASE_PATH)}>← Back</button>
        </div>
    )

    const players = Array.isArray(room.players) ? room.players : []
    const me = players.find(p => p.conn_id === connId)
    const isHost = me?.is_host ?? false
    const iAmReady = me?.ready ?? false
    const allReady = players.length > 0 && players.every(p => p.is_host || p.ready)
    const emptySlots = Math.max(0, room.max_players - room.player_count)

    // ── When game starts, players see the Couch Gamepad Controller! ──────────
    if (room.status === 'playing') {
        return (
            <Controller
                room={room}
                connId={connId}
                ws={wsRef.current}
                onLeave={handleLeave}
            />
        )
    }

    return (
        <div className="min-h-screen w-full flex flex-col items-center p-6" style={{ background: 'var(--bg)', color: 'var(--txt)' }}>
            {/* header */}
            <div className="w-full max-w-lg flex items-center justify-between mb-6">
                <button
                    className="btn ghost text-sm px-3 py-2"
                    onClick={handleLeave}
                    style={{ fontSize: 13 }}
                >
                    ← Leave
                </button>
                <h1 className="font-black text-xl uppercase tracking-widest">
                    {room.name || 'Lobby'}
                </h1>
                <button
                    onClick={async () => {
                        try {
                            const { token } = await getWsToken()
                            window.open(`${BASE_PATH}tv/${id}?token=${encodeURIComponent(token)}`, '_blank')
                        } catch {
                            window.open(`${BASE_PATH}tv/${id}`, '_blank')
                        }
                    }}
                    style={{
                        fontSize: 13,
                        padding: '8px 12px',
                        borderRadius: 10,
                        border: '2px solid var(--line)',
                        color: 'var(--mut)',
                        background: 'none',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                    }}
                >
                    📺 TV View
                </button>
            </div>

            {/* room code card */}
            <div className="w-full max-w-lg rounded-2xl p-5 mb-4 text-center" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--mut)' }}>Room Code</p>
                <div className="font-black text-5xl tracking-widest" style={{ letterSpacing: '0.35em', color: 'var(--acc)' }}>
                    {room.code}
                </div>
                <p className="text-xs mt-2" style={{ color: 'var(--mut)' }}>Share this code with friends</p>
            </div>

            {/* players */}
            <div className="w-full max-w-lg flex flex-col gap-3 mb-6">
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--mut)' }}>
                    Players {room.player_count}/{room.max_players}
                </p>
                {players.map(p => (
                    <PlayerSlot
                        key={p.conn_id}
                        player={p}
                        isSelf={p.conn_id === connId}
                    />
                ))}
                {Array.from({ length: emptySlots }).map((_, i) => (
                    <EmptySlot key={`empty-${i}`} />
                ))}
            </div>

            {/* error */}
            {error && (
                <p className="mb-4 text-sm" style={{ color: '#ff6b81' }}>{error}</p>
            )}

            {/* actions */}
            <div className="w-full max-w-lg flex flex-col gap-3">
                {isHost ? (
                    <button
                        className="btn"
                        disabled={!allReady || room.player_count < 2}
                        onClick={handleStart}
                        style={allReady && room.player_count >= 2 ? { background: 'var(--ok)', color: '#06281b' } : {}}
                    >
                        {room.player_count < 2 ? 'Waiting for players…' : allReady ? '🚀 Start Race!' : 'Waiting for everyone to ready up…'}
                    </button>
                ) : (
                    <button
                        className="btn"
                        onClick={handleReady}
                        style={iAmReady ? { background: '#2ee59d22', color: 'var(--ok)', border: '2px solid var(--ok)' } : {}}
                    >
                        {iAmReady ? '✅ Ready! (click to unready)' : '👍 I\'m Ready'}
                    </button>
                )}
            </div>
        </div>
    )
}
