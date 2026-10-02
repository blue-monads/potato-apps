import { useState, useRef } from 'react'
import { useNavigate } from 'react-router'
import { BASE_PATH } from '../lib/base'
import { roomsApi, getWsToken } from '../lib/api'

const COLORS = ['#7c5cff', '#2ee59d', '#ffb84d', '#e5484d', '#2f7bff', '#ff6bd6']

export default function Home() {
    const navigate = useNavigate()
    const [tab, setTab] = useState<'home' | 'create' | 'join'>('home')
    const [roomName, setRoomName] = useState('')
    const [joinCode, setJoinCode] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const connIdRef = useRef('')
    const connTokenRef = useRef('')

    const ensureWsConn = async () => {
        if (connIdRef.current) return connIdRef.current
        const res = await getWsToken()
        connIdRef.current = res.conn_id
        connTokenRef.current = res.token
        return res.conn_id
    }

    const handleCreate = async () => {
        if (!roomName.trim()) { setError('Enter a room name'); return }
        setLoading(true); setError('')
        try {
            const conn_id = await ensureWsConn()
            const room = await roomsApi.create({ name: roomName.trim(), conn_id, max_players: 4 })
            // TV is default screen when creating a room:
            sessionStorage.setItem('pr_conn_id', conn_id)
            sessionStorage.setItem('pr_ws_token', connTokenRef.current)
            navigate(`${BASE_PATH}tv/${room.id}?token=${encodeURIComponent(connTokenRef.current)}`)
        } catch (e: any) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }

    const handleJoinByCode = async () => {
        const code = joinCode.trim().toUpperCase()
        if (code.length !== 5) { setError('Enter a valid 5-letter code'); return }
        setLoading(true); setError('')
        try {
            const conn_id = await ensureWsConn()
            const room = await roomsApi.joinByCode(code)
            const joined = await roomsApi.join(room.id, conn_id)
            sessionStorage.setItem('pr_conn_id', conn_id)
            sessionStorage.setItem('pr_ws_token', connTokenRef.current)
            navigate(`${BASE_PATH}lobby/${joined.id}`)
        } catch (e: any) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center p-6" style={{ background: 'var(--bg)', color: 'var(--txt)' }}>
            {/* logo */}
            <div className="mb-8 text-center">
                <div className="flex gap-2 justify-center mb-2 text-5xl select-none">
                    {['🥔', '🥔', '🥔'].map((e, i) => (
                        <span key={i} style={{ color: COLORS[i % COLORS.length], filter: 'drop-shadow(0 0 12px currentColor)' }}>{e}</span>
                    ))}
                </div>
                <h1 className="font-black text-3xl tracking-widest uppercase" style={{ letterSpacing: '0.3em' }}>Potato Race</h1>
                <p className="text-sm mt-1" style={{ color: 'var(--mut)' }}>couch party racing</p>
            </div>

            {/* card */}
            <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
                {/* tabs */}
                <div className="flex gap-2 rounded-xl p-1" style={{ background: 'var(--bg)' }}>
                    {(['home', 'create', 'join'] as const).map(t => (
                        <button
                            key={t}
                            onClick={() => { setTab(t); setError('') }}
                            className="flex-1 py-2 rounded-lg text-sm font-bold capitalize transition-all"
                            style={{
                                background: tab === t ? 'var(--acc)' : 'none',
                                color: tab === t ? '#fff' : 'var(--mut)',
                                border: 'none',
                                cursor: 'pointer',
                            }}
                        >
                            {t === 'home' ? '🏠 Home' : t === 'create' ? '📺 Host TV' : '🎮 Join'}
                        </button>
                    ))}
                </div>

                {/* home tab */}
                {tab === 'home' && (
                    <div className="flex flex-col gap-3">
                        <p className="text-center text-sm" style={{ color: 'var(--mut)' }}>
                            Host a TV display on this screen, or join with a room code to turn this device into a controller!
                        </p>
                        <button className="btn" onClick={() => setTab('create')}>📺 Host TV Screen</button>
                        <button className="btn ghost" onClick={() => setTab('join')}>🎮 Join as Player</button>
                    </div>
                )}

                {/* create tab */}
                {tab === 'create' && (
                    <div className="flex flex-col gap-3">
                        <label className="flex flex-col gap-1">
                            <span className="text-xs font-bold uppercase" style={{ color: 'var(--mut)', letterSpacing: '0.1em' }}>Room name</span>
                            <input
                                autoFocus
                                value={roomName}
                                onChange={e => setRoomName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                                placeholder="my potato den"
                                maxLength={40}
                            />
                        </label>
                        <p className="text-xs" style={{ color: 'var(--mut)' }}>
                            This screen will become the TV display. Players will join with their phones/controllers!
                        </p>
                        <button className="btn" disabled={loading} onClick={handleCreate}>
                            {loading ? 'Creating…' : '📺 Create TV Screen'}
                        </button>
                    </div>
                )}

                {/* join tab */}
                {tab === 'join' && (
                    <div className="flex flex-col gap-3">
                        <label className="flex flex-col gap-1">
                            <span className="text-xs font-bold uppercase" style={{ color: 'var(--mut)', letterSpacing: '0.1em' }}>Room code</span>
                            <input
                                autoFocus
                                value={joinCode}
                                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                                onKeyDown={e => e.key === 'Enter' && handleJoinByCode()}
                                placeholder="XKCD9"
                                maxLength={5}
                                style={{ textAlign: 'center', fontSize: 28, fontWeight: 800, letterSpacing: '0.3em' }}
                            />
                        </label>
                        <button className="btn" disabled={loading} onClick={handleJoinByCode}>
                            {loading ? 'Joining…' : '🔑 Join Room'}
                        </button>
                    </div>
                )}

                {error && (
                    <p className="text-sm text-center" style={{ color: '#ff6b81' }}>{error}</p>
                )}
            </div>
        </div>
    )
}
