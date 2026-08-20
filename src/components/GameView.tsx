import type { GameState } from '../hooks/useGame'
import type { Contracts } from '../hooks/useContracts'
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
  pendingGames?: Array<{ gameId: string; challenger: string; stake: string }>
  showFlipCounts?: boolean
  onToggleFlipCounts?: () => void
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
  pendingGames = [],
  showFlipCounts = false,
  onToggleFlipCounts,
}: GameViewProps) {
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
    try {
      const tx = await contracts.game.makeMove(gameId, position)
      await tx.wait()
    } catch {
      toast('error', 'Move failed: invalid or not your turn')
    } finally {
      onMovePending(false)
    }
  }

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
            {game.blackCount === game.whiteCount
              ? "It's a draw: both players got their stakes back (96% each)."
              : account &&
                  ((account.toLowerCase() === game.p1Addr.toLowerCase() && game.blackCount > game.whiteCount) ||
                    (account.toLowerCase() === game.p2Addr.toLowerCase() && game.whiteCount > game.blackCount))
                ? 'You won! YYG has been sent to your wallet.'
                : 'You lost. Better luck next time.'}
          </div>
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
            disabled={txPending}
            pendingGames={pendingGames}
          />
        </>
      )}
    </div>
  )
}
