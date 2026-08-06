import './game.css';

export interface GameStatusBarProps {
  blackToMove: boolean;
  blackCount: number;
  whiteCount: number;
  txPending?: boolean;
}

export function GameStatusBar({
  blackToMove,
  blackCount,
  whiteCount,
  txPending = false,
}: GameStatusBarProps) {
  return (
    <div className="game-status-bar">
      <div className="game-status-bar__turn">
        <span
          className={`game-status-bar__dot ${
            blackToMove ? 'game-status-bar__dot--yin' : 'game-status-bar__dot--yang'
          }`}
        />
        <span>{blackToMove ? 'Black' : 'White'} to move</span>
      </div>
      <div className="game-status-bar__counts">
        <div className="game-status-bar__count">
          <span className="game-status-bar__count-num game-status-bar__count-num--yin">
            {blackCount}
          </span>
          <span className="game-status-bar__count-label">Black</span>
        </div>
        <span style={{ color: '#4a4642' }}>|</span>
        <div className="game-status-bar__count">
          <span className="game-status-bar__count-num game-status-bar__count-num--yang">
            {whiteCount}
          </span>
          <span className="game-status-bar__count-label">White</span>
        </div>
      </div>
      {txPending && <span className="game-status-bar__tx-badge">TX Pending...</span>}
    </div>
  );
}

export default GameStatusBar;
