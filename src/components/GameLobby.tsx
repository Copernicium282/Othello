import { useState } from 'react'
import './game.css'

export interface GameLobbyProps {
  onCreateGame?: (opponentAddress: string, stake: string) => void
  onAcceptGame?: (gameId: string) => void
  onSelectGame?: (gameId: string) => void
  disabled?: boolean
  pendingGames?: Array<{ gameId: string; challenger: string; stake: string }>
  activeGames?: Array<{ gameId: string; black: string; white: string; stake: string }>
  beginnerProtection?: {
    active: boolean
    matchesPlayed: number
    onToggle: (enabled: boolean) => Promise<void>
    toggling?: boolean
  }
}

const MIN_STAKE = 10

function shortenAddress(addr: string): string {
  if (!addr || addr.length <= 10) return addr || ''
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function GameLobby({
  onCreateGame,
  onAcceptGame,
  onSelectGame,
  disabled = false,
  pendingGames = [],
  activeGames = [],
  beginnerProtection,
}: GameLobbyProps) {
  const [opponentAddress, setOpponentAddress] = useState('')
  const [stake, setStake] = useState('')
  const [gameId, setGameId] = useState('')

  return (
    <div className="game-lobby">
      {beginnerProtection && (
        <div className="game-lobby__card" style={{ background: 'var(--color-bg-secondary, #fafafa)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="game-lobby__eyebrow" style={{ margin: 0 }}>Beginner Protection (Unrated)</span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                padding: '2px 8px',
                borderRadius: '4px',
                background: beginnerProtection.active ? 'rgba(46, 158, 68, 0.15)' : 'rgba(100, 100, 100, 0.15)',
                color: beginnerProtection.active ? '#1e7a33' : '#666',
                border: `1px solid ${beginnerProtection.active ? '#2e9e44' : '#999'}`,
              }}
            >
              {beginnerProtection.active ? 'Active' : 'Disabled'}
            </span>
          </div>
          <p style={{ fontSize: '13px', margin: 0, color: 'var(--color-ink-muted, #555)', lineHeight: 1.4 }}>
            {beginnerProtection.matchesPlayed < 5 ? (
              <>
                Unrated provisional matches: <strong>{beginnerProtection.matchesPlayed} / 5</strong> played. Your ELO remains protected during your first 5 matches.
              </>
            ) : (
              <>
                You have completed <strong>{beginnerProtection.matchesPlayed}</strong> matches. You are playing fully rated competitive matches!
              </>
            )}
          </p>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
            <button
              type="button"
              className="game-lobby__button game-lobby__button--yang"
              style={{ width: 'auto', padding: '6px 14px', fontSize: '12px' }}
              disabled={disabled || beginnerProtection.toggling}
              onClick={() => beginnerProtection.onToggle(!beginnerProtection.active)}
            >
              {beginnerProtection.toggling
                ? 'Updating...'
                : beginnerProtection.active
                  ? 'Disable Protection (Play Rated Now)'
                  : 'Enable Protection (Keep Unrated)'}
            </button>
          </div>
        </div>
      )}

      {beginnerProtection && <div className="game-lobby__divider" />}

      {/* Challenge flow */}
      <div className="game-lobby__card">
        <span className="game-lobby__eyebrow">Challenge</span>
        <div className="game-lobby__field">
          <label className="game-lobby__label">Opponent Address</label>
          <input
            className="game-lobby__input"
            type="text"
            placeholder="0x..."
            value={opponentAddress}
            onChange={(e) => setOpponentAddress(e.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="game-lobby__field">
          <label className="game-lobby__label">Stake (YYG)</label>
          <input
            className="game-lobby__input"
            type="text"
            placeholder={`${MIN_STAKE} YYG min`}
            value={stake}
            onChange={(e) => setStake(e.target.value)}
            disabled={disabled}
          />
          <span className="game-lobby__hint">Minimum stake: {MIN_STAKE} YYG</span>
        </div>
        <button
          className="game-lobby__button game-lobby__button--primary"
          disabled={disabled || !opponentAddress || !stake}
          onClick={() => onCreateGame?.(opponentAddress, stake)}
        >
          Create Game
        </button>
      </div>

      <div className="game-lobby__divider" />

      {/* Accept & Resume flow */}
      <div className="game-lobby__card">
        <span className="game-lobby__eyebrow">Accept or Resume Game</span>
        <div className="game-lobby__field">
          <label className="game-lobby__label">Game ID</label>
          <input
            className="game-lobby__input"
            type="text"
            placeholder="Enter game ID"
            value={gameId}
            onChange={(e) => setGameId(e.target.value)}
            disabled={disabled}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="game-lobby__button game-lobby__button--yang"
            style={{ flex: 1 }}
            disabled={disabled || !gameId}
            onClick={() => onAcceptGame?.(gameId)}
          >
            Accept Game
          </button>
          <button
            className="game-lobby__button"
            style={{ flex: 1, background: 'var(--color-yin)', color: '#fff' }}
            disabled={disabled || !gameId}
            onClick={() => onSelectGame?.(gameId)}
          >
            Open Game #{gameId || '...'}
          </button>
        </div>
      </div>

      <div className="game-lobby__divider" />

      {/* Browse pending games */}
      <div className="game-lobby__card">
        <span className="game-lobby__eyebrow">Browse Pending Games</span>
        {pendingGames.length > 0 && (
          <div style={{ marginTop: 'var(--space-md)' }}>
            {pendingGames.map(pg => (
              <div key={pg.gameId} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 0', borderBottom: '1px solid var(--color-hairline-medium)',
                fontFamily: 'var(--font-mono)', fontSize: '13px',
              }}>
                <div>
                  <span style={{ color: 'var(--color-slate)' }}>#{pg.gameId}</span>{' '}
                  <span style={{ color: 'var(--color-ink)' }}>{shortenAddress(pg.challenger)}</span>{' '}
                  <span style={{ color: 'var(--color-yin)' }}>{pg.stake} YYG</span>
                </div>
                <button
                  className="game-lobby__button game-lobby__button--yang"
                  disabled={disabled}
                  onClick={() => onAcceptGame?.(pg.gameId)}
                  style={{ width: 'auto', padding: '6px 12px', marginTop: 0, fontSize: '12px' }}
                >
                  Accept
                </button>
              </div>
            ))}
          </div>
        )}
        {pendingGames.length === 0 && (
          <div style={{ marginTop: 'var(--space-md)', color: 'var(--color-slate)', fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
            No pending games found.
          </div>
        )}
      </div>

      <div className="game-lobby__divider" />

      <div className="game-lobby__card">
        <span className="game-lobby__eyebrow">Active Games (Spectate)</span>
        {activeGames.length > 0 ? (
          <div style={{ marginTop: 'var(--space-md)' }}>
            {activeGames.map(ag => (
              <div key={ag.gameId} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 0', borderBottom: '1px solid var(--color-hairline-medium)',
                fontFamily: 'var(--font-mono)', fontSize: '13px',
              }}>
                <div>
                  <span style={{ color: 'var(--color-slate)' }}>#{ag.gameId}</span>{' '}
                  <span style={{ color: 'var(--color-ink)' }}>{shortenAddress(ag.black)}</span>
                  <span style={{ color: 'var(--color-slate)' }}> vs </span>
                  <span style={{ color: 'var(--color-ink)' }}>{shortenAddress(ag.white)}</span>{' '}
                  <span style={{ color: 'var(--color-yin)' }}>{ag.stake} YYG</span>
                </div>
                <button
                  className="game-lobby__button"
                  disabled={disabled}
                  onClick={() => onSelectGame?.(ag.gameId)}
                  style={{ width: 'auto', padding: '6px 12px', marginTop: 0, fontSize: '12px' }}
                >
                  Spectate
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ marginTop: 'var(--space-md)', color: 'var(--color-slate)', fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
            No active games found.
          </div>
        )}
      </div>
    </div>
  )
}
