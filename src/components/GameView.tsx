import { useEffect, useState } from 'react'
import type { GameState } from '../hooks/useGame'
import type { Contracts } from '../hooks/useContracts'
import type { SessionActions, SessionResult, SessionStatus } from '../hooks/useSession'
import { Board } from './Board'
import { GameStatusBar } from './GameStatusBar'
import { GameLobby } from './GameLobby'
import { toast } from './Toast'
import './game.css'

export interface GameViewProps {
  game: GameState
  contracts: Contracts | null
  account: string | null
  gameId: string | null
  txPending: boolean
  onMovePending: (pending: boolean) => void
  onCreateGame?: (opponentAddress: string, stake: string) => void
  onAcceptGame?: (gameId: string) => void
  onSelectGame?: (gameId: string) => void
  pendingGames?: Array<{ gameId: string; challenger: string; stake: string }>
  showFlipCounts?: boolean
  onToggleFlipCounts?: () => void
  onRenewSession: (gameId: string) => Promise<SessionResult>
  onRevokeSession: () => Promise<SessionResult>
  session: SessionActions
}

type SessionChip = 'session' | 'expired' | 'direct'

function chipFromStatus(status: SessionStatus, inThisGame: boolean): SessionChip {
  if (status.active) return 'session'
  if (status.expired && inThisGame) return 'expired'
  return 'direct'
}

function shorten(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

const DEFAULT_BLACK = 0x0000000810000000n
const DEFAULT_WHITE = 0x0000001008000000n

export function GameView({
  game,
  contracts,
  account,
  gameId,
  txPending,
  onMovePending,
  onCreateGame,
  onAcceptGame,
  onSelectGame,
  pendingGames = [],
  showFlipCounts = false,
  onToggleFlipCounts,
  onRenewSession,
  onRevokeSession,
  session,
}: GameViewProps) {
  const [sessionChip, setSessionChip] = useState<SessionChip>('direct')
  const [renewing, setRenewing] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const [cancelled, setCancelled] = useState(false)

  useEffect(() => {
    setCancelled(false)
  }, [gameId])

  const inThisGame =
    account !== null &&
    (account.toLowerCase() === game.p1Addr.toLowerCase() ||
      account.toLowerCase() === game.p2Addr.toLowerCase())

  useEffect(() => {
    let cancelled = false
    if (gameId) {
      session.isSessionActive(gameId).then(status => {
        if (!cancelled) setSessionChip(chipFromStatus(status, inThisGame))
      })
    } else {
      setSessionChip('direct')
    }
    return () => {
      cancelled = true
    }
  }, [gameId, session, game.status, inThisGame])

  const handleRenew = async () => {
    if (!gameId || renewing) return
    setRenewing(true)
    try {
      const res = await onRenewSession(gameId)
      if (res.ok) {
        toast('success', 'Session renewed!')
        setSessionChip('session')
      } else if (res.reason !== 'not-deployed') {
        toast('info', 'Renewal failed, moves will use direct signing')
      }
    } finally {
      setRenewing(false)
    }
  }

  const handleRevoke = async () => {
    if (revoking) return
    setRevoking(true)
    try {
      const res = await onRevokeSession()
      if (res.ok) {
        toast('success', 'Session revoked')
        setSessionChip('direct')
      } else {
        toast('info', 'Revoke failed, session will expire on its own')
      }
    } finally {
      setRevoking(false)
    }
  }

  const opponent = account
    ? account.toLowerCase() === game.p1Addr.toLowerCase()
      ? game.p2Addr
      : game.p1Addr
    : ''

  // A PENDING game that hasn't been accepted yet has empty bitboards; show the
  // standard opening position instead of a blank grid.
  const previewBlack = game.blackBits === 0n && game.whiteBits === 0n ? DEFAULT_BLACK : game.blackBits
  const previewWhite = game.blackBits === 0n && game.whiteBits === 0n ? DEFAULT_WHITE : game.whiteBits

  const handleCellClick = async (position: number) => {
    if (!contracts || !gameId || !account) return
    onMovePending(true)
    let sessionSent = false
    try {
      const status = await session.isSessionActive(gameId)
      setSessionChip(chipFromStatus(status, inThisGame))
      if (status.active) {
        const res = await session.submitMove(gameId, position)
        if (res.ok) {
          sessionSent = true
          onMovePending(false)
        } else if (res.reason === 'reverted') {
          sessionSent = true
          onMovePending(false)
          toast('error', 'Move failed: transaction reverted')
        } else if (res.reason === 'funds') {
          toast('info', 'Session key out of gas, using direct signing')
        }
      }
      if (!sessionSent) {
        const tx = await contracts.game.makeMove(gameId, position)
        await tx.wait()
      }
    } catch {
      toast('error', 'Move failed: invalid or not your turn')
    } finally {
      if (!sessionSent) onMovePending(false)
    }
  }

  // A never-started FINISHED game (empty bitboards) can only have been
  // cancelled, which refunds the full stake with no fee.
  const cancelledGame =
    cancelled || (game.status === 2 && game.blackBits === 0n && game.whiteBits === 0n)

  return (
    <div className="game-view">
      <GameStatusBar
        blackToMove={game.blackToMove}
        blackCount={game.blackCount}
        whiteCount={game.whiteCount}
        txPending={txPending}
      />

      {game.activeGame && (
        <>
          <div className="game-view__info-row">
            <span className="game-view__game-id">
              {gameId ? `Game #${gameId}` : ''}
            </span>
            <button
              className="flip-toggle"
              aria-pressed={showFlipCounts}
              onClick={onToggleFlipCounts}
            >
              flip #{showFlipCounts ? 'on' : 'off'}
            </button>
            <span
              className="flip-toggle"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'default' }}
            >
              <span
                className="game-status-bar__dot"
                style={{
                  background:
                    sessionChip === 'session' ? '#2e9e44' : sessionChip === 'expired' ? '#d9a514' : '#9a938b',
                  border: `1px solid ${
                    sessionChip === 'session' ? '#1e7a33' : sessionChip === 'expired' ? '#a87f0a' : '#6e6a64'
                  }`,
                }}
              />
              {sessionChip === 'session' ? 'Session' : sessionChip === 'expired' ? 'Expired' : 'Direct'}
              {sessionChip === 'expired' && (
                <button
                  className="flip-toggle"
                  disabled={renewing}
                  onClick={handleRenew}
                >
                  Renew
                </button>
              )}
            </span>
            <span className="game-view__opponent">
              {opponent ? `vs ${shorten(opponent)}` : ''}
            </span>
          </div>
          <Board
            blackBits={game.blackBits}
            whiteBits={game.whiteBits}
            onCellClick={handleCellClick}
            legalMoves={game.legalMoves}
            isMyTurn={game.isMyTurn}
            txPending={txPending}
            blackToMove={game.blackToMove}
            showFlipCounts={showFlipCounts}
          />
        </>
      )}

      {game.status === 2 && (
        <div className="game-over">
          <div className="game-over__title">
            {game.blackCount > game.whiteCount
              ? 'Black Wins'
              : game.whiteCount > game.blackCount
                ? 'White Wins'
                : 'Draw'}
          </div>
          <div className="game-over__score">
            {game.blackCount} - {game.whiteCount}
          </div>
          <div className="game-over__detail">
            {cancelledGame
              ? 'Game cancelled - your full stake was refunded'
              : game.blackCount === game.whiteCount
                ? "It's a draw: both players got their stakes back (96% each)."
                : account &&
                    ((account.toLowerCase() === game.p1Addr.toLowerCase() && game.blackCount > game.whiteCount) ||
                      (account.toLowerCase() === game.p2Addr.toLowerCase() && game.whiteCount > game.blackCount))
                  ? 'You won! YYG has been sent to your wallet.'
                  : 'You lost. Better luck next time.'}
          </div>
          {(sessionChip === 'session' || sessionChip === 'expired') && (
            <button
              className="flip-toggle"
              disabled={revoking}
              onClick={handleRevoke}
            >
              Revoke session
            </button>
          )}
        </div>
      )}

      {game.status === 0 && account && account.toLowerCase() === game.p1Addr.toLowerCase() && (
        <button
          className="button-secondary"
          style={{ marginTop: 'var(--space-lg)', width: '100%', maxWidth: '480px' }}
          onClick={async () => {
            if (!contracts || !gameId) return
            onMovePending(true)
            try {
              const tx = await contracts.game.cancelGame(gameId)
              await tx.wait()
              setCancelled(true)
              toast('success', 'Game cancelled, stake returned')
            } catch {
              toast('error', 'Failed to cancel game')
            } finally {
              onMovePending(false)
            }
          }}
        >
          Cancel Game
        </button>
      )}

      {!game.activeGame && game.status !== 2 && (
        <>
          <div className="game-view__preview-board">
            <span><b></b></span>
            <Board
              blackBits={previewBlack}
              whiteBits={previewWhite}
              legalMoves={[]}
              isMyTurn={false}
              txPending={false}
            />
          </div>
          <GameLobby
            onCreateGame={onCreateGame}
            onAcceptGame={onAcceptGame}
            onSelectGame={onSelectGame}
            disabled={txPending}
            pendingGames={pendingGames}
          />
        </>
      )}
    </div>
  )
}
