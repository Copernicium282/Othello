import { useState } from 'react'
import './game.css'

export interface GameLobbyProps {
  onCreateGame?: (opponentAddress: string, stake: string) => void
  onAcceptGame?: (gameId: string) => void
  disabled?: boolean
  pendingGames?: Array<{ gameId: string; challenger: string; stake: string }>
}

const MIN_STAKE = 10

function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function GameLobby({ onCreateGame, onAcceptGame, disabled = false, pendingGames = [] }: GameLobbyProps) {
  const [opponentAddress, setOpponentAddress] = useState('')
  const [stake, setStake] = useState('')
  const [gameId, setGameId] = useState('')

  return (
    <div className="game-lobby">
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

      {/* Accept flow */}
      <div className="game-lobby__card">
        <span className="game-lobby__eyebrow">Accept</span>
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
        <button
          className="game-lobby__button game-lobby__button--yang"
          disabled={disabled || !gameId}
          onClick={() => onAcceptGame?.(gameId)}
        >
          Accept Game
        </button>
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
    </div>
  )
}
