import { PieceYin } from './PieceYin';
import { PieceYang } from './PieceYang';
import './board.css';

export interface BoardProps {
  blackBits: bigint;
  whiteBits: bigint;
  onCellClick?: (position: number) => void;
  legalMoves?: number[];
  isMyTurn?: boolean;
  txPending?: boolean;
}

export function Board({
  blackBits,
  whiteBits,
  onCellClick,
  legalMoves = [],
  isMyTurn = false,
  txPending = false,
}: BoardProps) {
  const legalSet = new Set(legalMoves);

  const cells = Array.from({ length: 64 }, (_, i) => {
    const row = Math.floor(i / 8);
    const col = i % 8;
    const isLight = (row + col) % 2 === 0;
    const hasBlack = (blackBits >> BigInt(i)) & 1n;
    const hasWhite = (whiteBits >> BigInt(i)) & 1n;
    const isLegal = legalSet.has(i);

    const classNames = [
      'board-cell',
      isLight ? 'board-cell--light' : 'board-cell--dark',
      isLegal && isMyTurn ? 'board-cell--legal' : '',
      !txPending && isMyTurn && onCellClick ? 'board-cell--clickable' : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div
        key={i}
        className={classNames}
        onClick={
          !txPending && isMyTurn && onCellClick && isLegal
            ? () => onCellClick(i)
            : undefined
        }
      >
        {hasBlack ? (
          <div className="piece-wrapper">
            <PieceYin />
          </div>
        ) : hasWhite ? (
          <div className="piece-wrapper">
            <PieceYang />
          </div>
        ) : null}
      </div>
    );
  });

  return (
    <div className={`board-container${txPending ? ' board-container--pending' : ''}`}>
      {cells}
    </div>
  );
}

export default Board;
