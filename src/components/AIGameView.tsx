import { useAIGame } from '../hooks/useAIGame'
import { Board } from './Board'
import type { Difficulty } from '../lib/ai'
import './AIGameView.css'

const DIFFICULTIES: { id: Difficulty; label: string; desc: string }[] = [
  { id: 'easy', label: 'Easy', desc: 'Random moves, depth 2' },
  { id: 'medium', label: 'Medium', desc: 'Smart moves, depth 4' },
  { id: 'hard', label: 'Hard', desc: 'Alpha-beta, depth 8' },
  { id: 'expert', label: 'Expert', desc: 'Deep search, depth 16' },
]

export function AIGameView({
  showFlipCounts = false,
  onToggleFlipCounts,
}: {
  showFlipCounts?: boolean
  onToggleFlipCounts?: () => void
}) {
  const { state, startGame, playerMove } = useAIGame()

  return (
    <div className="ai-game-view">
      {state.gameStatus === 'idle' ? (
        <div className="ai-game-view__setup">
          <div className="ai-game-view__eyebrow">Play vs AI</div>
          <div className="ai-game-view__subtitle">No wallet needed. No stakes. Just play.</div>
          <div className="ai-game-view__difficulties">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.id}
                className="ai-game-view__diff-btn"
                onClick={() => startGame(d.id)}
              >
                <span className="ai-game-view__diff-label">{d.label}</span>
                <span className="ai-game-view__diff-desc">{d.desc}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="ai-game-view__board-area">
          <div className="ai-game-view__info-row">
            <span className="ai-game-view__difficulty-badge">
              AI: {DIFFICULTIES.find(d => d.id === state.difficulty)?.label}
            </span>
            <button
              className="flip-toggle"
              aria-pressed={showFlipCounts}
              onClick={onToggleFlipCounts}
            >
              flip #{showFlipCounts ? 'on' : 'off'}
            </button>
            <span className="ai-game-view__turn-info">
              {state.gameStatus === 'thinking' && 'AI thinking...'}
              {state.gameStatus === 'playing' && 'Your turn'}
              {state.gameStatus === 'gameover' && (
                state.result === 'win' ? 'You win!' : state.result === 'loss' ? 'AI wins!' : 'Draw!'
              )}
            </span>
          </div>
          <Board
            blackBits={state.blackBits}
            whiteBits={state.whiteBits}
            legalMoves={state.legalMoves}
            onCellClick={state.gameStatus === 'playing' ? playerMove : undefined}
            isMyTurn={state.gameStatus === 'playing'}
            txPending={state.gameStatus === 'thinking'}
            blackToMove={state.playerIsBlack ? state.gameStatus === 'playing' : state.gameStatus !== 'playing'}
            showFlipCounts={showFlipCounts}
          />
          <div className="ai-game-view__counts">
            <span className="ai-game-view__count">
              <span className="ai-game-view__count-dot ai-game-view__count-dot--yin"></span>
              <span className="ai-game-view__count-num">{state.playerCount}</span>
              <span className="ai-game-view__count-label">You</span>
            </span>
            <span className="ai-game-view__count">
              <span className="ai-game-view__count-dot ai-game-view__count-dot--yang"></span>
              <span className="ai-game-view__count-num">{state.aiCount}</span>
              <span className="ai-game-view__count-label">AI</span>
            </span>
          </div>
          {state.gameStatus === 'gameover' && (
            <div className="ai-game-view__gameover">
              <div className="ai-game-view__gameover-title">
                {state.result === 'win' ? 'Victory!' : state.result === 'loss' ? 'Defeated' : 'Draw'}
              </div>
              <div className="ai-game-view__gameover-score">
                {state.playerCount} vs {state.aiCount}
              </div>
              <div className="ai-game-view__gameover-detail">
                {state.moveHistory.length} moves played
              </div>
            </div>
          )}
          <button className="ai-game-view__new-game-btn" onClick={() => startGame(state.difficulty)}>
            {state.gameStatus === 'gameover' ? 'Play Again' : 'Restart'}
          </button>
        </div>
      )}
    </div>
  )
}
